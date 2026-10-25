import type { Messages } from '../config/types';
import { builtIn, isLoaded, loadBuiltIn } from '../locales';
import { signal } from './signal';

const readPageLocale = () => (typeof document !== 'undefined' && document.documentElement.lang) || (typeof navigator !== 'undefined' ? navigator.language : '') || 'en';

// The host page's language, followed as the app switches it.
export const pageLocale = signal(readPageLocale());
let watching = false;

export function watchPageLocale() {
  pageLocale.value = readPageLocale();
  if (watching || typeof MutationObserver === 'undefined') return;
  watching = true;
  new MutationObserver(() => (pageLocale.value = readPageLocale())).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
}

// pt-BR: pt-BR, then pt, then en.
export const localeChain = (locale: string) => [...new Set([locale, locale.split('-')[0]!, 'en'])];

function lookup(messages: Messages | undefined, key: string): string | undefined {
  let node: string | Messages | undefined = messages;
  for (const part of key.split('.')) node = typeof node === 'object' ? node[part] : undefined;
  return typeof node === 'string' ? node : undefined;
}

export const localeLoaded = (locale: string) => isLoaded(localeChain(locale));
export const loadLocale = (locale: string) => loadBuiltIn(localeChain(locale));

export type Translate = (key: string, params?: Record<string, string | number>) => string;

// The host's messages first, then the built-in ones, along the locale chain; a missing key shows itself.
export function translator(locale: string, custom: Record<string, Messages> = {}): Translate {
  const sources = localeChain(locale).flatMap((code) => [custom[code], builtIn(code)]);
  return (key, params = {}) => {
    const text = sources.reduce<string | undefined>((found, messages) => found ?? lookup(messages, key), undefined) ?? key;
    return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
  };
}
