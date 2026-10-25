import { signal } from '../runtime/signal';
import { decide } from './rig';

declare module './rig' {
  interface Decisions {
    dealer: { context: { count: number }; value: number | null };
  }
}

// While a dealer stands at the Salon Privé's tables, its games win this many times as often.
export const DEALER_BOOST = 2;

// A shift at the tables, in minutes from local midnight, and who takes it, by index in the host's list.
export interface Shift {
  start: number;
  end: number;
  dealer: number;
}

const SHIFTS = 3;
const OPENING = 10 * 60;
const SPAN = 260;

// The same shifts for everyone on a local calendar day, from an FNV-1a hash of the date: three of 30 to 90 minutes
// between 10:00 and 23:00, one in each third of that span, the dealers taking them in turn from one the day picks.
export function dealerShifts(date: Date, count: number): Shift[] {
  if (!count) return [];
  let hash = 0x811c9dc5;
  for (const char of `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}:dealer`) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return Array.from({ length: SHIFTS }, (_, index) => {
    const start = OPENING + index * SPAN + ((hash >>> (index * 8)) % 140);
    return { start, end: start + 30 + ((hash >>> (index * 5 + 3)) % 61), dealer: (hash + index) % count };
  });
}

export function shiftAt(date: Date, count: number): number | null {
  const minute = date.getHours() * 60 + date.getMinutes();
  return dealerShifts(date, count).find((shift) => shift.start <= minute && minute < shift.end)?.dealer ?? null;
}

// How many dealers the host gave, and the one at the tables now: null when none is.
export const roster = signal(0);
export const onDuty = signal<number | null>(null);

export function checkDuty(now = new Date()) {
  const count = roster.value;
  onDuty.value = count ? decide('dealer', { count }, () => shiftAt(now, count)) : null;
}
