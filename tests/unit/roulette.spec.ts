import { afterEach, describe, expect, it, vi } from 'vitest';
import { announcedNumbers, ROULETTE_ANNOUNCED, ROULETTE_SPOTS, ROULETTE_STORM, rouletteNumber, rouletteWin, stormNumbers } from '../../src/engine/roulette';

describe('Storm Roulette', () => {
  afterEach(() => vi.restoreAllMocks());

  it('strikes three different numbers of the wheel', () => {
    for (let i = 0; i < 100; i++) {
      const numbers = stormNumbers();
      expect(new Set(numbers).size).toBe(ROULETTE_STORM);
      expect(numbers.every((number) => number >= 0 && number <= 36)).toBe(true);
    }
  });

  it('lands on each struck number as many times as often as the multiplier', () => {
    const storm = [0, 17, 36];
    const total = 34 + 3 * 4;
    const counts = new Map<number, number>();
    const random = vi.spyOn(Math, 'random');
    for (let index = 0; index < total; index++) {
      random.mockReturnValue((index + 0.5) / total);
      const number = rouletteNumber(storm, 4);
      counts.set(number, (counts.get(number) ?? 0) + 1);
    }
    expect(counts.size).toBe(37);
    for (const [number, count] of counts) expect(count).toBe(storm.includes(number) ? 4 : 1);
  });
});

describe('the roulette table', () => {
  const count = (kind: string) => ROULETTE_SPOTS.filter((spot) => spot.kind === kind).length;

  it('offers every classic European bet once', () => {
    expect([count('straight'), count('split'), count('street'), count('corner'), count('line')]).toEqual([37, 60, 14, 23, 11]);
    expect([count('column'), count('dozen'), count('chance')]).toEqual([3, 3, 6]);
    expect(new Set(ROULETTE_SPOTS.map((spot) => spot.id)).size).toBe(ROULETTE_SPOTS.length);
  });

  it('covers each number from 1 to 36 with one column, one dozen and three even-money bets, and zero with none of them', () => {
    for (let number = 0; number <= 36; number++) {
      const covering = ROULETTE_SPOTS.filter((spot) => spot.numbers.includes(number));
      const expected = number === 0 ? [0, 0, 0] : [1, 1, 3];
      expect(['column', 'dozen', 'chance'].map((kind) => covering.filter((spot) => spot.kind === kind).length)).toEqual(expected);
    }
  });

  it('lays the announced bets on the table spots of their sector of the wheel', () => {
    expect(Object.values(ROULETTE_ANNOUNCED).map((spots) => spots.length)).toEqual([5, 5, 6]);
    const sorted = (numbers: number[]) => [...numbers].sort((a, b) => a - b);
    expect(sorted(announcedNumbers('nassa'))).toEqual([0, 3, 12, 15, 19, 26, 32, 35]);
    expect(sorted(announcedNumbers('orphans'))).toEqual([1, 6, 9, 14, 17, 20, 31, 34]);
    expect(sorted(announcedNumbers('tiers'))).toEqual([5, 8, 10, 11, 13, 16, 23, 24, 27, 30, 33, 36]);
  });

  it('pays the best winning bet with the prize of its chips', () => {
    const bets = [
      { spot: 'chance:red', prizeId: 'mug', chips: 3 },
      { spot: 'split:14-17', prizeId: 'credits', chips: 1 },
      { spot: 'straight:14', prizeId: 'pro', chips: 1 },
    ];
    expect(rouletteWin(bets, 14)).toEqual({ bet: bets[2], tier: 'jackpot' });
    expect(rouletteWin(bets, 17)).toEqual({ bet: bets[1], tier: 'big' });
    expect(rouletteWin(bets, 3)).toEqual({ bet: bets[0], tier: 'small' });
    expect(rouletteWin(bets, 0)).toBeNull();
  });

  it('breaks a tie between bets of the same class by the chips on them', () => {
    const bets = [
      { spot: 'chance:red', prizeId: 'mug', chips: 1 },
      { spot: 'dozen:1', prizeId: 'credits', chips: 2 },
    ];
    expect(rouletteWin(bets, 3)?.bet.prizeId).toBe('credits');
  });
});
