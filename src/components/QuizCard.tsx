import { StyleSheet, Text, TextInput, View } from 'react-native';

import { QUIZ_TARGET } from '@/logic/quiz';
import { colors, radius } from '@/theme';
import { Phrase } from '@/types';

export type QuizResult = 'correct' | 'wrong' | 'graduated';

interface Props {
  phrase: Phrase;
  /** Streak to show: the stored one, or the new one right after answering. */
  streak: number;
  result: QuizResult | null;
  /** What the user typed for a wrong answer ('' when they gave up). */
  typed: string;
  input: string;
  onChangeInput: (text: string) => void;
  onSubmit: () => void;
  /** Phrases graduated this week, shown on the graduation message. */
  weekCount: number;
}

/** Card for a mastered phrase: shows the meaning, the user types the English phrase. */
export function QuizCard({ phrase, streak, result, typed, input, onChangeInput, onSubmit, weekCount }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.badge}>ĐÃ THUỘC · KIỂM TRA</Text>
        <View
          style={styles.dots}
          accessible
          accessibilityLabel={`Đúng liên tiếp ${streak} trên ${QUIZ_TARGET}`}>
          {Array.from({ length: QUIZ_TARGET }, (_, i) => (
            <View key={i} style={[styles.dot, i < streak && styles.dotOn]} />
          ))}
          <Text style={styles.count}>
            {streak}/{QUIZ_TARGET}
          </Text>
        </View>
      </View>

      <Text style={styles.label}>Gõ cụm tiếng Anh có nghĩa là</Text>
      <Text style={styles.meaning}>{phrase.meaning}</Text>

      {result === null && (
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={onChangeInput}
          onSubmitEditing={onSubmit}
          placeholder="Gõ cụm tiếng Anh…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          returnKeyType="done"
          accessibilityLabel="Cụm tiếng Anh"
        />
      )}

      {result === 'correct' && (
        <View style={[styles.box, styles.boxOk]}>
          <Text style={[styles.boxTitle, { color: colors.success }]}>
            ✅ Chuẩn! Còn {QUIZ_TARGET - streak} lần nữa là tốt nghiệp
          </Text>
          <Answer phrase={phrase} />
        </View>
      )}

      {result === 'wrong' && (
        <View style={[styles.box, styles.boxBad]}>
          <Text style={[styles.boxTitle, { color: colors.danger }]}>
            {typed ? '❌ Chưa đúng, chuỗi về 0' : 'Không sao, chuỗi về 0'}
          </Text>
          {typed ? (
            <Text style={styles.typed}>
              Bạn gõ: <Text style={styles.strike}>{typed}</Text>
            </Text>
          ) : null}
          <Text style={styles.typed}>Đáp án đúng</Text>
          <Answer phrase={phrase} />
        </View>
      )}

      {result === 'graduated' && (
        <View style={[styles.box, styles.boxGrad]}>
          <Text style={styles.cap}>🎓</Text>
          <Text style={styles.gradTitle}>Tốt nghiệp!</Text>
          <Text style={styles.answer}>{phrase.phrase}</Text>
          <Text style={styles.gradText}>
            Đúng {QUIZ_TARGET} lần liên tiếp. Từ này sẽ không hiện trên màn khoá nữa.
          </Text>
          <Text style={styles.gradWeek}>Tuần này bạn đã tốt nghiệp {weekCount} từ</Text>
        </View>
      )}
    </View>
  );
}

function Answer({ phrase }: { phrase: Phrase }) {
  return (
    <>
      <Text style={styles.answer}>{phrase.phrase}</Text>
      {phrase.example && <Text style={styles.example}>“{phrase.example}”</Text>}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius * 1.5,
    padding: 24,
    gap: 14,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  badge: { color: colors.success, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#3A4466' },
  dotOn: { backgroundColor: colors.success, borderColor: colors.success },
  count: { color: colors.muted, fontSize: 13, fontWeight: '700', marginLeft: 4 },
  label: { color: colors.muted, fontSize: 13 },
  meaning: { color: colors.text, fontSize: 26, fontWeight: '700', lineHeight: 34 },
  input: {
    backgroundColor: colors.bg,
    borderColor: colors.accent,
    borderWidth: 1.5,
    borderRadius: radius,
    color: colors.text,
    fontSize: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 6,
  },
  box: { borderRadius: radius, padding: 16, gap: 8, marginTop: 6 },
  boxOk: { backgroundColor: '#123A28' },
  boxBad: { backgroundColor: '#3A1A1D' },
  boxGrad: { backgroundColor: '#1E2A52', alignItems: 'center' },
  boxTitle: { fontSize: 16, fontWeight: '700' },
  typed: { color: '#C9CFE3', fontSize: 14 },
  strike: { textDecorationLine: 'line-through' },
  answer: { color: colors.text, fontSize: 20, fontWeight: '800' },
  example: { color: colors.text, fontSize: 15, fontStyle: 'italic' },
  cap: { fontSize: 40 },
  gradTitle: { color: '#FFD166', fontSize: 22, fontWeight: '800' },
  gradText: { color: '#C9CFE3', fontSize: 14, textAlign: 'center' },
  gradWeek: { color: colors.accent, fontSize: 14, fontWeight: '700' },
});
