import { describe, expect, it } from 'vitest';
import { loadLocale, localeChain, localeLoaded, translator } from '../../src/runtime/i18n';

describe('translations', () => {
  it('falls back from a regional locale to its language, then to English', () => {
    expect(localeChain('pt-BR')).toEqual(['pt-BR', 'pt', 'en']);
    expect(localeChain('en')).toEqual(['en']);
  });

  it('loads a built-in language only when asked for', async () => {
    expect(localeLoaded('en-GB')).toBe(true);
    expect(localeLoaded('fr')).toBe(false);
    expect(translator('fr')('cert.otherGame')).toBe('Change game');
    await loadLocale('fr-CA');
    expect(localeLoaded('fr')).toBe(true);
    expect(translator('fr')('cert.otherGame')).not.toBe('Change game');
  });

  it('prefers the host’s messages, then the built-in ones, and fills the parameters', async () => {
    await loadLocale('it');
    const t = translator('it-CH', { it: { cert: { claim: 'Prendi {what}' } } });
    expect(t('cert.claim', { what: 'il premio' })).toBe('Prendi il premio');
    expect(t('cert.otherGame')).toBe('Cambia gioco');
    expect(translator('pt')('cert.otherGame')).toBe('Change game');
    expect(t('missing.key')).toBe('missing.key');
  });
});
