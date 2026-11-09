import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { consumeAutoShowSuppression } from '@/lib/autoShow';
import { createBootCover, onCardShown } from '@/lib/bootCover';
import { nativeLockscreenEnabled } from '@/lib/lockscreenBridge';
import { hideSplash, SPLASH_FALLBACK_MS } from '@/lib/splash';
import { usePhraseStore } from '@/store/PhraseStore';
import { colors } from '@/theme';

const LOCKSCREEN = '/lockscreen';

/**
 * Shows the card on cold start and every time the app comes back, when
 * `settings.autoShowOnOpen` or the native lock-screen feature is on.
 *
 * The card is opened when the app *leaves* (goes to the background), not when it comes
 * back: on return — or when SCREEN_ON brings the app over the keyguard — the card is
 * already on top, so the home list (or the guard's blank cover) never flashes first.
 *
 * Until the first screen is decided it also draws a plain cover over the app: the splash
 * only covers the very first start, not a reopen after Back (see src/lib/bootCover.ts).
 */
export function AutoShowLockscreen() {
  const { ready, data } = usePhraseStore();
  const pathname = usePathname();
  const enabled = data.settings.autoShowOnOpen;

  const pathRef = useRef(pathname);
  const enabledRef = useRef(enabled);
  const coldStartHandled = useRef(false);

  // One cover per mount, revealed once the card is on screen (or no card is due).
  const [cover] = useState(createBootCover);
  const [covered, setCovered] = useState(true);

  useEffect(() => {
    const offCover = cover.subscribe(() => setCovered(false));
    const offCard = onCardShown(cover.reveal);
    // Never leave the user stuck behind the cover if something goes wrong.
    const t = setTimeout(cover.reveal, SPLASH_FALLBACK_MS);
    return () => {
      offCover();
      offCard();
      clearTimeout(t);
    };
  }, [cover]);

  useEffect(() => {
    pathRef.current = pathname;
    enabledRef.current = enabled;
  }, [pathname, enabled]);

  // Cold start: the splash stays up; the lockscreen hides it once its card is ready.
  useEffect(() => {
    if (!ready || coldStartHandled.current) return;
    coldStartHandled.current = true;
    if (enabled && pathname !== LOCKSCREEN) router.push(LOCKSCREEN);
    else if (pathname !== LOCKSCREEN) {
      hideSplash();
      cover.reveal();
    }
  }, [ready, enabled, pathname, cover]);

  // Leaving the app → open the card now, so it is waiting there on return.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'background') return;
      if (consumeAutoShowSuppression()) return;
      if (pathRef.current === LOCKSCREEN) return;
      if (enabledRef.current || nativeLockscreenEnabled()) router.push(LOCKSCREEN);
    });
    return () => sub.remove();
  }, []);

  return covered ? <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]} /> : null;
}
