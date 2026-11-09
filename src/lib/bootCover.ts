import { hideSplash } from '@/lib/splash';

/**
 * Covers the app from mount until we know what the first screen is, so the home list
 * never flashes before the study card.
 *
 * The native splash only covers the very first start: its "hidden" flag lives in the JS
 * runtime and in the native module. When the app is reopened after Back (activity
 * recreated, JS runtime still alive) the UI remounts on "/" with no splash, then the card
 * is pushed once the store has loaded. A cover created per mount fixes that case too.
 */
export interface BootCover {
  isCovered(): boolean;
  /** Drops the cover. Safe to call more than once. */
  reveal(): void;
  subscribe(listener: () => void): () => void;
}

export function createBootCover(): BootCover {
  let covered = true;
  const listeners = new Set<() => void>();
  return {
    isCovered: () => covered,
    reveal() {
      if (!covered) return;
      covered = false;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const cardShownListeners = new Set<() => void>();

/** Called by the card screen once its first phrase is on screen. Also hides the splash. */
export function notifyCardShown() {
  hideSplash();
  cardShownListeners.forEach((l) => l());
}

export function onCardShown(listener: () => void): () => void {
  cardShownListeners.add(listener);
  return () => {
    cardShownListeners.delete(listener);
  };
}
