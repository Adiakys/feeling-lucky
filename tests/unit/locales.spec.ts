import { describe, expect, it } from 'vitest';
import type { Messages } from '../../src/config/types';
import { BUILT_IN_LOCALES, en } from '../../src/locales';
import de from '../../src/locales/de';
import es from '../../src/locales/es';
import fr from '../../src/locales/fr';
import italian from '../../src/locales/it';

function flatten(messages: Messages, prefix = ''): Map<string, string> {
  const entries = new Map<string, string>();
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') entries.set(path, value);
    else for (const [nested, text] of flatten(value as Messages, path)) entries.set(nested, text);
  }
  return entries;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

const english = flatten(en);

const TRANSLATIONS: Record<string, Messages> = { it: italian, es, fr, de };

it('lists every translation among the built-in locales', () => {
  expect(BUILT_IN_LOCALES.sort()).toEqual(['en', ...Object.keys(TRANSLATIONS)].sort());
});

describe.each(Object.entries(TRANSLATIONS))('built-in locale %s', (_, messages) => {
  const translated = flatten(messages);

  it('has exactly the English keys', () => {
    expect([...translated.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it('keeps the placeholders of every key', () => {
    for (const [key, text] of english) expect(placeholders(translated.get(key) ?? ''), key).toEqual(placeholders(text));
  });
});
