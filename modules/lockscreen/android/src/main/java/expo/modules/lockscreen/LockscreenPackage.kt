package expo.modules.lockscreen

import android.app.Activity
import android.app.NotificationManager
import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import java.lang.ref.WeakReference
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

class LockscreenPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> =
    listOf(LockscreenActivityListener())
}

/**
 * Lets MainActivity appear over the keyguard only right after the service's SCREEN_ON
 * (one-shot ticket in LockscreenPrefs). Normal launches never show over the lock, and the
 * flag is cleared as soon as the activity leaves the foreground.
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
    clear(activity)
  }

  override fun onDestroy(activity: Activity) {
    if (current?.get() === activity) current = null
  }

  private fun allowIfTicket(activity: Activity) {
    if (!LockscreenModule.supported) return
    if (LockscreenPrefs.isEnabled(activity) && LockscreenPrefs.consumePendingShow(activity)) allow(activity)
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
     * Called by the service on SCREEN_ON (main thread), before startActivity.
     * Fail-closed: if the card has not come to the foreground within the TTL
     * (launch blocked, user ignored it), the flag is revoked again.
     */
    fun allowCurrent(ctx: Context) {
      if (!LockscreenModule.supported || !LockscreenPrefs.isEnabled(ctx)) return
      val activity = current?.get() ?: return
      allow(activity)
      handler.postDelayed({ if (!resumed) clear(activity) }, REVOKE_AFTER_MS)
    }

    /** Called by the service when the launch failed. */
    fun clearCurrent() {
      current?.get()?.let { clear(it) }
    }

    private const val REVOKE_AFTER_MS = 5_000L

    private fun allow(activity: Activity) {
      activity.setShowWhenLocked(true)
      activity.setTurnScreenOn(true)
    }

    fun clear(activity: Activity) {
      if (!LockscreenModule.supported) return
      activity.setShowWhenLocked(false)
      activity.setTurnScreenOn(false)
    }
  }
}
