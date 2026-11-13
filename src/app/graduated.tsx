import { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { notify } from '@/lib/notify';
import { graduatedByWeek, GraduatedWeek, weekStart } from '@/logic/quiz';
import { usePhraseStore } from '@/store/PhraseStore';
import { colors, radius } from '@/theme';
import { Phrase } from '@/types';

const DAY = 24 * 60 * 60 * 1000;

const dm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
const range = (start: Date) => `${dm(start)} – ${dm(new Date(start.getTime() + 6 * DAY))}`;

const WEEK_NAMES: Record<GraduatedWeek['kind'], string> = {
  this: 'TUẦN NÀY',
  last: 'TUẦN TRƯỚC',
  older: 'TUẦN',
};

/** Phrases that left the rotation after QUIZ_TARGET correct answers, grouped by week. */
export default function GraduatedScreen() {
  const store = usePhraseStore();
  const summary = useMemo(() => graduatedByWeek(store.data.phrases), [store.data.phrases]);
  const thisWeekStart = useMemo(() => weekStart(new Date()), []);

  const sections = summary.weeks.map((w) => ({
    key: String(w.start.getTime()),
    title: `${WEEK_NAMES[w.kind]} · ${range(w.start)} (${w.phrases.length})`,
    data: w.phrases,
  }));

  const restore = async (p: Phrase) => {
    try {
      await store.restore(p.id);
      notify(`Đã đưa "${p.phrase}" về Đang học`);
    } catch {
      notify('Không lưu được 😢');
    }
  };

  return (
    <SectionList
      style={styles.root}
      contentContainerStyle={styles.list}
      sections={sections}
      keyExtractor={(p) => p.id}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <View style={styles.tiles}>
          <View style={[styles.tile, styles.tileWeek]}>
            <Text style={styles.tileLabelWeek}>Tuần này</Text>
            <Text style={styles.tileNumberWeek}>{summary.thisWeek}</Text>
            <Text style={styles.tileSubWeek}>{range(thisWeekStart)}</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>Tổng cộng</Text>
            <Text style={styles.tileNumber}>{summary.total}</Text>
            <Text style={styles.tileSub}>từ đã ra trường</Text>
          </View>
        </View>
      }
      renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowPhrase} numberOfLines={1}>
              {item.phrase}
            </Text>
            <Text style={styles.rowMeaning} numberOfLines={1}>
              {item.meaning}
            </Text>
            {item.graduatedAt && <Text style={styles.rowDate}>Tốt nghiệp {dm(new Date(item.graduatedAt))}</Text>}
          </View>
          <Pressable
            onPress={() => restore(item)}
            accessibilityLabel={`Học lại ${item.phrase}`}
            style={({ pressed }) => [styles.restore, pressed && { opacity: 0.6 }]}>
            <Text style={styles.restoreText}>↩️ Học lại</Text>
          </Pressable>
        </View>
      )}
      ListEmptyComponent={
        <Text style={styles.empty}>
          Chưa có từ nào tốt nghiệp.{'\n'}Gõ đúng 3 lần liên tiếp một từ đã thuộc để ra trường 🎓
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 8 },
  tiles: { flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 4 },
  tile: {
    flex: 1,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius,
    padding: 16,
    gap: 4,
  },
  tileWeek: { backgroundColor: '#221D0E', borderColor: '#4A3F1C' },
  tileLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  tileLabelWeek: { color: '#E8C46A', fontSize: 13, fontWeight: '600' },
  tileNumber: { color: colors.text, fontSize: 36, fontWeight: '800' },
  tileNumberWeek: { color: '#FFD166', fontSize: 36, fontWeight: '800' },
  tileSub: { color: colors.muted, fontSize: 13 },
  tileSubWeek: { color: '#C9B98A', fontSize: 13 },
  section: { color: colors.muted, fontSize: 13, fontWeight: '700', letterSpacing: 1, marginTop: 16, marginBottom: 4 },
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
  rowDate: { color: '#7F89A8', fontSize: 12 },
  restore: {
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  restoreText: { color: colors.warn, fontSize: 14, fontWeight: '600' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40, fontSize: 15, lineHeight: 22 },
});
