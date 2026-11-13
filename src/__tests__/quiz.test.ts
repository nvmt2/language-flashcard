import { QUIZ_TARGET, graduatedByWeek, isCorrectAnswer, weekStart } from '@/logic/quiz';
import { Phrase } from '@/types';

describe('isCorrectAnswer', () => {
  it('ignores case, extra spaces and punctuation', () => {
    expect(isCorrectAnswer('  piece   OF cake ', 'Piece of cake')).toBe(true);
    expect(isCorrectAnswer('break a leg', 'Break a leg!')).toBe(true);
    expect(isCorrectAnswer('Well, done.', 'well done')).toBe(true);
  });

  it('treats curly apostrophes like straight ones', () => {
    expect(isCorrectAnswer('I’m all ears', "I'm all ears")).toBe(true);
  });

  it('rejects spelling mistakes and missing words', () => {
    expect(isCorrectAnswer('peace of cake', 'Piece of cake')).toBe(false);
    expect(isCorrectAnswer('piece cake', 'Piece of cake')).toBe(false);
  });

  it('rejects an empty answer', () => {
    expect(isCorrectAnswer('   ', 'Piece of cake')).toBe(false);
    expect(isCorrectAnswer('!!', '!!')).toBe(false);
  });

  it('needs three correct answers in a row', () => {
    expect(QUIZ_TARGET).toBe(3);
  });
});

describe('weekStart', () => {
  it('returns Monday 00:00 local time for any day of that week', () => {
    const monday = new Date(2026, 10, 9);
    expect(weekStart(new Date(2026, 10, 9, 0, 0)).getTime()).toBe(monday.getTime());
    expect(weekStart(new Date(2026, 10, 13, 15, 30)).getTime()).toBe(monday.getTime());
    expect(weekStart(new Date(2026, 10, 15, 23, 59)).getTime()).toBe(monday.getTime());
  });

  it('starts a new week on Monday', () => {
    expect(weekStart(new Date(2026, 10, 16, 0, 1)).getTime()).toBe(new Date(2026, 10, 16).getTime());
  });
});

describe('graduatedByWeek', () => {
  const at = (d: Date) => d.toISOString();
  const p = (id: string, over: Partial<Phrase> = {}): Phrase => ({
    id,
    phrase: id,
    meaning: id,
    status: 'graduated',
    seenCount: 0,
    createdAt: at(new Date(2026, 9, 1)),
    ...over,
  });
  const NOW = new Date(2026, 10, 13, 12, 0); // Friday

  it('groups graduated phrases by Monday–Sunday week, newest first', () => {
    const phrases = [
      p('lastWeek', { graduatedAt: at(new Date(2026, 10, 8, 22, 0)) }), // Sunday before
      p('learning', { status: 'learning' }),
      p('mon', { graduatedAt: at(new Date(2026, 10, 9, 8, 0)) }),
      p('fri', { graduatedAt: at(new Date(2026, 10, 13, 9, 0)) }),
      p('mastered', { status: 'mastered' }),
    ];
    const out = graduatedByWeek(phrases, NOW);
    expect(out.thisWeek).toBe(2);
    expect(out.total).toBe(3);
    expect(out.weeks.map((w) => w.kind)).toEqual(['this', 'last']);
    expect(out.weeks[0].phrases.map((x) => x.id)).toEqual(['fri', 'mon']);
    expect(out.weeks[0].start.getTime()).toBe(new Date(2026, 10, 9).getTime());
    expect(out.weeks[1].phrases.map((x) => x.id)).toEqual(['lastWeek']);
  });

  it('labels weeks before last week as older', () => {
    const out = graduatedByWeek([p('old', { graduatedAt: at(new Date(2026, 9, 20)) })], NOW);
    expect(out.thisWeek).toBe(0);
    expect(out.weeks).toHaveLength(1);
    expect(out.weeks[0].kind).toBe('older');
  });

  it('returns nothing when no phrase has graduated', () => {
    expect(graduatedByWeek([p('a', { status: 'learning' })], NOW)).toEqual({ thisWeek: 0, total: 0, weeks: [] });
  });
});
