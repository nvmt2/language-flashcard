import seed from '@/data/seed.json';
import {
  ImportError,
  buildExport,
  mergeImport,
  normalizePhrase,
  parseImport,
} from '@/store/validate';
import { Phrase } from '@/types';

const NOW = '2026-11-05T00:00:00.000Z';

const make = (over: Partial<Phrase> = {}): Phrase => ({
  id: 'x1',
  phrase: 'Hello',
  meaning: 'Xin chào',
  status: 'learning',
  seenCount: 0,
  createdAt: NOW,
  ...over,
});

describe('normalizePhrase', () => {
  it('fills defaults for a minimal phrase', () => {
    const p = normalizePhrase({ phrase: ' Hi ', meaning: 'Chào' }, NOW);
    expect(p).toMatchObject({
      phrase: 'Hi',
      meaning: 'Chào',
      status: 'learning',
      seenCount: 0,
      createdAt: NOW,
    });
    expect(typeof p?.id).toBe('string');
    expect(p!.id.length).toBeGreaterThan(0);
  });

  it('keeps valid optional fields', () => {
    const p = normalizePhrase(
      {
        id: 'p9',
        phrase: 'A',
        meaning: 'B',
        example: 'ex',
        exampleVi: 'vd',
        tags: ['idiom', 3, ' daily '],
        status: 'mastered',
        seenCount: 4,
        lastSeenAt: NOW,
        createdAt: '2020-01-01T00:00:00.000Z',
      },
      NOW,
    );
    expect(p).toEqual({
      id: 'p9',
      phrase: 'A',
      meaning: 'B',
      example: 'ex',
      exampleVi: 'vd',
      tags: ['idiom', 'daily'],
      status: 'mastered',
      seenCount: 4,
      lastSeenAt: NOW,
      createdAt: '2020-01-01T00:00:00.000Z',
    });
  });

  it.each([
    [null],
    ['text'],
    [{ phrase: 'only phrase' }],
    [{ meaning: 'only meaning' }],
    [{ phrase: '   ', meaning: 'x' }],
    [{ phrase: 1, meaning: 'x' }],
  ])('rejects invalid input %p', (input) => {
    expect(normalizePhrase(input, NOW)).toBeNull();
  });

  it('repairs bad status / seenCount', () => {
    const p = normalizePhrase({ phrase: 'a', meaning: 'b', status: 'weird', seenCount: -2 }, NOW);
    expect(p?.status).toBe('learning');
    expect(p?.seenCount).toBe(0);
  });

  it('accepts every seed phrase', () => {
    for (const s of seed) expect(normalizePhrase(s, NOW)).not.toBeNull();
  });
});

describe('parseImport', () => {
  it('accepts a bare array', () => {
    const r = parseImport(JSON.stringify([{ phrase: 'a', meaning: 'b' }]), NOW);
    expect(r.valid).toHaveLength(1);
    expect(r.skipped).toBe(0);
  });

  it('accepts { phrases: [...] } and counts skipped items', () => {
    const r = parseImport(
      JSON.stringify({ version: 1, phrases: [{ phrase: 'a', meaning: 'b' }, { phrase: 'x' }, 42] }),
      NOW,
    );
    expect(r.valid).toHaveLength(1);
    expect(r.skipped).toBe(2);
  });

  it('throws ImportError on invalid JSON', () => {
    expect(() => parseImport('{nope', NOW)).toThrow(ImportError);
  });

  it('throws ImportError on wrong shape', () => {
    expect(() => parseImport(JSON.stringify({ foo: 1 }), NOW)).toThrow(ImportError);
  });

  it('dedupes ids inside the same file (last wins)', () => {
    const r = parseImport(
      JSON.stringify([
        { id: 'a', phrase: 'one', meaning: 'm' },
        { id: 'a', phrase: 'two', meaning: 'm' },
      ]),
      NOW,
    );
    expect(r.valid).toHaveLength(1);
    expect(r.valid[0].phrase).toBe('two');
  });
});

describe('mergeImport', () => {
  const existing = [make({ id: 'a', phrase: 'old' }), make({ id: 'b' })];

  it('merge overwrites same id and appends new ones', () => {
    const out = mergeImport(existing, [make({ id: 'a', phrase: 'new' }), make({ id: 'c' })], 'merge');
    expect(out.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(out[0].phrase).toBe('new');
  });

  it('replace drops existing phrases', () => {
    const out = mergeImport(existing, [make({ id: 'c' })], 'replace');
    expect(out.map((p) => p.id)).toEqual(['c']);
  });
});

describe('buildExport', () => {
  it('exports version and phrases only', () => {
    const data = {
      version: 1 as const,
      phrases: [make()],
      settings: { autoShowOnOpen: true, inboxUrl: '' },
      recentIds: ['x1'],
    };
    expect(buildExport(data)).toEqual({ version: 1, phrases: [make()] });
  });

  it('round-trips through parseImport', () => {
    const data = { version: 1 as const, phrases: [make()], settings: { autoShowOnOpen: true, inboxUrl: '' }, recentIds: [] };
    const r = parseImport(JSON.stringify(buildExport(data)), NOW);
    expect(r.valid).toEqual([make()]);
  });
});
