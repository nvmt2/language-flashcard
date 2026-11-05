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
 * SPIKE (#15): foreground service that listens for SCREEN_ON (only deliverable to
 * runtime-registered receivers) and opens the /lockscreen route over the keyguard.
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
        if (intent.action == Intent.ACTION_SCREEN_ON) onScreenOn()
      }
    }
    val filter = IntentFilter(Intent.ACTION_SCREEN_ON)
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

  private fun onScreenOn() {
    val now = System.currentTimeMillis()
    LockscreenPrefs.setLastScreenOnAt(this, now)
    LockscreenPrefs.setPendingShow(this, now)
    LockscreenActivityListener.allowCurrent(this)
    val mode = LockscreenPrefs.mode(this)
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
