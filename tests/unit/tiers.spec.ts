import { afterEach, describe, expect, it } from 'vitest';
import { BONUS_GAMES, DAY_MACHINES, DAY_TICKETS, dailyBonus, DEFAULT_ODDS, drawTier, luckBoost, PRIVATE_GAMES, setOdds, tierOdds } from '../../src/engine/tiers';

describe('drawTier', () => {
  it('splits the roll into jackpot 1 in 150, big 1 in 60, small 1 in 30, otherwise nothing', () => {
    expect(drawTier(1, 0)).toBe('jackpot');
    expect(drawTier(1, 0.0066)).toBe('jackpot');
    expect(drawTier(1, 0.0067)).toBe('big');
    expect(drawTier(1, 0.0233)).toBe('big');
    expect(drawTier(1, 0.0234)).toBe('small');
    expect(drawTier(1, 0.0566)).toBe('small');
    expect(drawTier(1, 0.0567)).toBe('none');
    expect(drawTier(1, 0.999)).toBe('none');
  });
});

describe('the host\'s odds', () => {
  afterEach(() => setOdds());

  it('replace the defaults tier by tier, keeping the default for any left out', () => {
    setOdds({ small: 1 / 4, big: 1 / 10 });
    expect(tierOdds()).toEqual({ small: 1 / 4, big: 1 / 10, jackpot: DEFAULT_ODDS.jackpot });
    expect(drawTier(1, 0.0066)).toBe('jackpot');
    expect(drawTier(1, 0.1)).toBe('big');
    expect(drawTier(1, 0.35)).toBe('small');
    expect(drawTier(1, 0.36)).toBe('none');
  });

  it('are the defaults when none are given', () => {
    setOdds({ small: 0.5 });
    setOdds();
    expect(tierOdds()).toEqual(DEFAULT_ODDS);
  });

  it('keep each chance between 0 and 1 and scale them down when together they pass 1', () => {
    setOdds({ small: -1, big: 2 });
    expect(tierOdds()).toEqual({ small: 0, big: 1 / (1 + DEFAULT_ODDS.jackpot), jackpot: DEFAULT_ODDS.jackpot / (1 + DEFAULT_ODDS.jackpot) });
    setOdds({ small: 0.6, big: 0.6, jackpot: 0.3 });
    const { small, big, jackpot } = tierOdds();
    expect(small + big + jackpot).toBeCloseTo(1, 10);
    expect(drawTier(1, 0.999)).not.toBe('none');
  });

  it('are still multiplied by the bonus of the day', () => {
    setOdds({ small: 0.1, big: 0, jackpot: 0 });
    expect(drawTier(3, 0.29)).toBe('small');
    expect(drawTier(3, 0.31)).toBe('none');
  });
});

describe('the bonus of the day', () => {
  it('multiplies every odd of the game of the day', () => {
    expect(drawTier(3, 0.0199)).toBe('jackpot');
    expect(drawTier(3, 0.0699)).toBe('big');
    expect(drawTier(3, 0.1699)).toBe('small');
    expect(drawTier(3, 0.1701)).toBe('none');
  });

  it('gives everyone the same game and a multiplier from 2 to 5 for the whole day', () => {
    expect(dailyBonus(new Date(2026, 9, 23, 0, 1))).toEqual(dailyBonus(new Date(2026, 9, 23, 23, 59)));
    const days = Array.from({ length: 120 }, (_, index) => dailyBonus(new Date(2026, 0, 1 + index)));
    expect(new Set(days.map((day) => day.game))).toEqual(new Set(BONUS_GAMES));
    expect(new Set(days.map((day) => day.multiplier))).toEqual(new Set([2, 3, 4, 5]));
    expect(new Set(days.map((day) => day.ticket))).toEqual(new Set(DAY_TICKETS));
    const tickets = days.map((day) => day.ticket);
    expect(tickets.filter((ticket) => ticket === 'double').length / tickets.length).toBeGreaterThan(0.35);
    expect(new Set(days.map((day) => day.machine))).toEqual(new Set(DAY_MACHINES));
  });

  it('boosts only the game of the day', () => {
    const today = new Date(2026, 9, 23);
    const { game, multiplier } = dailyBonus(today);
    expect(luckBoost(game, today)).toBe(multiplier);
    expect(BONUS_GAMES.filter((other) => other !== game).map((other) => luckBoost(other, today))).toEqual([1, 1, 1, 1]);
  });

  it('never gives the bonus to a Salon Privé game', () => {
    const year = Array.from({ length: 366 }, (_, index) => new Date(2026, 0, 1 + index));
    expect(year.filter((day) => PRIVATE_GAMES.includes(dailyBonus(day).game))).toEqual([]);
    expect(year.flatMap((day) => PRIVATE_GAMES.map((game) => luckBoost(game, day))).every((boost) => boost === 1)).toBe(true);
  });
});
