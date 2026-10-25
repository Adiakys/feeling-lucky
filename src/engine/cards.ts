import type { Tier } from '../config/types';
import { pick, randomInt, range, shuffle } from './random';

export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export type Suit = (typeof SUITS)[number];

// rank 2 to 10, then 11 jack, 12 queen, 13 king, 14 ace.
export interface Card {
  rank: number;
  suit: Suit;
}

export const DECK: Card[] = SUITS.flatMap((suit) => range(2, 14).map((rank) => ({ rank, suit })));
export const rankLabel = (rank: number) => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' })[rank] ?? String(rank);
const card = (rank: number, suit: Suit = pick(SUITS)): Card => ({ rank, suit });
const sameCard = (a: Card, b: Card) => a.rank === b.rank && a.suit === b.suit;

/* Blackjack: the tier is drawn at the deal and the shoe stages it, whatever the player then does. */

const TEN_RANKS = [10, 11, 12, 13];
// A card worth that much: 1 and 11 are the ace.
const cardWorth = (value: number) => (value === 1 || value === 11 ? card(14) : value === 10 ? card(pick(TEN_RANKS)) : card(value));

const cardValue = (card: Card) => (card.rank === 14 ? 11 : Math.min(10, card.rank));

export function handTotal(cards: Card[]) {
  let total = cards.reduce((sum, card) => sum + cardValue(card), 0);
  let aces = cards.filter(({ rank }) => rank === 14).length;
  while (total > 21 && aces) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export const isNatural = (cards: Card[]) => cards.length === 2 && handTotal(cards).total === 21;
// Two cards of the same value split into two hands.
export const canSplit = (cards: Card[]) => cards.length === 2 && cardValue(cards[0]!) === cardValue(cards[1]!);
const isSpadesJack = (cards: Card[]) => cards.every(({ suit }) => suit === 'spades') && cards.some(({ rank }) => rank === 14) && cards.some(({ rank }) => rank === 11);

// The dealer always opens on a hard 12 to 16, so one more card lands wherever the tier needs it.
export function blackjackDeal(tier: Tier): { player: Card[]; dealer: Card[] } {
  const opening = randomInt(12, 16);
  const up = randomInt(Math.max(2, opening - 10), Math.min(10, opening - 2));
  const dealer = [cardWorth(up), cardWorth(opening - up)];
  if (tier === 'jackpot') return { player: shuffle([card(14, 'spades'), card(11, 'spades')]), dealer };
  let player: Card[];
  do {
    player = tier === 'big' ? shuffle([card(14), card(pick(TEN_RANKS))]) : [card(randomInt(2, 14)), card(randomInt(2, 14))];
  } while (tier === 'big' ? isSpadesJack(player) : isNatural(player));
  return { player, dealer };
}

// The card a hit draws: a winning hand never busts, a losing one never makes 21.
export function blackjackHit(tier: Tier, player: Card[]): Card {
  return pick(DECK.filter((next) => {
    const { total } = handTotal([...player, next]);
    return tier === 'none' ? total !== 21 : total <= 21;
  }));
}

// The cards the dealer draws once the player stands, on the best total of their hands, or none if they all bust.
export function blackjackDealer(tier: Tier, dealer: Card[], playerTotal: number | null): Card[] {
  if (playerTotal === null) return [];
  const { total } = handTotal(dealer);
  if (tier === 'none') return [cardWorth(randomInt(Math.max(17, playerTotal + 1), 21) - total)];
  if (playerTotal >= 18 && Math.random() < 0.5) return [cardWorth(randomInt(17, playerTotal - 1) - total)];
  return [cardWorth(randomInt(22 - total, 10))];
}

export const blackjackPrize = (player: Card[]): Tier => (isSpadesJack(player) && player.length === 2 ? 'jackpot' : isNatural(player) ? 'big' : 'small');

/* Texas Hold'em against the dealer: the deal is chosen among those that give the drawn tier. */

export const HAND_NAMES = ['highCard', 'pair', 'twoPair', 'trips', 'straight', 'flush', 'fullHouse', 'quads', 'straightFlush', 'royalFlush'] as const;

export interface PokerHand {
  category: number;
  ranks: number[];
  cards: Card[];
}

function evaluateFive(cards: Card[]): PokerHand {
  const counts = new Map<number, number>();
  cards.forEach(({ rank }) => counts.set(rank, (counts.get(rank) ?? 0) + 1));
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const ranks = groups.map(([rank]) => rank);
  const shape = groups.map(([, count]) => count).join('');
  const flush = cards.every(({ suit }) => suit === cards[0]!.suit);
  const high = groups.length === 5 ? (ranks[0]! - ranks[4]! === 4 ? ranks[0]! : ranks.join() === '14,5,4,3,2' ? 5 : 0) : 0;
  const category =
    high && flush ? (high === 14 ? 9 : 8)
    : shape === '41' ? 7
    : shape === '32' ? 6
    : flush ? 5
    : high ? 4
    : shape === '311' ? 3
    : shape === '221' ? 2
    : shape === '2111' ? 1
    : 0;
  return { category, ranks: high ? [high] : ranks, cards };
}

export const compareHands = (a: PokerHand, b: PokerHand) => a.category - b.category || (a.ranks.map((rank, index) => rank - b.ranks[index]!).find(Boolean) ?? 0);

export function bestHand(cards: Card[]): PokerHand {
  let best: PokerHand | null = null;
  for (let a = 0; a < cards.length; a++)
    for (let b = a + 1; b < cards.length; b++) {
      const hand = evaluateFive(cards.filter((_, index) => index !== a && index !== b));
      if (!best || compareHands(hand, best) > 0) best = hand;
    }
  return best ?? evaluateFive(cards);
}

// Winning with up to three of a kind pays a small prize, from a straight up a big prize, the royal flush the jackpot.
const holdemTier = (player: PokerHand, dealer: PokerHand): Tier => {
  if (compareHands(player, dealer) <= 0) return 'none';
  return player.category === 9 ? 'jackpot' : player.category >= 4 ? 'big' : 'small';
};

export function holdemDeal(tier: Tier): { player: Card[]; dealer: Card[]; board: Card[] } {
  if (tier === 'jackpot') {
    const suit = pick(SUITS);
    const royal = shuffle(range(10, 14).map((rank) => card(rank, suit)));
    const rest = shuffle(DECK.filter((other) => !royal.some((mine) => sameCard(mine, other))));
    return { player: royal.slice(0, 2), dealer: rest.slice(2, 4), board: shuffle([...royal.slice(2), ...rest.slice(0, 2)]) };
  }
  for (;;) {
    const deck = shuffle(DECK);
    const deal = { player: deck.slice(0, 2), dealer: deck.slice(2, 4), board: deck.slice(4, 9) };
    const lost = compareHands(bestHand([...deal.player, ...deal.board]), bestHand([...deal.dealer, ...deal.board])) < 0;
    if (tier === 'none' ? lost : holdemTier(bestHand([...deal.player, ...deal.board]), bestHand([...deal.dealer, ...deal.board])) === tier) return deal;
  }
}

export const holdemResult = (player: Card[], dealer: Card[], board: Card[]) => {
  const mine = bestHand([...player, ...board]);
  const theirs = bestHand([...dealer, ...board]);
  return { mine, theirs, tier: holdemTier(mine, theirs), lost: compareHands(mine, theirs) < 0 };
};

export const SUIT_PATHS: Record<Suit, string> = {
  spades: 'M10 1C7 5 2 8.5 2 12.5C2 15 4 16.5 6 16.5C7.4 16.5 8.5 15.9 9.1 15.1L8 19H12L10.9 15.1C11.5 15.9 12.6 16.5 14 16.5C16 16.5 18 15 18 12.5C18 8.5 13 5 10 1Z',
  hearts: 'M10 18C6 15 1.5 11.5 1.5 6.5C1.5 3.8 3.6 2 6 2C7.8 2 9.2 3 10 4.4C10.8 3 12.2 2 14 2C16.4 2 18.5 3.8 18.5 6.5C18.5 11.5 14 15 10 18Z',
  diamonds: 'M10 1L17 10L10 19L3 10Z',
  clubs: 'M10 1.5a4 4 0 1 1 0 8a4 4 0 1 1 0-8ZM5.5 7.8a4 4 0 1 1 0 8a4 4 0 1 1 0-8ZM14.5 7.8a4 4 0 1 1 0 8a4 4 0 1 1 0-8ZM9 11.5h2l1.3 7.5h-4.6Z',
};
export const isRed = (card: Card) => card.suit === 'hearts' || card.suit === 'diamonds';

// The cards that make the hand: the matched ranks of pairs, trips, full houses and quads, all five of a
// straight or a flush, the top card alone of a high card.
export function combination(hand: PokerHand): Card[] {
  if ([4, 5, 8, 9].includes(hand.category)) return hand.cards;
  if (hand.category === 0) return hand.cards.filter(({ rank }) => rank === hand.ranks[0]).slice(0, 1);
  return hand.cards.filter(({ rank }) => hand.cards.filter((other) => other.rank === rank).length > 1);
}
