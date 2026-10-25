import { html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { HandCoins, PlaneTakeoff } from 'lucide';
import type { Tier } from '../../config/types';
import { prizesPaying } from '../../engine/awards';
import { cashAwards, TAKEOFF_STEPS, TAKEOFF_TOP, takeoffAt, takeoffCrash, takeoffStep, takeoffTime, type Priced, type TakeoffStep } from '../../engine/cashout';
import type { Outcome } from '../../engine/outcome';
import { roomTheme, SANTA_SLEIGH } from '../../engine/themes';
import { gameBoost, gamePrize, gameTier } from '../../engine/tiers';
import { stage } from '../../room/stage';
import type { GameOptions } from '../../runtime/context';
import { LuckyElement } from '../../runtime/element';
import { fx, SPARKS } from '../../runtime/fx';
import { icon } from '../../runtime/icons';
import { reducedMotion } from '../../runtime/motion';
import { sound } from '../../runtime/sound';

type Step = Priced<TakeoffStep>;

const W = 720;
const H = 360;
const sleigh = SANTA_SLEIGH.map((part) => ({ ...part, path: new Path2D(part.d) }));

// An ivory biplane with gold trim and burgundy wings.
function drawPlane(context: CanvasRenderingContext2D, x: number, y: number, angle: number, now: number) {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.scale(1.35, 1.35);
  context.translate(-14, -6);
  context.lineWidth = 1.2;
  context.strokeStyle = '#8a6420';
  context.fillStyle = '#7d1c24';
  context.beginPath();
  context.moveTo(-24, -2);
  context.lineTo(-34, -15);
  context.lineTo(-27, -15);
  context.lineTo(-15, -5);
  context.closePath();
  context.fill();
  context.stroke();
  const body = context.createLinearGradient(0, -8, 0, 8);
  body.addColorStop(0, '#fff6dc');
  body.addColorStop(1, '#d9c08a');
  context.fillStyle = body;
  context.beginPath();
  context.ellipse(0, 0, 26, 7.5, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = '#d4a94e';
  context.fillRect(-18, -1.2, 36, 2.4);
  context.fillStyle = '#9e1b22';
  context.beginPath();
  context.moveTo(-6, 2);
  context.lineTo(7, 2);
  context.lineTo(-3, 17);
  context.lineTo(-14, 17);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = '#2a1208';
  context.beginPath();
  context.ellipse(9, -4, 6, 3, -0.2, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#d4a94e';
  context.beginPath();
  context.arc(26, 0, 3, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgb(246 226 166 / 0.85)';
  context.beginPath();
  context.ellipse(28.5, 0, 2, 13 * Math.abs(Math.sin(now / 30)), 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawSleigh(context: CanvasRenderingContext2D, x: number, y: number, angle: number, now: number) {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.translate(0, Math.sin(now / 160) * 1.5 - 8);
  context.scale(1.25, 1.25);
  // Centred on the reins, so the reindeer stay on screen when the climb is steep.
  context.translate(-30, 0);
  context.lineCap = 'round';
  for (const part of sleigh) {
    context.shadowColor = '#ff3b3b';
    context.shadowBlur = part.glow ? 10 + Math.sin(now / 200) * 4 : 0;
    if (part.fill) {
      context.fillStyle = part.fill;
      context.fill(part.path);
    }
    if (part.stroke) {
      context.strokeStyle = part.stroke;
      context.lineWidth = part.width ?? 1;
      context.stroke(part.path);
    }
  }
  context.restore();
}

@customElement('fl-takeoff')
export class Takeoff extends LuckyElement {
  @property({ attribute: false }) options: GameOptions = {};

  @state() private phase: 'ready' | 'flying' | 'gone' = 'ready';
  @state() private multiplier = 1;
  @state() private cashed: { at: number; step: Step } | null = null;

  @query('canvas') private canvas?: HTMLCanvasElement;

  private boost = gameBoost('slot');
  // At Christmas Santa's sleigh flies instead of the plane.
  private christmas = roomTheme() === 'christmas';
  private tier: Tier = 'none';
  private crash = Infinity;
  private start = 0;
  private goneAt = 0;
  private raf = 0;
  // The prize cashed out, handed over once the flight is over.
  private won: Outcome | null = null;

  private get steps(): Step[] {
    return cashAwards(TAKEOFF_STEPS, this.room.board);
  }

  private get reached() {
    return takeoffStep(this.multiplier, this.steps);
  }

  private label(step: Step) {
    return this.room.award(step.tier, step.award);
  }

  private takeOff() {
    if (this.phase === 'flying' || this.cashed) return;
    this.tier = gameTier('slot', this.boost);
    this.crash = takeoffCrash(this.tier);
    this.multiplier = 1;
    this.phase = 'flying';
    this.start = performance.now();
    sound.play('whoosh', 0.8);
  }

  // The step reached is the award paid: the prize is drawn among the ones that pay it.
  private cashOut() {
    const step = this.reached;
    if (this.phase !== 'flying' || this.cashed || !step) return;
    this.cashed = { at: this.multiplier, step };
    sound.play(step.tier === 'jackpot' ? 'jackpot' : 'win');
    const rect = this.canvas?.getBoundingClientRect();
    if (rect && !reducedMotion()) fx.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, { count: 46, type: 'spark', speed: 640, life: 0.8, gravity: 300, colors: SPARKS });
    const prize = this.room.prize(gamePrize('slot', prizesPaying(this.room.prizes, step.tier, step.award).map(({ id }) => id)));
    this.won = { game: 'slot', tier: step.tier, prizeId: prize.id, award: step.award, detail: { key: 'detail.slot.takeoff', params: { m: this.multiplier.toFixed(2) } } };
  }

  private frame = (now: number) => {
    if (this.phase === 'flying') {
      const value = takeoffAt((now - this.start) / 1000);
      const end = Math.min(this.crash, TAKEOFF_TOP);
      if (value >= end) {
        this.multiplier = end;
        // A jackpot flight is cashed in at the top: there is nothing left to wait for.
        if (this.crash > TAKEOFF_TOP && !this.cashed) this.cashOut();
        this.phase = 'gone';
        this.goneAt = now;
        const won = this.won;
        if (won) this.later(() => this.room.finish(won), reducedMotion() ? 300 : 1600);
        else sound.play('stop', 0.6);
      } else this.multiplier = value;
    }
    this.draw(now);
    this.raf = requestAnimationFrame(this.frame);
  };

  private draw(now: number) {
    const canvas = this.canvas;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const ratio = Math.min(2, devicePixelRatio);
    if (canvas.width !== W * ratio) Object.assign(canvas, { width: W * ratio, height: H * ratio });
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const background = context.createRadialGradient(0, H, 40, 0, H, W);
    background.addColorStop(0, '#3a1a0b');
    background.addColorStop(1, '#120804');
    context.fillStyle = background;
    context.fillRect(0, 0, W, H);

    // The sunburst behind the flight, in gold, turning slowly from the takeoff corner.
    context.save();
    context.translate(0, H);
    context.rotate((now / 24000) % (Math.PI * 2));
    context.fillStyle = 'rgb(226 189 99 / 0.05)';
    for (let ray = 0; ray < 24; ray++) {
      context.beginPath();
      context.moveTo(0, 0);
      context.arc(0, 0, W * 1.6, (ray * Math.PI) / 12, (ray * Math.PI) / 12 + Math.PI / 24);
      context.fill();
    }
    context.restore();

    const seconds = takeoffTime(this.multiplier);
    const pad = 34;
    const spanX = Math.max(8, seconds * 1.18);
    const spanY = Math.max(1.6, (this.multiplier - 1) * 1.22);
    const point = (time: number) => ({ x: pad + (time / spanX) * (W - pad * 2), y: H - pad - ((takeoffAt(time) - 1) / spanY) * (H - pad * 2) });

    context.strokeStyle = 'rgb(226 189 99 / 0.22)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(pad, H - pad);
    context.lineTo(W - pad / 2, H - pad);
    context.moveTo(pad, H - pad);
    context.lineTo(pad, pad / 2);
    context.stroke();

    const flyer = this.christmas ? drawSleigh : drawPlane;
    if (this.phase === 'ready') return flyer(context, pad + 10, H - pad - 8, -0.08, now);
    const points = Array.from({ length: 61 }, (_, index) => point((seconds * index) / 60));
    const tip = points.at(-1)!;
    const fill = context.createLinearGradient(0, tip.y, 0, H - pad);
    fill.addColorStop(0, 'rgb(246 196 83 / 0.28)');
    fill.addColorStop(1, 'rgb(246 196 83 / 0.02)');
    context.beginPath();
    context.moveTo(pad, H - pad);
    points.forEach(({ x, y }) => context.lineTo(x, y));
    context.lineTo(tip.x, H - pad);
    context.closePath();
    context.fillStyle = fill;
    context.fill();

    // The golden trail, like the Pachinko ball's: a glowing ribbon with sparkles along it.
    context.save();
    context.shadowColor = '#ffcf5a';
    context.shadowBlur = 14;
    const ribbon = context.createLinearGradient(pad, H - pad, tip.x, tip.y);
    ribbon.addColorStop(0, 'rgb(185 121 28 / 0.4)');
    ribbon.addColorStop(0.7, '#f6c453');
    ribbon.addColorStop(1, '#fff6d2');
    context.beginPath();
    points.forEach(({ x, y }, index) => (index ? context.lineTo(x, y) : context.moveTo(x, y)));
    context.strokeStyle = ribbon;
    context.lineWidth = 5;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.stroke();
    context.restore();
    context.fillStyle = '#fffbe8';
    points.slice(-30).forEach(({ x, y }, index) => {
      if ((index * 7 + Math.floor(now / 70)) % 5) return;
      context.globalAlpha = (index / 30) * 0.9;
      context.beginPath();
      context.arc(x + Math.sin(now / 90 + index) * 3, y + Math.cos(now / 110 + index) * 3, 1.4, 0, Math.PI * 2);
      context.fill();
    });
    context.globalAlpha = 1;

    const before = points.at(-4)!;
    const angle = Math.atan2(tip.y - before.y, tip.x - before.x);
    // Gone: the plane leaves the screen toward the top right.
    const away = this.phase === 'gone' ? Math.min(1, (now - this.goneAt) / 900) : 0;
    flyer(context, tip.x + away * W * 0.6, tip.y - away * H * 0.9, angle - away * 0.4, now);
  }

  private again() {
    this.phase = 'ready';
    this.takeOff();
  }

  firstUpdated() {
    this.raf = requestAnimationFrame(this.frame);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    cancelAnimationFrame(this.raf);
  }

  render() {
    const { phase, multiplier, cashed, reached } = this;
    const gone = phase === 'gone' && !cashed;
    const state = cashed ? 'won' : phase === 'flying' ? 'spinning' : 'idle';
    return stage(
      this.room.t,
      { state, rules: this.t('slot.takeoff.rules', { n: this.boost }), multiplier: this.boost },
      html`
        <div class="lk-takeoff">
          <div class="lk-takeoff-screen ${gone ? 'is-gone' : ''} ${cashed ? 'is-cashed' : ''}">
            <canvas aria-label=${this.t('slot.names.takeoff')}></canvas>
            <div class="lk-takeoff-reading" aria-live="polite">
              <b>${multiplier.toFixed(2)}×</b>
              ${gone
                ? html`<span>${this.t('slot.takeoff.gone')}</span>`
                : cashed
                  ? html`<span>${this.t('slot.takeoff.cashed', { m: cashed.at.toFixed(2), prize: this.label(cashed.step) })}</span>`
                  : phase === 'ready'
                    ? html`<span>${this.t('slot.takeoff.ready')}</span>`
                    : ''}
            </div>
          </div>
          <ol class="lk-takeoff-steps">
            ${this.steps.map(
              (step) => html`
                <li class="${phase !== 'ready' && multiplier >= step.at ? 'is-reached' : ''} ${cashed?.step.at === step.at ? 'is-cashed' : ''} ${step.tier === 'jackpot' ? 'is-jackpot' : ''}">
                  <small>×${step.at}</small>${this.label(step)}
                </li>
              `,
            )}
          </ol>
          <div class="lk-controls">
            ${phase === 'flying' && !cashed
              ? html`<button class="lk-btn lk-btn--primary lk-btn--lg lk-takeoff-cash" ?disabled=${!reached} @click=${() => this.cashOut()}>
                  ${icon(HandCoins)}${reached ? this.t('slot.takeoff.cashOut', { prize: this.label(reached) }) : this.t('slot.takeoff.cashFrom', { m: TAKEOFF_STEPS[0]!.at })}
                </button>`
              : html`<button class="lk-btn lk-btn--primary lk-btn--lg" ?disabled=${!!cashed || phase === 'flying'} @click=${() => (phase === 'ready' ? this.takeOff() : this.again())}>
                  ${icon(PlaneTakeoff)}${this.t(phase === 'ready' ? 'slot.takeoff.start' : 'slot.takeoff.again')}
                </button>`}
            <div class="lk-hint">${this.t('slot.takeoff.hint')}</div>
          </div>
        </div>
      `,
    );
  }
}
