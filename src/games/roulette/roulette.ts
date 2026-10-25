import { html, nothing, type LitElement } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { keyed } from 'lit/directives/keyed.js';
import { CircleDot, Grid3x3, Orbit, Repeat, Trash2, Undo2, Zap } from 'lucide';
import { drawAward } from '../../engine/awards';
import { mod, random, randomInt } from '../../engine/random';
import { drawRouletteNumber, drawStorm, ROULETTE_ANNOUNCED, ROULETTE_CHIPS, ROULETTE_ORDER, ROULETTE_RED, ROULETTE_STORM, rouletteWin, type RouletteAnnounced, type RouletteBet } from '../../engine/roulette';
import { gameBoost } from '../../engine/tiers';
import type { GameOptions } from '../../runtime/context';
import { LuckyElement } from '../../runtime/element';
import { fx } from '../../runtime/fx';
import { icon } from '../../runtime/icons';
import { reducedMotion, wait } from '../../runtime/motion';
import { sound } from '../../runtime/sound';
import { stage } from '../../room/stage';
import './table';
import './track';
import type { Play } from './track';
import { polar } from './wheel';

const WIDTH = 360 / ROULETTE_ORDER.length;
const BOUNCES = [0.6, 0.76, 0.84, 0.9, 0.95];
// The medallion's roll slows down like a wheel, one number after the other.
const ROLL = [45, 45, 50, 55, 60, 70, 80, 95, 115, 140, 175];
const ROLL_TIME = ROLL.reduce((sum, gap) => sum + gap, 0);
const STRIKE_GAP = ROLL_TIME + 420;
const BOLT_COLORS = ['#ffffff', '#fff1c4', '#ffd36e', '#bfe0ff'];

const numberColor = (number: number) => (number === 0 ? '#156b3c' : ROULETTE_RED.has(number) ? '#9e1b22' : '#17120e');

// The ball rides the track, drops past a diamond, bounces over the frets and settles in its pocket.
function radiusAt(u: number) {
  if (u < 0.6) return 282;
  if (u < 0.76) {
    const v = (u - 0.6) / 0.16;
    const eased = v < 0.5 ? 4 * v ** 3 : 1 - (-2 * v + 2) ** 3 / 2;
    return 282 - 62 * eased + 10 * Math.sin(v * Math.PI) ** 6;
  }
  if (u < 0.96) {
    const v = (u - 0.76) / 0.2;
    return 196 + 22 * Math.abs(Math.cos(2.5 * Math.PI * v)) * (1 - v) ** 1.6;
  }
  return 192;
}

const liftAt = (u: number) => (u < 0.76 || u > 0.96 ? 1 : 1 + 0.28 * Math.abs(Math.sin(2.5 * Math.PI * ((u - 0.76) / 0.2))) * (1 - (u - 0.76) / 0.2) ** 1.4);

/* The storm: the room darkens, bolts fall on the struck numbers one after the other, then the light comes back. */

type Point = { x: number; y: number };
interface Bolt { from: Point; to: Point; start: number; shape: number; paths: Point[][] }

// A jagged line by midpoint displacement, with a couple of shorter forks off it.
function jag(from: Point, to: Point, spread: number, depth = 6): Point[] {
  if (depth === 0) return [from, to];
  const middle = { x: (from.x + to.x) / 2 + random(-spread, spread), y: (from.y + to.y) / 2 + random(-spread, spread) * 0.3 };
  return [...jag(from, middle, spread / 2, depth - 1), ...jag(middle, to, spread / 2, depth - 1).slice(1)];
}

function shapeBolt(bolt: Bolt) {
  const trunk = jag(bolt.from, bolt.to, 46);
  const forks = [0.3, 0.55].map((along) => {
    const start = trunk[Math.floor(trunk.length * along)]!;
    const end = { x: start.x + random(-70, 70), y: start.y + random(30, 80) };
    return jag(start, end, 18, 4);
  });
  bolt.paths = [trunk, ...forks];
}

function stroke(context: CanvasRenderingContext2D, points: Point[]) {
  context.beginPath();
  points.forEach((point, index) => (index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)));
  context.stroke();
}

// Vue-style CSS transitions: `<name>-<phase>-from` and `-active` go on, `-to` takes the place of `-from` two frames
// later, and an entering element drops them once its transition ends; a leaving one keeps them until it goes.
async function transition(element: Element, name: string, phase: 'enter' | 'leave') {
  const [from, active, to] = ['from', 'active', 'to'].map((step) => `${name}-${phase}-${step}`) as [string, string, string];
  // An entering element may have been styled already, though not painted: it must start from `-from`, not ease into it.
  const inline = (element as HTMLElement).style;
  if (phase === 'enter') inline.transition = 'none';
  element.classList.add(from, active);
  if (phase === 'enter') {
    void getComputedStyle(element).opacity;
    inline.transition = '';
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  element.classList.replace(from, to);
  const style = getComputedStyle(element);
  const delays = style.transitionDelay.split(',').map(parseFloat);
  const longest = Math.max(...style.transitionDuration.split(',').map((duration, index) => parseFloat(duration) + (delays[index % delays.length] ?? 0)));
  await wait(longest * 1000);
  if (phase === 'enter') element.classList.remove(active, to);
}

type Layout = { bets: RouletteBet[]; plays: Play[] };
type Medallion = { shown: number | null; rolling: boolean };
type Call = 'made' | 'closed' | null;
type Surface = 'table' | 'track';

@customElement('fl-roulette')
export class Roulette extends LuckyElement {
  @property({ attribute: false }) options: GameOptions = {};

  @state() private state: 'idle' | 'spinning' | 'won' = 'idle';
  @state() private result: number | null = null;
  @state() private bets: RouletteBet[] = [];
  @state() private chosen = '';
  @state() private winning: string | null = null;
  // The call and the surface on show, which follow call and surface through their transitions.
  @state() private shownCall: Call = null;
  @state() private surface: Surface = 'table';
  @state() private shownSurface: Surface = 'table';
  @state() private plays: Play[] = [];
  // The layouts before each change since the last throw, to take back one at a time, and the one last thrown, to repeat.
  @state() private history: Layout[] = [];
  @state() private lastThrown: Layout | null = null;
  // The numbers lightning has struck this throw, in the order they were hit; each is first drawn on its
  // medallion, which rolls through the numbers like a wheel before it stops.
  @state() private struck: number[] = [];
  @state() private medallions: Medallion[] = Array.from({ length: ROULETTE_STORM }, () => ({ shown: null, rolling: false }));

  @query('.lk-roulette') private root?: HTMLElement;
  @query('.lk-rl-board') private board?: HTMLElement;
  @query('.lk-rl-sky') private sky?: HTMLCanvasElement;
  @query('.lk-rl-dark') private dark?: HTMLElement;

  private boost = gameBoost('roulette');
  private storm = this.boost > 1;
  private call: Call = null;
  private callChange = Promise.resolve();
  private surfaceChange = Promise.resolve();
  private rotorAngle = random(0, 360);
  private ballAngle = random(0, 360);
  private ballRadius = 192;
  private raf = 0;
  private previous = performance.now();
  private spin: { index: number; end: number; laps: number; start: number; duration: number; cue: number } | null = null;
  private bolts: Bolt[] = [];
  private storming = false;
  private darkness = 0;

  private get used() {
    return this.bets.reduce((sum, bet) => sum + bet.chips, 0);
  }

  private get struckResult() {
    return this.result !== null && this.struck.includes(this.result);
  }

  protected willUpdate() {
    if (!this.room.prizeIds.includes(this.chosen)) this.chosen = this.room.prizeIds[0]!;
  }

  protected firstUpdated() {
    this.raf = requestAnimationFrame((now) => this.frame(now));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    cancelAnimationFrame(this.raf);
  }

  private draw(scale = 1) {
    this.board?.querySelector('.lk-rl-rotor')?.setAttribute('transform', `rotate(${this.rotorAngle})`);
    const [x, y] = polar(this.ballRadius, this.ballAngle);
    this.board?.querySelector('.lk-rl-ball')?.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(3)})`);
  }

  private frame(now: number) {
    const dt = Math.min(0.05, (now - this.previous) / 1000);
    this.previous = now;
    const spin = this.spin;
    if (!spin) {
      this.rotorAngle += 14 * dt;
      this.ballAngle += 14 * dt;
      this.draw();
    } else {
      const u = Math.min(1, (now - spin.start) / spin.duration);
      this.rotorAngle += (14 + 70 * (1 - u) ** 2) * dt;
      this.ballAngle = this.rotorAngle + spin.end + spin.laps * (1 - u) ** 3;
      this.ballRadius = radiusAt(u);
      while (spin.cue < BOUNCES.length && u >= BOUNCES[spin.cue]!) {
        sound.play('bounce', 1 + spin.cue * 0.06, 1 - spin.cue * 0.15);
        spin.cue++;
      }
      if (u >= 0.76 && this.call) this.setCall(null);
      this.draw(liftAt(u));
      if (u >= 1) this.land();
    }
    if (this.storm) this.drawSky(now, dt);
    this.raf = requestAnimationFrame((next) => this.frame(next));
  }

  private drawSky(now: number, dt: number) {
    const canvas = this.sky;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const ratio = Math.min(2, devicePixelRatio);
    if (canvas.width !== Math.round(canvas.clientWidth * ratio)) {
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    this.darkness += ((this.storming ? 1 : 0) - this.darkness) * Math.min(1, dt * (this.storming ? 6 : 3));
    if (this.dark) this.dark.style.opacity = (0.55 * this.darkness).toFixed(3);
    this.bolts = this.bolts.filter((bolt) => now - bolt.start < 700);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    for (const bolt of this.bolts) {
      const age = Math.max(0, now - bolt.start) / 1000;
      const shape = Math.floor(age / 0.06);
      if (shape !== bolt.shape) {
        bolt.shape = shape;
        shapeBolt(bolt);
      }
      const flicker = [1, 0.35, 1, 0.75, 0.3, 0.9, 0.5, 0.2][shape % 8]!;
      const alpha = flicker * Math.max(0, 1 - age / 0.7);
      const glow = context.createRadialGradient(bolt.to.x, bolt.to.y, 0, bolt.to.x, bolt.to.y, 90);
      glow.addColorStop(0, `rgb(255 244 210 / ${(0.9 * alpha).toFixed(3)})`);
      glow.addColorStop(1, 'rgb(255 214 120 / 0)');
      context.fillStyle = glow;
      context.fillRect(bolt.to.x - 90, bolt.to.y - 90, 180, 180);
      bolt.paths.forEach((points, index) => {
        const width = index ? 0.5 : 1;
        context.globalAlpha = alpha;
        context.shadowColor = '#ffd36e';
        context.shadowBlur = 24;
        context.strokeStyle = 'rgb(255 214 120 / 0.35)';
        context.lineWidth = 11 * width;
        stroke(context, points);
        context.shadowColor = '#bfe0ff';
        context.shadowBlur = 10;
        context.strokeStyle = '#fff1c4';
        context.lineWidth = 4 * width;
        stroke(context, points);
        context.shadowBlur = 0;
        context.strokeStyle = '#ffffff';
        context.lineWidth = 1.6 * width;
        stroke(context, points);
      });
    }
    context.globalAlpha = 1;
  }

  // A new face on a medallion slides in while a copy of the old one slides out.
  private setMedallion(slot: number, next: Medallion) {
    const current = this.medallions[slot]!;
    if (current.shown === next.shown && current.rolling === next.rolling) return;
    const element = this.querySelectorAll('.lk-rl-medallion')[slot];
    const face = () => element?.querySelector(':scope > b, :scope > .fl-icon');
    const old = current.shown !== next.shown ? face() : null;
    if (old) {
      const ghost = old.cloneNode(true) as Element;
      ghost.classList.remove('lk-roll-enter-from', 'lk-roll-enter-active', 'lk-roll-enter-to');
      element!.append(ghost);
      void transition(ghost, 'lk-roll', 'leave').then(() => ghost.remove());
    }
    this.medallions = this.medallions.map((medallion, index) => (index === slot ? next : medallion));
    if (old) {
      void this.updateComplete.then(() => {
        const entering = face();
        if (entering) void transition(entering, 'lk-roll', 'enter');
      });
    }
  }

  // The call and the surface change out-in: what shows leaves, then what replaces it enters.
  private setCall(next: Call) {
    if (this.call === next) return;
    this.call = next;
    this.callChange = this.callChange.then(async () => {
      if (this.shownCall === this.call) return;
      const leaving = this.querySelector('.lk-rl-call');
      if (leaving) await transition(leaving, 'lk-call', 'leave');
      this.shownCall = this.call;
      await this.updateComplete;
      const entering = this.querySelector('.lk-rl-call');
      if (entering) await transition(entering, 'lk-call', 'enter');
    });
  }

  private setSurface(next: Surface) {
    if (this.surface === next) return;
    this.surface = next;
    this.surfaceChange = this.surfaceChange.then(async () => {
      if (this.shownSurface === this.surface) return;
      const leaving = this.querySelector('.lk-rl-felt > * > svg');
      if (leaving) await transition(leaving, 'lk-surface', 'leave');
      this.shownSurface = this.surface;
      await this.updateComplete;
      const host = this.querySelector<LitElement>('.lk-rl-felt > fl-roulette-table, .lk-rl-felt > fl-roulette-track');
      await host?.updateComplete;
      const entering = host?.querySelector(':scope > svg');
      if (entering) await transition(entering, 'lk-surface', 'enter');
    });
  }

  private roll(slot: number, number: number) {
    if (reducedMotion()) {
      this.setMedallion(slot, { shown: number, rolling: false });
      return this.strike(slot, number);
    }
    this.setMedallion(slot, { shown: this.medallions[slot]!.shown, rolling: true });
    let at = 0;
    ROLL.forEach((gap, step) => {
      at += gap;
      this.later(() => {
        const last = step === ROLL.length - 1;
        this.setMedallion(slot, { shown: last ? number : randomInt(0, 36), rolling: !last });
        sound.play('tick', 1.4 - step * 0.03, 0.5);
        if (last) this.later(() => this.strike(slot, number), 160);
      }, at);
    });
  }

  // The bolt leaves the medallion and falls on the number's square of the table.
  private strike(slot: number, number: number) {
    this.struck = [...this.struck, number];
    sound.play('thunder', 1, 0.9);
    if (reducedMotion()) return;
    const canvas = this.sky!.getBoundingClientRect();
    const cell = this.root?.querySelector(`.lk-rl-felt [data-number="${number}"]`)?.getBoundingClientRect();
    const origin = this.root?.querySelectorAll('.lk-rl-medallion')[slot]?.getBoundingClientRect();
    if (!cell || !origin) return;
    const to = { x: cell.left + cell.width / 2 - canvas.left, y: cell.top + cell.height / 2 - canvas.top };
    const from = { x: origin.left + origin.width / 2 - canvas.left, y: origin.top + origin.height / 2 - canvas.top };
    this.bolts.push({ from, to, start: performance.now(), shape: -1, paths: [] });
    fx.burst(cell.left + cell.width / 2, cell.top + cell.height / 2, { count: 26, type: 'spark', speed: 520, spread: Math.PI * 2, life: 0.55, gravity: 500, colors: BOLT_COLORS });
  }

  private layout(): Layout {
    return { bets: this.bets.map((bet) => ({ ...bet })), plays: [...this.plays] };
  }

  private placeChips(spots: string[]) {
    if (this.state !== 'idle' || this.used + spots.length > ROULETTE_CHIPS) return false;
    this.result = null;
    this.clearStorm();
    this.history = [...this.history, this.layout()];
    const bets = [...this.bets];
    for (const spot of spots) {
      const bet = bets.find((entry) => entry.spot === spot && entry.prizeId === this.chosen);
      if (bet) bet.chips++;
      else bets.push({ spot, prizeId: this.chosen, chips: 1 });
    }
    this.bets = bets;
    sound.play('tick');
    return true;
  }

  private announce(name: RouletteAnnounced) {
    if (!this.placeChips(ROULETTE_ANNOUNCED[name])) return;
    if (!this.plays.some((entry) => entry.name === name && entry.prizeId === this.chosen)) this.plays = [...this.plays, { name, prizeId: this.chosen }];
  }

  private restore(previous: Layout) {
    this.bets = previous.bets.map((bet) => ({ ...bet }));
    this.plays = [...previous.plays];
    this.result = null;
    this.clearStorm();
  }

  private clearChips() {
    this.history = [...this.history, this.layout()];
    this.restore({ bets: [], plays: [] });
  }

  private undo() {
    const previous = this.history.at(-1);
    if (!previous) return;
    this.history = this.history.slice(0, -1);
    this.restore(previous);
  }

  private rebet() {
    if (this.state !== 'idle' || this.bets.length || !this.lastThrown) return;
    this.history = [...this.history, this.layout()];
    this.restore(this.lastThrown);
    sound.play('tick');
  }

  private clearStorm() {
    this.struck = [];
    this.medallions.forEach((_, slot) => this.setMedallion(slot, { shown: null, rolling: false }));
  }

  private launch() {
    if (this.state !== 'idle' || !this.bets.length) return;
    this.result = null;
    this.winning = null;
    this.clearStorm();
    this.lastThrown = this.layout();
    this.history = [];
    this.state = 'spinning';
    if (!this.storm) return this.throwBall([]);
    const numbers = drawStorm(this.boost);
    const gap = reducedMotion() ? 0 : STRIKE_GAP;
    this.storming = !reducedMotion();
    numbers.forEach((number, slot) => this.later(() => this.roll(slot, number), 350 + slot * gap));
    this.later(() => {
      this.storming = false;
      this.throwBall(numbers);
    }, 350 + numbers.length * gap + 250);
  }

  private throwBall(numbers: number[]) {
    const number = drawRouletteNumber(this.bets, numbers, this.boost);
    const index = ROULETTE_ORDER.indexOf(number);
    const relative = mod(this.ballAngle - this.rotorAngle, 360);
    const end = index * WIDTH;
    this.setCall('made');
    this.later(() => this.call === 'made' && this.setCall('closed'), reducedMotion() ? 0 : 1900);
    this.spin = { index, end, laps: mod(relative - end, 360) + 3240, start: performance.now(), duration: reducedMotion() ? 1 : 7200, cue: 0 };
    sound.play('whoosh');
  }

  private land() {
    const number = ROULETTE_ORDER[this.spin!.index]!;
    this.spin = null;
    this.setCall(null);
    this.ballRadius = 192;
    this.result = number;
    sound.play('stop');
    const struck = this.struckResult;
    if (struck) {
      sound.play('thunder', 1, 0.7);
      const rect = this.board?.querySelector('.lk-rl-result')?.getBoundingClientRect();
      if (rect && !reducedMotion()) fx.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, { count: 60, type: 'spark', speed: 700, spread: Math.PI * 2, life: 0.8, gravity: 300, colors: BOLT_COLORS });
    }
    const win = rouletteWin(this.bets, number);
    if (!win) {
      this.state = 'idle';
      return;
    }
    this.state = 'won';
    this.winning = win.bet.spot;
    sound.play('chime', win.tier === 'jackpot' ? 1.5 : 1.1);
    const outcome = {
      game: 'roulette' as const,
      tier: win.tier,
      prizeId: win.bet.prizeId,
      award: drawAward(this.room.prize(win.bet.prizeId), win.tier),
      detail: { key: struck ? 'detail.storm' : 'detail.roulette', params: { n: number } },
    };
    this.later(() => this.room.finish(outcome), reducedMotion() ? 200 : 1500);
  }

  render() {
    const { boost, storm, result, used } = this;
    const idle = this.state === 'idle';
    const struckResult = this.struckResult;
    const resultColor = result === null ? '#17120e' : numberColor(result);
    const rules = this.t(storm ? 'roulette.storm.rules' : 'games.roulette.rules', { n: ROULETTE_CHIPS, m: boost });
    return stage(
      this.room.t,
      { state: this.state, rules, multiplier: boost },
      html`
        <div class="lk-roulette ${storm ? 'lk-roulette--storm' : ''}">
          <div class="lk-rl-board">
            ${storm
              ? html`<div class="lk-rl-bolts" role="status" aria-label=${this.t('roulette.storm.numbers')}>
                  <span class="lk-rl-bolts-title">${icon(Zap)}${this.t('roulette.storm.title')}</span>
                  ${this.medallions.map((medallion) => {
                    const lit = !medallion.rolling && medallion.shown !== null && this.struck.includes(medallion.shown);
                    return html`
                      <div
                        class=${classMap({ 'lk-rl-medallion': true, 'is-rolling': medallion.rolling, 'is-struck': lit, 'is-result': medallion.shown !== null && medallion.shown === result })}
                        style=${medallion.shown !== null ? `--lk-bolt-number: ${numberColor(medallion.shown)}` : nothing}
                      >
                        ${medallion.shown !== null ? keyed(medallion.shown, html`<b>${medallion.shown}</b>`) : icon(Zap)}
                        ${lit ? html`<small>×${boost}</small>` : nothing}
                      </div>
                    `;
                  })}
                  <p>${this.t('roulette.storm.odds', { n: boost })}</p>
                </div>`
              : nothing}
            <fl-roulette-wheel prefix="rl" ball .struck=${this.struck}></fl-roulette-wheel>
            <div
              class=${classMap({ 'lk-rl-result': true, 'is-on': result !== null, 'is-struck': struckResult })}
              style="background: radial-gradient(circle at 35% 30%, color-mix(in oklab, ${resultColor} 70%, white), ${resultColor} 60%); box-shadow: 0 0 0 4px rgb(255 255 255 / .2), 0 0 40px ${resultColor}"
            >
              <b>${result}</b>
              ${struckResult ? html`<small>${icon(Zap)}×${boost}</small>` : nothing}
            </div>
          </div>
          <div class="lk-rl-switch" role="radiogroup" aria-label=${this.t('roulette.surface')}>
            ${(['table', 'track'] as const).map(
              (option) => html`
                <button role="radio" aria-checked=${this.surface === option} class=${this.surface === option ? 'is-on' : ''} @click=${() => this.setSurface(option)}>
                  ${icon(option === 'table' ? Grid3x3 : Orbit)}${this.t(`roulette.${option}`)}
                </button>
              `,
            )}
          </div>
          <div class="lk-rl-felt">
            ${this.shownSurface === 'table'
              ? html`<fl-roulette-table
                  .bets=${this.bets}
                  ?locked=${!idle}
                  .result=${result}
                  .winning=${this.winning}
                  .struck=${this.struck}
                  .strikeLabel=${`×${boost}`}
                  @place=${(event: CustomEvent<string>) => this.placeChips([event.detail])}
                ></fl-roulette-table>`
              : html`<fl-roulette-track
                  .plays=${this.plays}
                  .chipsLeft=${ROULETTE_CHIPS - used}
                  ?locked=${!idle}
                  .result=${result}
                  .struck=${this.struck}
                  @announce=${(event: CustomEvent<RouletteAnnounced>) => this.announce(event.detail)}
                ></fl-roulette-track>`}
            ${this.shownCall
              ? keyed(this.shownCall, html`<p class="lk-rl-call" aria-live="assertive"><span>${this.t(`roulette.call.${this.shownCall}`)}</span></p>`)
              : nothing}
          </div>
          <div class="lk-rl-rack">
            <fl-chips
              .chosen=${this.chosen}
              ?disabled=${!idle}
              .locked=${this.bets[0]?.prizeId ?? null}
              .count=${{ used, max: ROULETTE_CHIPS }}
              @choose=${(event: CustomEvent<string>) => (this.chosen = event.detail)}
            ></fl-chips>
            <div class="lk-rl-actions">
              <div class="lk-rl-quick">
                <button class="lk-round" aria-label=${this.t('roulette.undo')} data-tip=${this.t('roulette.undo')} ?disabled=${!this.history.length || !idle} @click=${this.undo}>
                  ${icon(Undo2)}
                </button>
                <button class="lk-round" aria-label=${this.t('roulette.rebet')} data-tip=${this.t('roulette.rebet')} ?disabled=${!this.lastThrown || !!this.bets.length || !idle} @click=${this.rebet}>
                  ${icon(Repeat)}
                </button>
                <button class="lk-round" aria-label=${this.t('roulette.clear')} data-tip=${this.t('roulette.clear')} ?disabled=${!this.bets.length || !idle} @click=${this.clearChips}>
                  ${icon(Trash2)}
                </button>
              </div>
              <button class="lk-btn lk-btn--primary lk-btn--lg" ?disabled=${!this.bets.length || !idle} @click=${this.launch}>
                ${icon(CircleDot)}${this.t('roulette.launch')}
              </button>
            </div>
          </div>
          ${storm ? html`<div class="lk-rl-dark" aria-hidden="true"></div><canvas class="lk-rl-sky" aria-hidden="true"></canvas>` : nothing}
        </div>
      `,
    );
  }
}
