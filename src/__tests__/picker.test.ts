import { MASTERED_CHANCE, markSeen, pick } from '@/logic/picker';
import { AppData, Phrase, RECENT_LIMIT } from '@/types';

const NOW = '2026-11-05T00:00:00.000Z';
const p = (id: string, over: Partial<Phrase> = {}): Phrase => ({
  id,
  phrase: id,
  meaning: id,
  status: 'learning',
  seenCount: 0,
  createdAt: NOW,
  ...over,
});

/** Deterministic random source returning the given values in order (then repeating the last). */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

describe('pick', () => {
  it('returns null for an empty list', () => {
    expect(pick([], [], Math.random)).toBeNull();
  });

  it('never picks a recently shown phrase when others exist', () => {
    const phrases = ['a', 'b', 'c'].map((id) => p(id));
    for (let i = 0; i < 200; i++) {
      expect(pick(phrases, ['a', 'b'], Math.random)?.id).toBe('c');
    }
  });

  it('falls back to all phrases when everything is recent', () => {
    const phrases = [p('a'), p('b')];
    expect(['a', 'b']).toContain(pick(phrases, ['a', 'b'], Math.random)?.id);
  });

  it('chooses learning group when roll < 0.7 and mastered otherwise', () => {
    const phrases = [p('L'), p('M', { status: 'mastered' })];
    expect(pick(phrases, [], seq(0.5, 0))?.id).toBe('L');
    expect(pick(phrases, [], seq(0.75, 0))?.id).toBe('M');
    expect(MASTERED_CHANCE).toBeCloseTo(0.3);
  });

  it('never picks a graduated phrase', () => {
    const phrases = [p('G', { status: 'graduated' }), p('L'), p('M', { status: 'mastered' })];
    for (let i = 0; i < 500; i++) expect(pick(phrases, ['L', 'M'], Math.random)?.id).not.toBe('G');
  });

  it('returns null when every phrase has graduated', () => {
    expect(pick([p('G', { status: 'graduated' })], [], Math.random)).toBeNull();
  });

  it('uses the other group when the chosen one is empty', () => {
    expect(pick([p('M', { status: 'mastered' })], [], seq(0.1, 0))?.id).toBe('M');
    expect(pick([p('L')], [], seq(0.99, 0))?.id).toBe('L');
  });

  it('favours phrases with a lower seenCount', () => {
    const phrases = [p('new', { seenCount: 0 }), p('old', { seenCount: 9 })];
    let newCount = 0;
    const N = 10000;
    for (let i = 0; i < N; i++) if (pick(phrases, [], Math.random)?.id === 'new') newCount++;
    // weights 1 and 0.1 → expected share ≈ 0.909
    expect(newCount / N).toBeGreaterThan(0.85);
    expect(newCount / N).toBeLessThan(0.96);
  });

  it('roughly respects the 70/30 split', () => {
    const phrases = [p('L'), p('M', { status: 'mastered' })];
    let m = 0;
    const N = 10000;
    for (let i = 0; i < N; i++) if (pick(phrases, [], Math.random)?.id === 'M') m++;
    expect(m / N).toBeGreaterThan(0.26);
    expect(m / N).toBeLessThan(0.34);
  });
});

describe('markSeen', () => {
  const base = (): AppData => ({
    version: 2,
    phrases: [p('a'), p('b')],
    settings: { autoShowOnOpen: true, inboxUrl: '' },
    recentIds: [],
  });

  it('increments seenCount and sets lastSeenAt without mutating input', () => {
    const data = base();
    const out = markSeen(data, 'a', NOW);
    expect(out.phrases[0]).toMatchObject({ seenCount: 1, lastSeenAt: NOW });
    expect(data.phrases[0].seenCount).toBe(0);
  });

  it('keeps recentIds unique, newest last, capped at RECENT_LIMIT', () => {
    let data = base();
    for (const id of ['1', '2', '3', '4', '5', '6', '3']) data = markSeen(data, id, NOW);
    expect(data.recentIds).toEqual(['2', '4', '5', '6', '3']);
    expect(data.recentIds.length).toBe(RECENT_LIMIT);
  });
});
