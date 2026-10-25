import { html } from 'lit';
import { isRed, rankLabel, SUIT_PATHS, type Card } from '../../engine/cards';

// A playing card, dealt from the shoe; hidden shows its back until it is turned.
export function card(c: Card, { hidden = false, lit = false }: { hidden?: boolean; lit?: boolean } = {}) {
  const corner = (turned: boolean) =>
    html`<span class="lk-card-corner ${turned ? 'is-turned' : ''}"><b>${rankLabel(c.rank)}</b><svg viewBox="0 0 20 20"><path d=${SUIT_PATHS[c.suit]} /></svg></span>`;
  return html`
    <div class="lk-card ${hidden ? 'is-hidden' : ''} ${isRed(c) ? 'is-red' : ''} ${lit ? 'is-lit' : ''}">
      <div class="lk-card-turn">
        <div class="lk-card-face">
          ${corner(false)}
          <svg class="lk-card-pip" viewBox="0 0 20 20"><path d=${SUIT_PATHS[c.suit]} /></svg>
          ${corner(true)}
        </div>
        <div class="lk-card-back"></div>
      </div>
    </div>
  `;
}
