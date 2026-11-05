import { router } from 'expo-router';

import { isSupported, Lockscreen } from '../../modules/lockscreen';

/** True when the native lock-screen service is compiled in and switched on. */
export function nativeLockscreenEnabled(): boolean {
  return isSupported() && (Lockscreen?.getStatus().enabled ?? false);
}

/**
 * Closes the lock-screen card.
 * With the native feature on, the task goes to the back so the real keyguard shows.
 * Otherwise (Expo Go, web, feature off) it is plain navigation.
 */
export function dismissLockscreen() {
  if (nativeLockscreenEnabled()) {
    Lockscreen?.dismiss();
    return;
  }
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** SPIKE (#15): ms between the last SCREEN_ON and now, if it was recent. */
export function msSinceScreenOn(): number | null {
  if (!isSupported() || !Lockscreen) return null;
  const at = Lockscreen.getStatus().lastScreenOnAt;
  const ms = Date.now() - at;
  return at > 0 && ms < 15_000 ? ms : null;
}
