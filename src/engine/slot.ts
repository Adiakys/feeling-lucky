import type { Tier } from '../config/types';
import { pick, shuffle } from './random';

// A prize id, or one of the two special symbols.
export type SlotSymbol = string;

declare module './rig' {
  interface Decisions {
    'slot.line': { context: { tier: Tier; prizeId: string }; value: SlotSymbol[] };
  }
}

// Every prize on each reel, at least nine symbols of them, plus two sevens and one infinity, shuffled per reel.
export function slotStrips(prizeIds: string[]): SlotSymbol[][] {
  const base = [...Array.from({ length: Math.max(9, prizeIds.length) }, (_, index) => prizeIds[index % prizeIds.length]!), 'seven', 'seven', 'inf'];
  return [0, 1, 2].map(() => shuffle(base));
}

// The symbols on the line for a tier: nothing is a line without a pair, small a pair of prizes, big
// three prizes or three sevens, the jackpot three infinities.
export function slotLine(tier: Tier, prizeIds: string[], prizeId = pick(prizeIds)): { symbols: SlotSymbol[]; prizeId: string } {
  if (tier === 'jackpot') return { symbols: ['inf', 'inf', 'inf'], prizeId };
  if (tier === 'big') {
    const symbol = Math.random() < 0.3 ? 'seven' : prizeId;
    return { symbols: [symbol, symbol, symbol], prizeId };
  }
  if (tier === 'small') {
    const other = pick([...prizeIds.filter((id) => id !== prizeId), 'seven', 'inf']);
    return { symbols: shuffle([prizeId, prizeId, other]), prizeId };
  }
  const symbols = shuffle([...prizeIds, 'seven', 'inf']).slice(0, 3);
  while (symbols.length < 3) symbols.push(pick(['seven', 'inf']));
  return { symbols, prizeId };
}

// The symbols that make the line; among equals, the preferred one.
export function slotWinning(symbols: SlotSymbol[], prefer?: SlotSymbol) {
  const count = (symbol: SlotSymbol) => symbols.filter((other) => other === symbol).length;
  const best = symbols.filter((symbol) => count(symbol) >= 2).sort((a, b) => count(b) - count(a) || Number(b === prefer) - Number(a === prefer))[0];
  return best ? symbols.flatMap((symbol, index) => (symbol === best ? [index] : [])) : [];
}
