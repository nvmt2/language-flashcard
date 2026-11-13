import { countByStatus, filterPhrases, fold } from '@/logic/search';
import { Phrase } from '@/types';

const p = (id: string, phrase: string, meaning: string, status: Phrase['status'] = 'learning'): Phrase => ({
  id,
  phrase,
  meaning,
  status,
  seenCount: 0,
  createdAt: '2026-11-05T00:00:00.000Z',
});

const list = [p('1', 'Break a leg', 'Chúc may mắn'), p('2', 'Hit the sack', 'Đi ngủ', 'mastered')];

test('fold strips diacritics and đ', () => {
  expect(fold('Đi Ngủ Chúc MAY mắn')).toBe('di ngu chuc may man');
});

test('search matches phrase or meaning, accent-insensitive', () => {
  expect(filterPhrases(list, 'LEG', 'all').map((x) => x.id)).toEqual(['1']);
  expect(filterPhrases(list, 'di ngu', 'all').map((x) => x.id)).toEqual(['2']);
  expect(filterPhrases(list, '  ', 'all')).toHaveLength(2);
});

test('status filter', () => {
  expect(filterPhrases(list, '', 'mastered').map((x) => x.id)).toEqual(['2']);
  expect(filterPhrases(list, 'leg', 'mastered')).toEqual([]);
});

test('countByStatus', () => {
  expect(countByStatus(list)).toEqual({ learning: 1, mastered: 1, graduated: 0 });
});

test('graduated phrases stay out of the home list, even under "all"', () => {
  const withGrad = [...list, p('3', 'Bite the bullet', 'Cắn răng', 'graduated')];
  expect(filterPhrases(withGrad, '', 'all').map((x) => x.id)).toEqual(['1', '2']);
  expect(filterPhrases(withGrad, 'bullet', 'all')).toEqual([]);
});

test('countByStatus counts graduated phrases separately', () => {
  const withGrad = [...list, p('3', 'Bite the bullet', 'Cắn răng', 'graduated')];
  expect(countByStatus(withGrad)).toEqual({ learning: 1, mastered: 1, graduated: 1 });
});
