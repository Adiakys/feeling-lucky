import { describe, expect, it } from 'vitest';
import type { Prize } from '../../src/config/types';
import { boardOf, drawAward, prizesPaying, resolveVariant, spread } from '../../src/engine/awards';

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

describe('the board', () => {
  it('shows each tier’s variant labels once, in order, and the symbol while some prize has none of the tier', () => {
    expect(boardOf([pro])).toEqual({ small: ['7D', '1M'], big: ['1Y'], jackpot: [null] });
    expect(boardOf([pro, mug])).toEqual({ small: ['7D', '1M', null], big: ['1Y', null], jackpot: [null] });
    expect(boardOf([credits])).toEqual({ small: [null], big: [null], jackpot: [null] });
  });

  it('fills a fixed number of spots in order', () => {
    expect(spread(['a', 'b'], 5)).toEqual(['a', 'a', 'a', 'b', 'b']);
    expect(spread(['a', 'b', 'c', 'd'], 2)).toEqual(['a', 'c']);
    expect(spread([null], 3)).toEqual([null, null, null]);
  });
});

describe('what a win pays', () => {
  it('draws an award among the prize’s own variants of the tier, or the symbol', () => {
    for (let i = 0; i < 50; i++) expect(['7D', '1M']).toContain(drawAward(pro, 'small'));
    expect(drawAward(pro, 'jackpot')).toBeNull();
    expect(drawAward(mug, 'big')).toBeNull();
    expect(drawAward(pro, 'none')).toBeNull();
  });

  it('pays a board award only with the prizes that have it', () => {
    expect(prizesPaying([pro, mug, credits], 'small', '1M')).toEqual([pro]);
    expect(prizesPaying([pro, mug, credits], 'small', null)).toEqual([mug, credits]);
    expect(prizesPaying([pro], 'small', null)).toEqual([pro]);
  });

  it('hands over the variant shown, the variants function’s one, or the whole prize', async () => {
    expect(await resolveVariant(pro, 'small', '1M')).toEqual({ tier: 'small', label: '1 month', short: '1M' });
    expect(await resolveVariant(credits, 'big', null)).toEqual({ tier: 'big', label: 'big credits' });
    expect(await resolveVariant(mug, 'jackpot', null)).toBeNull();
    expect(await resolveVariant(pro, 'jackpot', null)).toBeNull();
  });
});
