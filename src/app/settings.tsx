import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { isSupported } from '../../modules/lockscreen';

import { choose, confirm, notify } from '@/lib/notify';
import { pickJsonText, shareJson } from '@/lib/transfer';
import { usePhraseStore } from '@/store/PhraseStore';
import { buildExport, ImportError, ImportMode, parseImport } from '@/store/validate';
import { colors, radius } from '@/theme';

export default function SettingsScreen() {
  const store = usePhraseStore();
  const [busy, setBusy] = useState(false);

  const run = async (task: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  };

  const toggleAutoShow = (value: boolean) =>
    store.updateSettings({ autoShowOnOpen: value }).catch(() => notify('Không lưu được cài đặt 😢'));

  const exportData = () =>
    run(async () => {
      try {
        await shareJson(JSON.stringify(buildExport(store.data), null, 2));
      } catch {
        notify('Xuất file thất bại 😢');
      }
    });

  const importData = () =>
    run(async () => {
      let text: string | null;
      try {
        text = await pickJsonText();
      } catch {
        notify('Không đọc được file 😢');
        return;
      }
      if (text == null) return;

      let result;
      try {
        result = parseImport(text, new Date().toISOString());
      } catch (e) {
        notify(e instanceof ImportError ? e.message : 'File không hợp lệ.');
        return;
      }
      if (result.valid.length === 0) {
        notify(`Không có câu hợp lệ nào (bỏ qua ${result.skipped} câu lỗi).`);
        return;
      }

      const mode = await choose<ImportMode | null>(
        'Nhập dữ liệu',
        `Tìm thấy ${result.valid.length} câu hợp lệ. Gộp vào danh sách hiện tại hay thay thế toàn bộ?`,
        [
          { text: 'Hủy', value: null, style: 'cancel' },
          { text: 'Thay thế', value: 'replace', style: 'destructive' },
          { text: 'Gộp', value: 'merge' },
        ],
      );
      if (!mode) return;
      if (
        mode === 'replace' &&
        !(await confirm('Thay thế toàn bộ?', `${store.data.phrases.length} câu hiện tại sẽ bị xóa.`, 'Thay thế', true))
      )
        return;

      try {
        await store.importPhrases(result.valid, mode);
        notify(`Đã nhập ${result.valid.length} câu, bỏ qua ${result.skipped} câu lỗi.`);
      } catch {
        notify('Không lưu được dữ liệu nhập 😢');
      }
    });

  const resetSeed = () =>
    run(async () => {
      const ok = await confirm(
        'Khôi phục bộ câu mẫu?',
        'Toàn bộ câu và tiến độ hiện tại sẽ bị thay bằng 50 câu mẫu. Nên xuất file sao lưu trước.',
        'Khôi phục',
        true,
      );
      if (!ok) return;
      try {
        await store.resetToSeed();
        notify('Đã khôi phục bộ câu mẫu.');
      } catch {
        notify('Không khôi phục được 😢');
      }
    });

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Section title="Thẻ học">
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Tự hiện thẻ khi mở app</Text>
            <Text style={styles.rowSub}>Mỗi lần mở hoặc quay lại app là hiện ngay một thẻ học.</Text>
          </View>
          <Switch
            value={store.data.settings.autoShowOnOpen}
            onValueChange={toggleAutoShow}
            trackColor={{ true: colors.accent, false: colors.cardBorder }}
          />
        </View>
      </Section>

      <Section title="Dữ liệu">
        <Button label="📤 Xuất file JSON" onPress={exportData} disabled={busy} />
        <Button label="📥 Nhập file JSON" onPress={importData} disabled={busy} />
        <Text style={styles.note}>
          File nhập có thể là mảng {'[...]'} hoặc {'{ "phrases": [...] }'}. Mỗi câu cần ít nhất “phrase” và “meaning”.
        </Text>
      </Section>

      <Section title="Khác">
        {isSupported() && <Button label="🧪 Spike: màn hình khóa" onPress={() => router.push('/spike')} />}
        <Button label="♻️ Khôi phục bộ câu mẫu" onPress={resetSeed} disabled={busy} danger />
        <Text style={styles.note}>Hiện có {store.data.phrases.length} câu.</Text>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Button({
  label,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        danger && { borderColor: colors.danger },
        (pressed || disabled) && { opacity: 0.6 },
      ]}>
      <Text style={[styles.buttonText, danger && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 24, paddingBottom: 48 },
  section: { gap: 10 },
  sectionTitle: { color: colors.muted, fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  sectionBody: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: 14,
  },
  rowText: { flex: 1, gap: 4 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  rowSub: { color: colors.muted, fontSize: 13 },
  button: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  note: { color: colors.muted, fontSize: 13 },
});
