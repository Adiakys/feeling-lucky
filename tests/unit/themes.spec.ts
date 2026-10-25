import { describe, expect, it } from 'vitest';
import { easterSunday, themeOfDay } from '../../src/engine/themes';

const day = (iso: string) => new Date(`${iso}T12:00:00`);

describe('the room themes', () => {
  it('finds Easter Sunday', () => {
    expect(easterSunday(2026).toDateString()).toBe(day('2026-04-05').toDateString());
    expect(easterSunday(2027).toDateString()).toBe(day('2027-03-28').toDateString());
    expect(easterSunday(2038).toDateString()).toBe(day('2038-04-25').toDateString());
  });

  it('dresses the room from the calendar', () => {
    expect(themeOfDay(day('2026-12-07'))).toBeNull();
    expect(themeOfDay(day('2026-12-08'))).toBe('christmas');
    expect(themeOfDay(day('2027-01-06'))).toBe('christmas');
    expect(themeOfDay(day('2027-01-07'))).toBeNull();
    expect(themeOfDay(day('2026-10-29'))).toBeNull();
    expect(themeOfDay(day('2026-10-30'))).toBe('halloween');
    expect(themeOfDay(day('2026-10-31'))).toBe('halloween');
    expect(themeOfDay(day('2026-07-31'))).toBeNull();
    expect(themeOfDay(day('2026-08-01'))).toBe('august');
    expect(themeOfDay(day('2026-08-31'))).toBe('august');
    expect(themeOfDay(day('2026-09-01'))).toBeNull();
  });

  it('follows Easter from year to year', () => {
    expect(themeOfDay(day('2026-03-30'))).toBe('easter');
    expect(themeOfDay(day('2026-04-06'))).toBe('easter');
    expect(themeOfDay(day('2026-04-07'))).toBeNull();
    expect(themeOfDay(day('2027-03-22'))).toBe('easter');
    expect(themeOfDay(day('2027-03-21'))).toBeNull();
  });
});
