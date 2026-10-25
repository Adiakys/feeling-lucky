import type { PrizeTier, Tier } from '../config/types';
import { PRIZE_TIERS, spread, type Award, type Board } from './awards';
import { pick } from './random';

declare module './rig' {
  interface Decisions {
    'breakaway.tackle': { context: { tier: Tier }; value: number | null };
  }
}

// The slots of the day are cash-out games: the drawn tier is the ceiling. The run ends inside its tier's
// stretch; cashing out earlier pays the step reached, waiting past the end loses everything.
export interface CashStep {
  tier: PrizeTier;
}

export interface TakeoffStep extends CashStep {
  at: number;
}

export type Priced<T> = T extends null ? null : T & { award: Award };

// Each step with its board label: every tier's stretch of steps filled in order with the tier's awards.
export function cashAwards<T extends CashStep | null>(steps: T[], board: Board): Priced<T>[] {
  const ofTier = (tier: PrizeTier) => steps.filter((step) => step?.tier === tier);
  const awards = Object.fromEntries(PRIZE_TIERS.map((tier) => [tier, spread(board[tier], ofTier(tier).length)])) as Record<PrizeTier, Award[]>;
  return steps.map((step) => (step && { ...step, award: awards[step.tier][ofTier(step.tier).indexOf(step)] as Award }) as Priced<T>);
}

// Takeoff: the multiplier climbs while the plane flies; each step pays from its multiplier on.
export const TAKEOFF_STEPS: TakeoffStep[] = [
  { at: 2, tier: 'small' },
  { at: 3, tier: 'small' },
  { at: 4, tier: 'small' },
  { at: 5, tier: 'small' },
  { at: 6.5, tier: 'small' },
  { at: 8, tier: 'small' },
  { at: 10, tier: 'big' },
  { at: 20, tier: 'big' },
  { at: 35, tier: 'big' },
  { at: 50, tier: 'jackpot' },
];
export const TAKEOFF_TOP = 50;
// The multiplier after t seconds of flight.
export const takeoffAt = (seconds: number) => Math.exp(0.12 * seconds);
export const takeoffTime = (multiplier: number) => Math.log(multiplier) / 0.12;

const TAKEOFF_STRETCH: Record<Tier, [number, number]> = { none: [1, 2], small: [2, 10], big: [10, 50], jackpot: [Infinity, Infinity] };

// Where the plane flies away: past the start of its tier's stretch, up to its end, as likely early as late
// on a log scale; flying away at the next step's multiplier leaves that step out of reach.
export function takeoffCrash(tier: Tier, roll = Math.random()) {
  const [from, to] = TAKEOFF_STRETCH[tier];
  return from === Infinity ? Infinity : from * (to / from) ** (1 - roll);
}

export const takeoffStep = <T extends TakeoffStep>(multiplier: number, steps: T[]) => steps.filter((step) => step.at <= multiplier).at(-1);

// Breakaway: up the pitch one line at a time, choosing a square of each; a defender hides in every line. The
// prize grows with the lines cleared; in front of the goal the shot cashes it in.
export const BREAKAWAY_LANES = 4;
export const BREAKAWAY_STEPS: (CashStep | null)[] = [null, { tier: 'small' }, { tier: 'small' }, { tier: 'big' }, { tier: 'big' }, { tier: 'jackpot' }];

const TACKLES: Record<Tier, number[]> = { none: [1, 2], small: [3, 4], big: [5, 6], jackpot: [] };

// The line, from 1, where the defender stops the run; null when the ball reaches the goal.
export const breakawayTackle = (tier: Tier) => (tier === 'jackpot' ? null : pick(TACKLES[tier]));

// The prize after clearing that many lines.
export const breakawayStep = <T extends CashStep>(cleared: number, steps: (T | null)[]) => (cleared ? steps[cleared - 1] : null);
