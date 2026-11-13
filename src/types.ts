/** `graduated`: answered correctly QUIZ_TARGET times in a row, never shown again. */
export type PhraseStatus = 'learning' | 'mastered' | 'graduated';

export interface Phrase {
  id: string;
  phrase: string;
  meaning: string;
  example?: string;
  exampleVi?: string;
  tags?: string[];
  status: PhraseStatus;
  /** Correct quiz answers in a row (mastered only, 1..QUIZ_TARGET-1). Absent means 0. */
  quizStreak?: number;
  /** When the phrase graduated (graduated only). */
  graduatedAt?: string;
  seenCount: number;
  lastSeenAt?: string;
  createdAt: string;
}

export interface Settings {
  autoShowOnOpen: boolean;
  /** Inbox URL entered in the app. '' means "use the build-time default" (see src/lib/inbox.ts). */
  inboxUrl: string;
}

export const DATA_VERSION = 2 as const;
/** Versions migrate() can read. v1 → v2 added the `graduated` status and quiz fields. */
export const SUPPORTED_VERSIONS: readonly number[] = [1, 2];

export interface AppData {
  version: typeof DATA_VERSION;
  phrases: Phrase[];
  settings: Settings;
  /** Most recently shown ids, newest last, max RECENT_LIMIT. */
  recentIds: string[];
}

export const RECENT_LIMIT = 5;

export const DEFAULT_SETTINGS: Settings = { autoShowOnOpen: true, inboxUrl: '' };
