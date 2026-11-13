import AsyncStorage from '@react-native-async-storage/async-storage';

import seed from '@/data/seed.json';
import { phraseKey } from '@/logic/inbox';
import { ImportMode, mergeImport, newId, normalizeList, normalizePhrase } from '@/store/validate';
import { QUIZ_TARGET } from '@/logic/quiz';
import {
  AppData,
  DATA_VERSION,
  DEFAULT_SETTINGS,
  Phrase,
  PhraseStatus,
  RECENT_LIMIT,
  Settings,
  SUPPORTED_VERSIONS,
} from '@/types';

export const STORAGE_KEY = 'lockscreen-english/data';
export const CORRUPT_PREFIX = 'lockscreen-english/corrupt-';

const nowIso = () => new Date().toISOString();

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ───────────────────────── creation / migration ─────────────────────────

export function createSeedData(now: string = nowIso()): AppData {
  return {
    version: DATA_VERSION,
    phrases: normalizeList(seed, now).valid,
    settings: { ...DEFAULT_SETTINGS },
    recentIds: [],
  };
}

/** Upgrades stored JSON to the current AppData shape. Throws if it is unusable. */
export function migrate(raw: unknown, now: string = nowIso()): AppData {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('Not an object');
  const r = raw as Record<string, unknown>;
  if (typeof r.version !== 'number' || !SUPPORTED_VERSIONS.includes(r.version)) throw new Error(`Unsupported data version: ${String(r.version)}`);
  if (!Array.isArray(r.phrases)) throw new Error('Missing phrases');

  const phrases = normalizeList(r.phrases, now).valid;
  const ids = new Set(phrases.map((p) => p.id));
  const settings =
    typeof r.settings === 'object' && r.settings !== null ? (r.settings as Partial<Settings>) : {};
  return {
    version: DATA_VERSION,
    phrases,
    settings: {
      autoShowOnOpen:
        typeof settings.autoShowOnOpen === 'boolean' ? settings.autoShowOnOpen : DEFAULT_SETTINGS.autoShowOnOpen,
      inboxUrl: typeof settings.inboxUrl === 'string' ? settings.inboxUrl.trim() : DEFAULT_SETTINGS.inboxUrl,
    },
    recentIds: Array.isArray(r.recentIds)
      ? r.recentIds.filter((x): x is string => typeof x === 'string' && ids.has(x)).slice(-RECENT_LIMIT)
      : [],
  };
}

// ───────────────────────── persistence ─────────────────────────

export interface LoadResult {
  data: AppData;
  /** True when stored JSON was unreadable: it was backed up and the seed was loaded. */
  recoveredFromCorrupt: boolean;
}

export async function loadData(now: string = nowIso()): Promise<LoadResult> {
  const text = await AsyncStorage.getItem(STORAGE_KEY);
  if (text == null) {
    const data = createSeedData(now);
    await saveData(data);
    return { data, recoveredFromCorrupt: false };
  }
  try {
    return { data: migrate(JSON.parse(text), now), recoveredFromCorrupt: false };
  } catch {
    await AsyncStorage.setItem(`${CORRUPT_PREFIX}${Date.parse(now)}`, text);
    const data = createSeedData(now);
    await saveData(data);
    return { data, recoveredFromCorrupt: true };
  }
}

export async function saveData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ───────────────────────── pure operations ─────────────────────────

export interface PhraseInput {
  phrase: string;
  meaning: string;
  example?: string;
  exampleVi?: string;
  tags?: string[];
}

function validated(input: PhraseInput, base: Partial<Phrase>, now: string): Phrase {
  const p = normalizePhrase({ ...base, ...input }, now);
  if (!p) throw new ValidationError('Cần nhập cả cụm từ và nghĩa.');
  return p;
}

export function addPhrase(data: AppData, input: PhraseInput, now: string = nowIso()): { data: AppData; phrase: Phrase } {
  const phrase = validated(input, { createdAt: now }, now);
  return { data: { ...data, phrases: [...data.phrases, phrase] }, phrase };
}

/**
 * Appends already-normalized phrases in one change (inbox import). Phrases whose text is
 * already on the phone (same phraseKey) or repeated in the batch are skipped.
 */
export function addPhrases(data: AppData, incoming: Phrase[]): { data: AppData; added: Phrase[] } {
  const keys = new Set(data.phrases.map((p) => phraseKey(p.phrase)));
  const ids = new Set(data.phrases.map((p) => p.id));
  const added: Phrase[] = [];
  for (const p of incoming) {
    const key = phraseKey(p.phrase);
    if (keys.has(key)) continue;
    keys.add(key);
    const phrase = ids.has(p.id) ? { ...p, id: newId() } : p;
    ids.add(phrase.id);
    added.push(phrase);
  }
  return { data: added.length ? { ...data, phrases: [...data.phrases, ...added] } : data, added };
}

export function updatePhrase(data: AppData, id: string, input: PhraseInput, now: string = nowIso()): AppData {
  const existing = data.phrases.find((p) => p.id === id);
  if (!existing) throw new ValidationError('Không tìm thấy câu cần sửa.');
  // Optional fields not present in input are cleared (form sends the full set).
  const { example: _e, exampleVi: _v, tags: _t, ...keep } = existing;
  const next = validated(input, { ...keep, id }, now);
  return { ...data, phrases: data.phrases.map((p) => (p.id === id ? next : p)) };
}

export function deletePhrase(data: AppData, id: string): AppData {
  return {
    ...data,
    phrases: data.phrases.filter((p) => p.id !== id),
    recentIds: data.recentIds.filter((r) => r !== id),
  };
}

/** Drops quiz progress: a status change always starts the streak over. */
function withStatus(p: Phrase, status: PhraseStatus, graduatedAt?: string): Phrase {
  const { quizStreak: _s, graduatedAt: _g, ...rest } = p;
  return graduatedAt ? { ...rest, status, graduatedAt } : { ...rest, status };
}

export function setStatus(data: AppData, id: string, status: PhraseStatus, now: string = nowIso()): AppData {
  return {
    ...data,
    phrases: data.phrases.map((p) => (p.id === id ? withStatus(p, status, status === 'graduated' ? now : undefined) : p)),
  };
}

/**
 * Records a quiz answer on a mastered phrase. A wrong answer resets the streak;
 * the QUIZ_TARGET-th correct answer in a row graduates the phrase.
 */
export function answerQuiz(
  data: AppData,
  id: string,
  correct: boolean,
  now: string = nowIso(),
): { data: AppData; graduated: boolean } {
  const p = data.phrases.find((x) => x.id === id);
  if (!p || p.status !== 'mastered') return { data, graduated: false };

  const streak = correct ? (p.quizStreak ?? 0) + 1 : 0;
  const graduated = streak >= QUIZ_TARGET;
  const next = graduated
    ? withStatus(p, 'graduated', now)
    : streak > 0
      ? { ...p, quizStreak: streak }
      : withStatus(p, 'mastered');
  return { data: { ...data, phrases: data.phrases.map((x) => (x.id === id ? next : x)) }, graduated };
}

/** Sends a phrase (usually graduated) back to learning, from zero. */
export function restorePhrase(data: AppData, id: string): AppData {
  return setStatus(data, id, 'learning');
}

export function updateSettings(data: AppData, patch: Partial<Settings>): AppData {
  return { ...data, settings: { ...data.settings, ...patch } };
}

export function resetToSeed(data: AppData, now: string = nowIso()): AppData {
  return { ...createSeedData(now), settings: data.settings };
}

export function importPhrases(data: AppData, incoming: Phrase[], mode: ImportMode): AppData {
  const phrases = mergeImport(data.phrases, incoming, mode);
  const ids = new Set(phrases.map((p) => p.id));
  return { ...data, phrases, recentIds: data.recentIds.filter((r) => ids.has(r)) };
}
