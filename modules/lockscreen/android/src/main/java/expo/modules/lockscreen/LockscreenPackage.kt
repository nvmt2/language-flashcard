package expo.modules.lockscreen

import android.app.Activity
import android.app.NotificationManager
import android.content.Context
import android.os.Bundle
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
    allowIfTicket(activity)
    activity.getSystemService(NotificationManager::class.java)?.cancel(LockscreenService.ID_CARD)
  }

  override fun onPause(activity: Activity) {
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

    /** Called by the service on SCREEN_ON (main thread), before startActivity. */
    fun allowCurrent() {
      current?.get()?.let { allow(it) }
    }

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
