import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BUILD_INBOX_URL, isValidInboxUrl } from '@/lib/inbox';
import { notify } from '@/lib/notify';
import { usePhraseStore } from '@/store/PhraseStore';
import { colors, radius } from '@/theme';

/**
 * Edits settings.inboxUrl (#29 §5). Empty means "use the build-time URL" when the build has
 * one. Used in Settings and on the inbox screen when no URL is configured yet.
 */
export function InboxUrlForm({ onSaved }: { onSaved?: () => void }) {
  const store = usePhraseStore();
  const saved = store.data.settings.inboxUrl;
  const [value, setValue] = useState(saved);
  const [saving, setSaving] = useState(false);

  const dirty = value.trim() !== saved;
  const placeholder = BUILD_INBOX_URL
    ? 'Đang dùng URL mặc định của bản build'
    : 'https://<project-id>.mockapi.io/api/v1/inbox';

  const save = async (next: string) => {
    const url = next.trim();
    if (!isValidInboxUrl(url)) {
      notify('URL phải bắt đầu bằng https://');
      return;
    }
    setSaving(true);
    try {
      await store.updateSettings({ inboxUrl: url });
      setValue(url);
      notify(url ? 'Đã lưu địa chỉ hộp thư.' : BUILD_INBOX_URL ? 'Đang dùng URL mặc định.' : 'Đã xóa địa chỉ hộp thư.');
      onSaved?.();
    } catch {
      notify('Không lưu được cài đặt 😢');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        inputMode="url"
        returnKeyType="done"
        onSubmitEditing={() => dirty && save(value)}
      />
      <View style={styles.actions}>
        <Pressable
          onPress={() => save(value)}
          disabled={!dirty || saving}
          style={({ pressed }) => [styles.button, styles.primary, (pressed || !dirty || saving) && styles.dim]}>
          <Text style={[styles.buttonText, styles.primaryText]}>Lưu</Text>
        </Pressable>
        {BUILD_INBOX_URL !== '' && saved !== '' && (
          <Pressable
            onPress={() => save('')}
            disabled={saving}
            style={({ pressed }) => [styles.button, (pressed || saving) && styles.dim]}>
            <Text style={styles.buttonText}>Dùng URL mặc định</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  button: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  buttonText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  primaryText: { color: colors.bg, fontWeight: '800' },
  dim: { opacity: 0.5 },
});
