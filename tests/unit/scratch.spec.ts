import { describe, expect, it } from 'vitest';
import type { Prize, Tier } from '../../src/config/types';
import { doubleTicket, foreverTicket, scratchCard, ticketPrizeKey, ticketPrizes, type NumbersTicket, type TicketPrize } from '../../src/engine/scratch';

const TIERS: Tier[] = ['none', 'small', 'big', 'jackpot'];
const pro: Prize = {
  id: 'pro',
  name: 'Pro',
  icon: '',
  variants: [
    { tier: 'small', label: '7 days', short: '7D' },
    { tier: 'small', label: '1 month', short: '1M' },
    { tier: 'big', label: '1 year', short: '1Y' },
    { tier: 'jackpot', label: 'Lifetime', short: '∞' },
  ],
};
const mug: Prize = { id: 'mug', name: 'Mug', icon: '' };
const credits: Prize = { id: 'credits', name: 'Credits', icon: '', variants: (tier) => ({ tier, label: `${tier} credits` }) };
const extra = ['tee', 'stickers', 'book'].map((id): Prize => ({ id, name: id, icon: '' }));
const PRIZE_SETS = [[mug], [pro, mug, credits], [pro, mug, credits, ...extra]];

describe('the classic scratch card', () => {
  it('prints exactly one triple for a win and none for a loss', () => {
    for (const prizes of PRIZE_SETS) {
      const prizeIds = prizes.map((prize) => prize.id);
      for (let i = 0; i < 200; i++) {
        for (const tier of TIERS) {
          const card = scratchCard(tier, prizeIds);
          const counts = new Map<string, number>();
          card.cells.forEach((cell) => counts.set(cell, (counts.get(cell) ?? 0) + 1));
          const triples = [...counts].filter(([, count]) => count >= 3).map(([cell]) => cell);
          expect(card.cells).toHaveLength(6);
          expect(triples).toEqual(tier === 'none' ? [] : [card.prizeId]);
        }
      }
    }
  });
});

describe('the prizes under the numbers', () => {
  it('are each prize with its small and big variants, or the tier symbol', () => {
    expect(ticketPrizes([pro, mug]).map(ticketPrizeKey)).toEqual(['pro small:7D', 'pro small:1M', 'pro big:1Y', 'mug small:', 'mug big:']);
    expect(ticketPrizes([credits]).map(ticketPrizeKey)).toEqual(['credits small:', 'credits big:']);
  });
});

// What a player reads on a numbers ticket: every prize it pays, 'jackpot' for three equal logos.
function payouts(ticket: NumbersTicket) {
  const repeated = (keys: string[], times: number) => [...new Set(keys)].filter((key) => keys.filter((other) => other === key).length >= times);
  const keys = (prizes: (TicketPrize | null)[]) => prizes.flatMap((prize) => (prize ? [ticketPrizeKey(prize)] : []));
  const matches = ticket.yours.filter((cell) => ticket.winningNumbers.includes(cell.value as number)).flatMap((cell) => keys([cell.prize]));
  const logos = ticket.yours.flatMap((cell) => (typeof cell.value === 'string' ? [cell.value] : []));
  const prizes = ticket.second.length ? repeated(keys(ticket.second), 2) : repeated(keys(ticket.yours.map((cell) => cell.prize)), 3);
  return [...matches, ...repeated(logos, 3).map(() => 'jackpot'), ...prizes];
}

describe('the numbers tickets', () => {
  it('pay exactly the prize drawn, in one way only, and nothing on a losing ticket, with 1 to 6 prizes', () => {
    for (const prizes of PRIZE_SETS) {
      const prizeIds = prizes.map((prize) => prize.id);
      const prizeId = prizeIds.at(-1)!;
      for (let i = 0; i < 200; i++) {
        for (const tier of TIERS) {
          for (const print of [doubleTicket, foreverTicket]) {
            const award = prizeId === 'pro' && tier === 'small' ? '1M' : null;
            const ticket = print(tier, prizes, prizeId, award);
            const won = tier === 'small' || tier === 'big' ? ticketPrizeKey({ prizeId, tier, award }) : tier;
            expect(payouts(ticket)).toEqual(tier === 'none' ? [] : [won]);
            expect(ticket.hit.length > 0).toBe(tier !== 'none');
            expect(ticket.yours.filter((cell) => typeof cell.value === 'string').every((cell) => prizeIds.includes(cell.value as string) && !cell.prize)).toBe(true);
            expect(ticket.yours.some((cell) => typeof cell.value === 'string')).toBe(true);
          }
        }
      }
    }
  });

  it('leaves numbers without a prize only when the prizes are too few', () => {
    const empty = (ticket: NumbersTicket) => ticket.yours.filter((cell) => typeof cell.value === 'number' && !cell.prize).length + ticket.second.filter((prize) => !prize).length;
    for (let i = 0; i < 100; i++) {
      for (const tier of TIERS) {
        expect(empty(doubleTicket(tier, [pro, mug, credits, ...extra], 'mug', null))).toBe(0);
        expect(empty(foreverTicket(tier, [pro, mug, credits], 'mug', null))).toBe(0);
      }
    }
    expect(empty(doubleTicket('none', [mug], 'mug', null))).toBeGreaterThan(0);
    expect(empty(foreverTicket('none', [mug], 'mug', null))).toBe(3);
  });

  it('lays out each ticket as its model, with the three logos of the prize on the jackpot', () => {
    const double = doubleTicket('jackpot', [pro, mug, credits], 'mug', null);
    expect([double.winningNumbers.length, double.yours.length, double.second.length]).toEqual([5, 12, 0]);
    expect(double.hit.map((spot) => double.yours[Number(spot.slice(1))]!)).toEqual(Array(3).fill({ value: 'mug', prize: null }));
    const forever = foreverTicket('none', [pro, mug, credits], 'mug', null);
    expect([forever.winningNumbers.length, forever.yours.length, forever.second.length]).toEqual([4, 15, 5]);
  });
});
