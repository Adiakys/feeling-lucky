export const random = (min: number, max: number) => min + Math.random() * (max - min);
export const randomInt = (min: number, max: number) => Math.floor(random(min, max + 1));
export const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]!;
export const shuffle = <T>(items: readonly T[]): T[] =>
  items.map((item) => [Math.random(), item] as const).sort((a, b) => a[0] - b[0]).map(([, item]) => item);
export const mod = (value: number, base: number) => ((value % base) + base) % base;
export const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);
