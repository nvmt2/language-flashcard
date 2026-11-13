import { Phrase } from '@/types';

/** Correct answers in a row that graduate a mastered phrase. */
export const QUIZ_TARGET = 3;

/** Lenient form used to compare answers: case, spaces and punctuation don't matter, spelling does. */
function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isCorrectAnswer(input: string, phrase: string): boolean {
  const answer = normalizeAnswer(input);
  return answer !== '' && answer === normalizeAnswer(phrase);
}

/** Monday 00:00 (device time) of the week containing `d`. */
export function weekStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export interface GraduatedWeek {
  kind: 'this' | 'last' | 'older';
  /** Monday 00:00 of the week. */
  start: Date;
  /** Newest first. */
  phrases: Phrase[];
}

export interface GraduatedSummary {
  thisWeek: number;
  total: number;
  /** Newest week first. */
  weeks: GraduatedWeek[];
}

const gradTime = (p: Phrase) => Date.parse(p.graduatedAt ?? '') || 0;

/** Groups graduated phrases by Monday–Sunday week for the /graduated screen. */
export function graduatedByWeek(phrases: Phrase[], now: Date = new Date()): GraduatedSummary {
  const grads = phrases.filter((p) => p.status === 'graduated').sort((a, b) => gradTime(b) - gradTime(a));
  const thisStart = weekStart(now).getTime();
  const lastStart = weekStart(new Date(thisStart - 1)).getTime();

  const weeks: GraduatedWeek[] = [];
  for (const p of grads) {
    const start = weekStart(new Date(gradTime(p)));
    let week = weeks[weeks.length - 1];
    if (!week || week.start.getTime() !== start.getTime()) {
      const t = start.getTime();
      week = { kind: t === thisStart ? 'this' : t === lastStart ? 'last' : 'older', start, phrases: [] };
      weeks.push(week);
    }
    week.phrases.push(p);
  }
  return { thisWeek: weeks[0]?.kind === 'this' ? weeks[0].phrases.length : 0, total: grads.length, weeks };
}
