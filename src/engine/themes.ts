import { decide } from './rig';

declare module './rig' {
  interface Decisions {
    theme: { context: Record<string, never>; value: Theme | null };
  }
}

export const THEMES = ['christmas', 'halloween', 'easter', 'august'] as const;
export type Theme = (typeof THEMES)[number];

// When each theme dresses the room, the first that matches winning. A date is 'MM-DD' every year,
// 'YYYY-MM-DD' that year only, or 'easter', 'easter-7', 'easter+1' from Easter Sunday; without `to` it is a single day.
export const THEME_CALENDAR: { theme: Theme; from: string; to?: string }[] = [
  { theme: 'christmas', from: '12-08', to: '01-06' },
  { theme: 'halloween', from: '10-30', to: '10-31' },
  { theme: 'easter', from: 'easter-6', to: 'easter+1' },
  { theme: 'august', from: '08-01', to: '08-31' },
];

const pad = (value: number) => String(value).padStart(2, '0');
const isoDay = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Easter Sunday of the Gregorian calendar (anonymous algorithm).
export function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const h = (19 * a + b - Math.floor(b / 4) - Math.floor((b - Math.floor((b + 8) / 25) + 1) / 3) + 15) % 30;
  const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - (c % 4)) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function resolve(day: string, year: number) {
  const easter = /^easter([+-]\d+)?$/.exec(day);
  if (easter) {
    const sunday = easterSunday(year);
    sunday.setDate(sunday.getDate() + Number(easter[1] ?? 0));
    return isoDay(sunday);
  }
  return day.length === 5 ? `${year}-${day}` : day;
}

// A period that ends before it starts runs into the next year, so the one begun last year counts too.
export function themeOfDay(date = new Date()): Theme | null {
  const today = isoDay(date);
  const year = date.getFullYear();
  const period = THEME_CALENDAR.find(({ from, to = from }) =>
    [year - 1, year].some((start) => {
      const first = resolve(from, start);
      let last = resolve(to, start);
      if (last < first) last = resolve(to, start + 1);
      return first <= today && today <= last;
    }),
  );
  return period?.theme ?? null;
}

export const roomTheme = () => decide('theme', {}, () => themeOfDay());

// The room's lights and the win confetti in each theme's colours.
export const THEME_COLORS: Record<Theme, { lights: string[]; confetti: string[] }> = {
  christmas: { lights: ['#ffe3a0', '#fff4d6', '#ff6b5e', '#7fd6a0', '#ffffff', '#f6d27a'], confetti: ['#c8202f', '#1c7a45', '#fff4d6', '#f3d488', '#d4a94e', '#ffffff'] },
  halloween: { lights: ['#ffb347', '#ff8a2a', '#c48bff', '#ffe3a0', '#9be36a'], confetti: ['#ff8a2a', '#6b2fa0', '#1b1210', '#f3d488', '#9be36a'] },
  easter: { lights: ['#fff4d6', '#ffc8dd', '#cdb4ff', '#b8f0c8', '#fff1a8'], confetti: ['#ffc8dd', '#cdb4ff', '#b8f0c8', '#fff1a8', '#a8dcff', '#f3d488'] },
  august: { lights: ['#ffe3a0', '#ffb36b', '#6ee0d6', '#ff8f8f', '#fff4d6'], confetti: ['#ffd23f', '#3ec1c9', '#ff6f59', '#ffffff', '#f3d488'] },
};

// Santa's sleigh, flying toward +x from the sleigh's middle, drawn by two reindeer with Rudolph in the lead:
// Takeoff's plane at Christmas, as SVG paths for the lobby and the game's canvas alike.
export interface ArtPart { d: string; fill?: string; stroke?: string; width?: number; glow?: boolean }

const reindeer = (x: number, nose: boolean): ArtPart[] => [
  { d: `M${x + 3} 0L${x - 1} 7M${x + 6} 0L${x + 4} 8M${x + 15} 0L${x + 19} 7M${x + 17} 0L${x + 22} 6`, stroke: '#6b4220', width: 1.6 },
  { d: `M${x} -4a10 4.5 0 1 0 20 0a10 4.5 0 1 0 -20 0M${x + 17} -6L${x + 23} -13L${x + 26} -11L${x + 20} -3Z`, fill: '#8a5a2b' },
  { d: `M${x + 23} -13a4 2.6 0 1 0 8 0a4 2.6 0 1 0 -8 0`, fill: '#9a6634' },
  { d: `M${x + 24} -15L${x + 22} -21M${x + 23} -18L${x + 20} -19M${x + 26} -15L${x + 27} -21M${x + 26.5} -18L${x + 29} -20`, stroke: '#e6c79a', width: 1 },
  { d: `M${x + 29.5} -13a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0`, fill: nose ? '#ff3b3b' : '#3a2010', glow: nose },
];

export const SANTA_SLEIGH: ArtPart[] = [
  { d: 'M10 -8L38 -6M10 -8L68 -6', stroke: '#f3d488', width: 0.8 },
  ...reindeer(30, false),
  ...reindeer(60, true),
  { d: 'M-19 -12a7 7 0 1 0 14 0a7 7 0 1 0 -14 0', fill: '#7a4a22' },
  { d: 'M-9 -9a7 7 0 1 0 14 0a7 7 0 1 0 -14 0', fill: '#c8202f' },
  { d: 'M2 -11L10 -8', stroke: '#c8202f', width: 3 },
  { d: 'M-4 -19a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', fill: '#f2c9a0' },
  { d: 'M-4.5 -18Q0 -9 4.5 -18Z', fill: '#fffaf0' },
  { d: 'M-4.5 -21Q0 -28 4.5 -21ZM-2 -25L-9 -27L-3 -22Z', fill: '#c8202f' },
  { d: 'M-4.8 -22.4h9.6v2.2h-9.6zM-11 -27a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0', fill: '#fffaf0' },
  { d: 'M-18 -6Q-20 -14 -15 -14L-12 -10L12 -6Q20 -4 18 4L-14 4Q-18 4 -18 -6Z', fill: '#9e1b22', stroke: '#d4a94e', width: 1.2 },
  { d: 'M-20 10L16 10Q24 10 22 4M-10 4v6M8 4v6', stroke: '#d4a94e', width: 2 },
];
