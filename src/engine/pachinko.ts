import type { PrizeTier, Tier } from '../config/types';
import { spread, type Award, type Board } from './awards';
import { pick } from './random';
import { TIER_ODDS } from './tiers';

declare module './rig' {
  interface Decisions {
    'pachinko.board': { context: { pegs: PachinkoPeg[] }; value: { violet: PachinkoPeg; reds: PachinkoPeg[] } };
    'pachinko.route': { context: { violet: PachinkoPeg; reds: PachinkoPeg[] }; value: { through: PachinkoPeg[]; avoid: PachinkoPeg[] } };
    'pachinko.wins': { context: { boost: number; violet: boolean }; value: boolean };
    'pachinko.pocket': { context: { near: number }; value: number };
  }
}

export interface PachinkoPocket {
  tier: Tier;
  award: Award;
}

export const PACHINKO_POCKETS: Tier[] = ['none', 'small', 'none', 'big', 'jackpot', 'big', 'none', 'small', 'none'];

// The plain board's pockets: each tier's pockets take the board's awards in order, left to right.
export function plainPockets(board: Board): PachinkoPocket[] {
  const awards = (tier: PrizeTier) => spread(board[tier], PACHINKO_POCKETS.filter((other) => other === tier).length);
  const labels = { small: awards('small'), big: awards('big'), jackpot: awards('jackpot') };
  const used = { small: 0, big: 0, jackpot: 0 };
  return PACHINKO_POCKETS.map((tier) => (tier === 'none' ? { tier, award: null } : { tier, award: labels[tier][used[tier]++]! }));
}

// near: the pocket under the ball, as a fractional index; the ball goes to the closest pocket of the tier.
export function pachinkoPocket(tier: Tier, near: number) {
  const pockets = PACHINKO_POCKETS.flatMap((pocket, index) => (pocket === tier ? [index] : []));
  const closest = Math.min(...pockets.map((index) => Math.abs(index - near)));
  return pick(pockets.filter((index) => Math.abs(index - near) === closest));
}

export const PACHINKO_RED_PEGS = 8;

// The violet orb sits between these heights, clear of the arch and of the pockets.
export const PACHINKO_VIOLET_ROWS = [180, 400] as const;

// lit: an orb of the coloured board the ball has touched; it stays and keeps bouncing the ball, it counts once.
export interface PachinkoPeg {
  x: number;
  y: number;
  hit: number;
  divider?: boolean;
  color?: 'blue' | 'red' | 'violet';
  lit?: boolean;
}

// The coloured board's prizes, smallest first: six small steps, three big ones, the jackpot.
export const pachinkoLadder = (board: Board): PachinkoPocket[] => [
  ...spread(board.small, 6).map((award) => ({ tier: 'small' as const, award })),
  ...spread(board.big, 3).map((award) => ({ tier: 'big' as const, award })),
  ...spread(board.jackpot, 1).map((award) => ({ tier: 'jackpot' as const, award })),
];

// Ladder step of the middle pocket after 0 to 8 reds; the pockets beside it sit one step lower, the outer ones two.
const MIDDLE_STEP = [0, 2, 4, 6, 7, 8, 8, 8, 9];

export function pachinkoPockets(redHits: number, board: Board): PachinkoPocket[] {
  const ladder = pachinkoLadder(board);
  const middle = MIDDLE_STEP[Math.min(redHits, PACHINKO_RED_PEGS)]!;
  return PACHINKO_POCKETS.map((tier, index) =>
    tier === 'none' ? { tier, award: null } : ladder[Math.max(0, middle - Math.min(2, Math.abs(index - 4)))]!,
  );
}

export function pachinkoChance(multiplier: number, violetHit: boolean): number {
  return Math.min(1, (TIER_ODDS.small + TIER_ODDS.big + TIER_ODDS.jackpot) * multiplier * (violetHit ? multiplier : 1));
}
