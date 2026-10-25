import { html, svg, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { announcedNumbers, ROULETTE_ANNOUNCED, ROULETTE_ORDER, ROULETTE_RED, type RouletteAnnounced } from '../../engine/roulette';
import { LuckyElement } from '../../runtime/element';

export type Play = { name: RouletteAnnounced; prizeId: string };

const S = 330;
const R = 62;
const T = 34;
const CX = S / 2 + R + T / 2;
const CY = R + T / 2;
const L = 2 * S + 2 * Math.PI * R;
const CELL = L / ROULETTE_ORDER.length;
const QUARTER = (Math.PI * R) / 2;

const arc = (x: number, angle: number, r: number) => [x + r * Math.cos(angle), CY + r * Math.sin(angle)];

// s runs clockwise from the right end, where zero sits.
function point(s: number, offset: number) {
  const along = ((s % L) + L) % L;
  const r = R + offset;
  if (along < QUARTER) return arc(CX + S / 2, along / R, r);
  if (along < QUARTER + S) return [CX + S / 2 - (along - QUARTER), CY + r];
  if (along < QUARTER + S + Math.PI * R) return arc(CX - S / 2, Math.PI / 2 + (along - QUARTER - S) / R, r);
  if (along < QUARTER + 2 * S + Math.PI * R) return [CX - S / 2 + (along - QUARTER - S - Math.PI * R), CY - r];
  return arc(CX + S / 2, (3 * Math.PI) / 2 + (along - QUARTER - 2 * S - Math.PI * R) / R, r);
}

function sample(from: number, to: number, offset: number) {
  const steps = Math.max(2, Math.ceil((to - from) / 6));
  return Array.from({ length: steps + 1 }, (_, index) => point(from + ((to - from) * index) / steps, offset));
}
const toPath = (points: number[][]) => `M${points.map(([x, y]) => `${x!.toFixed(1)} ${y!.toFixed(1)}`).join('L')}Z`;
const edge = (index: number) => (index + 0.5) * CELL;

const cells = ROULETTE_ORDER.map((number, index) => {
  const from = edge(index - 1);
  const to = edge(index);
  const [x, y] = point(index * CELL, 0);
  return {
    number,
    d: toPath([...sample(from, to, T / 2), ...sample(from, to, -T / 2).reverse()]),
    x: x!,
    y: y!,
    fill: number === 0 ? '#156b3c' : ROULETTE_RED.has(number) ? '#9e1b22' : '#17120e',
  };
});

const indexOf = (number: number) => ROULETTE_ORDER.indexOf(number);
// Each sector of the wheel as runs of pocket indexes; the inner field between them is drawn from those runs.
const RUNS: Record<RouletteAnnounced, [number, number][]> = {
  nassa: [[indexOf(12) - 1, ROULETTE_ORDER.length + indexOf(19)]],
  orphans: [[indexOf(17) - 1, indexOf(6)], [indexOf(1) - 1, indexOf(9)]],
  tiers: [[indexOf(27) - 1, indexOf(33)]],
};

const sectors = (Object.keys(ROULETTE_ANNOUNCED) as RouletteAnnounced[]).map((name) => {
  const points = RUNS[name].flatMap(([from, to]) => sample(edge(from), edge(to), -T / 2 - 1));
  return {
    name,
    d: toPath(points),
    x: Math.min(CX + S / 2 + 6, Math.max(CX - S / 2 - 6, points.reduce((sum, [x]) => sum + x!, 0) / points.length)),
    y: CY,
    cost: ROULETTE_ANNOUNCED[name].length,
  };
});

const outline = toPath(sample(0, L, T / 2 + 3));
const inner = toPath(sample(0, L, -T / 2));

// The racetrack: the wheel's numbers in their order around a stadium, with the announced bets inside.
// Choosing one fires `announce` with its name.
@customElement('fl-roulette-track')
export class RouletteTrack extends LuckyElement {
  @property({ attribute: false }) plays: Play[] = [];
  @property({ type: Number }) chipsLeft = 0;
  @property({ type: Boolean }) locked = false;
  @property({ attribute: false }) result: number | null = null;
  @property({ attribute: false }) struck: number[] = [];

  @state() private hovered: RouletteAnnounced | null = null;

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('locked') && this.locked) this.hovered = null;
  }

  private choose(name: RouletteAnnounced, cost: number) {
    if (!this.locked && cost <= this.chipsLeft) this.dispatchEvent(new CustomEvent('announce', { detail: name }));
  }

  render() {
    const { room, chipsLeft } = this;
    const lit = new Set(this.hovered ? announcedNumbers(this.hovered) : []);
    return html`
      <svg class=${classMap({ 'lk-track': true, 'is-locked': this.locked })} viewBox="-4 -4 ${2 * CX + 8} ${2 * CY + 8}" role="group" aria-label=${this.t('roulette.track')}>
        <path d=${outline} fill="#1e0d06" stroke="#d4a94e" stroke-width="1.6" />
        <path d=${inner} fill="rgb(0 0 0 / .18)" />
        ${cells.map(
          (cell) => svg`
            <g class=${classMap({ 'lk-track-cell': true, 'is-lit': lit.has(cell.number), 'is-result': this.result === cell.number, 'is-struck': this.struck.includes(cell.number) })} data-number=${cell.number}>
              <path d=${cell.d} fill=${cell.fill} stroke="#d4a94e" stroke-width=".8" />
              <text x=${cell.x} y=${cell.y}>${cell.number}</text>
            </g>
          `,
        )}
        ${sectors.map((sector) => {
          const plays = this.plays.filter((play) => play.name === sector.name);
          const off = sector.cost > chipsLeft;
          const choose = () => this.choose(sector.name, sector.cost);
          return svg`
            <g
              class=${classMap({ 'lk-track-sector': true, 'is-off': off })}
              role="button"
              tabindex=${this.locked || off ? -1 : 0}
              aria-disabled=${this.locked || off}
              aria-label=${this.t('roulette.announced.label', { name: this.t(`roulette.announced.${sector.name}`), n: sector.cost })}
              @pointerenter=${() => (this.hovered = sector.name)}
              @pointerleave=${() => (this.hovered = null)}
              @focus=${() => (this.hovered = sector.name)}
              @blur=${() => (this.hovered = null)}
              @click=${choose}
              @keydown=${(event: KeyboardEvent) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                choose();
              }}
            >
              <path d=${sector.d} />
              <text x=${sector.x} y=${sector.y - 16} class="lk-track-name">${this.t(`roulette.announced.${sector.name}`)}</text>
              <text x=${sector.x} y=${sector.y + 1} class="lk-track-cost">${this.t('roulette.announced.cost', { n: sector.cost })}</text>
              ${repeat(
                plays,
                (play) => play.prizeId,
                (play, index) => svg`
                  <g class="lk-rt-chip" transform="translate(${sector.x + (index - (plays.length - 1) / 2) * 24} ${sector.y + 24})">
                    <circle r="11" fill=${room.color(play.prizeId)} />
                    <circle r="9.7" fill="none" stroke="#fbf3df" stroke-width="2.6" stroke-dasharray="3.8 3.82" />
                    <circle r="7" fill=${room.color(play.prizeId)} stroke="rgb(251 243 223 / .55)" stroke-width="1" />
                    <image href=${room.icon(play.prizeId)} x="-5" y="-5" width="10" height="10" />
                  </g>
                `,
              )}
            </g>
          `;
        })}
      </svg>
    `;
  }
}
