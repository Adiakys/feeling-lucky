import { describe, expect, it } from 'vitest';
import type { Board } from '../../src/engine/awards';
import { PACHINKO_POCKETS, PACHINKO_RED_PEGS, pachinkoChance, pachinkoPocket, pachinkoPockets, plainPockets } from '../../src/engine/pachinko';

const TIERS = ['none', 'small', 'big', 'jackpot'] as const;
const board: Board = { small: ['s1', 's2', 's3', 's4', 's5', 's6'], big: ['b1', 'b2', 'b3'], jackpot: ['j'] };

describe('Pachinko', () => {
  it('steers the ball to the pocket of the tier closest to it', () => {
    for (const tier of TIERS) for (let near = 0; near <= 8; near += 0.5) expect(PACHINKO_POCKETS[pachinkoPocket(tier, near)]).toBe(tier);
    expect(pachinkoPocket('small', 0.2)).toBe(1);
    expect(pachinkoPocket('small', 7.6)).toBe(7);
    expect(pachinkoPocket('big', 2.4)).toBe(3);
    expect(pachinkoPocket('none', 5.9)).toBe(6);
  });

  it('labels the plain board’s pockets with each tier’s awards, left to right', () => {
    expect(plainPockets(board).map((pocket) => pocket.award)).toEqual([null, 's1', null, 'b1', 'j', 'b2', null, 's4', null]);
    expect(plainPockets({ small: [null], big: ['1Y'], jackpot: [null] }).map((pocket) => pocket.award)).toEqual([null, null, null, '1Y', null, '1Y', null, null, null]);
    expect(plainPockets(board).map((pocket) => pocket.tier)).toEqual(PACHINKO_POCKETS);
  });
});

describe('coloured Pachinko', () => {
  it('keeps the losing pockets of the plain board and raises the others with the reds collected', () => {
    for (let reds = 0; reds <= PACHINKO_RED_PEGS; reds++) {
      pachinkoPockets(reds, board).forEach((pocket, index) => expect(pocket.tier === 'none').toBe(PACHINKO_POCKETS[index] === 'none'));
    }
    expect(pachinkoPockets(0, board).map((pocket) => pocket.award)).toEqual([null, 's1', null, 's1', 's1', 's1', null, 's1', null]);
    expect(pachinkoPockets(3, board)[4]).toEqual({ tier: 'big', award: 'b1' });
    expect(pachinkoPockets(3, board)[3]).toEqual({ tier: 'small', award: 's6' });
  });

  it('turns the middle pocket into the jackpot only with every red, its neighbours into the top big step', () => {
    expect(pachinkoPockets(PACHINKO_RED_PEGS - 1, board).some((pocket) => pocket.tier === 'jackpot')).toBe(false);
    const all = pachinkoPockets(PACHINKO_RED_PEGS, board);
    expect(all[4]).toEqual({ tier: 'jackpot', award: 'j' });
    expect(all[3]).toEqual({ tier: 'big', award: 'b3' });
    expect(all[1]).toEqual({ tier: 'big', award: 'b2' });
  });

  it('spreads a short board over the ladder', () => {
    const all = pachinkoPockets(PACHINKO_RED_PEGS, { small: ['7D', '1M'], big: [null], jackpot: [null] });
    expect(pachinkoPockets(0, { small: ['7D', '1M'], big: [null], jackpot: [null] })[4]).toEqual({ tier: 'small', award: '7D' });
    expect(all.map((pocket) => pocket.tier)).toEqual(['none', 'big', 'none', 'big', 'jackpot', 'big', 'none', 'big', 'none']);
  });

  it('applies violet on top of the daily multiplier, capped at 100%', () => {
    expect(pachinkoChance(3, false)).toBeCloseTo(0.17);
    expect(pachinkoChance(3, true)).toBeCloseTo(0.51);
    expect(pachinkoChance(5, true)).toBe(1);
  });
});
