import type { Prize, Tier } from '../config/types';
import { awardKey, prizesPaying, type Award, type Board } from './awards';
import { pick } from './random';
import { gamePrize, tierOdds } from './tiers';

/* The Grand Wheel: 54 segments that say what they pay; the tier picks where the wheel stops. */

export type WheelSegment =
  | { kind: 'none' }
  // pale: the light small segments of the layout, for variety on the wheel.
  | { kind: 'small'; award: Award; pale: boolean }
  | { kind: 'big'; award: Award }
  | { kind: 'coin' | 'hunt' | 'pachinko' }
  | { kind: 'jackpot' };

declare module './rig' {
  interface Decisions {
    'wheel.booster': { context: { boost: number; segments: WheelSegment[] }; value: string };
    'wheel.segment': { context: { tier: Tier; segments: WheelSegment[] }; value: number };
  }
}

type Spot = 'small' | 'pale' | 'big' | 'coin' | 'hunt' | 'pachinko' | 'jackpot';

// A ring of nothing broken by prizes, so each prize sits between two blanks.
const LAYOUT: Spot[] = [
  'jackpot', 'small', 'big', 'coin', 'pale', 'small', 'hunt', 'big', 'small', 'pachinko',
  'pale', 'small', 'coin', 'big', 'pale', 'small', 'hunt', 'big', 'small', 'coin',
  'pale', 'big', 'pachinko', 'small', 'pale', 'coin', 'small',
];

// The small and big segments take the board's awards in turn, so neighbours differ.
export function wheelSegments(board: Board): WheelSegment[] {
  let small = 0;
  let big = 0;
  return LAYOUT.flatMap((spot): WheelSegment[] => {
    const segment: WheelSegment =
      spot === 'small' || spot === 'pale'
        ? { kind: 'small', award: board.small[small++ % board.small.length]!, pale: spot === 'pale' }
        : spot === 'big'
          ? { kind: 'big', award: board.big[big++ % board.big.length]! }
          : { kind: spot };
    return [segment, { kind: 'none' }];
  });
}

// A win lands on a bonus game four times in ten: the bonus then reveals the same prize.
const BONUS_SHARE = 0.4;
export const isBonus = (segment: WheelSegment) => segment.kind === 'coin' || segment.kind === 'hunt' || segment.kind === 'pachinko';

const indexes = (segments: WheelSegment[], match: (segment: WheelSegment) => boolean) =>
  segments.flatMap((segment, index) => (match(segment) ? [index] : []));

export function wheelTarget(segments: WheelSegment[], tier: Tier): { index: number; bonus: boolean } {
  if (tier === 'jackpot') return { index: indexes(segments, (segment) => segment.kind === 'jackpot')[0]!, bonus: false };
  if (tier === 'none') return { index: pick(indexes(segments, (segment) => segment.kind === 'none')), bonus: false };
  if (Math.random() < BONUS_SHARE) return { index: pick(indexes(segments, isBonus)), bonus: true };
  return { index: pick(indexes(segments, (segment) => segment.kind === tier)), bonus: false };
}

export const segmentKey = (segment: WheelSegment) => (segment.kind === 'small' || segment.kind === 'big' ? awardKey(segment.kind, segment.award) : segment.kind);

// The Booster of the day picks one kind of segment, which comes out boost times as often.
export const boosterKeys = (segments: WheelSegment[]) => [...new Set(segments.filter((segment) => segment.kind !== 'none').map(segmentKey))];

// Where the wheel stops on the day of the Booster: each segment as likely as the tiers make it, the
// boosted ones boost times as likely, the gain taken from the blanks.
export function wheelLanding(segments: WheelSegment[], boosted: string, boost: number, roll = Math.random()): { index: number; tier: Tier } {
  const tiers = tierOdds();
  const { small, big, jackpot } = tiers;
  const count = (match: (segment: WheelSegment) => boolean) => segments.filter(match).length;
  const odds = (segment: WheelSegment) => {
    if (segment.kind === 'jackpot') return jackpot;
    if (isBonus(segment)) return (BONUS_SHARE * (small + big)) / count(isBonus);
    if (segment.kind === 'small' || segment.kind === 'big') {
      const kind = segment.kind;
      return ((1 - BONUS_SHARE) * tiers[kind]) / count((other) => other.kind === kind);
    }
    return 0;
  };
  const raw = segments.map((segment) => odds(segment) * (segmentKey(segment) === boosted ? boost : 1));
  // Generous odds times a boost can pass 1: then the winning segments share the whole wheel.
  const total = raw.reduce((sum, weight) => sum + weight, 0);
  const weights = total > 1 ? raw.map((weight) => weight / total) : raw;
  const blank = Math.max(0, 1 - Math.min(1, total)) / count((segment) => segment.kind === 'none');
  let left = roll;
  const found = segments.findIndex((segment, at) => (left -= segment.kind === 'none' ? blank : weights[at]!) < 0);
  // A roll a hair under 1 can run past the end by rounding: it lands on the last segment that pays.
  const index = found >= 0 ? found : segments.reduce((last, segment, at) => (segment.kind === 'none' ? last : at), 0);
  const segment = segments[index]!;
  if (isBonus(segment)) return { index, tier: Math.random() < small / (small + big) ? 'small' : 'big' };
  return { index, tier: segment.kind as Tier };
}

// The prize the Booster stops on: one that pays the segment's award, any prize for the other segments.
export function wheelPrize(prizes: Prize[], segment: WheelSegment) {
  const paying = segment.kind === 'small' || segment.kind === 'big' ? prizesPaying(prizes, segment.kind, segment.award) : prizes;
  const id = gamePrize('wheel', paying.map((prize) => prize.id));
  return prizes.find((prize) => prize.id === id) ?? paying[0]!;
}
