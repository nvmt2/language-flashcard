package expo.modules.lockscreen

import android.app.Activity
import android.app.NotificationManager
import android.content.Context
import android.os.Bundle
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
    activity?.let { allowIfTicket(it) }
  }

  override fun onResume(activity: Activity) {
    allowIfTicket(activity)
    activity.getSystemService(NotificationManager::class.java)?.cancel(LockscreenService.ID_CARD)
  }

  override fun onPause(activity: Activity) {
    clear(activity)
  }

  private fun allowIfTicket(activity: Activity) {
    if (!LockscreenModule.supported) return
    if (LockscreenPrefs.isEnabled(activity) && LockscreenPrefs.consumePendingShow(activity)) {
      activity.setShowWhenLocked(true)
      activity.setTurnScreenOn(true)
    }
  }

  companion object {
    fun clear(activity: Activity) {
      if (!LockscreenModule.supported) return
      activity.setShowWhenLocked(false)
      activity.setTurnScreenOn(false)
    }
  }
}
