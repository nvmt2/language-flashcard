import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { markSeen, pick } from '@/logic/picker';
import * as ops from '@/store/phrases';
import { ImportMode } from '@/store/validate';
import { AppData, DEFAULT_SETTINGS, Phrase, PhraseStatus, Settings } from '@/types';

interface PhraseStore {
  ready: boolean;
  data: AppData;
  /** Set when stored data was corrupt and the seed was restored. */
  recoveredFromCorrupt: boolean;
  dismissRecoveryNotice: () => void;
  add: (input: ops.PhraseInput) => Promise<Phrase>;
  /** Adds normalized phrases in one write, skipping ones already on the phone. Returns those added. */
  addPhrases: (phrases: Phrase[]) => Promise<Phrase[]>;
  update: (id: string, input: ops.PhraseInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setStatus: (id: string, status: PhraseStatus) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  resetToSeed: () => Promise<void>;
  importPhrases: (incoming: Phrase[], mode: ImportMode) => Promise<void>;
  /** Picks the next phrase, records it as seen and returns it. */
  showNext: () => Promise<Phrase | null>;
}

const EMPTY: AppData = { version: 1, phrases: [], settings: { ...DEFAULT_SETTINGS }, recentIds: [] };

const Ctx = createContext<PhraseStore | null>(null);

export function PhraseStoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY);
  const [ready, setReady] = useState(false);
  const [recoveredFromCorrupt, setRecovered] = useState(false);
  const latest = useRef<AppData>(EMPTY);

  useEffect(() => {
    let alive = true;
    ops
      .loadData()
      .then((r) => {
        if (!alive) return;
        latest.current = r.data;
        setData(r.data);
        setRecovered(r.recoveredFromCorrupt);
      })
      .catch(() => {
        // Storage unreadable at all: run in memory on the seed.
        if (!alive) return;
        const seed = ops.createSeedData();
        latest.current = seed;
        setData(seed);
        setRecovered(true);
      })
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  /** Applies a change in memory first, then persists. Rejects if the write fails (state is kept). */
  const commit = useCallback(async (next: AppData) => {
    latest.current = next;
    setData(next);
    await ops.saveData(next);
  }, []);

  const value = useMemo<PhraseStore>(
    () => ({
      ready,
      data,
      recoveredFromCorrupt,
      dismissRecoveryNotice: () => setRecovered(false),
      add: async (input) => {
        const r = ops.addPhrase(latest.current, input);
        await commit(r.data);
        return r.phrase;
      },
      addPhrases: async (phrases) => {
        const r = ops.addPhrases(latest.current, phrases);
        if (r.added.length) await commit(r.data);
        return r.added;
      },
      update: (id, input) => commit(ops.updatePhrase(latest.current, id, input)),
      remove: (id) => commit(ops.deletePhrase(latest.current, id)),
      setStatus: (id, status) => commit(ops.setStatus(latest.current, id, status)),
      updateSettings: (patch) => commit(ops.updateSettings(latest.current, patch)),
      resetToSeed: () => commit(ops.resetToSeed(latest.current)),
      importPhrases: (incoming, mode) => commit(ops.importPhrases(latest.current, incoming, mode)),
      showNext: async () => {
        const next = pick(latest.current.phrases, latest.current.recentIds);
        if (!next) return null;
        const updated = markSeen(latest.current, next.id);
        await commit(updated);
        return updated.phrases.find((p) => p.id === next.id) ?? next;
      },
    }),
    [ready, data, recoveredFromCorrupt, commit],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePhraseStore(): PhraseStore {
  const store = useContext(Ctx);
  if (!store) throw new Error('usePhraseStore must be used inside PhraseStoreProvider');
  return store;
}
