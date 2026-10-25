import { html } from 'lit';
import type { Translate } from '../runtime/i18n';

// The bonus's sash, on a lobby table or on its game's felt: the bonus of the day, or the dealer's at the Salon Privé.
export const boost = (t: Translate, multiplier: number, dealer = false) => html`
  <span class="lk-boost" role="img" aria-label=${t(dealer ? 'boost.dealerOdds' : 'boost.odds', { n: multiplier })}>
    <small aria-hidden="true">${t(dealer ? 'boost.dealer' : 'boost.title')}</small>
    <b aria-hidden="true">${t('boost.badge', { n: multiplier })}</b>
  </span>
`;
