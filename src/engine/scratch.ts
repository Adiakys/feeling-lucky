import type { Prize, PrizeTier, Tier } from '../config/types';
import { awardKey, awardOf, variantsOf, type Award } from './awards';
import { pick, randomInt, range, shuffle } from './random';
import type { DayTicket } from './tiers';

declare module './rig' {
  interface Decisions {
    'scratch.award': { context: { tier: Tier; prizeId: string }; value: Award };
  }
}

/* Scratch cards. The classic one: three equal logos win the prize, the award strip says what it pays. */

// The fillers are numbers and logos of other prizes, never three of a kind.
export function scratchCard(tier: Tier, prizeIds: string[], prizeId = pick(prizeIds), award: Award = null) {
  const winning = tier === 'none' ? null : prizeId;
  const numbers = shuffle(range(1, 50)).map(String);
  const logos = shuffle(prizeIds.filter((id) => id !== winning).flatMap((id) => [id, id]));
  const count = winning ? 3 : 6;
  const teasers = logos.slice(0, randomInt(Math.min(1, logos.length), Math.min(count - 1, logos.length)));
  const fillers = [...teasers, ...numbers.slice(0, count - teasers.length)];
  const cells = shuffle(winning ? [winning, winning, winning, ...fillers] : fillers);
  return { prizeId, cells, winning, award };
}

export type ScratchKind = 'classic' | DayTicket;

// The numbers tickets print a prize under each number: a prize with an award it pays on a small or big win.
// A logo takes a whole cell, with no prize under it: three equal ones pay the jackpot of that prize.
export interface TicketPrize {
  prizeId: string;
  tier: PrizeTier;
  award: Award;
}

export interface NumbersTicket {
  winningNumbers: number[];
  // A number with the prize under it, or with none when the prizes are too few to fill the ticket; or a logo alone.
  yours: { value: number | string; prize: TicketPrize | null }[];
  // null: a spot with no prize, when the prizes are too few to fill the game.
  second: (TicketPrize | null)[];
  // The spots that make the win: w the winning numbers, y yours, s the second game.
  hit: string[];
  how: 'match' | 'three' | 'pair' | 'logos' | null;
}

// Every prize with each award it pays on a small or big win: its variants of the tier, or the tier symbol.
export const ticketPrizes = (prizes: Prize[]): TicketPrize[] =>
  prizes.flatMap((prize) =>
    (['small', 'big'] as const).flatMap((tier) => {
      const awards = [...new Set(variantsOf(prize, tier).map(awardOf))];
      return (awards.length ? awards : [null]).map((award) => ({ prizeId: prize.id, tier, award }));
    }),
  );

export const ticketPrizeKey = (prize: TicketPrize) => `${prize.prizeId} ${awardKey(prize.tier, prize.award)}`;

type Cell = NumbersTicket['yours'][number] & { hit: boolean };

// Logos in the free cells: three of the prize on the jackpot, otherwise at most two of each.
function placeLogos(cells: Cell[], count: number, prizeIds: string[], prizeId: string, jackpot: boolean) {
  const teasers = shuffle(prizeIds.flatMap((id) => (jackpot && id === prizeId ? [] : [id, id])));
  const logos = jackpot ? [prizeId, prizeId, prizeId, ...teasers.slice(0, count - 3)] : teasers.slice(0, count);
  const free = shuffle(cells.filter((cell) => !cell.hit));
  logos.forEach((logo, index) => Object.assign(free[index]!, { value: logo, prize: null, hit: jackpot && logo === prizeId }));
}

function numbersTicket(winningNumbers: number[], cells: Cell[], second: { prize: TicketPrize | null; hit?: boolean }[], how: NumbersTicket['how']): NumbersTicket {
  const yours = shuffle(cells);
  const games = shuffle(second);
  const matched = how === 'match' ? yours.find((cell) => cell.hit) : undefined;
  const hit = [
    ...winningNumbers.flatMap((number, index) => (number === matched?.value ? [`w${index}`] : [])),
    ...yours.flatMap((cell, index) => (cell.hit ? [`y${index}`] : [])),
    ...games.flatMap((game, index) => (game.hit ? [`s${index}`] : [])),
  ];
  return { winningNumbers, yours: yours.map(({ value, prize }) => ({ value, prize })), second: games.map(({ prize }) => prize), hit, how };
}

const wonPrize = (tier: Tier, prizeId: string, award: Award): TicketPrize => ({ prizeId, tier: tier === 'big' ? 'big' : 'small', award });

// Two ways to win: a winning number among yours wins the prize under it, three equal prizes win that prize.
// Every other prize shows at most twice, so three equal prizes come only with a win; when that leaves too few
// prizes, the rest of the numbers have none under them.
export function doubleTicket(tier: Tier, prizes: Prize[], prizeId: string, award: Award): NumbersTicket {
  const numbers = shuffle(range(1, 50));
  const winningNumbers = numbers.slice(0, 5);
  const how = tier === 'none' ? null : tier === 'jackpot' ? 'logos' : Math.random() < 0.5 ? 'match' : 'three';
  const won = how === 'match' || how === 'three' ? wonPrize(tier, prizeId, award) : null;
  const fillers = shuffle(ticketPrizes(prizes).filter((prize) => !won || ticketPrizeKey(prize) !== ticketPrizeKey(won)).flatMap((prize) => [prize, prize]));
  const winners = how === 'three' ? 3 : how === 'match' ? 1 : 0;
  const under = [...Array<TicketPrize | null>(winners).fill(won), ...range(0, 11 - winners).map((index) => fillers[index] ?? null)];
  const cells: Cell[] = under.map((prize, index) => ({ value: numbers[5 + index]!, prize, hit: index < winners }));
  if (how === 'match') cells[0]!.value = pick(winningNumbers);
  placeLogos(cells, how === 'logos' ? 3 : randomInt(1, 2), prizes.map((prize) => prize.id), prizeId, how === 'logos');
  return numbersTicket(winningNumbers, cells, [], how);
}

// Game 1: a winning number among yours wins the prize under it. Game 2: two equal prizes win that prize; with
// too few prizes to fill it, the rest of its spots have none.
export function foreverTicket(tier: Tier, prizes: Prize[], prizeId: string, award: Award): NumbersTicket {
  const numbers = shuffle(range(1, 50));
  const winningNumbers = numbers.slice(0, 4);
  const how = tier === 'none' ? null : tier === 'jackpot' ? 'logos' : Math.random() < 0.5 ? 'match' : 'pair';
  const printed = ticketPrizes(prizes);
  const won = wonPrize(tier, prizeId, award);
  const cells: Cell[] = range(0, 14).map((index) => ({ value: numbers[4 + index]!, prize: pick(printed), hit: false }));
  if (how === 'match') cells[0] = { value: pick(winningNumbers), prize: won, hit: true };
  placeLogos(cells, how === 'logos' ? 4 : randomInt(1, 3), prizes.map((prize) => prize.id), prizeId, how === 'logos');
  const distinct = shuffle(printed.filter((prize) => how !== 'pair' || ticketPrizeKey(prize) !== ticketPrizeKey(won))).map((prize) => ({ prize }));
  const second = how === 'pair' ? [{ prize: won, hit: true }, { prize: won, hit: true }, ...distinct.slice(0, 3)] : distinct.slice(0, 5);
  return numbersTicket(winningNumbers, cells, [...second, ...range(second.length, 4).map(() => ({ prize: null }))], how);
}
