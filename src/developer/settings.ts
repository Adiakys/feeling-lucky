import type { GameId, Prize, PrizeTier, Tier } from '../config/types';
import type { Award } from '../engine/awards';
import type { Theme } from '../engine/themes';
import { DAY_MACHINES, DAY_TICKETS } from '../engine/tiers';

export type Result = 'automatic' | 'loss' | 'win' | 'jackpot';
export type Field = 'segment' | 'booster' | 'prize' | 'combination' | 'number' | 'storm' | 'violet' | 'pocket' | 'award';

export interface GameSettings {
  multiplier?: number;
  // The slot and the scratch card: the game of the day that takes the classic's place.
  variant?: string;
  result: Result;
  advanced: Partial<Record<Field, string>>;
}

export const RESULTS: Result[] = ['automatic', 'loss', 'win', 'jackpot'];

// The advanced settings of each game. A decisive one, once set, decides the outcome over the result.
export const ADVANCED: Record<GameId, Field[]> = {
  wheel: ['segment', 'booster', 'prize'],
  slot: ['combination', 'prize'],
  roulette: ['number', 'storm'],
  pachinko: ['pocket', 'violet'],
  scratch: ['award', 'prize'],
  blackjack: ['prize'],
  holdem: ['prize'],
};
export const DECISIVE: Field[] = ['segment', 'combination', 'number', 'pocket', 'award'];

export const settings: Partial<Record<GameId, GameSettings>> = {};
// The room's theme, from the calendar unless set; it applies at once, to the whole room. The prizes are
// the room's, for the prize that pays a chosen award.
export const room: { theme?: Theme | 'none'; locale?: string; dealer?: number | 'none'; prizes: Prize[] } = { prizes: [] };

export const blankSettings = (): GameSettings => ({ multiplier: undefined, variant: undefined, result: 'automatic', advanced: {} });
export const VARIANTS: Partial<Record<GameId, readonly string[]>> = { slot: DAY_MACHINES, scratch: DAY_TICKETS };
export const settingsOf = (game: GameId): GameSettings => settings[game] ?? blankSettings();

// The reverse of awardKey: 'small:7D' is the small 7D, 'big:' the big tier's symbol.
export function parseAward(key: string): { tier: PrizeTier; award: Award } {
  const colon = key.indexOf(':');
  return { tier: key.slice(0, colon) as PrizeTier, award: key.slice(colon + 1) || null };
}

export const COMBINATION_TIER: Record<string, Tier> = { none: 'none', pair: 'small', logos: 'big', sevens: 'big', infinities: 'jackpot' };

// A gate, not a protection: whoever can open the room can already hand out any prize. The config holds only
// the password's SHA-256, in hex.
export async function passwordMatches(password: string, hash: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('') === hash.toLowerCase();
}
