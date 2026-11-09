import {
  classify,
  InboxItem,
  parseInboxResponse,
  phraseKey,
  splitByDay,
  startOfDay,
  toImport,
} from '@/logic/inbox';

const NOW = '2026-11-09T10:00:00.000Z';
const item = (id: string, extra: Record<string, unknown> = {}): InboxItem => ({
  id,
  phrase: `word ${id}`,
  meaning: `nghĩa ${id}`,
  ...extra,
});

describe('phraseKey', () => {
  it('trims, collapses inner whitespace and lower-cases', () => {
    expect(phraseKey('  Break  the\tICE ')).toBe('break the ice');
  });
});

describe('parseInboxResponse', () => {
  it('rejects a non-array response', () => {
    expect(() => parseInboxResponse({ items: [] })).toThrow();
    expect(() => parseInboxResponse(null)).toThrow();
  });

  it('keeps records with an id, stringifying numeric ids', () => {
    const items = parseInboxResponse([{ id: '1', phrase: 'a' }, { id: 2 }, { phrase: 'no id' }, 'junk', null, { id: '' }]);
    expect(items.map((i) => i.id)).toEqual(['1', '2']);
  });
});

describe('splitByDay', () => {
  // Built from local components so the test holds in any time zone.
  const now = new Date(2026, 10, 9, 15, 0);
  const at = (h: number, day = 9) => new Date(2026, 10, day, h, 0).toISOString();

  it('splits at 00:00 local time, newest first', () => {
    const groups = splitByDay(
      [
        item('a', { createdAt: at(9) }),
        item('b', { createdAt: at(23, 8) }),
        item('c', { createdAt: at(14) }),
        item('d', { createdAt: at(0) }),
      ],
      now,
    );
    expect(groups.today.map((i) => i.id)).toEqual(['c', 'a', 'd']);
    expect(groups.older.map((i) => i.id)).toEqual(['b']);
  });

  it('puts missing or invalid createdAt in older, after dated ones', () => {
    const groups = splitByDay(
      [item('x'), item('y', { createdAt: 'not a date' }), item('z', { createdAt: at(10, 7) }), item('n', { createdAt: 12345 })],
      now,
    );
    expect(groups.today).toEqual([]);
    expect(groups.older[0].id).toBe('z');
    expect(groups.older.map((i) => i.id).sort()).toEqual(['n', 'x', 'y', 'z']);
  });

  it('startOfDay is local midnight', () => {
    expect(startOfDay(now)).toBe(new Date(2026, 10, 9).getTime());
  });
});

describe('classify', () => {
  const existing = new Set([phraseKey('Break the ice')]);

  it('marks records missing phrase or meaning as invalid', () => {
    expect(classify({ id: '1', phrase: 'x' }, existing, NOW)).toBe('invalid');
    expect(classify({ id: '1', meaning: 'y' }, existing, NOW)).toBe('invalid');
    expect(classify({ id: '1', phrase: '  ', meaning: 'y' }, existing, NOW)).toBe('invalid');
  });

  it('marks phrases already on the phone, ignoring case and spacing', () => {
    expect(classify({ id: '1', phrase: ' break  THE ice', meaning: 'phá băng' }, existing, NOW)).toBe('alreadyAdded');
  });

  it('marks new valid phrases as selectable', () => {
    expect(classify(item('1'), existing, NOW)).toBe('selectable');
  });
});

describe('toImport', () => {
  it('keeps only the phrase fields and gives fresh learning phrases', () => {
    const [p] = toImport(
      [
        {
          id: '7',
          phrase: ' ubiquitous ',
          meaning: 'có mặt ở khắp nơi',
          example: 'Phones are ubiquitous.',
          exampleVi: 'Điện thoại ở khắp nơi.',
          tags: ['pc', ''],
          status: 'mastered',
          seenCount: 99,
          createdAt: '2020-01-01T00:00:00.000Z',
          lastSeenAt: '2020-01-01T00:00:00.000Z',
          foo: 'bar',
        },
      ],
      new Set(),
      NOW,
    );
    expect(p).toEqual({
      id: expect.any(String),
      phrase: 'ubiquitous',
      meaning: 'có mặt ở khắp nơi',
      example: 'Phones are ubiquitous.',
      exampleVi: 'Điện thoại ở khắp nơi.',
      tags: ['pc'],
      status: 'learning',
      seenCount: 0,
      createdAt: NOW,
    });
    expect(p.id).not.toBe('7');
  });

  it('skips invalid records, phrases already on the phone and duplicates in the batch', () => {
    const out = toImport(
      [
        item('1', { phrase: 'Alpha' }),
        { id: '2', phrase: 'broken' },
        item('3', { phrase: 'alpha ' }),
        item('4', { phrase: 'Beta' }),
        item('5', { phrase: 'Gamma' }),
      ],
      new Set([phraseKey('beta')]),
      NOW,
    );
    expect(out.map((p) => p.phrase)).toEqual(['Alpha', 'Gamma']);
  });

  it('gives each imported phrase a distinct id', () => {
    const out = toImport([item('1'), item('2'), item('3')], new Set(), NOW);
    expect(new Set(out.map((p) => p.id)).size).toBe(3);
  });
});
