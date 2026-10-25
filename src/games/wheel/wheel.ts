import { html, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { ArrowRight, RotateCw } from 'lucide';
import type { PrizeTier, Tier } from '../../config/types';
import { drawAward, type Award } from '../../engine/awards';
import { mod, pick, random } from '../../engine/random';
import { decide } from '../../engine/rig';
import { gameBoost, gameTier } from '../../engine/tiers';
import { boosterKeys, segmentKey, wheelLanding, wheelPrize, wheelSegments, wheelTarget } from '../../engine/wheel';
import type { GameOptions } from '../../runtime/context';
import { LuckyElement } from '../../runtime/element';
import { icon } from '../../runtime/icons';
import { reducedMotion } from '../../runtime/motion';
import { sound } from '../../runtime/sound';
import { stage } from '../../room/stage';
import type { CoinFace } from './coin';
import type { WheelFace } from './face';
import './coin';
import './face';
import './hunt';

// The close-up on the pointer, like the show's camera: zoom on the wheel to get in, zoom out to step back.
const ZOOM = { scale: 2.4, originY: -0.06 };

const easeOutCubic = (u: number) => 1 - (1 - u) ** 3;

@customElement('fl-wheel')
export class Wheel extends LuckyElement {
  @property({ attribute: false }) options: GameOptions = {};

  @state() private state: 'idle' | 'spinning' | 'won' = 'idle';
  @state() private prizeId: string | null = null;
  @state() private topSet = false;
  @state() private topBlur = false;
  @state() private bonus: 'coin' | 'hunt' | 'pachinko' | null = null;
  @state() private grabbed = false;
  @state() private zoomed = false;
  @state() private boosted: string | null = null;

  @query('fl-wheel-face') private face?: WheelFace;
  @query('.lk-wheel-wrap') private wrap?: HTMLElement;
  @query('.lk-pointer') private pointer?: SVGElement;
  @query('.lk-window ul') private strip?: HTMLElement;
  @query('.lk-window--boost ul') private boostStrip?: HTMLElement;

  private boost = gameBoost('wheel');
  // The day of the Booster: it also picks a kind of segment, lit on the wheel, that comes out boost times as often.
  private boosterDay = this.boost > 1;

  private angle = random(0, 360);
  private velocity = 0;
  private direction = 1;
  private phase: 'idle' | 'free' | 'brake' | 'done' = 'idle';
  private freeSince = 0;
  private brake = { from: 0, distance: 0, start: 0, duration: 1 };
  private target = 0;
  private tier: Tier = 'none';
  private lastIndex = -1;
  private lastTick = 0;
  private raf = 0;
  private previous = 0;
  private top = { position: 0, state: 'idle' as 'idle' | 'spinning' | 'stopping' | 'set', from: 0, to: 0, start: 0, duration: 1 };
  private boostTop = { ...this.top, key: '' };
  // A bonus reveals the award drawn when the wheel stopped; other is the coin's losing face.
  private prize: { won: CoinFace; other: CoinFace } = { won: { tier: 'none', award: null }, other: { tier: 'none', award: null } };

  private get segments() {
    return wheelSegments(this.room.board);
  }

  private get keys() {
    return boosterKeys(this.segments);
  }

  private segmentLabel(key: string) {
    const segment = this.segments.find((candidate) => segmentKey(candidate) === key)!;
    if (segment.kind === 'small' || segment.kind === 'big') return this.room.award(segment.kind, segment.award);
    return this.t(`wheel.segment.${segment.kind}`);
  }

  private indexAt(value: number) {
    return Math.floor(mod(-value, 360) / (360 / this.segments.length));
  }

  private draw() {
    this.face?.rotor?.setAttribute('transform', `rotate(${this.angle})`);
    if (this.strip) this.strip.style.transform = `translateY(${-mod(this.top.position, this.room.prizeIds.length * 9) * 40}px)`;
    if (this.boostStrip) this.boostStrip.style.transform = `translateY(${-mod(this.boostTop.position, this.keys.length * 9) * 40}px)`;
    const index = this.indexAt(this.angle);
    if (index === this.lastIndex) return;
    if (this.lastIndex !== -1 && this.phase !== 'idle' && performance.now() - this.lastTick > 40) {
      this.lastTick = performance.now();
      sound.play('tick', 1 + Math.min(0.3, Math.abs(this.velocity) / 4000));
      this.pointer?.animate([{ transform: `rotate(${-this.direction * 22}deg)` }, { transform: 'rotate(0deg)' }], { duration: 170, easing: 'cubic-bezier(.2,.8,.3,1)' });
    }
    this.lastIndex = index;
  }

  // Brake from the speed the wheel has, so the stop on the drawn segment looks like friction.
  private planBrake(now: number) {
    const width = 360 / this.segments.length;
    const stopAt = mod(-(this.target + 0.5 + random(-0.3, 0.3)) * width, 360);
    let distance = this.direction > 0 ? mod(stopAt - this.angle, 360) : -mod(this.angle - stopAt, 360);
    while ((3 * Math.abs(distance)) / Math.abs(this.velocity) < 4.2) distance += this.direction * 360;
    this.brake = { from: this.angle, distance, start: now, duration: ((3 * Math.abs(distance)) / Math.abs(this.velocity)) * 1000 };
    this.phase = 'brake';
    const count = this.room.prizeIds.length;
    const base = Math.ceil(this.top.position / count) * count + count * 2;
    this.top = { ...this.top, state: 'stopping', from: this.top.position, to: base + this.room.prizeIds.indexOf(this.prizeId!), start: now, duration: Math.min(this.brake.duration * 0.55, 1600) };
  }

  private frame = (now: number) => {
    const dt = Math.min(0.05, (now - this.previous) / 1000);
    this.previous = now;
    if (this.phase === 'free') {
      this.velocity *= Math.exp(-dt / 2.6);
      if (Math.abs(this.velocity) < 260) this.velocity = 260 * this.direction;
      this.angle += this.velocity * dt;
      if (this.boostTop.state === 'spinning' && now - this.freeSince > 350) this.stopBoost(now);
      if (now - this.freeSince > 900) this.planBrake(now);
    } else if (this.phase === 'brake') {
      const u = Math.min(1, (now - this.brake.start) / this.brake.duration);
      this.angle = this.brake.from + this.brake.distance * easeOutCubic(u);
      this.velocity = (this.brake.distance * 3 * (1 - u) ** 2) / (this.brake.duration / 1000);
      if (u >= 1) return this.land();
    }
    if (this.boostTop.state === 'spinning') this.boostTop.position += 18 * dt;
    if (this.boostTop.state === 'stopping') {
      const u = Math.min(1, (now - this.boostTop.start) / this.boostTop.duration);
      this.boostTop.position = this.boostTop.from + (this.boostTop.to - this.boostTop.from) * easeOutCubic(u);
      if (u >= 1) this.settleBoost();
    }
    if (this.top.state === 'spinning') this.top.position += 14 * dt;
    if (this.top.state === 'stopping') {
      const u = Math.min(1, (now - this.top.start) / this.top.duration);
      this.top.position = this.top.from + (this.top.to - this.top.from) * easeOutCubic(u);
      this.topBlur = u < 0.6;
      if (u >= 1) this.settleTop();
    }
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  private settleTop() {
    this.top.state = 'set';
    this.top.position = this.top.to;
    this.topSet = true;
    this.topBlur = false;
    sound.play('stop', 1, 0.7);
  }

  private stopBoost(now: number) {
    const count = this.keys.length;
    const base = Math.ceil(this.boostTop.position / count) * count + count * 2;
    this.boostTop = { ...this.boostTop, state: 'stopping', from: this.boostTop.position, to: base + this.keys.indexOf(this.boostTop.key), start: now, duration: 900 };
  }

  private settleBoost() {
    this.boostTop = { ...this.boostTop, state: 'set', position: this.boostTop.to };
    this.boosted = this.boostTop.key;
    sound.play('chime', 1.6, 0.8);
  }

  private spin(initialVelocity: number) {
    if (this.phase !== 'idle') return;
    this.face?.highlight(null);
    const segments = this.segments;
    let tier: Tier;
    if (this.boosterDay) {
      const key = decide('wheel.booster', { boost: this.boost, segments }, () => pick(boosterKeys(segments)));
      const landing = wheelLanding(segments, key, this.boost);
      tier = decide('tier', { game: 'wheel', boost: this.boost }, () => landing.tier);
      this.target = decide('wheel.segment', { tier, segments }, () => (landing.tier === tier ? landing.index : wheelTarget(segments, tier).index));
      this.boosted = null;
      this.boostTop = { ...this.boostTop, key, state: 'spinning' };
    } else {
      tier = gameTier('wheel', this.boost);
      this.target = decide('wheel.segment', { tier, segments }, () => wheelTarget(segments, tier).index);
    }
    this.tier = tier;
    this.prizeId = wheelPrize(this.room.prizes, segments[this.target]!).id;
    this.direction = Math.sign(initialVelocity) || 1;
    this.velocity = initialVelocity;
    this.phase = 'free';
    this.freeSince = performance.now();
    this.top = { ...this.top, state: 'spinning' };
    this.topBlur = true;
    this.topSet = false;
    this.state = 'spinning';
    sound.play('whoosh');
    if (reducedMotion()) {
      if (this.boosterDay) {
        this.boostTop.to = this.keys.indexOf(this.boostTop.key);
        this.settleBoost();
      }
      this.planBrake(performance.now());
      this.angle = this.brake.from + this.brake.distance;
      this.top.position = this.top.to;
      this.settleTop();
      this.draw();
      return this.land();
    }
    this.previous = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private land() {
    this.phase = 'done';
    cancelAnimationFrame(this.raf);
    if (this.top.state !== 'set') {
      this.top.position = this.top.to;
      this.settleTop();
    }
    this.draw();
    this.state = 'won';
    this.face?.highlight(this.target);
    const segment = this.segments[this.target]!;
    sound.play(segment.kind === 'none' ? 'stop' : 'chime', segment.kind === 'jackpot' ? 1.5 : 1);
    if (segment.kind === 'none') {
      this.state = 'idle';
      this.phase = 'idle';
      return;
    }
    const { tier } = this;
    const prize = this.room.prize(this.prizeId!);
    this.later(() => {
      if (segment.kind === 'coin' || segment.kind === 'hunt' || segment.kind === 'pachinko') {
        const other: PrizeTier = tier === 'small' ? 'big' : 'small';
        this.prize = { won: { tier, award: drawAward(prize, tier) }, other: { tier: other, award: drawAward(prize, other) } };
        this.bonus = segment.kind;
        return;
      }
      const award: Award = 'award' in segment ? segment.award : drawAward(prize, tier);
      this.room.finish({ game: 'wheel', tier, prizeId: this.prizeId!, award, detail: { key: `detail.wheel.${segment.kind}` } });
    }, reducedMotion() ? 200 : 1300);
  }

  private bonusWon = () => {
    this.room.finish({ game: 'wheel', tier: this.tier, prizeId: this.prizeId!, award: this.prize.won.award, detail: { key: `detail.wheel.${this.bonus}` } });
  };

  /* Grab the wheel and fling it. */

  private drag: { last: number; samples: { t: number; a: number }[] } | null = null;

  // In the close-up the wheel's centre sits below the frame, where the zoom has pushed it.
  private pointerAngle(event: PointerEvent) {
    const rect = this.wrap!.getBoundingClientRect();
    const centre = this.zoomed ? ZOOM.originY + (0.5 - ZOOM.originY) * ZOOM.scale : 0.5;
    return (Math.atan2(event.clientY - rect.top - rect.height * centre, event.clientX - rect.left - rect.width / 2) * 180) / Math.PI;
  }

  private zoom = (event: WheelEvent) => {
    if (!event.deltaY) return;
    event.preventDefault();
    this.zoomed = event.deltaY < 0;
  };

  // Two fingers on the wheel pinch the zoom instead of grabbing it.
  private fingers = new Map<number, { x: number; y: number }>();
  private pinch: number | null = null;
  private spread() {
    const [a, b] = [...this.fingers.values()];
    return Math.hypot(a!.x - b!.x, a!.y - b!.y);
  }

  private grab = (event: PointerEvent) => {
    this.fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.fingers.size === 2) {
      this.drag = null;
      this.grabbed = false;
      this.pinch = this.spread();
      return;
    }
    if (this.phase !== 'idle') return;
    this.wrap!.setPointerCapture(event.pointerId);
    this.grabbed = true;
    this.drag = { last: this.pointerAngle(event), samples: [{ t: performance.now(), a: this.angle }] };
  };

  private move = (event: PointerEvent) => {
    if (this.fingers.has(event.pointerId)) this.fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pinch !== null && this.fingers.size === 2) {
      const ratio = this.spread() / this.pinch;
      if (ratio > 1.25 || ratio < 0.8) {
        this.zoomed = ratio > 1;
        this.pinch = this.spread();
      }
      return;
    }
    if (!this.drag) return;
    const current = this.pointerAngle(event);
    const delta = mod(current - this.drag.last + 180, 360) - 180;
    this.drag.last = current;
    this.angle += delta;
    const now = performance.now();
    this.drag.samples = [...this.drag.samples, { t: now, a: this.angle }].filter((sample) => now - sample.t < 120);
    this.draw();
  };

  private release = (event: PointerEvent) => {
    this.fingers.delete(event.pointerId);
    if (this.pinch !== null) {
      if (!this.fingers.size) this.pinch = null;
      return;
    }
    if (!this.drag) return;
    this.grabbed = false;
    const [first] = this.drag.samples;
    const now = performance.now();
    const speed = first && this.drag.samples.length > 1 && now - first.t > 10 ? ((this.angle - first.a) / (now - first.t)) * 1000 : 0;
    this.drag = null;
    if (Math.abs(speed) > 220) this.spin(Math.max(-1900, Math.min(1900, speed)));
  };

  async firstUpdated() {
    await this.face?.updateComplete;
    this.draw();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    cancelAnimationFrame(this.raf);
  }

  private overlay() {
    if (this.bonus === 'coin') return html`<fl-wheel-coin .won=${this.prize.won} .other=${this.prize.other} .prizeId=${this.prizeId!} @done=${this.bonusWon}></fl-wheel-coin>`;
    if (this.bonus === 'hunt') return html`<fl-wheel-hunt .won=${this.prize.won} @done=${this.bonusWon}></fl-wheel-hunt>`;
    if (this.bonus !== 'pachinko') return undefined;
    const bonus = { prizeId: this.prizeId!, tier: this.tier, award: this.prize.won.award };
    return html`
      <div class="lk-bonus">
        <div class="lk-bonus-card">
          <h3>${this.t('wheel.pachinkoTitle')}</h3>
          <p>${this.t('wheel.pachinkoText', { prize: this.room.name(this.prizeId!) })}</p>
          <button class="lk-btn lk-btn--primary lk-btn--lg" @click=${() => this.room.go('pachinko', { bonus })}>${icon(ArrowRight)}${this.t('wheel.toPachinko')}</button>
        </div>
      </div>
    `;
  }

  render() {
    const { boost, boosterDay, segments } = this;
    const boostedIndexes = segments.flatMap((segment, index) => (segmentKey(segment) === this.boosted ? [index] : []));
    const rules = boosterDay ? this.t('wheel.boosterRules', { n: boost }) : this.t('games.wheel.rules');
    const stripItems = Array.from({ length: 10 }, () => this.room.prizeIds).flat();
    const boostItems = Array.from({ length: 10 }, () => this.keys).flat();
    return stage(
      this.room.t,
      { state: this.state, rules, multiplier: boost },
      html`
        <div class="lk-wheel-game is-${this.state}">
          <div class="lk-booster ${this.topBlur ? 'is-blur' : ''} ${this.topSet ? 'is-set' : ''}">
            <span>${this.t('wheel.booster')}</span>
            <div class="lk-window">
              <ul>
                ${stripItems.map((id) => html`<li><img src=${this.room.icon(id)} alt="" />${this.room.name(id)}</li>`)}
              </ul>
            </div>
            ${boosterDay
              ? html`
                  <div class="lk-window lk-window--boost ${this.boosted ? 'is-set' : ''}">
                    <ul>
                      ${boostItems.map((key) => html`<li>${this.segmentLabel(key)}</li>`)}
                    </ul>
                  </div>
                  <b class="lk-booster-x ${this.boosted ? 'is-set' : ''}">×${boost}</b>
                `
              : nothing}
          </div>
          <div
            class="lk-wheel-wrap ${this.grabbed ? 'is-grabbed' : ''} ${this.zoomed ? 'is-zoomed' : ''}"
            style="--lk-zoom: ${ZOOM.scale}; --lk-zoom-y: ${ZOOM.originY * 100}%"
            @wheel=${this.zoom}
            @pointerdown=${this.grab}
            @pointermove=${this.move}
            @pointerup=${this.release}
            @pointercancel=${this.release}
          >
            <div class="lk-wheel-zoom">
              <fl-wheel-face .rootClass=${'lk-wheel'} .prefix=${'wheel'} .boosted=${boostedIndexes} .boostLabel=${`×${boost}`}></fl-wheel-face>
              <svg class="lk-pointer" viewBox="0 0 60 92" aria-hidden="true">
                <path d="M30 90 L8 30 A22 22 0 1 1 52 30 Z" fill="#d4a94e" stroke="#3a2a10" stroke-width="1.5" />
                <path d="M30 80 L16 32 A14 14 0 1 1 44 32 Z" fill="#2a170c" />
                <circle cx="30" cy="22" r="9" fill="#9e1b2a" />
                <circle cx="30" cy="22" r="6" fill="#d6455a" opacity=".8" />
                <circle cx="27" cy="19" r="3" fill="#fff" opacity=".85" />
              </svg>
            </div>
          </div>
          <div class="lk-controls">
            <button class="lk-btn lk-btn--primary lk-btn--lg" ?disabled=${this.state !== 'idle'} @click=${() => this.spin(random(1050, 1350))}>
              ${icon(RotateCw)}${this.t('wheel.spin')}
            </button>
            <div class="lk-hint">${this.t('wheel.hint')}</div>
          </div>
        </div>
      `,
      this.overlay(),
    );
  }
}
