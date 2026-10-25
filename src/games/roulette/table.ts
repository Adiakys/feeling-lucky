import { html, nothing, svg, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { ROULETTE_RED, ROULETTE_SPOTS, rouletteSpot, type RouletteBet, type RouletteSpot } from '../../engine/roulette';
import type { RoomContext } from '../../runtime/context';
import { LuckyElement } from '../../runtime/element';

const W = 58;
const H = 58;
const Z = 56;
const D = 44;
const GRID = 12 * W;
const CHANCES = ['low', 'even', 'red', 'black', 'odd', 'high'];

interface Rect { x: number; y: number; w: number; h: number }
interface Placed { spot: RouletteSpot; chip: { x: number; y: number }; hit: Rect }

const cell = (number: number): Rect => {
  const column = Math.floor((number - 1) / 3);
  return { x: Z + column * W, y: (2 - ((number - 1) % 3)) * H, w: W, h: H };
};
const center = (number: number) => {
  const rect = cell(number);
  return { x: rect.x + W / 2, y: rect.y + H / 2 };
};
const around = (x: number, y: number, w: number, h: number): Rect => ({ x: x - w / 2, y: y - h / 2, w, h });
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const ZERO_PATH = `M${Z} 0H22Q14 0 10 8L2 ${1.5 * H - 6}Q0 ${1.5 * H} 2 ${1.5 * H + 6}L10 ${3 * H - 8}Q14 ${3 * H} 22 ${3 * H}H${Z}Z`;

function place(spot: RouletteSpot): Placed {
  const [first] = spot.numbers;
  if (spot.kind === 'column') {
    const rect = { x: Z + GRID, y: (3 - Number(spot.name)) * H, w: W, h: H };
    return { spot, hit: rect, chip: { x: rect.x + W / 2, y: rect.y + H / 2 } };
  }
  if (spot.kind === 'dozen') {
    const rect = { x: Z + (Number(spot.name) - 1) * 4 * W, y: 3 * H, w: 4 * W, h: D };
    return { spot, hit: rect, chip: { x: rect.x + 2 * W, y: rect.y + D / 2 } };
  }
  if (spot.kind === 'chance') {
    const rect = { x: Z + CHANCES.indexOf(spot.name!) * 2 * W, y: 3 * H + D, w: 2 * W, h: D };
    return { spot, hit: rect, chip: { x: rect.x + W, y: rect.y + D / 2 } };
  }
  if (spot.kind === 'straight') {
    if (first === 0) return { spot, hit: { x: 0, y: 0, w: Z, h: 3 * H }, chip: { x: Z / 2 + 4, y: 1.5 * H } };
    return { spot, hit: cell(first!), chip: center(first!) };
  }
  const withZero = first === 0;
  const numbers = spot.numbers.filter((number) => number !== 0);
  // Streets, six lines and the first four sit on the line between the numbers and the dozens.
  const onEdge = spot.kind === 'line' || (spot.kind === 'street' && !withZero) || (spot.kind === 'corner' && withZero);
  const x = withZero ? Z : mean(numbers.map((number) => center(number).x));
  const y = onEdge ? 3 * H : mean(numbers.map((number) => center(number).y));
  if (spot.kind === 'split') {
    const across = withZero || numbers[1]! - numbers[0]! === 3;
    return { spot, hit: across ? around(x, y, 16, H - 20) : around(x, y, W - 20, 16), chip: { x, y } };
  }
  if (spot.kind === 'street' && !withZero) return { spot, hit: around(x, y, W - 20, 16), chip: { x, y } };
  return { spot, hit: around(x, y, 18, 18), chip: { x, y } };
}

const PRIORITY = ['straight', 'column', 'dozen', 'chance', 'split', 'street', 'line', 'corner'];
const spots: Placed[] = ROULETTE_SPOTS.map(place).sort((a, b) => PRIORITY.indexOf(a.spot.kind) - PRIORITY.indexOf(b.spot.kind));
const byId = new Map(spots.map((placed) => [placed.spot.id, placed]));
const numbers = Array.from({ length: 36 }, (_, index) => index + 1).map((number) => ({ number, rect: cell(number), red: ROULETTE_RED.has(number) }));

// The French layout seen from the player's side: zero on the left, the 2 to 1 columns on the right.
// Choosing a spot fires `place` with its id.
@customElement('fl-roulette-table')
export class RouletteTable extends LuckyElement {
  @property({ attribute: false }) bets: RouletteBet[] = [];
  @property({ type: Boolean }) locked = false;
  @property({ attribute: false }) result: number | null = null;
  @property({ attribute: false }) winning: string | null = null;
  @property({ attribute: false }) struck: number[] = [];
  @property() strikeLabel = '';

  @state() private hovered: string | null = null;
  private labels = new Map<string, string>();
  private labelsOf?: RoomContext['t'];

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('locked') && this.locked) this.hovered = null;
  }

  private label(spot: RouletteSpot) {
    if (this.labelsOf !== this.room.t) {
      this.labelsOf = this.room.t;
      this.labels = new Map(
        spots.map(({ spot }) => [spot.id, spot.name ? this.t(`roulette.spot.${spot.kind}.${spot.name}`) : this.t(`roulette.kind.${spot.kind}`, { numbers: spot.numbers.join(', ') })]),
      );
    }
    return this.labels.get(spot.id)!;
  }

  private choose(spot: string) {
    if (!this.locked) this.dispatchEvent(new CustomEvent('place', { detail: spot }));
  }

  private stacks() {
    const perSpot = new Map<string, RouletteBet[]>();
    this.bets.forEach((bet) => perSpot.set(bet.spot, [...(perSpot.get(bet.spot) ?? []), bet]));
    return [...perSpot].flatMap(([spot, bets]) =>
      bets.map((bet, index) => {
        const { chip } = byId.get(spot)!;
        const shift = (index - (bets.length - 1) / 2) * 12;
        const covered = this.result !== null && rouletteSpot(spot).numbers.includes(this.result);
        return { key: `${spot}|${bet.prizeId}`, bet, x: chip.x + shift, y: chip.y + shift / 2, winning: this.winning === spot, lost: this.result !== null && !covered };
      }),
    );
  }

  render() {
    const { room, result } = this;
    const lit = new Set(this.hovered ? rouletteSpot(this.hovered).numbers : []);
    const dolly = result === null ? null : result === 0 ? { x: Z / 2 + 4, y: 1.5 * H - 26 } : { x: center(result).x + 15, y: center(result).y - 15 };
    return html`
      <svg class=${classMap({ 'lk-rt': true, 'is-locked': this.locked })} viewBox="-8 -8 ${Z + GRID + W + 16} ${3 * H + 2 * D + 16}" role="group" aria-label=${this.t('roulette.table')}>
        <defs>
          <linearGradient id="lk-rt-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3c4" /><stop offset=".45" stop-color="#d4a94e" /><stop offset="1" stop-color="#8a6420" /></linearGradient>
          <filter id="lk-rt-shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#000" flood-opacity=".6" /></filter>
        </defs>

        <g class="lk-rt-print">
          <path d=${ZERO_PATH} fill="#156b3c" data-number="0" />
          <text x=${Z / 2 + 4} y=${1.5 * H} class="lk-rt-num">0</text>
          ${numbers.map(
            (item) => svg`
              <rect x=${item.rect.x + 4} y=${item.rect.y + 4} width=${W - 8} height=${H - 8} rx="6" fill=${item.red ? '#9e1b22' : '#17120e'} data-number=${item.number} />
              <text x=${item.rect.x + W / 2} y=${item.rect.y + H / 2} class="lk-rt-num">${item.number}</text>
            `,
          )}
          ${[1, 2, 3].map((column) => svg`<text x=${Z + GRID + W / 2} y=${(3 - column) * H + H / 2} class="lk-rt-word">${this.t('roulette.board.column')}</text>`)}
          ${[1, 2, 3].map((dozen) => svg`<text x=${Z + (dozen - 1) * 4 * W + 2 * W} y=${3 * H + D / 2} class="lk-rt-word">${this.t(`roulette.board.dozen${dozen}`)}</text>`)}
          ${CHANCES.map((name, index) =>
            name === 'red' || name === 'black'
              ? svg`<path d="M${Z + index * 2 * W + W} ${3 * H + D + 9}l26 ${D / 2 - 9}l-26 ${D / 2 - 9}l-26 ${-(D / 2 - 9)}z" fill=${name === 'red' ? '#9e1b22' : '#17120e'} stroke="url(#lk-rt-gold)" stroke-width="1.5" />`
              : svg`<text x=${Z + index * 2 * W + W} y=${3 * H + D + D / 2} class="lk-rt-word">${this.t(`roulette.board.${name}`)}</text>`,
          )}
          <g fill="none" stroke="url(#lk-rt-gold)" stroke-width="1.6">
            <path d=${ZERO_PATH} />
            <rect x=${Z} y="0" width=${GRID + W} height=${3 * H} />
            <path d=${Array.from({ length: 12 }, (_, i) => `M${Z + (i + 1) * W} 0V${3 * H}`).join('') + `M${Z} ${H}H${Z + GRID + W}M${Z} ${2 * H}H${Z + GRID + W}`} />
            <rect x=${Z} y=${3 * H} width=${GRID} height=${2 * D} />
            <path d=${`M${Z} ${3 * H + D}H${Z + GRID}` + [1, 2].map((i) => `M${Z + i * 4 * W} ${3 * H}V${3 * H + D}`).join('') + [1, 2, 3, 4, 5].map((i) => `M${Z + i * 2 * W} ${3 * H + D}V${3 * H + 2 * D}`).join('')} />
          </g>
        </g>

        <g class="lk-rt-lit" aria-hidden="true">
          ${lit.has(0) ? svg`<path d=${ZERO_PATH} />` : nothing}
          ${numbers.filter((entry) => lit.has(entry.number)).map((item) => svg`<rect x=${item.rect.x + 4} y=${item.rect.y + 4} width=${W - 8} height=${H - 8} rx="6" />`)}
        </g>

        <g class="lk-rt-struck" aria-hidden="true">
          ${repeat(
            this.struck,
            (number) => number,
            (number) => svg`
              <g class="lk-rt-bolt">
                ${number === 0 ? svg`<path d=${ZERO_PATH} />` : svg`<rect x=${cell(number).x + 3} y=${cell(number).y + 3} width=${W - 6} height=${H - 6} rx="7" />`}
                <g transform=${number === 0 ? `translate(${Z / 2 + 4} 24)` : `translate(${cell(number).x + W / 2} ${cell(number).y + 2})`}>
                  <rect x="-17" y="-9" width="34" height="18" rx="9" fill="url(#lk-rt-gold)" />
                  <text>${this.strikeLabel}</text>
                </g>
              </g>
            `,
          )}
        </g>

        <g class="lk-rt-chips" aria-hidden="true">
          ${repeat(
            this.stacks(),
            (stack) => stack.key,
            (stack) => svg`
              <g class=${classMap({ 'lk-rt-stack': true, 'is-winning': stack.winning, 'is-lost': stack.lost })} transform="translate(${stack.x} ${stack.y})">
                ${repeat(
                  Array.from({ length: stack.bet.chips }, (_, index) => index + 1),
                  (level) => level,
                  (level) => svg`
                    <g class="lk-rt-chip" transform="translate(0 ${-(level - 1) * 3.5})" filter="url(#lk-rt-shadow)">
                      <circle r="13" fill=${room.color(stack.bet.prizeId)} />
                      <circle r="11.5" fill="none" stroke="#fbf3df" stroke-width="3" stroke-dasharray="4.5 4.53" />
                      <circle r="8.5" fill=${room.color(stack.bet.prizeId)} stroke="rgb(251 243 223 / .55)" stroke-width="1" />
                      ${level === stack.bet.chips ? svg`<image href=${room.icon(stack.bet.prizeId)} x="-6" y="-6" width="12" height="12" />` : nothing}
                    </g>
                  `,
                )}
              </g>
            `,
          )}
        </g>

        ${dolly
          ? svg`<g class="lk-rt-dolly" transform="translate(${dolly.x} ${dolly.y})" aria-hidden="true">
              <circle r="10" fill="url(#lk-rt-gold)" filter="url(#lk-rt-shadow)" />
              <circle r="6.5" fill="#fbf3df" />
              <circle cx="-2" cy="-2" r="2" fill="#fff" />
            </g>`
          : nothing}

        <g class="lk-rt-hits">
          ${spots.map(
            (placed) => svg`
              <rect
                x=${placed.hit.x}
                y=${placed.hit.y}
                width=${placed.hit.w}
                height=${placed.hit.h}
                class="is-${placed.spot.kind}"
                role="button"
                tabindex=${this.locked || !['straight', 'column', 'dozen', 'chance'].includes(placed.spot.kind) ? -1 : 0}
                aria-label=${this.label(placed.spot)}
                @pointerenter=${() => (this.hovered = placed.spot.id)}
                @pointerleave=${() => (this.hovered = null)}
                @focus=${() => (this.hovered = placed.spot.id)}
                @blur=${() => (this.hovered = null)}
                @click=${() => this.choose(placed.spot.id)}
                @keydown=${(event: KeyboardEvent) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  this.choose(placed.spot.id);
                }}
              >
                <title>${this.label(placed.spot)}</title>
              </rect>
            `,
          )}
        </g>
      </svg>
    `;
  }
}
