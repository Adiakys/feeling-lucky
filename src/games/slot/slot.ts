import { html, type PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { RotateCw } from 'lucide';
import type { Tier } from '../../config/types';
import { drawAward } from '../../engine/awards';
import { mod, pick } from '../../engine/random';
import { decide } from '../../engine/rig';
import { slotLine, slotStrips, slotWinning, type SlotSymbol } from '../../engine/slot';
import { gameBoost, gamePrize, gameTier } from '../../engine/tiers';
import { stage } from '../../room/stage';
import type { GameOptions } from '../../runtime/context';
import { LuckyElement } from '../../runtime/element';
import { fx, shake, SPARKS } from '../../runtime/fx';
import { icon } from '../../runtime/icons';
import { reducedMotion } from '../../runtime/motion';
import { sound } from '../../runtime/sound';
import type { SlotMachine } from './machine';
import './machine';

const ITEM = 100;
const VELOCITY = 22;

interface Reel {
  pos: number;
  phase: 'idle' | 'spin' | 'brake' | 'settle';
  velocity: number;
  target: number;
  startedAt: number;
  stopAt: number;
  from: number;
  to: number;
  brakeStart: number;
  brakeDuration: number;
  settleStart: number;
}

@customElement('fl-slot')
export class Slot extends LuckyElement {
  @property({ attribute: false }) options: GameOptions = {};

  @state() private state: 'idle' | 'spinning' | 'won' = 'idle';
  @state() private readout = '';
  @state() private strips: SlotSymbol[][] = [];

  @query('fl-slot-machine') private machine?: SlotMachine;

  private boost = gameBoost('slot');
  private stripsOf = '';
  private reels: Reel[] = [];
  private raf = 0;
  private previous = 0;
  private ticker = 0;
  private tier: Tier = 'none';
  private prizeId = '';
  private line: SlotSymbol[] = [];
  // The first two reels make a pair: the third keeps everyone waiting.
  private suspense = false;

  private get size() {
    return this.strips[0]!.length;
  }

  private reelElements() {
    return [...this.querySelectorAll<HTMLElement>('.lk-reel')];
  }

  private draw(index: number) {
    const reel = this.reels[index]!;
    const element = this.reelElements()[index];
    if (!element) return;
    element.querySelector('ul')!.style.transform = `translateY(${-(mod(reel.pos, this.size) + this.size - 1) * ITEM}px)`;
    element.classList.toggle('is-blur', reel.velocity > 8);
  }

  // New prizes make new reels.
  willUpdate(changed: PropertyValues) {
    if (!changed.has('room') || this.stripsOf === this.room.prizeIds.join()) return;
    this.stripsOf = this.room.prizeIds.join();
    this.strips = slotStrips(this.room.prizeIds);
    this.reels = Array.from({ length: 3 }, () => ({ pos: Math.floor(Math.random() * this.size), phase: 'idle', velocity: 0, target: 0, startedAt: 0, stopAt: 0, from: 0, to: 0, brakeStart: 0, brakeDuration: 1, settleStart: 0 }));
    if (this.state === 'idle') this.readout = this.t('slot.ready');
  }

  updated(changed: PropertyValues) {
    if (changed.has('strips')) void this.machine?.updateComplete.then(() => this.reels.forEach((_, index) => this.draw(index)));
  }

  private pull = () => {
    if (this.state === 'spinning') return;
    sound.play('lever');
    this.querySelector('.lk-rod')?.animate(
      [{ transform: 'scaleY(1)' }, { transform: 'scaleY(-.25)', offset: 0.28, easing: 'cubic-bezier(.3,0,.2,1)' }, { transform: 'scaleY(1.04)', offset: 0.72 }, { transform: 'scaleY(.98)', offset: 0.86 }, { transform: 'scaleY(1)' }],
      { duration: reducedMotion() ? 1 : 760, easing: 'ease-out' },
    );
    this.later(() => this.spin(), reducedMotion() ? 0 : 220);
  };

  private spin() {
    if (this.state === 'spinning') return;
    const { prizeIds } = this.room;
    const tier = (this.tier = gameTier('slot', this.boost));
    const prizeId = (this.prizeId = gamePrize('slot', prizeIds));
    this.line = decide('slot.line', { tier, prizeId }, () => slotLine(tier, prizeIds, prizeId).symbols);
    this.state = 'spinning';
    this.readout = this.t('slot.spinning');
    this.querySelectorAll('.lk-reel li.is-win').forEach((item) => item.classList.remove('is-win'));
    const now = performance.now();
    this.suspense = slotWinning(this.line.slice(0, 2)).length === 2;
    this.reels.forEach((reel, index) => {
      const stops = this.strips[index]!.flatMap((symbol, position) => (symbol === this.line[index] ? [position] : []));
      Object.assign(reel, { phase: 'spin', startedAt: now, target: pick(stops), stopAt: now + 1000 + index * 450 + (index === 2 && this.suspense ? 1100 : 0) });
    });
    if (reducedMotion()) {
      this.reels.forEach((reel, index) => {
        Object.assign(reel, { pos: reel.target, velocity: 0, phase: 'idle' });
        this.draw(index);
      });
      return this.settle();
    }
    this.ticker = window.setInterval(() => this.reels.some((reel) => reel.phase !== 'idle') && sound.play('reel'), 90);
    this.previous = now;
    this.raf = requestAnimationFrame(this.frame);
  }

  // Each reel spins, jumps while blurred to a few symbols before its stop, brakes past it and settles back.
  private frame = (now: number) => {
    const dt = Math.min(0.05, (now - this.previous) / 1000);
    this.previous = now;
    const reels = this.reels;
    reels.forEach((reel, index) => {
      if (reel.phase === 'spin') {
        reel.velocity = VELOCITY * Math.min(1, (now - reel.startedAt) / 260) ** 2;
        reel.pos -= reel.velocity * dt;
        if (index === 2 && reel.stopAt - now < 1100 && reels[1]!.phase !== 'spin' && this.suspense) this.reelElements()[2]?.classList.add('is-suspense');
        if (now >= reel.stopAt) Object.assign(reel, { phase: 'brake', brakeStart: now, from: reel.target + 5, to: reel.target - 0.14, pos: reel.target + 5, brakeDuration: ((5 + 0.14) * 3 * 1000) / VELOCITY });
      } else if (reel.phase === 'brake') {
        const u = Math.min(1, (now - reel.brakeStart) / reel.brakeDuration);
        reel.pos = reel.from + (reel.to - reel.from) * (1 - (1 - u) ** 3);
        reel.velocity = (3 * (reel.from - reel.to) * (1 - u) ** 2 * 1000) / reel.brakeDuration;
        if (u >= 1) {
          Object.assign(reel, { phase: 'settle', settleStart: now });
          sound.play('stop', 1, index === 2 ? 1 : 0.75);
          this.reelElements()[index]?.classList.remove('is-suspense');
        }
      } else if (reel.phase === 'settle') {
        const u = Math.min(1, (now - reel.settleStart) / 220);
        reel.pos = reel.to + (reel.target - reel.to) * (1 - (1 - u) ** 2);
        reel.velocity = 0;
        if (u >= 1) reel.phase = 'idle';
      }
      this.draw(index);
    });
    if (reels.every((reel) => reel.phase === 'idle')) {
      clearInterval(this.ticker);
      return this.settle();
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private settle() {
    const { tier, prizeId } = this;
    const winning = tier === 'none' ? [] : slotWinning(this.line, prizeId);
    winning.forEach((index) => this.reelElements()[index]?.querySelectorAll('li')[mod(this.reels[index]!.pos, this.size) + this.size]?.classList.add('is-win'));
    this.readout = this.t(`slot.result.${tier}`);
    if (tier === 'none') {
      this.state = 'idle';
      return;
    }
    this.state = 'won';
    sound.play(tier === 'small' ? 'chime' : 'win');
    if (tier !== 'small') {
      const glass = this.querySelector('.lk-slot-glass')?.getBoundingClientRect();
      if (glass) fx.burst(glass.left + glass.width / 2, glass.top + glass.height / 2, { count: 40, type: 'spark', speed: 700, life: 0.7, gravity: 300, colors: SPARKS });
      shake(this.querySelector('.lk-slot-cab')!, 0.6);
    }
    const won = { game: 'slot' as const, tier, prizeId, award: drawAward(this.room.prize(prizeId), tier), detail: { key: `detail.slot.${tier}` } };
    this.later(() => this.room.finish(won), reducedMotion() ? 200 : tier === 'small' ? 1100 : 1700);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    cancelAnimationFrame(this.raf);
    clearInterval(this.ticker);
  }

  render() {
    const tray = html`
      <div class="lk-readout"><span>${this.t('slot.line')}</span><b>${this.readout}</b></div>
      <button class="lk-btn lk-btn--primary lk-btn--lg" ?disabled=${this.state === 'spinning'} @click=${this.pull}>${icon(RotateCw)}${this.t('slot.spin')}</button>
    `;
    return stage(
      this.room.t,
      { state: this.state, rules: this.t('games.slot.rules'), multiplier: this.boost },
      html`<div><fl-slot-machine .strips=${this.strips} .state=${this.state} .tray=${tray} @pull=${this.pull}></fl-slot-machine></div>`,
    );
  }
}
