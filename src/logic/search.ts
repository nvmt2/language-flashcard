import { Phrase, PhraseStatus } from '@/types';

/** Filters for the home list. Graduated phrases live on /graduated, never in this list. */
export type StatusFilter = 'all' | 'learning' | 'mastered';

/** Lowercases and strips Vietnamese diacritics so "chuc may man" matches "Chúc may mắn". */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function filterPhrases(phrases: Phrase[], query: string, status: StatusFilter): Phrase[] {
  const q = fold(query.trim());
  return phrases.filter(
    (p) =>
      p.status !== 'graduated' &&
      (status === 'all' || p.status === status) &&
      (q === '' || fold(p.phrase).includes(q) || fold(p.meaning).includes(q)),
  );
}

export function countByStatus(phrases: Phrase[]): Record<PhraseStatus, number> {
  const counts: Record<PhraseStatus, number> = { learning: 0, mastered: 0, graduated: 0 };
  for (const p of phrases) counts[p.status]++;
  return counts;
}
