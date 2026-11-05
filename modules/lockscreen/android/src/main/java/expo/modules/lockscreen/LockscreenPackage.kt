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
 * Lets MainActivity appear over the keyguard while the feature is enabled.
 * SPIKE: applied to the whole activity; the final version should only do this
 * when the activity is opened from the SCREEN_ON path.
 */
class LockscreenActivityListener : ReactActivityLifecycleListener {
  override fun onCreate(activity: Activity?, savedInstanceState: Bundle?) {
    activity?.let { apply(it) }
  }

  override fun onResume(activity: Activity) {
    apply(activity)
    activity.getSystemService(NotificationManager::class.java)?.cancel(LockscreenService.ID_CARD)
  }

  private fun apply(activity: Activity) {
    if (!LockscreenModule.supported) return
    val enabled = LockscreenPrefs.isEnabled(activity)
    activity.setShowWhenLocked(enabled)
    activity.setTurnScreenOn(enabled)
  }
}
