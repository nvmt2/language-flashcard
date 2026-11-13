import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CORRUPT_PREFIX,
  STORAGE_KEY,
  ValidationError,
  addPhrase,
  addPhrases,
  answerQuiz,
  createSeedData,
  deletePhrase,
  importPhrases,
  loadData,
  migrate,
  resetToSeed,
  restorePhrase,
  saveData,
  setStatus,
  updatePhrase,
  updateSettings,
} from '@/store/phrases';
import { AppData, Phrase } from '@/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const NOW = '2026-11-05T00:00:00.000Z';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('loadData', () => {
  it('seeds and persists on first run', async () => {
    const { data, recoveredFromCorrupt } = await loadData(NOW);
    expect(recoveredFromCorrupt).toBe(false);
    expect(data.phrases).toHaveLength(50);
    expect(data.phrases.every((p) => p.status === 'learning' && p.seenCount === 0)).toBe(true);
    expect(JSON.parse((await AsyncStorage.getItem(STORAGE_KEY))!)).toEqual(data);
  });

  it('reads back what was saved', async () => {
    const data = setStatus(createSeedData(NOW), 'p001', 'mastered');
    await saveData(data);
    const loaded = await loadData(NOW);
    expect(loaded.data).toEqual(data);
  });

  it('backs up corrupt JSON and falls back to seed', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, '{broken');
    const { data, recoveredFromCorrupt } = await loadData(NOW);
    expect(recoveredFromCorrupt).toBe(true);
    expect(data.phrases).toHaveLength(50);
    expect(await AsyncStorage.getItem(`${CORRUPT_PREFIX}${Date.parse(NOW)}`)).toBe('{broken');
  });
});

describe('migrate', () => {
  it('keeps valid current data intact', () => {
    const data = createSeedData(NOW);
    expect(data.version).toBe(2);
    expect(migrate(JSON.parse(JSON.stringify(data)), NOW)).toEqual(data);
  });

  it('upgrades version-1 data to version 2 without losing phrases', () => {
    const out = migrate(
      { version: 1, phrases: [{ id: 'a', phrase: 'x', meaning: 'y', status: 'mastered', seenCount: 4 }], recentIds: ['a'] },
      NOW,
    );
    expect(out.version).toBe(2);
    expect(out.phrases[0]).toMatchObject({ id: 'a', status: 'mastered', seenCount: 4 });
    expect(out.phrases[0].quizStreak).toBeUndefined();
    expect(out.recentIds).toEqual(['a']);
  });

  it('repairs settings and drops unknown recent ids', () => {
    const out = migrate({ version: 1, phrases: [{ id: 'a', phrase: 'x', meaning: 'y' }], recentIds: ['a', 'zz', 3] }, NOW);
    expect(out.settings).toEqual({ autoShowOnOpen: true, inboxUrl: '' });
    expect(out.recentIds).toEqual(['a']);
  });

  it('adds inboxUrl to settings saved before the inbox existed, keeping the rest', () => {
    const out = migrate({ version: 1, phrases: [], settings: { autoShowOnOpen: false }, recentIds: [] }, NOW);
    expect(out.settings).toEqual({ autoShowOnOpen: false, inboxUrl: '' });
  });

  it('keeps a stored inboxUrl and drops a non-string one', () => {
    const keep = migrate({ version: 1, phrases: [], settings: { inboxUrl: ' https://x.test/inbox ' } }, NOW);
    expect(keep.settings.inboxUrl).toBe('https://x.test/inbox');
    const bad = migrate({ version: 1, phrases: [], settings: { inboxUrl: 42 } }, NOW);
    expect(bad.settings.inboxUrl).toBe('');
  });

  it.each([[null], [[]], [{ version: 99, phrases: [] }], [{ version: 1 }]])('throws on %p', (raw) => {
    expect(() => migrate(raw, NOW)).toThrow();
  });
});

describe('pure operations', () => {
  const base = (): AppData => ({ ...createSeedData(NOW), recentIds: ['p001'] });

  it('addPhrase appends a normalized phrase', () => {
    const { data, phrase } = addPhrase(base(), { phrase: ' New ', meaning: 'Mới', tags: ['a'] }, NOW);
    expect(data.phrases).toHaveLength(51);
    expect(phrase).toMatchObject({ phrase: 'New', meaning: 'Mới', status: 'learning', seenCount: 0, tags: ['a'] });
  });

  it('addPhrase rejects missing required fields', () => {
    expect(() => addPhrase(base(), { phrase: '', meaning: 'x' }, NOW)).toThrow(ValidationError);
  });

  it('updatePhrase keeps progress, replaces content and clears removed optionals', () => {
    let data = setStatus(base(), 'p001', 'mastered');
    data = updatePhrase(data, 'p001', { phrase: 'Edited', meaning: 'M' }, NOW);
    const p = data.phrases.find((x) => x.id === 'p001')!;
    expect(p).toMatchObject({ phrase: 'Edited', meaning: 'M', status: 'mastered' });
    expect(p.example).toBeUndefined();
    expect(p.tags).toBeUndefined();
  });

  it('updatePhrase throws for unknown id', () => {
    expect(() => updatePhrase(base(), 'nope', { phrase: 'a', meaning: 'b' })).toThrow(ValidationError);
  });

  it('deletePhrase removes phrase and its recent entry', () => {
    const data = deletePhrase(base(), 'p001');
    expect(data.phrases.find((p) => p.id === 'p001')).toBeUndefined();
    expect(data.recentIds).toEqual([]);
  });

  it('updateSettings merges settings', () => {
    expect(updateSettings(base(), { autoShowOnOpen: false }).settings.autoShowOnOpen).toBe(false);
  });

  it('resetToSeed keeps settings', () => {
    const data = updateSettings(deletePhrase(base(), 'p002'), { autoShowOnOpen: false });
    const out = resetToSeed(data, NOW);
    expect(out.phrases).toHaveLength(50);
    expect(out.settings.autoShowOnOpen).toBe(false);
  });

  it('setStatus resets quiz progress', () => {
    let data = setStatus(base(), 'p001', 'mastered');
    data = answerQuiz(data, 'p001', true, NOW).data;
    data = setStatus(data, 'p001', 'learning');
    const p = data.phrases.find((x) => x.id === 'p001')!;
    expect(p.status).toBe('learning');
    expect(p.quizStreak).toBeUndefined();
  });

  it('importPhrases replace drops recent ids that no longer exist', () => {
    const incoming = [{ id: 'z', phrase: 'z', meaning: 'z', status: 'learning' as const, seenCount: 0, createdAt: NOW }];
    const out = importPhrases(base(), incoming, 'replace');
    expect(out.phrases.map((p) => p.id)).toEqual(['z']);
    expect(out.recentIds).toEqual([]);
  });
});

describe('addPhrases', () => {
  const phrase = (id: string, text: string): Phrase => ({
    id,
    phrase: text,
    meaning: 'm',
    status: 'learning',
    seenCount: 0,
    createdAt: NOW,
  });
  const base = (): AppData => ({ ...createSeedData(NOW), phrases: [phrase('p1', 'Break the ice')] });

  it('appends new phrases in one change', () => {
    const r = addPhrases(base(), [phrase('n1', 'alpha'), phrase('n2', 'beta')]);
    expect(r.added.map((p) => p.phrase)).toEqual(['alpha', 'beta']);
    expect(r.data.phrases.map((p) => p.phrase)).toEqual(['Break the ice', 'alpha', 'beta']);
  });

  it('skips phrases already on the phone and duplicates in the batch', () => {
    const r = addPhrases(base(), [phrase('n1', ' break  THE ice'), phrase('n2', 'Alpha'), phrase('n3', 'alpha')]);
    expect(r.added.map((p) => p.id)).toEqual(['n2']);
    expect(r.data.phrases).toHaveLength(2);
  });

  it('re-ids a phrase whose id is already taken', () => {
    const r = addPhrases(base(), [phrase('p1', 'gamma')]);
    expect(r.added[0].id).not.toBe('p1');
    expect(new Set(r.data.phrases.map((p) => p.id)).size).toBe(2);
  });

  it('returns the same data object when nothing is added', () => {
    const data = base();
    expect(addPhrases(data, [phrase('n1', 'break the ice')]).data).toBe(data);
  });
});

describe('answerQuiz', () => {
  const LATER = '2026-11-13T09:00:00.000Z';
  const base = (): AppData => setStatus(createSeedData(NOW), 'p001', 'mastered');
  const get = (data: AppData) => data.phrases.find((x) => x.id === 'p001')!;

  it('counts a correct answer', () => {
    const r = answerQuiz(base(), 'p001', true, LATER);
    expect(get(r.data).quizStreak).toBe(1);
    expect(get(r.data).status).toBe('mastered');
    expect(r.graduated).toBe(false);
  });

  it('graduates the phrase on the third correct answer in a row', () => {
    let data = base();
    data = answerQuiz(data, 'p001', true, LATER).data;
    data = answerQuiz(data, 'p001', true, LATER).data;
    const r = answerQuiz(data, 'p001', true, LATER);
    expect(r.graduated).toBe(true);
    expect(get(r.data)).toMatchObject({ status: 'graduated', graduatedAt: LATER });
    expect(get(r.data).quizStreak).toBeUndefined();
  });

  it('resets the streak on a wrong answer', () => {
    let data = base();
    data = answerQuiz(data, 'p001', true, LATER).data;
    data = answerQuiz(data, 'p001', true, LATER).data;
    const r = answerQuiz(data, 'p001', false, LATER);
    expect(get(r.data).quizStreak).toBeUndefined();
    expect(get(r.data).status).toBe('mastered');
    expect(r.graduated).toBe(false);
  });

  it('ignores phrases that are not mastered', () => {
    const data = createSeedData(NOW);
    expect(answerQuiz(data, 'p001', true, LATER).data).toBe(data);
    expect(answerQuiz(data, 'nope', true, LATER).data).toBe(data);
  });
});

describe('restorePhrase', () => {
  it('sends a graduated phrase back to learning', () => {
    let data = setStatus(createSeedData(NOW), 'p001', 'mastered');
    for (let i = 0; i < 3; i++) data = answerQuiz(data, 'p001', true, NOW).data;
    data = restorePhrase(data, 'p001');
    const p = data.phrases.find((x) => x.id === 'p001')!;
    expect(p.status).toBe('learning');
    expect(p.quizStreak).toBeUndefined();
    expect(p.graduatedAt).toBeUndefined();
  });
});
