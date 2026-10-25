import type { Messages } from '../config/types';
import en from './en';

// English is every language's fallback, so it ships with the library; the others load when the room speaks them.
const LOADERS: Record<string, () => Promise<{ default: Messages }>> = {
  it: () => import('./it'),
  es: () => import('./es'),
  fr: () => import('./fr'),
  de: () => import('./de'),
};

export const BUILT_IN_LOCALES = ['en', ...Object.keys(LOADERS)];

const loaded: Record<string, Messages> = { en };

export const builtIn = (code: string): Messages | undefined => loaded[code];

export const isLoaded = (codes: string[]) => codes.every((code) => !LOADERS[code] || loaded[code]);

export async function loadBuiltIn(codes: string[]) {
  await Promise.all(codes.filter((code) => LOADERS[code] && !loaded[code]).map(async (code) => (loaded[code] = (await LOADERS[code]!()).default)));
}

export { en };
