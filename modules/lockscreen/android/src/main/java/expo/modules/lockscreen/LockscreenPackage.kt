package expo.modules.lockscreen

import android.app.Activity
import android.app.KeyguardManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import java.lang.ref.WeakReference
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

class LockscreenPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> =
    listOf(LockscreenActivityListener())
}

/**
 * Lets MainActivity appear over the keyguard only after the service's SCREEN_OFF / SCREEN_ON
 * (one-shot ticket in LockscreenPrefs). Normal launches never show over the lock. The flag
 * is cleared when the user leaves the app while the phone is unlocked and awake, when the
 * phone is unlocked (USER_PRESENT), and when the card is dismissed.
 */
class LockscreenActivityListener : ReactActivityLifecycleListener {
  override fun onCreate(activity: Activity?, savedInstanceState: Bundle?) {
    activity?.let {
      current = WeakReference(it)
      allowIfTicket(it)
    }
  }

  override fun onResume(activity: Activity) {
    current = WeakReference(activity)
    resumed = true
    allowIfTicket(activity)
    activity.getSystemService(NotificationManager::class.java)?.cancel(LockscreenService.ID_CARD)
  }

  override fun onPause(activity: Activity) {
    resumed = false
    // Only a real "leave the app" clears the flag. Pauses caused by the display going off
    // (the card was just opened for the next SCREEN_ON) or happening over the keyguard
    // (Android may pause with reason "sleep" while the screen turns on, notification shade,
    // PIN bouncer) must keep the card above the lock.
    if (isInteractive(activity) && !isLocked(activity)) clear(activity)
  }

  override fun onDestroy(activity: Activity) {
    if (current?.get() === activity) {
      current = null
      // The prepared card is gone: let the next SCREEN_ON open it again.
      preparedOnScreenOff = false
    }
  }

  override fun onNewIntent(intent: Intent?): Boolean {
    current?.get()?.let { allowIfTicket(it, intent) }
    return false
  }

  private fun allowIfTicket(activity: Activity, intent: Intent? = activity.intent) {
    if (!LockscreenModule.supported || !LockscreenPrefs.isEnabled(activity)) return
    val wake = LockscreenPrefs.consumePendingShow(intent) ?: return
    allow(activity, wake)
    if (!wake) preparedOnScreenOff = true
  }

  companion object {
    /**
     * The live MainActivity, if any. An activity that already exists behind the keyguard is
     * not resumed until unlock, so the service must set the flag on it *before* bringing it
     * to the front (otherwise the card only appears after unlocking).
     */
    @Volatile
    private var current: WeakReference<Activity>? = null

    @Volatile
    private var resumed = false
    private val handler = Handler(Looper.getMainLooper())

    /**
     * True once the card opened on SCREEN_OFF has received its ticket, i.e. it is on top and
     * allowed over the keyguard. The service then skips the SCREEN_ON launch.
     */
    @Volatile
    var preparedOnScreenOff = false
      private set

    /**
     * Called by the service (main thread) before startActivity. Fail-closed: if the launch
     * does not land within the TTL (blocked, ignored), the flag is revoked again.
     * - `wake` (SCREEN_ON): the card must come to the foreground.
     * - not `wake` (SCREEN_OFF): the activity cannot resume while the display is off, so
     *   check that the launch delivered its ticket instead.
     */
    fun allowCurrent(ctx: Context, wake: Boolean) {
      if (!LockscreenModule.supported || !LockscreenPrefs.isEnabled(ctx)) return
      val activity = current?.get() ?: return
      allow(activity, wake)
      handler.postDelayed({
        val landed = if (wake) resumed else !LockscreenPrefs.hasPendingShow()
        if (!landed) clear(activity)
      }, REVOKE_AFTER_MS)
    }

    /** Called by the service when the launch failed, or when the phone is unlocked. */
    fun clearCurrent() {
      current?.get()?.let { clear(it) }
    }

    private const val REVOKE_AFTER_MS = 5_000L

    private fun allow(activity: Activity, wake: Boolean) {
      activity.setShowWhenLocked(true)
      // Never on SCREEN_OFF: turning the screen on there would bring it straight back.
      activity.setTurnScreenOn(wake)
    }

    fun clear(activity: Activity) {
      if (!LockscreenModule.supported) return
      preparedOnScreenOff = false
      activity.setShowWhenLocked(false)
      activity.setTurnScreenOn(false)
    }

    private fun isInteractive(ctx: Context) =
      ctx.getSystemService(PowerManager::class.java)?.isInteractive ?: true

    private fun isLocked(ctx: Context) =
      ctx.getSystemService(KeyguardManager::class.java)?.isKeyguardLocked ?: false
  }
}
