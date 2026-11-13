import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/theme';
import { Phrase } from '@/types';

interface Props {
  phrase: Phrase;
  flipped: boolean;
  onFlip: () => void;
}

/** Big flashcard for a learning phrase: shows the phrase; tap to reveal meaning and examples. */
export function PhraseCard({ phrase, flipped, onFlip }: Props) {
  return (
    <Pressable onPress={onFlip} style={styles.card} accessibilityRole="button" accessibilityHint="Chạm để lật thẻ">
      <Text style={styles.phrase} adjustsFontSizeToFit numberOfLines={4}>
        {phrase.phrase}
      </Text>

      {flipped ? (
        <View style={styles.back}>
          <Text style={styles.meaning}>{phrase.meaning}</Text>
          {phrase.example && <Text style={styles.example}>“{phrase.example}”</Text>}
          {phrase.exampleVi && <Text style={styles.exampleVi}>{phrase.exampleVi}</Text>}
          {phrase.tags?.length ? <Text style={styles.tags}>{phrase.tags.map((t) => `#${t}`).join('  ')}</Text> : null}
        </View>
      ) : (
        <Text style={styles.hint}>Chạm để xem nghĩa</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius * 1.5,
    padding: 28,
    minHeight: 320,
    justifyContent: 'center',
    gap: 20,
  },
  phrase: { color: colors.text, fontSize: 40, fontWeight: '800', lineHeight: 48 },
  hint: { color: colors.muted, fontSize: 14 },
  back: { gap: 12 },
  meaning: { color: colors.accent, fontSize: 22, fontWeight: '600' },
  example: { color: colors.text, fontSize: 18, fontStyle: 'italic' },
  exampleVi: { color: colors.muted, fontSize: 16 },
  tags: { color: colors.muted, fontSize: 13, marginTop: 4 },
});
