import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AutoShowLockscreen } from '@/components/AutoShowLockscreen';
import { PhraseStoreProvider } from '@/store/PhraseStore';
import { colors } from '@/theme';

export default function RootLayout() {
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
        <Stack.Screen name="lockscreen" options={{ headerShown: false }} />
        <Stack.Screen name="edit/[id]" options={{ title: 'Câu' }} />
        <Stack.Screen name="settings" options={{ title: 'Cài đặt' }} />
        <Stack.Screen name="spike" options={{ title: 'Spike lockscreen' }} />
      </Stack>
      <AutoShowLockscreen />
    </PhraseStoreProvider>
  );
}
