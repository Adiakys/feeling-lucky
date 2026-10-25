import { afterEach, describe, expect, it } from 'vitest';
import { checkDuty, DEALER_BOOST, dealerShifts, onDuty, roster, shiftAt } from '../../src/engine/dealer';
import { installRig } from '../../src/engine/rig';
import { gameBoost, PRIVATE_GAMES } from '../../src/engine/tiers';

const day = (date: number, hours = 0, minutes = 0) => new Date(2026, 9, date, hours, minutes);

afterEach(() => {
  installRig({});
  roster.value = 0;
  onDuty.value = null;
});

describe('the dealers’ shifts', () => {
  it('are three a day, of 30 to 90 minutes, apart, between 10:00 and 23:00', () => {
    for (let date = 1; date <= 60; date++) {
      const shifts = dealerShifts(day(date), 4);
      expect(shifts).toHaveLength(3);
      shifts.forEach((shift, index) => {
        expect(shift.end - shift.start).toBeGreaterThanOrEqual(30);
        expect(shift.end - shift.start).toBeLessThanOrEqual(90);
        expect(shift.start).toBeGreaterThanOrEqual(10 * 60);
        expect(shift.end).toBeLessThanOrEqual(23 * 60);
        if (index) expect(shift.start).toBeGreaterThan(shifts[index - 1]!.end);
      });
    }
  });

  it('are the same for everyone all day, and change from day to day', () => {
    expect(dealerShifts(day(25, 9), 3)).toEqual(dealerShifts(day(25, 22), 3));
    const starts = new Set(Array.from({ length: 30 }, (_, date) => dealerShifts(day(date + 1), 3)[0]!.start));
    expect(starts.size).toBeGreaterThan(10);
  });

  it('go to the dealers in turn, every dealer over the days', () => {
    const shifts = dealerShifts(day(25), 3);
    expect(shifts.map((shift) => shift.dealer)).toEqual([0, 1, 2].map((index) => (shifts[0]!.dealer + index) % 3));
    const firsts = new Set(Array.from({ length: 30 }, (_, date) => dealerShifts(day(date + 1), 3)[0]!.dealer));
    expect(firsts).toEqual(new Set([0, 1, 2]));
    expect(dealerShifts(day(25), 0)).toEqual([]);
  });

  it('put a dealer at the tables only within a shift', () => {
    const [first] = dealerShifts(day(25), 2);
    const at = (minute: number) => shiftAt(day(25, Math.floor(minute / 60), minute % 60), 2);
    expect(at(first!.start)).toBe(first!.dealer);
    expect(at(first!.end - 1)).toBe(first!.dealer);
    expect(at(first!.end)).toBeNull();
    expect(at(first!.start - 1)).toBeNull();
  });
});

describe('a dealer at the tables', () => {
  it('doubles the odds of the Salon Privé’s games only', () => {
    const [first] = dealerShifts(day(25), 2);
    roster.value = 2;
    checkDuty(day(25, Math.floor(first!.start / 60), first!.start % 60));
    expect(onDuty.value).toBe(first!.dealer);
    expect(PRIVATE_GAMES.map(gameBoost)).toEqual([DEALER_BOOST, DEALER_BOOST]);
    checkDuty(day(25, 3));
    expect(PRIVATE_GAMES.map(gameBoost)).toEqual([1, 1]);
  });

  it('never comes without dealers, and the developer menu can call her or send her away', () => {
    checkDuty(day(25, 12));
    expect(onDuty.value).toBeNull();
    roster.value = 3;
    installRig({ dealer: () => 2 });
    checkDuty(day(25, 3));
    expect(onDuty.value).toBe(2);
  });
});
