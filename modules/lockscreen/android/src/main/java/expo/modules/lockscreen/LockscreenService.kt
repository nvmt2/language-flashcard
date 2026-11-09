package expo.modules.lockscreen

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log

/**
 * Foreground service that listens for SCREEN_OFF / SCREEN_ON (only deliverable to
 * runtime-registered receivers) and opens the /lockscreen route over the keyguard.
 *
 * In activity mode the card is opened on SCREEN_OFF, while the display is dark, so it is
 * already on top of the keyguard when the screen turns on: no frame of bare wallpaper
 * first. SCREEN_ON is only a fallback for when that launch did not land.
 */
class LockscreenService : Service() {
  private var receiver: BroadcastReceiver? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    createChannels()
    val notification = Notification.Builder(this, CHANNEL_SERVICE)
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle("Lockscreen English đang chạy")
      .setContentText("Bật màn hình để học một câu")
      .setOngoing(true)
      .setContentIntent(launchPendingIntent())
      .build()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(ID_SERVICE, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(ID_SERVICE, notification)
    }

    val r = object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
          Intent.ACTION_SCREEN_OFF -> onScreenOff()
          Intent.ACTION_SCREEN_ON -> onScreenOn()
          // Unlocked: the card no longer needs to show over the keyguard.
          Intent.ACTION_USER_PRESENT -> LockscreenActivityListener.clearCurrent()
        }
      }
    }
    val filter = IntentFilter().apply {
      addAction(Intent.ACTION_SCREEN_OFF)
      addAction(Intent.ACTION_SCREEN_ON)
      addAction(Intent.ACTION_USER_PRESENT)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(r, filter, Context.RECEIVER_EXPORTED)
    } else {
      registerReceiver(r, filter)
    }
    receiver = r
    running = true
    Log.i(TAG, "service started")
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

  override fun onDestroy() {
    receiver?.let { unregisterReceiver(it) }
    receiver = null
    running = false
    Log.i(TAG, "service stopped")
    super.onDestroy()
  }

  /**
   * Opens the card while the display is off, without turning it back on, so the next
   * SCREEN_ON shows the card at once. Full-screen-intent mode keeps the SCREEN_ON flow:
   * an alarm-style notification posted now would wake the screen.
   */
  private fun onScreenOff() {
    if (!LockscreenPrefs.isEnabled(this) || LockscreenPrefs.mode(this) != LockscreenPrefs.MODE_ACTIVITY) return
    val now = System.currentTimeMillis()
    LockscreenPrefs.setPendingShow(now, wake = false)
    LockscreenActivityListener.allowCurrent(this, wake = false)
    Log.i(TAG, "SCREEN_OFF at $now, preparing the card")
    try {
      startActivity(LockscreenPrefs.deepLinkIntent(this))
      LockscreenPrefs.setLastError(this, null)
    } catch (e: Exception) {
      Log.e(TAG, "failed to prepare lockscreen", e)
      LockscreenActivityListener.clearCurrent()
      LockscreenPrefs.setLastError(this, "${e.javaClass.simpleName}: ${e.message}")
    }
  }

  private fun onScreenOn() {
    val now = System.currentTimeMillis()
    LockscreenPrefs.setLastScreenOnAt(this, now)
    val mode = LockscreenPrefs.mode(this)
    if (mode == LockscreenPrefs.MODE_ACTIVITY && LockscreenActivityListener.preparedOnScreenOff) {
      Log.i(TAG, "SCREEN_ON at $now, card already on top")
      return
    }
    LockscreenPrefs.setPendingShow(now, wake = true)
    LockscreenActivityListener.allowCurrent(this, wake = true)
    Log.i(TAG, "SCREEN_ON at $now, mode=$mode")
    try {
      if (mode == LockscreenPrefs.MODE_FULL_SCREEN_INTENT) postFullScreenIntent()
      else startActivity(LockscreenPrefs.deepLinkIntent(this))
      LockscreenPrefs.setLastError(this, null)
    } catch (e: Exception) {
      Log.e(TAG, "failed to open lockscreen", e)
      LockscreenActivityListener.clearCurrent()
      LockscreenPrefs.setLastError(this, "${e.javaClass.simpleName}: ${e.message}")
    }
  }

  private fun postFullScreenIntent() {
    val pi = PendingIntent.getActivity(
      this, 1, LockscreenPrefs.deepLinkIntent(this),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    val n = Notification.Builder(this, CHANNEL_CARD)
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle("Lockscreen English")
      .setContentText("Chạm để học một câu")
      .setCategory(Notification.CATEGORY_ALARM)
      .setFullScreenIntent(pi, true)
      .setContentIntent(pi)
      .setAutoCancel(true)
      .build()
    getSystemService(NotificationManager::class.java).notify(ID_CARD, n)
  }

  private fun launchPendingIntent(): PendingIntent? {
    val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return null
    return PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE)
  }

  private fun createChannels() {
    val nm = getSystemService(NotificationManager::class.java)
    nm.createNotificationChannel(
      NotificationChannel(CHANNEL_SERVICE, "Dịch vụ màn hình khóa", NotificationManager.IMPORTANCE_MIN),
    )
    nm.createNotificationChannel(
      NotificationChannel(CHANNEL_CARD, "Thẻ học trên màn hình khóa", NotificationManager.IMPORTANCE_HIGH),
    )
  }

  companion object {
    const val TAG = "LockscreenEnglish"
    private const val CHANNEL_SERVICE = "lockscreen-service"
    private const val CHANNEL_CARD = "lockscreen-card"
    private const val ID_SERVICE = 1001
    const val ID_CARD = 1002

    @Volatile
    var running = false
      private set
  }
}
