import { html, nothing, type PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { LuckyElement } from '../runtime/element';

// One chip per prize: the prize the next play is for. Once a chip is on the table (locked), every other chip
// must be of its prize; count shows the chips left under the selector. Choosing fires `choose` with the prize id.
@customElement('fl-chips')
export class Chips extends LuckyElement {
  @property() chosen = '';
  @property({ type: Boolean }) disabled = false;
  @property() locked: string | null = null;
  @property({ attribute: false }) count?: { used: number; max: number };

  @state() private edges = { left: false, right: false };
  @query('.lk-chips-strip') private strip?: HTMLElement;

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('locked') && this.locked && this.locked !== this.chosen) this.choose(this.locked);
  }

  protected updated(changed: PropertyValues<this>) {
    if (changed.has('chosen')) this.reveal();
    this.measure();
  }

  // The chosen chip scrolls into the strip, without scrolling anything around it.
  private reveal() {
    const strip = this.strip;
    const chip = strip?.querySelector<HTMLElement>('.lk-chip.is-chosen');
    if (!strip || !chip) return;
    const left = chip.offsetLeft - strip.offsetLeft;
    if (left < strip.scrollLeft || left + chip.offsetWidth > strip.scrollLeft + strip.clientWidth)
      strip.scrollTo({ left: left - (strip.clientWidth - chip.offsetWidth) / 2, behavior: 'smooth' });
  }

  private measure = () => {
    const strip = this.strip;
    if (!strip) return;
    const edges = { left: strip.scrollLeft > 1, right: strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1 };
    if (edges.left !== this.edges.left || edges.right !== this.edges.right) this.edges = edges;
  };

  // A mouse wheel scrolls the strip sideways.
  private wheel = (event: WheelEvent) => {
    const strip = this.strip;
    if (!strip || strip.scrollWidth <= strip.clientWidth || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    event.preventDefault();
    event.stopPropagation();
    strip.scrollLeft += event.deltaY;
  };

  private choose(id: string) {
    this.dispatchEvent(new CustomEvent('choose', { detail: id }));
  }

  private message() {
    if (!this.count) return '';
    const left = this.count.max - this.count.used;
    if (left === this.count.max) return this.t('chipCount.hint', { n: left });
    return this.t(left === 0 ? 'chipCount.none' : left === 1 ? 'chipCount.leftOne' : 'chipCount.left', { n: left });
  }

  render() {
    const { room, count } = this;
    return html`
      <div class="lk-chips-rack">
        <div class="lk-chips" role="radiogroup" aria-label=${this.t('chips')}>
          <div
            class="lk-chips-strip ${this.edges.left ? 'has-left' : ''} ${this.edges.right ? 'has-right' : ''}"
            @scroll=${this.measure}
            @wheel=${this.wheel}
          >
            ${room.prizeIds.map(
              (id) => html`
                <button
                  class="lk-chip ${this.chosen === id ? 'is-chosen' : ''}"
                  role="radio"
                  aria-checked=${this.chosen === id}
                  ?disabled=${this.disabled || (!!this.locked && id !== this.locked)}
                  style="--lk-chip: ${room.color(id)}"
                  aria-label=${room.name(id)}
                  title=${room.name(id)}
                  @click=${() => this.choose(id)}
                >
                  <img src=${room.icon(id)} alt="" />
                </button>
              `,
            )}
          </div>
          <span>${this.chosen ? room.name(this.chosen) : ''}</span>
        </div>
        ${count
          ? html`<div class="lk-chip-count">
              <span class="lk-rl-pips" aria-hidden="true">${Array.from({ length: count.max }, (_, index) => html`<i class=${index < count.used ? 'is-used' : ''}></i>`)}</span>
              ${this.message()}
            </div>`
          : nothing}
      </div>
    `;
  }
}
