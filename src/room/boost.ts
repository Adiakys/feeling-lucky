import { html } from 'lit';
import type { Translate } from '../runtime/i18n';

// The bonus of the day's sash, on a lobby table or on its game's felt.
export const boost = (t: Translate, multiplier: number) => html`
  <span class="lk-boost" role="img" aria-label=${t('boost.odds', { n: multiplier })}>
    <small aria-hidden="true">${t('boost.title')}</small>
    <b aria-hidden="true">${t('boost.badge', { n: multiplier })}</b>
  </span>
`;
