import { html, nothing, svg, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { SlotSymbol } from '../../engine/slot';
import { LuckyElement } from '../../runtime/element';

const bulbs = Array.from({ length: 22 }, (_, index) => ({ x: 22 + (index % 11) * 37.6, y: index < 11 ? 9 : 77 }));

const inf = svg`<svg viewBox="0 0 64 64" role="img" aria-label="∞">
  <path d="M21 22c-6 0-10.5 4.5-10.5 10s4.5 10 10.5 10c8.5 0 13.5-20 22-20 6 0 10.5 4.5 10.5 10s-4.5 10-10.5 10c-8.5 0-13.5-20-22-20z" fill="none" stroke="#1c6136" stroke-width="7.5" stroke-linecap="round" />
</svg>`;
const seven = svg`<svg viewBox="0 0 64 64" role="img" aria-label="7">
  <text x="32" y="53" text-anchor="middle" font-family="'Playfair Display', Georgia, serif" font-weight="800" font-size="58" fill="#9e1b22" stroke="#4a0a10" stroke-width="2" paint-order="stroke">7</text>
</svg>`;

// The one-armed bandit: the slot game drives its reels, the lobby shows it idle. Fires `pull`.
@customElement('fl-slot-machine')
export class SlotMachine extends LuckyElement {
  @property({ attribute: false }) strips: SlotSymbol[][] = [];
  @property({ type: Boolean }) mini = false;
  @property() state: 'idle' | 'spinning' | 'won' = 'idle';
  @property() rootClass = '';
  @property({ attribute: false }) tray?: TemplateResult;

  private symbol(symbol: SlotSymbol) {
    if (symbol === 'inf') return inf;
    if (symbol === 'seven') return seven;
    return html`<img src=${this.room.icon(symbol)} alt=${this.room.name(symbol)} />`;
  }

  private pull = () => {
    if (!this.mini) this.dispatchEvent(new CustomEvent('pull'));
  };

  render() {
    const lever = html`<div class="lk-base"></div><div class="lk-rod"><div class="lk-knob"></div></div>`;
    return html`
      <div class="lk-slot is-${this.state} ${this.rootClass}">
        <div class="lk-slot-strip lk-slot-strip--left"></div>
        <div class="lk-slot-strip lk-slot-strip--right"></div>
        <div class="lk-slot-cab">
          <div class="lk-slot-sign">
            <svg viewBox="0 0 418 86" preserveAspectRatio="none" aria-hidden="true">
              ${bulbs.map((bulb, index) => svg`<circle class="lk-slot-lamp" style="--i: ${index}" cx=${bulb.x} cy=${bulb.y} r="4.2" />`)}
            </svg>
            <b>${this.t('slot.sign')}</b>
          </div>
          <div class="lk-slot-glass">
            ${this.strips.map(
              (strip) => html`
                <div class="lk-reel">
                  <ul>
                    ${[...strip, ...strip, ...strip].map((symbol) => html`<li><div class="lk-sym">${this.symbol(symbol)}</div></li>`)}
                  </ul>
                </div>
              `,
            )}
            <div class="lk-payline"></div>
          </div>
          <div class="lk-slot-tray">${this.tray ?? nothing}</div>
        </div>
        ${this.mini
          ? html`<div class="lk-lever">${lever}</div>`
          : html`<button class="lk-lever" aria-label=${this.t('slot.lever')} @click=${this.pull}>${lever}</button>`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fl-slot-machine': SlotMachine;
  }
}
