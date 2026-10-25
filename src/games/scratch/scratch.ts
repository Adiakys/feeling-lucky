import { html, nothing, svg } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { Eraser, Lock, Ticket } from 'lucide';
import type { Tier } from '../../config/types';
import { drawAward, type Award } from '../../engine/awards';
import { random } from '../../engine/random';
import { decide } from '../../engine/rig';
import { doubleTicket, foreverTicket, scratchCard, type NumbersTicket, type ScratchKind } from '../../engine/scratch';
import { gameBoost, gamePrize, gameTier, ticketOfDay, type DayTicket } from '../../engine/tiers';
import type { GameOptions } from '../../runtime/context';
import { LuckyElement } from '../../runtime/element';
import { fx, guilloche } from '../../runtime/fx';
import { icon } from '../../runtime/icons';
import { reducedMotion } from '../../runtime/motion';
import { sound } from '../../runtime/sound';
import { stage } from '../../room/stage';
import { coverArt, loadCovers, type Cover } from './covers';
import { ticketDouble } from './double';
import { ticketForever } from './forever';

type ClassicCard = { kind: 'classic' } & ReturnType<typeof scratchCard>;
type Card = ClassicCard | ({ kind: DayTicket; prizeId: string; award: Award } & NumbersTicket);

const lines = guilloche(210, 300, 0.85);
const newSerial = () => Math.random().toString(16).slice(2, 11).toUpperCase();

@customElement('fl-scratch')
export class Scratch extends LuckyElement {
  @property({ attribute: false }) options: GameOptions = {};

  private boost = gameBoost('scratch');
  // The classic ticket, replaced on the scratch card's day by the ticket of the day, one of the numbers tickets.
  private kind: ScratchKind = this.boost > 1 ? ticketOfDay() : 'classic';

  @state() private tier = gameTier('scratch', this.boost);
  @state() private card?: Card;
  @state() private serial = newSerial();
  @state() private revealed = new Set<string>();
  @state() private state: 'idle' | 'spinning' | 'won' = 'idle';

  @query('.lk-ticket') private ticket?: HTMLElement;

  private covers?: Record<Cover, HTMLImageElement>;
  private last: { x: number; y: number } | null = null;
  private strokes = 0;

  private print(tier: Tier): Card {
    const { prizeIds } = this.room;
    const prizeId = gamePrize('scratch', prizeIds);
    const award = decide('scratch.award', { tier, prizeId }, () => drawAward(this.room.prize(prizeId), tier));
    if (this.kind === 'classic') return { kind: 'classic', ...scratchCard(tier, prizeIds, prizeId, award) };
    return { kind: this.kind, prizeId, award, ...(this.kind === 'double' ? doubleTicket : foreverTicket)(tier, this.room.prizes, prizeId, award) };
  }

  protected willUpdate() {
    this.card ??= this.print(this.tier);
  }

  // The award strip of the classic ticket scratches only on a winning one, once its three matching logos are uncovered.
  private get spots() {
    const printed = this.card!;
    if (printed.kind === 'classic') return [...printed.cells.map((_, index) => String(index)), ...(printed.winning ? ['award'] : [])];
    return [...printed.winningNumbers.map((_, index) => `w${index}`), ...printed.yours.map((_, index) => `y${index}`), ...printed.second.map((_, index) => `s${index}`)];
  }

  private get done() {
    return this.revealed.size === this.spots.length;
  }

  private inLine(cell: string) {
    return this.card!.kind === 'classic' && cell === this.card!.winning;
  }

  private get hit() {
    const printed = this.card!;
    if (printed.kind !== 'classic') return printed.hit;
    return printed.winning ? printed.cells.flatMap((cell, index) => (this.inLine(cell) ? [String(index)] : [])) : [];
  }

  private get matched() {
    const { hit } = this;
    return hit.length > 0 && hit.every((spot) => this.revealed.has(spot));
  }

  private paint(canvas: HTMLCanvasElement) {
    const width = canvas.parentElement!.offsetWidth;
    const height = canvas.parentElement!.offsetHeight;
    const ratio = Math.min(2, devicePixelRatio);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext('2d')!;
    context.globalCompositeOperation = 'source-over';
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const cover = canvas.dataset.cover as Cover | undefined;
    if (cover && this.covers) {
      // The beach is one picture across the grid: each cell shows its own slice of it.
      const spot = canvas.parentElement!;
      const scene = spot.offsetParent as HTMLElement;
      if (cover === 'beach') context.drawImage(this.covers.beach, -spot.offsetLeft, -spot.offsetTop, scene.clientWidth, scene.clientHeight);
      else context.drawImage(this.covers[cover], 0, 0, width, height);
      return this.ready(canvas);
    }
    const gradient = context.createLinearGradient(0, 0, width, height);
    const stops = ['#e9edf1', '#a8b0bb', '#f4f6f9', '#8d96a3', '#d7dce3'];
    [0, 0.35, 0.5, 0.7, 1].forEach((offset, index) => gradient.addColorStop(offset, stops[index]!));
    context.fillStyle = gradient;
    context.beginPath();
    context.roundRect(0, 0, width, height, 14);
    context.fill();
    for (let i = 0; i < width * height * 0.08; i++) {
      context.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '40,46,56'},${random(0.04, 0.12)})`;
      context.fillRect(random(0, width), random(0, height), 1, 1);
    }
    context.save();
    context.globalAlpha = 0.14;
    context.fillStyle = '#2b323c';
    context.font = '800 10px ui-monospace, Menlo, monospace';
    context.rotate(-0.35);
    const watermark = this.t('scratch.watermark');
    for (let y = -20; y < height + 60; y += 16) {
      for (let x = -60; x < width + 40; x += 76) context.fillText(watermark, x + (y % 32 ? 38 : 0), y);
    }
    context.restore();
    this.ready(canvas);
  }

  // A round cover leaves its corners clear from the start: only what the scratching clears counts.
  private ready(canvas: HTMLCanvasElement) {
    canvas.style.opacity = '1';
    canvas.style.pointerEvents = '';
    canvas.dataset.clear = String(this.cleared(canvas));
    canvas.getContext('2d')!.globalCompositeOperation = 'destination-out';
  }

  private cleared(canvas: HTMLCanvasElement) {
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    let clear = 0;
    let samples = 0;
    for (let i = 3; i < data.length; i += 4 * 24) {
      samples++;
      if (data[i]! < 40) clear++;
    }
    return clear / samples;
  }

  private scratched(canvas: HTMLCanvasElement) {
    const before = Number(canvas.dataset.clear ?? 0);
    return (this.cleared(canvas) - before) / (1 - before);
  }

  private reveal(canvas: HTMLCanvasElement) {
    const spot = canvas.dataset.spot!;
    if (this.revealed.has(spot) || (spot === 'award' && !this.matched)) return;
    this.revealed = new Set([...this.revealed, spot]);
    canvas.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reducedMotion() ? 1 : 380, fill: 'forwards' });
    canvas.style.pointerEvents = 'none';
    sound.play('tick', 1.4);
    if (this.matched && spot !== 'award') sound.play('chime');
    if (this.done) this.finish();
  }

  private finish() {
    if (!this.hit.length) {
      this.state = 'idle';
      return;
    }
    this.state = 'won';
    const rect = this.ticket!.getBoundingClientRect();
    fx.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, { count: 50, speed: 600 });
    const card = this.card!;
    const detail = card.kind === 'classic' ? this.tier : card.how;
    const won = { game: 'scratch' as const, tier: this.tier, prizeId: card.prizeId, award: card.award, detail: { key: `detail.scratch.${detail}` } };
    this.later(() => this.room.finish(won), reducedMotion() ? 200 : 1400);
  }

  private foilOf(event: PointerEvent) {
    const target = event.target as HTMLElement;
    return target.classList.contains('lk-foil') ? (target as HTMLCanvasElement) : null;
  }

  private scratch(event: PointerEvent) {
    const canvas = this.foilOf(event);
    if (!canvas || (event.type === 'pointermove' && !event.buttons) || (canvas.dataset.spot === 'award' && !this.matched)) return;
    const context = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const from = this.last ?? point;
    const distance = Math.hypot(point.x - from.x, point.y - from.y);
    const steps = Math.max(1, Math.ceil(distance / 4));
    for (let k = 0; k <= steps; k++) {
      const x = from.x + ((point.x - from.x) * k) / steps;
      const y = from.y + ((point.y - from.y) * k) / steps;
      for (let j = 0; j < 4; j++) {
        context.beginPath();
        context.arc(x + random(-5, 5), y + random(-5, 5), random(5, 10), 0, Math.PI * 2);
        context.fill();
      }
    }
    if (distance > 2) {
      fx.burst(event.clientX, event.clientY, { count: 3, type: 'flake', speed: 160, angle: Math.PI / 2, spread: 2.4, gravity: 700, life: 0.9, colors: ['#c9cfd8', '#8b94a1', '#eef1f4'] });
      sound.play('scratch', random(0.9, 1.2), 0.8);
    }
    this.last = point;
    if (++this.strokes % 6 === 0 && this.scratched(canvas) > 0.52) this.reveal(canvas);
  }

  private start(event: PointerEvent) {
    const canvas = this.foilOf(event);
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    this.last = null;
    this.scratch(event);
  }

  private stop(event: PointerEvent) {
    this.last = null;
    const canvas = this.foilOf(event);
    if (canvas && this.scratched(canvas) > 0.52) this.reveal(canvas);
  }

  private foils() {
    return [...(this.ticket?.querySelectorAll<HTMLCanvasElement>('.lk-foil') ?? [])];
  }

  private revealAll() {
    const canvases = this.foils().filter((canvas) => this.spots.includes(canvas.dataset.spot!));
    canvases.forEach((canvas, index) => this.later(() => this.reveal(canvas), reducedMotion() ? 0 : index * Math.min(180, 2400 / canvases.length)));
  }

  private async newTicket() {
    this.tier = gameTier('scratch', this.boost);
    this.card = this.print(this.tier);
    this.serial = newSerial();
    this.revealed = new Set();
    await this.updateComplete;
    this.foils().forEach((canvas) => {
      canvas.getAnimations().forEach((animation) => animation.cancel());
      this.paint(canvas);
    });
  }

  async firstUpdated() {
    this.foils().forEach((canvas) => this.paint(canvas));
    this.covers = await loadCovers(coverArt(this.t('scratch.prize'))).catch(() => undefined);
    this.foils().forEach((canvas) => this.paint(canvas));
  }

  private classic(card: ClassicCard) {
    const { room, matched } = this;
    const today = new Date().toLocaleDateString(room.locale, { day: '2-digit', month: 'short', year: 'numeric' });
    return html`
      <svg viewBox="0 0 420 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        ${lines.map((points) => svg`<polyline points=${points} fill="none" stroke="#b08a3a" stroke-opacity="0.28" stroke-width="0.5" />`)}
      </svg>
      <header>${room.logo()}<b>${this.t('scratch.title')}</b><span>N. ${this.serial}</span></header>
      <p class="lk-rule">${this.t('scratch.rule')}</p>
      <div class="lk-spots">
        ${card.cells.map(
          (cell, index) => html`
            <div class="lk-spot ${matched && this.inLine(cell) ? 'is-match' : ''}">
              ${room.prizeIds.includes(cell) ? html`<img src=${room.icon(cell)} alt=${room.name(cell)} />` : html`<b class="lk-spot-number">${cell}</b>`}
              <canvas class="lk-foil" data-spot=${index}></canvas>
            </div>
          `,
        )}
        <div class="lk-spot lk-spot--wide ${matched ? '' : 'is-locked'}">
          <span>${card.winning ? room.award(this.tier, card.award) : '—'}<small>${this.t('scratch.award')}</small></span>
          <canvas class="lk-foil" data-spot="award"></canvas>
          ${this.revealed.has('award') ? nothing : html`<em class="lk-lock">${icon(Lock)}${this.t('scratch.locked')}</em>`}
        </div>
      </div>
      <footer><span>${this.t('scratch.series')}</span><span>${today}</span></footer>
    `;
  }

  render() {
    const card = this.card!;
    const { matched, done } = this;
    const rules = this.kind === 'classic' ? this.t('games.scratch.rules') : `${this.t('scratch.dayRules', { n: this.boost })} ${this.t(`scratch.${this.kind}.rules`)}`;
    const printed =
      card.kind === 'classic' ? this.classic(card) : card.kind === 'double' ? ticketDouble(this.room, card, matched, this.serial) : ticketForever(this.room, card, matched, this.serial);
    return stage(
      this.room.t,
      { state: this.state, rules, multiplier: this.boost },
      html`
        <div class="lk-scratch">
          <div class="lk-ticket lk-ticket--${card.kind}" @pointerdown=${this.start} @pointermove=${this.scratch} @pointerup=${this.stop}>${keyed(this.serial, printed)}</div>
          <div class="lk-controls">
            ${done && this.state === 'idle'
              ? html`<button class="lk-btn lk-btn--primary lk-btn--lg" @click=${this.newTicket}>${icon(Ticket)}${this.t('scratch.newTicket')}</button>`
              : html`<button class="lk-btn lk-btn--primary lk-btn--lg" ?disabled=${done} @click=${this.revealAll}>${icon(Eraser)}${this.t('scratch.revealAll')}</button>`}
            <div class="lk-hint">${this.t('scratch.hint')}</div>
          </div>
        </div>
      `,
    );
  }
}
