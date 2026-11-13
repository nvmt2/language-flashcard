import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AutoShowLockscreen } from '@/components/AutoShowLockscreen';
import { LockedRouteGuard } from '@/components/LockedRouteGuard';
import { hideSplash, SPLASH_FALLBACK_MS } from '@/lib/splash';
import { PhraseStoreProvider } from '@/store/PhraseStore';
import { colors } from '@/theme';

export default function RootLayout() {
  useEffect(() => {
    const t = setTimeout(hideSplash, SPLASH_FALLBACK_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <PhraseStoreProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}>
        <Stack.Screen name="index" options={{ title: 'Lockscreen English' }} />
        {/* No animation: the card must cover the screen at once, not slide/fade over the list. */}
        <Stack.Screen name="lockscreen" options={{ headerShown: false, animation: 'none' }} />
        <Stack.Screen name="edit/[id]" options={{ title: 'Câu' }} />
        <Stack.Screen name="settings" options={{ title: 'Cài đặt' }} />
        <Stack.Screen name="inbox" options={{ title: 'Hộp thư' }} />
        <Stack.Screen name="graduated" options={{ title: 'Đã tốt nghiệp' }} />
      </Stack>
      <AutoShowLockscreen />
      <LockedRouteGuard />
    </PhraseStoreProvider>
  );
}
