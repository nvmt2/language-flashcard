package expo.modules.lockscreen

import android.content.Context
import android.content.Intent
import android.net.Uri
import java.util.UUID

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

  /**
   * One-shot ticket set by the service on SCREEN_OFF / SCREEN_ON, bound to the launch intent
   * by a random in-memory nonce. The activity may show over the keyguard only when its intent
   * carries that nonce and the card deep link, so other apps / normal launches never bypass
   * the lock. `wake` says whether the launch may turn the screen on (false on SCREEN_OFF,
   * otherwise the screen would come straight back on).
   */
  @Volatile private var pendingNonce: String? = null
  @Volatile private var pendingAt = 0L
  @Volatile private var pendingWake = false

  fun setPendingShow(at: Long, wake: Boolean) {
    pendingNonce = UUID.randomUUID().toString()
    pendingAt = at
    pendingWake = wake
  }

  fun hasPendingShow() = pendingNonce != null

  /** Null when the intent carries no valid ticket, otherwise the ticket's `wake` flag. */
  fun consumePendingShow(intent: Intent?): Boolean? {
    val nonce = pendingNonce ?: return null
    if (intent?.getStringExtra(EXTRA_NONCE) != nonce || intent.dataString != DEEP_LINK) return null
    pendingNonce = null
    return if (System.currentTimeMillis() - pendingAt < PENDING_SHOW_TTL_MS) pendingWake else null
  }

  private const val PENDING_SHOW_TTL_MS = 10_000L
  private const val EXTRA_NONCE = "expo.modules.lockscreen.NONCE"

  fun lastError(ctx: Context) = prefs(ctx).getString("lastError", null)
  fun setLastError(ctx: Context, error: String?) = prefs(ctx).edit().putString("lastError", error).apply()

  fun deepLinkIntent(ctx: Context): Intent =
    Intent(Intent.ACTION_VIEW, Uri.parse(DEEP_LINK))
      .setPackage(ctx.packageName)
      .putExtra(EXTRA_NONCE, pendingNonce)
      // NO_ANIMATION: no window open animation over the keyguard.
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NO_ANIMATION)
}
