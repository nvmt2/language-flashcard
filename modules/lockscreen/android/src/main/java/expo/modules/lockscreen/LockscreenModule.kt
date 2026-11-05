package expo.modules.lockscreen

import android.Manifest
import android.app.NotificationManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LockscreenModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("Lockscreen")

    Function("isSupported") { supported }

    Function("start") { mode: String ->
      LockscreenPrefs.setEnabled(context, true, mode)
      context.startForegroundService(Intent(context, LockscreenService::class.java))
      appContext.currentActivity?.let { LockscreenActivityListener().onResume(it) }
    }

    Function("stop") {
      LockscreenPrefs.setEnabled(context, false)
      context.stopService(Intent(context, LockscreenService::class.java))
      appContext.currentActivity?.let { LockscreenActivityListener().onResume(it) }
    }

    Function("isRunning") { LockscreenService.running }

    Function("getStatus") {
      mapOf(
        "running" to LockscreenService.running,
        "enabled" to LockscreenPrefs.isEnabled(context),
        "mode" to LockscreenPrefs.mode(context),
        "lastScreenOnAt" to LockscreenPrefs.lastScreenOnAt(context).toDouble(),
        "lastError" to LockscreenPrefs.lastError(context),
        "sdkInt" to Build.VERSION.SDK_INT,
        "manufacturer" to Build.MANUFACTURER,
      )
    }

    Function("dismiss") {
      appContext.currentActivity?.moveTaskToBack(true)
    }

    Function("getPermissions") {
      val ctx = context
      val nm = ctx.getSystemService(NotificationManager::class.java)
      val pm = ctx.getSystemService(PowerManager::class.java)
      mapOf(
        "overlay" to state(Settings.canDrawOverlays(ctx)),
        "notifications" to state(nm.areNotificationsEnabled()),
        "battery" to state(pm.isIgnoringBatteryOptimizations(ctx.packageName)),
        "fullScreenIntent" to
          if (Build.VERSION.SDK_INT >= 34) state(nm.canUseFullScreenIntent()) else "granted",
        // MIUI-only permissions cannot be read by third-party apps.
        "miuiLockscreen" to "unknown",
        "miuiBackgroundPopup" to "unknown",
        "autostart" to "unknown",
      )
    }

    Function("requestNotificationPermission") {
      if (Build.VERSION.SDK_INT >= 33) {
        appContext.currentActivity?.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 4201)
      }
    }

    Function("openPermissionSettings") { kind: String ->
      openSettings(kind)
    }
  }

  private fun state(granted: Boolean) = if (granted) "granted" else "denied"

  private fun openSettings(kind: String): Boolean {
    val ctx = context
    val pkg = ctx.packageName
    val pkgUri = Uri.parse("package:$pkg")
    val candidates: List<Intent> = when (kind) {
      "overlay" -> listOf(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, pkgUri))
      "notifications" -> listOf(
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, pkg),
      )
      "battery" -> listOf(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, pkgUri))
      "fullScreenIntent" ->
        if (Build.VERSION.SDK_INT >= 34) listOf(Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, pkgUri))
        else emptyList()
      "miui" -> listOf(
        Intent("miui.intent.action.APP_PERM_EDITOR")
          .setComponent(ComponentName("com.miui.securitycenter", "com.miui.permcenter.permissions.PermissionsEditorActivity"))
          .putExtra("extra_pkgname", pkg),
        Intent("miui.intent.action.APP_PERM_EDITOR").putExtra("extra_pkgname", pkg),
      )
      "autostart" -> listOf(
        Intent().setComponent(ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")),
      )
      else -> emptyList()
    } + Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkgUri)

    for (intent in candidates) {
      try {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(intent)
        return true
      } catch (_: Exception) {
        // try the next candidate
      }
    }
    return false
  }

  companion object {
    /** Android 10+ is required for the SCREEN_ON → activity flow. */
    val supported: Boolean
      get() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
  }
}
