import { normalizePhrase } from '@/store/validate';
import { Phrase } from '@/types';

/**
 * A raw record from the shared inbox (MockAPI). `id` is the inbox's own id, used only
 * to delete the record; it is never reused as a Phrase id.
 */
export interface InboxItem {
  id: string;
  [field: string]: unknown;
}

export type InboxItemStatus = 'selectable' | 'alreadyAdded' | 'invalid';

/** Fields copied from an inbox record into a Phrase. Everything else is ignored. */
const PHRASE_FIELDS = ['phrase', 'meaning', 'example', 'exampleVi', 'tags'] as const;

/** Comparison key for duplicates: trimmed, inner whitespace collapsed, lower-cased. */
export function phraseKey(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Turns a parsed JSON response into inbox items. Throws if it is not an array. */
export function parseInboxResponse(json: unknown): InboxItem[] {
  if (!Array.isArray(json)) throw new Error('Inbox response is not an array');
  const items: InboxItem[] = [];
  for (const raw of json) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const { id } = raw as Record<string, unknown>;
    // Without an id a record cannot be deleted later, so it is skipped.
    if ((typeof id === 'string' && id !== '') || typeof id === 'number') {
      items.push({ ...(raw as Record<string, unknown>), id: String(id) });
    }
  }
  return items;
}

/** Only the phrase fields of a record, so inbox ids/status/counters never leak in. */
function phraseInput(item: InboxItem): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of PHRASE_FIELDS) if (item[f] !== undefined) out[f] = item[f];
  return out;
}

/** The record as a normalized Phrase, or null if `phrase`/`meaning` are missing. */
export function inboxPhrase(item: InboxItem, now: string): Phrase | null {
  return normalizePhrase(phraseInput(item), now);
}

/** `createdAt` in milliseconds, or null when missing or not a valid date. */
export function createdAtMs(item: InboxItem): number | null {
  const v = item.createdAt;
  if (typeof v !== 'string') return null;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : ms;
}

export function startOfDay(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

export interface DayGroups {
  /** Added since 00:00 today (device time zone), newest first. */
  today: InboxItem[];
  /** Added before today, or without a valid `createdAt`; newest first, undated last. */
  older: InboxItem[];
}

export function splitByDay(items: InboxItem[], now: Date): DayGroups {
  const cutoff = startOfDay(now);
  const newestFirst = (a: InboxItem, b: InboxItem) => (createdAtMs(b) ?? -Infinity) - (createdAtMs(a) ?? -Infinity);
  const today: InboxItem[] = [];
  const older: InboxItem[] = [];
  for (const item of items) {
    const ms = createdAtMs(item);
    (ms !== null && ms >= cutoff ? today : older).push(item);
  }
  return { today: today.sort(newestFirst), older: older.sort(newestFirst) };
}

/** `existingKeys` are the phraseKey()s of the phrases already on the phone. */
export function classify(item: InboxItem, existingKeys: ReadonlySet<string>, now: string): InboxItemStatus {
  const p = inboxPhrase(item, now);
  if (!p) return 'invalid';
  return existingKeys.has(phraseKey(p.phrase)) ? 'alreadyAdded' : 'selectable';
}

/**
 * Builds the phrases to add from the selected records: fresh ids, `learning`, `seenCount` 0,
 * `createdAt` = now. Invalid records, phrases already on the phone and duplicates inside the
 * batch (first one wins) are left out.
 */
export function toImport(selected: InboxItem[], existingKeys: ReadonlySet<string>, now: string): Phrase[] {
  const seen = new Set(existingKeys);
  const out: Phrase[] = [];
  for (const item of selected) {
    const p = inboxPhrase(item, now);
    if (!p) continue;
    const key = phraseKey(p.phrase);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}
