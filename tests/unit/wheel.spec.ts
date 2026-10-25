import { describe, expect, it } from 'vitest';
import type { Prize, Tier } from '../../src/config/types';
import { awardOf, boardOf, variantsOf } from '../../src/engine/awards';
import { TIER_ODDS } from '../../src/engine/tiers';
import { boosterKeys, segmentKey, wheelLanding, wheelPrize, wheelSegments, wheelTarget } from '../../src/engine/wheel';

const pro: Prize = {
  id: 'pro',
  name: 'Pro',
  icon: '',
  variants: [
    { tier: 'small', label: '7 days', short: '7D' },
    { tier: 'small', label: '1 month', short: '1M' },
    { tier: 'big', label: '1 year', short: '1Y' },
  ],
};
const mug: Prize = { id: 'mug', name: 'Mug', icon: '' };
const credits: Prize = { id: 'credits', name: 'Credits', icon: '', variants: (tier) => ({ tier, label: `${tier} credits` }) };
const PRIZES = [pro, mug, credits];
const SEGMENTS = wheelSegments(boardOf(PRIZES));
const TIERS: Tier[] = ['none', 'small', 'big', 'jackpot'];

describe('the Grand Wheel', () => {
  it('keeps 54 segments, a blank after each prize, and fills small and big ones from the board', () => {
    for (const prizes of [[pro], [mug], PRIZES]) {
      const board = boardOf(prizes);
      const segments = wheelSegments(board);
      expect(segments).toHaveLength(54);
      expect(segments.filter((_, index) => index % 2).every((segment) => segment.kind === 'none')).toBe(true);
      expect(segments.filter((segment) => segment.kind === 'jackpot')).toHaveLength(1);
      for (const segment of segments) if (segment.kind === 'small' || segment.kind === 'big') expect(board[segment.kind]).toContain(segment.award);
      expect(new Set(segments.flatMap((segment) => (segment.kind === 'small' ? [segment.award] : [])))).toEqual(new Set(board.small));
    }
  });

  it('lands on a segment of the tier, or on a bonus for a win', () => {
    for (let i = 0; i < 200; i++) {
      for (const tier of TIERS) {
        const { index, bonus } = wheelTarget(SEGMENTS, tier);
        const kind = SEGMENTS[index]!.kind;
        if (bonus) expect(['coin', 'hunt', 'pachinko']).toContain(kind);
        else expect(kind).toBe(tier);
        if (tier === 'none' || tier === 'jackpot') expect(bonus).toBe(false);
      }
    }
  });

  it('stops the Booster on a prize that pays the award the wheel landed on', () => {
    for (let i = 0; i < 50; i++) {
      for (const segment of SEGMENTS) {
        const prize = wheelPrize(PRIZES, segment);
        if (segment.kind !== 'small' && segment.kind !== 'big') continue;
        const labels = variantsOf(prize, segment.kind).map(awardOf);
        if (segment.award === null) expect(labels).toEqual([]);
        else expect(labels).toContain(segment.award);
      }
    }
  });
});

describe('the day of the Booster', () => {
  const landingOdds = (boosted: string, boost: number) => {
    const odds = new Map<number, number>();
    const steps = 60000;
    for (let step = 0; step < steps; step++) {
      const { index } = wheelLanding(SEGMENTS, boosted, boost, (step + 0.5) / steps);
      odds.set(index, (odds.get(index) ?? 0) + 1 / steps);
    }
    return (match: (key: string) => boolean) => SEGMENTS.reduce((sum, segment, index) => sum + (match(segmentKey(segment)) ? (odds.get(index) ?? 0) : 0), 0);
  };

  it('lands the Booster segments boost times as often, and only those', () => {
    const plain = landingOdds('jackpot', 1);
    expect(plain((key) => key === 'jackpot')).toBeCloseTo(TIER_ODDS.jackpot, 3);
    for (const key of ['jackpot', 'small:7D', 'small:', 'coin']) {
      const boosted = landingOdds(key, 4);
      expect(boosted((other) => other === key)).toBeCloseTo(4 * plain((other) => other === key), 3);
      expect(boosted((other) => other !== key && other !== 'none')).toBeCloseTo(plain((other) => other !== key && other !== 'none'), 3);
    }
    expect(boosterKeys(SEGMENTS)).not.toContain('none');
  });

  it('pays the Booster landing the tier of its segment', () => {
    const keys = boosterKeys(SEGMENTS);
    for (let i = 0; i < 300; i++) {
      const { index, tier } = wheelLanding(SEGMENTS, keys[i % keys.length]!, 5);
      const { kind } = SEGMENTS[index]!;
      if (['coin', 'hunt', 'pachinko'].includes(kind)) expect(['small', 'big']).toContain(tier);
      else expect(tier).toBe(kind);
    }
  });
});
