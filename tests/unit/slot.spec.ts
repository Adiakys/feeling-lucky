import { describe, expect, it } from 'vitest';
import type { Tier } from '../../src/config/types';
import type { Board } from '../../src/engine/awards';
import { BREAKAWAY_STEPS, breakawayStep, breakawayTackle, cashAwards, TAKEOFF_STEPS, TAKEOFF_TOP, takeoffAt, takeoffCrash, takeoffStep, takeoffTime } from '../../src/engine/cashout';
import { slotLine, slotStrips, slotWinning } from '../../src/engine/slot';

const PRIZES = ['pro', 'mug', 'credits'];
const TIERS: Tier[] = ['none', 'small', 'big', 'jackpot'];
const BOARD: Board = { small: ['7D', '1M', null], big: ['1Y', null], jackpot: [null] };

describe('the slot', () => {
  it('puts on the slot line nothing that pays for a loss, and a pair, a triple or three infinities for a win', () => {
    for (let i = 0; i < 200; i++) {
      expect(slotWinning(slotLine('none', PRIZES).symbols)).toEqual([]);
      const small = slotLine('small', PRIZES);
      expect(slotWinning(small.symbols)).toHaveLength(2);
      expect(small.symbols.filter((symbol) => symbol === small.prizeId)).toHaveLength(2);
      expect(new Set(slotLine('big', PRIZES).symbols).size).toBe(1);
      expect(slotLine('jackpot', PRIZES).symbols).toEqual(['inf', 'inf', 'inf']);
    }
  });

  it('keeps a lost slot line without pairs even with a single prize', () => {
    for (let i = 0; i < 100; i++) expect(slotWinning(slotLine('none', ['pro']).symbols)).toEqual([]);
  });

  it('puts every prize, a seven and an infinity on each reel', () => {
    for (const prizes of [['pro'], PRIZES, Array.from({ length: 12 }, (_, index) => `p${index}`)]) {
      for (const strip of slotStrips(prizes)) expect(new Set(strip)).toEqual(new Set([...prizes, 'seven', 'inf']));
    }
  });
});

describe('the slots of the day', () => {
  it('lets the plane fly through the steps of the drawn tier, never past them', () => {
    for (const tier of TIERS) {
      for (let roll = 0; roll < 1; roll += 0.01) {
        const crash = takeoffCrash(tier, roll);
        // The best a player can cash out: just before the plane flies away, or at the top.
        const best = takeoffStep(crash === Infinity ? TAKEOFF_TOP : crash - 1e-9, TAKEOFF_STEPS);
        expect(best?.tier ?? 'none').toBe(tier);
      }
    }
    expect(takeoffStep(1.99, TAKEOFF_STEPS)).toBeUndefined();
    expect(takeoffStep(2, TAKEOFF_STEPS)?.at).toBe(2);
    expect(takeoffStep(TAKEOFF_TOP, TAKEOFF_STEPS)?.tier).toBe('jackpot');
    expect(takeoffTime(takeoffAt(7))).toBeCloseTo(7);
  });

  it('stops the run in a column of the drawn tier, and lets only the jackpot reach the goal', () => {
    for (const tier of TIERS) {
      for (let i = 0; i < 50; i++) {
        const tackle = breakawayTackle(tier);
        const best = tackle === null ? breakawayStep(BREAKAWAY_STEPS.length, BREAKAWAY_STEPS) : breakawayStep(tackle - 1, BREAKAWAY_STEPS);
        expect(best?.tier ?? 'none').toBe(tier);
      }
    }
    expect(breakawayTackle('jackpot')).toBeNull();
  });

  it('labels each tier stretch of the ladders with its awards in order', () => {
    expect(cashAwards(TAKEOFF_STEPS, BOARD).map((step) => step.award)).toEqual(['7D', '7D', '1M', '1M', null, null, '1Y', '1Y', null, null]);
    expect(cashAwards(BREAKAWAY_STEPS, BOARD).map((step) => step && step.award)).toEqual([null, '7D', '1M', '1Y', null, null]);
    expect(cashAwards(TAKEOFF_STEPS, { small: [null], big: [null], jackpot: [null] }).every((step) => step.award === null)).toBe(true);
  });
});
