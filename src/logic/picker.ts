import { AppData, Phrase, RECENT_LIMIT } from '@/types';

/** Probability of drawing from the mastered group (when both groups have phrases). */
export const MASTERED_CHANCE = 0.3;

type Random = () => number;

function weightedPick(items: Phrase[], random: Random): Phrase {
  const weights = items.map((p) => 1 / (1 + p.seenCount));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * Picks the next phrase to show:
 * never graduated ones, skip recently shown ones, draw learning (70%) vs mastered (30%),
 * then favour phrases that have been seen less.
 */
export function pick(all: Phrase[], recentIds: string[], random: Random = Math.random): Phrase | null {
  const phrases = all.filter((p) => p.status !== 'graduated');
  if (phrases.length === 0) return null;

  const recent = new Set(recentIds);
  const fresh = phrases.filter((p) => !recent.has(p.id));
  const candidates = fresh.length ? fresh : phrases;

  const learning = candidates.filter((p) => p.status === 'learning');
  const mastered = candidates.filter((p) => p.status === 'mastered');
  const preferMastered = random() >= 1 - MASTERED_CHANCE;
  const group = preferMastered ? (mastered.length ? mastered : learning) : learning.length ? learning : mastered;

  return weightedPick(group, random);
}

/** Records that a phrase was shown. Returns a new AppData. */
export function markSeen(data: AppData, id: string, now: string = new Date().toISOString()): AppData {
  return {
    ...data,
    phrases: data.phrases.map((p) => (p.id === id ? { ...p, seenCount: p.seenCount + 1, lastSeenAt: now } : p)),
    recentIds: [...data.recentIds.filter((r) => r !== id), id].slice(-RECENT_LIMIT),
  };
}
