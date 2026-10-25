import type { GameId, Tier } from '../config/types';
import { DEALER_BOOST, onDuty } from './dealer';
import { pick } from './random';
import { decide } from './rig';

declare module './rig' {
  interface Decisions {
    boost: { context: { game: GameId }; value: number };
    tier: { context: { game: GameId; boost: number }; value: Tier };
    prize: { context: { game: GameId; prizeIds: string[] }; value: string };
  }
}

// The main hall's games, the ones the bonus of the day rotates among. The Salon Privé's games never take
// part in it: a new private game goes in PRIVATE_GAMES only.
export const BONUS_GAMES: GameId[] = ['wheel', 'slot', 'roulette', 'pachinko', 'scratch'];
export const PRIVATE_GAMES: GameId[] = ['blackjack', 'holdem'];
export const GAME_IDS: GameId[] = [...BONUS_GAMES, ...PRIVATE_GAMES];

export const TIER_ODDS = { jackpot: 1 / 150, big: 1 / 60, small: 1 / 30 };
export const TIER_RANK: Tier[] = ['none', 'small', 'big', 'jackpot'];

export type DayTicket = 'double' | 'forever';
export type DayMachine = 'takeoff' | 'breakaway';
export const DAY_TICKETS: DayTicket[] = ['double', 'forever'];
export const DAY_MACHINES: DayMachine[] = ['takeoff', 'breakaway'];

// boost multiplies every odd: the game of the day wins that many times as often.
export function drawTier(boost = 1, roll = Math.random()): Tier {
  if (roll < boost * TIER_ODDS.jackpot) return 'jackpot';
  if (roll < boost * (TIER_ODDS.jackpot + TIER_ODDS.big)) return 'big';
  if (roll < boost * (TIER_ODDS.jackpot + TIER_ODDS.big + TIER_ODDS.small)) return 'small';
  return 'none';
}

// The same game, multiplier, scratch ticket and slot for everyone on a local calendar day, from an FNV-1a hash
// of the date. The ticket and the slot are the ones that take the classic's place on their game's bonus day.
export function dailyBonus(date = new Date()): { game: GameId; multiplier: number; ticket: DayTicket; machine: DayMachine } {
  let hash = 0x811c9dc5;
  for (const char of `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return {
    game: BONUS_GAMES[hash % BONUS_GAMES.length]!,
    multiplier: 2 + ((hash >>> 8) % 4),
    ticket: (hash >>> 16) & 1 ? 'forever' : 'double',
    machine: (hash >>> 20) & 1 ? 'breakaway' : 'takeoff',
  };
}

export const luckBoost = (game: GameId, date = new Date()) => {
  const bonus = dailyBonus(date);
  return bonus.game === game ? bonus.multiplier : 1;
};

// The Salon Privé's games have no bonus of the day: theirs comes with the dealer.
export const gameBoost = (game: GameId) =>
  decide('boost', { game }, () => (PRIVATE_GAMES.includes(game) ? (onDuty.value === null ? 1 : DEALER_BOOST) : luckBoost(game)));
export const gameTier = (game: GameId, boost: number) => decide('tier', { game, boost }, () => drawTier(boost));
// The prize a play is for, among the ones that can pay it.
export const gamePrize = (game: GameId, prizeIds: string[]) => decide('prize', { game, prizeIds }, () => pick(prizeIds));

// The lobby's big card: the most boosted game, the game of the day first among equals.
export function boostedGame(): GameId | undefined {
  const daily = dailyBonus().game;
  return BONUS_GAMES.filter((game) => gameBoost(game) > 1).sort((a, b) => gameBoost(b) - gameBoost(a) || Number(b === daily) - Number(a === daily))[0];
}

declare module './rig' {
  interface Decisions {
    'slot.machine': { context: Record<string, never>; value: DayMachine };
    'scratch.ticket': { context: Record<string, never>; value: DayTicket };
  }
}

export const machineOfDay = () => decide('slot.machine', {}, () => dailyBonus().machine);
export const ticketOfDay = () => decide('scratch.ticket', {}, () => dailyBonus().ticket);
