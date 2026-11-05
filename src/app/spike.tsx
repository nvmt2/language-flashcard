// SPIKE (#15): throwaway test screen for the native lock-screen experiment.
// Delete together with the spike code once #15 has its answer.
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { notify } from '@/lib/notify';
import { usePhraseStore } from '@/store/PhraseStore';
import { colors, radius } from '@/theme';

import {
  isSupported,
  Lockscreen,
  LockscreenMode,
  LockscreenPermissions,
  LockscreenStatus,
  PermissionKind,
} from '../../modules/lockscreen';

const PERMISSION_ROWS: { key: keyof LockscreenPermissions; label: string; open: PermissionKind }[] = [
  { key: 'notifications', label: 'Thông báo (POST_NOTIFICATIONS)', open: 'notifications' },
  { key: 'overlay', label: 'Hiển thị trên ứng dụng khác', open: 'overlay' },
  { key: 'miuiLockscreen', label: 'MIUI: Hiển thị trên màn hình khóa', open: 'miui' },
  { key: 'miuiBackgroundPopup', label: 'MIUI: Mở cửa sổ khi chạy nền', open: 'miui' },
  { key: 'autostart', label: 'MIUI: Tự khởi động', open: 'autostart' },
  { key: 'battery', label: 'Pin: Không giới hạn', open: 'battery' },
  { key: 'fullScreenIntent', label: 'Thông báo toàn màn hình (dự phòng)', open: 'fullScreenIntent' },
];

const ICON = { granted: '✅', denied: '❌', unknown: '❓' } as const;

export default function SpikeScreen() {
  const store = usePhraseStore();
  const [status, setStatus] = useState<LockscreenStatus | null>(null);
  const [perms, setPerms] = useState<LockscreenPermissions | null>(null);

  const refresh = useCallback(() => {
    if (!Lockscreen) return;
    setStatus(Lockscreen.getStatus());
    setPerms(Lockscreen.getPermissions());
  }, []);

  useFocusEffect(refresh);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  if (!isSupported() || !Lockscreen) {
    return (
      <View style={styles.root}>
        <Text style={styles.text}>Bản này không có native module (Expo Go / web). Cần cài dev build.</Text>
      </View>
    );
  }
  const native = Lockscreen;

  const start = async (mode: LockscreenMode) => {
    // Avoid the Phase 1 AppState auto-show opening a second card.
    if (store.data.settings.autoShowOnOpen) await store.updateSettings({ autoShowOnOpen: false });
    native.start(mode);
    notify(`Đã bật (${mode}). Tắt màn hình rồi bật lại để thử.`);
    setTimeout(refresh, 500);
  };

  const stop = () => {
    native.stop();
    setTimeout(refresh, 500);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Trạng thái</Text>
      {status && (
        <View style={styles.box}>
          <Text style={styles.text}>Service: {status.running ? '🟢 đang chạy' : '⚪ tắt'} · mode: {status.mode}</Text>
          <Text style={styles.text}>
            Máy: {status.manufacturer} · Android SDK {status.sdkInt}
          </Text>
          <Text style={styles.text}>
            SCREEN_ON gần nhất: {status.lastScreenOnAt ? new Date(status.lastScreenOnAt).toLocaleTimeString() : '—'}
          </Text>
          {status.lastError && <Text style={[styles.text, { color: colors.danger }]}>Lỗi: {status.lastError}</Text>}
        </View>
      )}

      <Text style={styles.title}>Thử</Text>
      <Btn label="▶️ Bật — cách 1: mở activity" onPress={() => start('activity')} />
      <Btn label="▶️ Bật — cách 2: fullScreenIntent" onPress={() => start('fullScreenIntent')} />
      <Btn label="⏹ Tắt" onPress={stop} />

      <Text style={styles.title}>Quyền</Text>
      <Btn label="🔔 Xin quyền thông báo" onPress={() => native.requestNotificationPermission()} />
      {perms &&
        PERMISSION_ROWS.map((row) => (
          <Pressable key={row.key} style={styles.permRow} onPress={() => native.openPermissionSettings(row.open)}>
            <Text style={styles.text}>
              {ICON[perms[row.key]]} {row.label}
            </Text>
            <Text style={styles.link}>Mở</Text>
          </Pressable>
        ))}
      <Text style={styles.note}>❓ = MIUI không cho app đọc, phải tự kiểm tra trong cài đặt.</Text>
    </ScrollView>
  );
}

function Btn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  title: { color: colors.muted, fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 12 },
  box: { backgroundColor: colors.card, borderRadius: radius, padding: 14, gap: 4 },
  text: { color: colors.text, fontSize: 15 },
  note: { color: colors.muted, fontSize: 13 },
  link: { color: colors.accent, fontWeight: '700' },
  permRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: 14,
    gap: 8,
  },
  btn: { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: radius, padding: 14 },
  btnText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
