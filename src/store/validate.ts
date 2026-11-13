import { QUIZ_TARGET } from '@/logic/quiz';
import { AppData, DATA_VERSION, Phrase, PhraseStatus } from '@/types';

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

export type ImportMode = 'merge' | 'replace';

export interface ImportResult {
  valid: Phrase[];
  skipped: number;
}

export interface ExportFile {
  version: typeof DATA_VERSION;
  phrases: Phrase[];
}

export function newId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

const nonEmpty = (x: unknown): string | undefined =>
  typeof x === 'string' && x.trim() !== '' ? x.trim() : undefined;

const STATUSES: readonly PhraseStatus[] = ['learning', 'mastered', 'graduated'];
const toStatus = (x: unknown): PhraseStatus => (STATUSES.includes(x as PhraseStatus) ? (x as PhraseStatus) : 'learning');

const isIsoDate = (x: unknown): x is string =>
  typeof x === 'string' && !Number.isNaN(Date.parse(x));

/** Turns unknown input into a valid Phrase, or null if `phrase`/`meaning` are missing. */
export function normalizePhrase(input: unknown, now: string): Phrase | null {
  if (!isRecord(input)) return null;
  const phrase = nonEmpty(input.phrase);
  const meaning = nonEmpty(input.meaning);
  if (!phrase || !meaning) return null;

  const out: Phrase = {
    id: nonEmpty(input.id) ?? newId(),
    phrase,
    meaning,
    status: toStatus(input.status),
    seenCount:
      typeof input.seenCount === 'number' && Number.isFinite(input.seenCount) && input.seenCount > 0
        ? Math.floor(input.seenCount)
        : 0,
    createdAt: isIsoDate(input.createdAt) ? input.createdAt : now,
  };

  const example = nonEmpty(input.example);
  if (example) out.example = example;
  const exampleVi = nonEmpty(input.exampleVi);
  if (exampleVi) out.exampleVi = exampleVi;
  if (Array.isArray(input.tags)) {
    const tags = input.tags.map(nonEmpty).filter((t): t is string => !!t);
    if (tags.length) out.tags = tags;
  }
  if (isIsoDate(input.lastSeenAt)) out.lastSeenAt = input.lastSeenAt;

  if (out.status === 'mastered' && typeof input.quizStreak === 'number' && Number.isFinite(input.quizStreak)) {
    const streak = Math.min(Math.floor(input.quizStreak), QUIZ_TARGET - 1);
    if (streak > 0) out.quizStreak = streak;
  }
  if (out.status === 'graduated') out.graduatedAt = isIsoDate(input.graduatedAt) ? input.graduatedAt : now;

  return out;
}

/** Normalizes a list, dropping invalid entries and de-duplicating ids (last wins). */
export function normalizeList(items: unknown[], now: string): ImportResult {
  const byId = new Map<string, Phrase>();
  let skipped = 0;
  for (const item of items) {
    const p = normalizePhrase(item, now);
    if (!p) {
      skipped++;
      continue;
    }
    byId.delete(p.id); // keep insertion order of the last occurrence
    byId.set(p.id, p);
  }
  return { valid: [...byId.values()], skipped };
}

/** Parses an import file: either `[...]` or `{ phrases: [...] }`. */
export function parseImport(text: string, now: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError('File không phải JSON hợp lệ.');
  }
  const items = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.phrases) ? raw.phrases : null;
  if (!items) throw new ImportError('Không tìm thấy danh sách câu (cần mảng [...] hoặc { "phrases": [...] }).');
  return normalizeList(items, now);
}

export function mergeImport(existing: Phrase[], incoming: Phrase[], mode: ImportMode): Phrase[] {
  if (mode === 'replace') return [...incoming];
  const incomingById = new Map(incoming.map((p) => [p.id, p]));
  const merged = existing.map((p) => incomingById.get(p.id) ?? p);
  const existingIds = new Set(existing.map((p) => p.id));
  return [...merged, ...incoming.filter((p) => !existingIds.has(p.id))];
}

export function buildExport(data: AppData): ExportFile {
  return { version: data.version, phrases: data.phrases };
}
