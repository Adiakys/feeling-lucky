import type { Tier } from '../config/types';
import { pick, randomInt, range, shuffle } from './random';
import { decide } from './rig';
import { TIER_RANK } from './tiers';

/* Roulette: a European wheel and its table. The number is drawn fairly but on its day; the best winning bet decides the prize. */

export const ROULETTE_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const ROULETTE_RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const ROULETTE_CHIPS = 6;

// Storm Roulette, the roulette of the day: at every throw, once the bets are down, lightning strikes
// three numbers that come out as many times as often as the day's multiplier.
export const ROULETTE_STORM = 3;

export const stormNumbers = () => shuffle(range(0, 36)).slice(0, ROULETTE_STORM);

export function rouletteNumber(storm: number[], boost: number) {
  return pick(range(0, 36).flatMap((number) => Array<number>(storm.includes(number) ? boost : 1).fill(number)));
}

export type RouletteBetKind = 'straight' | 'split' | 'street' | 'corner' | 'line' | 'column' | 'dozen' | 'chance';

export const ROULETTE_TIER: Record<RouletteBetKind, Tier> = {
  straight: 'jackpot',
  split: 'big',
  street: 'big',
  corner: 'big',
  line: 'big',
  column: 'small',
  dozen: 'small',
  chance: 'small',
};

export interface RouletteSpot {
  id: string;
  kind: RouletteBetKind;
  numbers: number[];
  name?: string;
}

export interface RouletteBet {
  spot: string;
  prizeId: string;
  chips: number;
}

const inside = (kind: RouletteBetKind, numbers: number[]): RouletteSpot => ({ id: `${kind}:${numbers.join('-')}`, kind, numbers });
const outside = (kind: RouletteBetKind, name: string, numbers: number[]): RouletteSpot => ({ id: `${kind}:${name}`, kind, numbers, name });

export const ROULETTE_SPOTS: RouletteSpot[] = [
  ...range(0, 36).map((number) => inside('straight', [number])),
  ...[1, 2, 3].map((number) => inside('split', [0, number])),
  ...range(1, 33).map((number) => inside('split', [number, number + 3])),
  ...range(1, 35).filter((number) => number % 3 !== 0).map((number) => inside('split', [number, number + 1])),
  inside('street', [0, 1, 2]),
  inside('street', [0, 2, 3]),
  ...range(0, 11).map((column) => inside('street', range(3 * column + 1, 3 * column + 3))),
  inside('corner', [0, 1, 2, 3]),
  ...range(1, 32).filter((number) => number % 3 !== 0).map((number) => inside('corner', [number, number + 1, number + 3, number + 4])),
  ...range(0, 10).map((column) => inside('line', range(3 * column + 1, 3 * column + 6))),
  ...[1, 2, 3].map((column) => outside('column', String(column), range(1, 36).filter((number) => (number - column) % 3 === 0))),
  ...[1, 2, 3].map((dozen) => outside('dozen', String(dozen), range(12 * dozen - 11, 12 * dozen))),
  outside('chance', 'low', range(1, 18)),
  outside('chance', 'even', range(1, 36).filter((number) => number % 2 === 0)),
  outside('chance', 'red', range(1, 36).filter((number) => ROULETTE_RED.has(number))),
  outside('chance', 'black', range(1, 36).filter((number) => !ROULETTE_RED.has(number))),
  outside('chance', 'odd', range(1, 36).filter((number) => number % 2 === 1)),
  outside('chance', 'high', range(19, 36)),
];

// Announced bets: each lays its chips on its straight-ups and splits.
export const ROULETTE_ANNOUNCED = {
  nassa: ['straight:19', 'straight:26', 'split:0-3', 'split:12-15', 'split:32-35'],
  orphans: ['straight:1', 'split:6-9', 'split:14-17', 'split:17-20', 'split:31-34'],
  tiers: ['split:5-8', 'split:10-11', 'split:13-16', 'split:23-24', 'split:27-30', 'split:33-36'],
};

export type RouletteAnnounced = keyof typeof ROULETTE_ANNOUNCED;

const SPOTS_BY_ID = new Map(ROULETTE_SPOTS.map((spot) => [spot.id, spot]));

export const rouletteSpot = (id: string) => SPOTS_BY_ID.get(id)!;
export const announcedNumbers = (name: RouletteAnnounced) => [...new Set(ROULETTE_ANNOUNCED[name].flatMap((id) => rouletteSpot(id).numbers))];

// Several winning bets: the best paying one wins, then the one with more chips.
export function rouletteWin(bets: RouletteBet[], number: number): { bet: RouletteBet; tier: Tier } | null {
  let best: { bet: RouletteBet; tier: Tier } | null = null;
  for (const bet of bets) {
    const spot = rouletteSpot(bet.spot);
    if (!spot.numbers.includes(number)) continue;
    const tier = ROULETTE_TIER[spot.kind];
    const rank = TIER_RANK.indexOf(tier) - (best ? TIER_RANK.indexOf(best.tier) : 0);
    if (!best || rank > 0 || (rank === 0 && bet.chips > best.bet.chips)) best = { bet, tier };
  }
  return best;
}

declare module './rig' {
  interface Decisions {
    'roulette.storm': { context: { boost: number }; value: number[] };
    'roulette.number': { context: { bets: RouletteBet[]; storm: number[]; boost: number }; value: number };
  }
}

export const drawStorm = (boost: number) => decide('roulette.storm', { boost }, stormNumbers);
export const drawRouletteNumber = (bets: RouletteBet[], storm: number[], boost: number) =>
  decide('roulette.number', { bets, storm, boost }, () => (boost > 1 ? rouletteNumber(storm, boost) : randomInt(0, 36)));
