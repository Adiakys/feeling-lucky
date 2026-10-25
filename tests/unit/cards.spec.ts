import { describe, expect, it } from 'vitest';
import { bestHand, blackjackDeal, blackjackDealer, blackjackHit, blackjackPrize, canSplit, combination, compareHands, handTotal, HAND_NAMES, holdemDeal, holdemResult, isNatural, type Card } from '../../src/engine/cards';
import type { Tier } from '../../src/config/types';

const cards = (text: string): Card[] =>
  text.split(' ').map((code) => ({
    rank: '23456789TJQKA'.indexOf(code[0]!) + 2,
    suit: ({ s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' } as const)[code[1] as 's' | 'h' | 'd' | 'c'],
  }));
const handName = (text: string) => HAND_NAMES[bestHand(cards(text)).category];

// A whole blackjack hand with a player who hits below a threshold, as the game plays it.
function playBlackjack(tier: Tier, standOn: number) {
  const { player, dealer } = blackjackDeal(tier);
  if (isNatural(player)) return { won: true, prize: blackjackPrize(player) };
  while (handTotal(player).total < Math.min(standOn, 21)) player.push(blackjackHit(tier, player));
  const mine = handTotal(player).total;
  if (mine > 21) return { won: false, prize: 'none' };
  dealer.push(...blackjackDealer(tier, dealer, mine));
  const theirs = handTotal(dealer).total;
  return { won: theirs > 21 || theirs < mine, prize: blackjackPrize(player) };
}

// The same with splits and doubles: a pair splits, nine to eleven doubles; the best hand counts.
function playSplitting(tier: Tier) {
  const { player, dealer } = blackjackDeal(tier);
  if (isNatural(player)) return true;
  const hands = canSplit(player) ? player.map((card) => [card]) : [player];
  for (const hand of hands) {
    if (hand.length === 1) hand.push(blackjackHit(tier, hand));
    const { total } = handTotal(hand);
    if (total >= 9 && total <= 11) hand.push(blackjackHit(tier, hand));
    else while (handTotal(hand).total < 17) hand.push(blackjackHit(tier, hand));
  }
  const standing = hands.map((hand) => handTotal(hand).total).filter((total) => total <= 21);
  if (!standing.length) return false;
  dealer.push(...blackjackDealer(tier, dealer, Math.max(...standing)));
  const theirs = handTotal(dealer).total;
  return standing.some((mine) => theirs > 21 || theirs < mine);
}

describe('blackjack', () => {
  it('counts aces as one or eleven', () => {
    expect(handTotal(cards('As 6h'))).toEqual({ total: 17, soft: true });
    expect(handTotal(cards('As 6h 9c'))).toEqual({ total: 16, soft: false });
    expect(handTotal(cards('As Ad 9c'))).toEqual({ total: 21, soft: true });
  });

  it('splits pairs of the same value', () => {
    expect(canSplit(cards('8h 8c'))).toBe(true);
    expect(canSplit(cards('Kh Qc'))).toBe(true);
    expect(canSplit(cards('Ah Ac'))).toBe(true);
    expect(canSplit(cards('9h 8c'))).toBe(false);
  });

  it('stages the drawn tier through splits and doubles', () => {
    for (let hand = 0; hand < 400; hand++) {
      expect(playSplitting('none')).toBe(false);
      expect(playSplitting('small')).toBe(true);
    }
  });

  it('stages the drawn tier whatever the player does', () => {
    for (const standOn of [4, 12, 17, 20, 21])
      for (let hand = 0; hand < 200; hand++) {
        expect(playBlackjack('none', standOn).won).toBe(false);
        expect(playBlackjack('small', standOn)).toEqual({ won: true, prize: 'small' });
        expect(playBlackjack('big', standOn)).toEqual({ won: true, prize: 'big' });
        expect(playBlackjack('jackpot', standOn)).toEqual({ won: true, prize: 'jackpot' });
      }
  });
});

describe("Texas Hold'em", () => {
  it('names the best five cards of seven', () => {
    expect(handName('As Ks Qs Js Ts 2h 3c')).toBe('royalFlush');
    expect(handName('9h 8h 7h 6h 5h Ac Ad')).toBe('straightFlush');
    expect(handName('Ah 2c 3d 4s 5h Kc Qd')).toBe('straight');
    expect(handName('7h 7c 7d 2s 2h Kc Qd')).toBe('fullHouse');
    expect(handName('7h 7c 7d 7s 2h Kc Qd')).toBe('quads');
    expect(handName('2h 9h Jh 4h Kh 3c 3d')).toBe('flush');
    expect(handName('2h 2c Jh Js Kh 3c 5d')).toBe('twoPair');
    expect(handName('2h 7c Jh 8s Kh 3c 5d')).toBe('highCard');
  });

  it('breaks ties on the kickers', () => {
    expect(compareHands(bestHand(cards('Ah Ac Kd 7s 4h 3c 2d')), bestHand(cards('Ad As Qd 7s 4h 3c 2d')))).toBeGreaterThan(0);
    expect(compareHands(bestHand(cards('Ah 2c 3d 4s 5h 9c 9d')), bestHand(cards('6h 2c 3d 4s 5h 9c 9d')))).toBeLessThan(0);
  });

  it('deals the drawn tier', () => {
    for (const tier of ['none', 'small', 'big', 'jackpot'] as const)
      for (let hand = 0; hand < 60; hand++) {
        const { player, dealer, board } = holdemDeal(tier);
        expect(new Set([...player, ...dealer, ...board].map(({ rank, suit }) => `${rank}${suit}`)).size).toBe(9);
        const result = holdemResult(player, dealer, board);
        expect(result.tier).toBe(tier);
        if (tier === 'none') expect(result.lost).toBe(true);
      }
  });
});

describe('the winning combination', () => {
  const lit = (text: string) => combination(bestHand(cards(text))).map(({ rank }) => rank).sort((a, b) => a - b);
  it('lights only the cards that make the hand', () => {
    expect(lit('Ah Ac Kd 7s 4h 3c 2d')).toEqual([14, 14]);
    expect(lit('2h 2c Jh Js Kh 3c 5d')).toEqual([2, 2, 11, 11]);
    expect(lit('7h 7c 7d 2s 2h Kc Qd')).toEqual([2, 2, 7, 7, 7]);
    expect(lit('Ah 2c 3d 4s 5h Kc Qd')).toEqual([2, 3, 4, 5, 14]);
    expect(lit('2h 7c Jh 8s Kh 3c 5d')).toEqual([13]);
  });
});
