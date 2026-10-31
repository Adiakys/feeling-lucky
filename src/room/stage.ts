import { html, nothing, svg, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ref } from 'lit/directives/ref.js';
import { CircleHelp } from 'lucide';
import { guilloche } from '../runtime/fx';
import type { Translate } from '../runtime/i18n';
import { LuckyElement } from '../runtime/element';
import { icon } from '../runtime/icons';
import { boost } from './boost';

const backdrop = guilloche(450, 400, 1.25);

// A game drawn bigger than its table, as on a phone, is scaled down to fit it whole, whenever the table or the game
// changes size, and centred with what hangs out of its box, like the slot's lever. A scale, not a zoom: a zoom would
// leave the parts sized on the table's container units as big as before.
const fits = new WeakMap<Element, ResizeObserver>();
function fit(game?: Element) {
  if (!(game instanceof HTMLElement) || fits.has(game)) return;
  const machine = game.parentElement!;
  const observer = new ResizeObserver(() => {
    if (!game.isConnected) return observer.disconnect();
    const style = getComputedStyle(machine);
    const width = machine.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = machine.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const scale = Math.min(1, width / game.scrollWidth, height / game.scrollHeight);
    const shift = (overflow: number) => `${(-overflow / 2) * scale}px`;
    game.style.scale = scale < 0.99 ? String(scale) : '';
    game.style.translate =
      scale < 0.99 ? `${shift(game.scrollWidth - game.offsetWidth)} ${shift(game.scrollHeight - game.offsetHeight)}` : '';
  });
  observer.observe(machine);
  observer.observe(game);
  fits.set(game, observer);
}

// The felt table every game stands on, with its bulb frame and the game's rules behind a round button.
export function stage(
  t: Translate,
  { state, rules, multiplier, dealer }: { state: 'idle' | 'spinning' | 'won'; rules: string; multiplier?: number; dealer?: boolean },
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
        ${multiplier && multiplier > 1 ? boost(t, multiplier, dealer) : nothing}
        <fl-rules .text=${rules}></fl-rules>
        <div class="lk-game" ${ref(fit)}>${game}</div>
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
