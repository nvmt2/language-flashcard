import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { notify } from '@/lib/notify';
import { graduatedByWeek, QUIZ_TARGET } from '@/logic/quiz';
import { countByStatus, filterPhrases, StatusFilter } from '@/logic/search';
import { usePhraseStore } from '@/store/PhraseStore';
import { colors, radius } from '@/theme';
import { Phrase } from '@/types';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'learning', label: 'Đang học' },
  { key: 'mastered', label: 'Đã thuộc' },
];

export default function HomeScreen() {
  const { ready, data, recoveredFromCorrupt, dismissRecoveryNotice } = usePhraseStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

  const counts = useMemo(() => countByStatus(data.phrases), [data.phrases]);
  const visible = useMemo(() => filterPhrases(data.phrases, query, filter), [data.phrases, query, filter]);
  const weekCount = useMemo(() => graduatedByWeek(data.phrases).thisWeek, [data.phrases]);

  useEffect(() => {
    if (recoveredFromCorrupt) {
      notify('Dữ liệu bị lỗi nên đã nạp lại bộ câu mẫu (bản cũ đã được sao lưu).');
      dismissRecoveryNotice();
    }
  }, [recoveredFromCorrupt, dismissRecoveryNotice]);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable hitSlop={12} accessibilityLabel="Đã tốt nghiệp" onPress={() => router.push('/graduated')}>
                <Text style={styles.headerIcon}>🎓</Text>
              </Pressable>
              <Pressable hitSlop={12} accessibilityLabel="Hộp thư" onPress={() => router.push('/inbox')}>
                <Text style={styles.headerIcon}>📥</Text>
              </Pressable>
              <Pressable hitSlop={12} accessibilityLabel="Cài đặt" onPress={() => router.push('/settings')}>
                <Text style={styles.headerIcon}>⚙️</Text>
              </Pressable>
            </View>
          ),
        }}
      />

      <Text style={styles.stats}>
        {counts.learning} đang học · {counts.mastered} đã thuộc · {counts.graduated} tốt nghiệp
      </Text>

      <Pressable style={styles.grad} onPress={() => router.push('/graduated')}>
        <Text style={styles.gradText}>🎓 Tuần này tốt nghiệp {weekCount} từ</Text>
        <Text style={styles.gradText}>›</Text>
      </Pressable>

      <Pressable style={styles.study} onPress={() => router.push('/lockscreen')}>
        <Text style={styles.studyText}>🃏 Mở thẻ học</Text>
      </Pressable>

      <TextInput
        style={styles.search}
        placeholder="Tìm cụm từ hoặc nghĩa…"
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        clearButtonMode="while-editing"
      />

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.chip, filter === f.key && styles.chipActive]}>
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <Row phrase={item} />}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={styles.empty}>
            {data.phrases.length === 0
              ? 'Chưa có câu nào, bấm ➕ để thêm 🥲'
              : counts.learning + counts.mastered === 0
                ? 'Tốt nghiệp hết rồi 🎓 Bấm ➕ để thêm từ mới.'
                : 'Không tìm thấy câu nào.'}
          </Text>
        }
      />

      <Pressable style={styles.fab} accessibilityLabel="Thêm câu" onPress={() => router.push('/edit/new')}>
        <Text style={styles.fabText}>＋</Text>
      </Pressable>
    </View>
  );
}

function Row({ phrase }: { phrase: Phrase }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/edit/[id]', params: { id: phrase.id } })}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <View style={styles.rowText}>
        <Text style={styles.rowPhrase} numberOfLines={1}>
          {phrase.phrase}
        </Text>
        <Text style={styles.rowMeaning} numberOfLines={1}>
          {phrase.meaning}
        </Text>
      </View>
      <Text style={[styles.badge, phrase.status === 'mastered' ? styles.badgeDone : styles.badgeLearning]}>
        {phrase.status === 'mastered' ? `Đã thuộc · ${phrase.quizStreak ?? 0}/${QUIZ_TARGET}` : 'Đang học'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  headerActions: { flexDirection: 'row', gap: 20 },
  headerIcon: { fontSize: 22 },
  stats: { color: colors.muted, fontSize: 14, marginTop: 4 },
  grad: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#221D0E',
    borderColor: '#4A3F1C',
    borderWidth: 1,
    borderRadius: radius,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  gradText: { color: '#FFD166', fontSize: 15, fontWeight: '600' },
  study: {
    backgroundColor: colors.accent,
    borderRadius: radius,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  studyText: { color: colors.bg, fontWeight: '800', fontSize: 17 },
  search: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    marginTop: 12,
  },
  filters: { flexDirection: 'row', gap: 8, marginTop: 10 },
  chip: {
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.muted, fontSize: 14 },
  chipTextActive: { color: colors.bg, fontWeight: '700' },
  list: { paddingVertical: 12, paddingBottom: 96, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: 14,
  },
  rowText: { flex: 1, gap: 2 },
  rowPhrase: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rowMeaning: { color: colors.muted, fontSize: 14 },
  badge: { fontSize: 12, fontWeight: '700', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, overflow: 'hidden' },
  badgeLearning: { color: colors.warn, backgroundColor: '#3A2D12' },
  badgeDone: { color: colors.success, backgroundColor: '#123A28' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40, fontSize: 15 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  fabText: { color: colors.bg, fontSize: 32, fontWeight: '700', marginTop: -2 },
});
