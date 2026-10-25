import { html, nothing, svg, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CircleHelp } from 'lucide';
import { guilloche } from '../runtime/fx';
import type { Translate } from '../runtime/i18n';
import { LuckyElement } from '../runtime/element';
import { icon } from '../runtime/icons';
import { boost } from './boost';

const backdrop = guilloche(450, 400, 1.25);

// The felt table every game stands on, with its bulb frame and the game's rules behind a round button.
export function stage(
  t: Translate,
  { state, rules, multiplier }: { state: 'idle' | 'spinning' | 'won'; rules: string; multiplier?: number },
  game: TemplateResult,
  overlay?: TemplateResult,
) {
  return html`
    <div class="lk-stage">
      <div class="lk-machine" data-state=${state}>
        <svg class="lk-backdrop" viewBox="0 0 900 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          ${backdrop.map((points) => svg`<polyline points=${points} fill="none" stroke="#d4a94e" stroke-opacity="0.12" stroke-width="0.5" />`)}
        </svg>
        <i class="lk-bulbs" aria-hidden="true"></i>
        ${multiplier && multiplier > 1 ? boost(t, multiplier) : nothing}
        <fl-rules .text=${rules}></fl-rules>
        <div class="lk-game">${game}</div>
        ${overlay ?? nothing}
      </div>
    </div>
  `;
}

@customElement('fl-rules')
export class Rules extends LuckyElement {
  @property() text = '';
  @state() private open = false;

  // Esc closes the rules before the room sees it, and a click anywhere else closes them too.
  private key = (event: KeyboardEvent) => {
    if (!this.open || event.key !== 'Escape') return;
    event.stopPropagation();
    this.open = false;
  };

  private outside = (event: PointerEvent) => {
    if (this.open && !event.composedPath().includes(this)) this.open = false;
  };

  connectedCallback() {
    super.connectedCallback();
    addEventListener('keydown', this.key, true);
    addEventListener('pointerdown', this.outside, true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    removeEventListener('keydown', this.key, true);
    removeEventListener('pointerdown', this.outside, true);
  }

  render() {
    return html`
      <div class="lk-help">
        <button class="lk-round ${this.open ? 'is-open' : ''}" aria-label=${this.t('rules')} aria-expanded=${this.open} aria-controls="lk-rules" @click=${() => (this.open = !this.open)}>
          ${icon(CircleHelp)}
        </button>
        ${this.open
          ? html`<div id="lk-rules" class="lk-rules" role="dialog" aria-label=${this.t('rules')}><h4>${this.t('rules')}</h4><p>${this.text}</p></div>`
          : nothing}
      </div>
    `;
  }
}
