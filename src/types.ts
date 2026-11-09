export type PhraseStatus = 'learning' | 'mastered';

export interface Phrase {
  id: string;
  phrase: string;
  meaning: string;
  example?: string;
  exampleVi?: string;
  tags?: string[];
  status: PhraseStatus;
  seenCount: number;
  lastSeenAt?: string;
  createdAt: string;
}

export interface Settings {
  autoShowOnOpen: boolean;
  /** Inbox URL entered in the app. '' means "use the build-time default" (see src/lib/inbox.ts). */
  inboxUrl: string;
}

export const DATA_VERSION = 1 as const;

export interface AppData {
  version: typeof DATA_VERSION;
  phrases: Phrase[];
  settings: Settings;
  /** Most recently shown ids, newest last, max RECENT_LIMIT. */
  recentIds: string[];
}

export const RECENT_LIMIT = 5;

export const DEFAULT_SETTINGS: Settings = { autoShowOnOpen: true, inboxUrl: '' };
