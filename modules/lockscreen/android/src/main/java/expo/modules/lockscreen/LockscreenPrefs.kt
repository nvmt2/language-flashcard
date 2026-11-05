package expo.modules.lockscreen

import android.content.Context
import android.content.Intent
import android.net.Uri

/** Shared state between the JS module, the foreground service and the activity listener. */
internal object LockscreenPrefs {
  private const val FILE = "lockscreen-english"
  const val DEEP_LINK = "lockscreenenglish://lockscreen"
  const val MODE_ACTIVITY = "activity"
  const val MODE_FULL_SCREEN_INTENT = "fullScreenIntent"

  private fun prefs(ctx: Context) = ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE)

  fun isEnabled(ctx: Context) = prefs(ctx).getBoolean("enabled", false)
  fun mode(ctx: Context) = prefs(ctx).getString("mode", MODE_ACTIVITY) ?: MODE_ACTIVITY

  fun setEnabled(ctx: Context, enabled: Boolean, mode: String? = null) {
    prefs(ctx).edit().apply {
      putBoolean("enabled", enabled)
      if (mode != null) putString("mode", mode)
    }.apply()
  }

  fun lastScreenOnAt(ctx: Context) = prefs(ctx).getLong("lastScreenOnAt", 0L)
  fun setLastScreenOnAt(ctx: Context, at: Long) = prefs(ctx).edit().putLong("lastScreenOnAt", at).apply()

  fun lastError(ctx: Context) = prefs(ctx).getString("lastError", null)
  fun setLastError(ctx: Context, error: String?) = prefs(ctx).edit().putString("lastError", error).apply()

  fun deepLinkIntent(ctx: Context): Intent =
    Intent(Intent.ACTION_VIEW, Uri.parse(DEEP_LINK))
      .setPackage(ctx.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
}
