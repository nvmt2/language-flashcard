import { InboxItem, parseInboxResponse } from '@/logic/inbox';
import { Settings } from '@/types';

/**
 * The only module that knows the inbox is a MockAPI resource. Swapping the backend
 * (e.g. Supabase) means rewriting this file only. Spec: GitHub issue #29.
 */

/**
 * Inbox URL baked in at build time. Must stay a static `process.env.EXPO_PUBLIC_*`
 * member access: babel-preset-expo only inlines that exact form.
 */
export const BUILD_INBOX_URL: string = (process.env.EXPO_PUBLIC_INBOX_URL ?? '').trim();

/** The URL in use: the one entered in the app, else the build-time one, else null. */
export function resolveInboxUrl(settings: Pick<Settings, 'inboxUrl'>, buildUrl: string = BUILD_INBOX_URL): string | null {
  const own = settings.inboxUrl.trim();
  if (own) return own;
  const fallback = buildUrl.trim();
  return fallback || null;
}

/** '' (use the default) or an https URL. */
export function isValidInboxUrl(value: string): boolean {
  const v = value.trim();
  if (v === '') return true;
  return /^https:\/\/[^\s/]+\.[^\s/]+(\/\S*)?$/i.test(v);
}

export type InboxErrorKind = 'network' | 'timeout' | 'http' | 'invalid';

export class InboxError extends Error {
  constructor(
    readonly kind: InboxErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'InboxError';
  }
}

/** User-facing (Vietnamese) text for an inbox failure. */
export function describeInboxError(e: unknown): string {
  if (!(e instanceof InboxError)) return 'Có lỗi khi đọc hộp thư.';
  switch (e.kind) {
    case 'timeout':
    case 'network':
      return 'Không kết nối được hộp thư.';
    case 'http':
      return `Hộp thư trả về lỗi ${e.status}.`;
    case 'invalid':
      return 'Dữ liệu hộp thư không hợp lệ.';
  }
}

export const INBOX_TIMEOUT_MS = 10_000;

interface RequestOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

async function request(url: string, init: RequestInit, opts: RequestOptions): Promise<Response> {
  const { fetchImpl = fetch, timeoutMs = INBOX_TIMEOUT_MS } = opts;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch {
    throw timedOut
      ? new InboxError('timeout', 'Inbox request timed out')
      : new InboxError('network', 'Inbox request failed');
  } finally {
    clearTimeout(timer);
  }
}

const itemUrl = (url: string, id: string) => `${url.replace(/\/+$/, '')}/${encodeURIComponent(id)}`;

/** GETs every record in the inbox. */
export async function fetchInbox(url: string, opts: RequestOptions = {}): Promise<InboxItem[]> {
  const res = await request(url, { method: 'GET', headers: { Accept: 'application/json' } }, opts);
  if (!res.ok) throw new InboxError('http', `Inbox GET failed: ${res.status}`, res.status);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new InboxError('invalid', 'Inbox response is not JSON');
  }
  try {
    return parseInboxResponse(json);
  } catch {
    throw new InboxError('invalid', 'Inbox response is not an array');
  }
}

/** DELETEs one record. A 404 counts as success: someone else already removed it. */
export async function deleteInboxItem(url: string, id: string, opts: RequestOptions = {}): Promise<void> {
  const res = await request(itemUrl(url, id), { method: 'DELETE' }, opts);
  if (!res.ok && res.status !== 404) throw new InboxError('http', `Inbox DELETE failed: ${res.status}`, res.status);
}

export interface DeleteResult {
  deleted: number;
  /** Ids that could not be deleted (network or HTTP error). */
  failed: string[];
}

/** Deletes records one by one, carrying on past failures so a retry only redoes the rest. */
export async function deleteInboxItems(url: string, ids: string[], opts: RequestOptions = {}): Promise<DeleteResult> {
  const failed: string[] = [];
  let deleted = 0;
  for (const id of ids) {
    try {
      await deleteInboxItem(url, id, opts);
      deleted++;
    } catch {
      failed.push(id);
    }
  }
  return { deleted, failed };
}
