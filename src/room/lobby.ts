import { html, nothing, svg, type PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { ChevronRight } from 'lucide';
import type { GameId } from '../config/types';
import type { Card } from '../engine/cards';
import { takeoffAt, takeoffTime } from '../engine/cashout';
import { range } from '../engine/random';
import { stormNumbers } from '../engine/roulette';
import { slotStrips, type SlotSymbol } from '../engine/slot';
import { roomTheme, SANTA_SLEIGH } from '../engine/themes';
import { BONUS_GAMES, boostedGame, gameBoost, machineOfDay, PRIVATE_GAMES, ticketOfDay } from '../engine/tiers';
import { card } from '../games/cards/card';
import { coverArt } from '../games/scratch/covers';
import '../games/roulette/wheel';
import '../games/slot/machine';
import '../games/wheel/face';
import { LuckyElement } from '../runtime/element';
import { icon } from '../runtime/icons';
import { reducedMotion } from '../runtime/motion';
import { sound } from '../runtime/sound';
import { boost } from './boost';

const PAGES = ['lobby.games', 'lobby.private'];
const MINI_HANDS: Record<string, { dealer: Card[]; player: Card[] }> = {
  blackjack: { dealer: [{ rank: 13, suit: 'hearts' }, { rank: 9, suit: 'clubs' }], player: [{ rank: 14, suit: 'spades' }, { rank: 11, suit: 'spades' }] },
  holdem: { dealer: [{ rank: 12, suit: 'diamonds' }, { rank: 12, suit: 'clubs' }], player: [{ rank: 14, suit: 'hearts' }, { rank: 13, suit: 'hearts' }] },
};
const MINI_BOARD: Card[] = [{ rank: 12, suit: 'hearts' }, { rank: 11, suit: 'hearts' }, { rank: 10, suit: 'hearts' }, { rank: 4, suit: 'spades' }, { rank: 9, suit: 'diamonds' }];

// Staggered rows centred on the arch (centre 110,110, radius 100), kept clear of its frame.
const pegs: { x: number; y: number }[] = [];
for (let row = 0; row < 7; row++) {
  const y = 46 + row * 26;
  for (let offset = row % 2 ? -60 : -72; offset <= 72; offset += 24) {
    if (y > 110 || Math.hypot(offset, y - 110) < 90) pegs.push({ x: 110 + offset, y });
  }
}
const pockets = ['#2a170c', '#1d3561', '#7d1c24', '#c79a3e', '#7d1c24', '#1d3561', '#2a170c'];

// On its day each game's art shows its bonus variant: the coloured Pachinko board, Storm Roulette
// and the scratch ticket of the day, drawn with the game's own covers.
const ORBS = { blue: ['#8cc8ff', '#2f7fe6'], red: ['#ffa08c', '#f0433f'], violet: ['#ffc4f4', '#e04fd0'] } as const;
const violetPeg = pegs.reduce((best, peg, index) => (Math.hypot(peg.x - 110, peg.y - 124) < Math.hypot(pegs[best]!.x - 110, pegs[best]!.y - 124) ? index : best), 0);
const orbOf = (index: number) => (index === violetPeg ? 'violet' : index % 5 === 2 ? 'red' : 'blue');
const BOLTS = ['-14,-10 8,14 0,20 22,28 16,36 36,38', '-14,232 10,214 2,206 22,198 14,190 36,184', '234,234 210,214 218,206 196,198 204,190 184,184'];
const TRAIL = 'M10 176C70 174 122 156 160 124';
const RAYS = range(0, 23).map((ray) => `M0 190L${(Math.cos((ray * Math.PI) / 12) * 420).toFixed(1)} ${(190 - Math.sin((ray * Math.PI) / 12) * 420).toFixed(1)}L${(Math.cos(((ray + 0.5) * Math.PI) / 12) * 420).toFixed(1)} ${(190 - Math.sin(((ray + 0.5) * Math.PI) / 12) * 420).toFixed(1)}Z`);
// The side stands of the football art, seen from above: wider on the outside, two rows of fans a side,
// cheering when the table is hovered.
const STANDS = ['4,0 36,18 36,202 4,220', '256,0 224,18 224,202 256,220'];
const STAND_ROWS = [
  { x: 28, from: 30, count: 9 },
  { x: 12, from: 14, count: 11 },
  { x: 232, from: 30, count: 9 },
  { x: 248, from: 14, count: 11 },
];
const STAND_FANS = STAND_ROWS.flatMap(({ x, from, count }, column) => range(0, count - 1).map((row) => ({ x, y: from + row * 18.5, color: ['#9e1b22', '#1d3561', '#d4a94e', '#f6e2a6', '#1c6136', '#5b2a6e'][(row * 5 + column * 3) % 6]!, delay: `${((row * 7 + column * 3) % 10) / 20}s` })));
const SPEED = [{ x: 40, y: 40, w: 26 }, { x: 120, y: 62, w: 18 }, { x: 70, y: 112, w: 22 }, { x: 170, y: 150, w: 16 }, { x: 20, y: 140, w: 14 }];
// The take-off art climbs at the game's own pace from ×50 to ×20000, holds it, and climbs again.
const TAKEOFF_FROM = 50;
const TAKEOFF_TO = 20000;
const TAKEOFF_LOOP = (takeoffTime(TAKEOFF_TO) - takeoffTime(TAKEOFF_FROM) + 1.8) * 1000;

// Hovering ramps the playback rate, which keeps the current position; a new CSS duration would make it jump.
interface Spin {
  selector: string;
  keyframes: Keyframe[];
  duration: number;
  fast: number;
}
const FOOTBALL_RUN: Keyframe[] = [
  { offset: 0, transform: 'translate(0, 0)', opacity: 1 },
  { offset: 0.12, transform: 'translate(0, 0)', opacity: 1, easing: 'ease-out' },
  { offset: 0.3, transform: 'translate(0, -42px)', opacity: 1 },
  { offset: 0.42, transform: 'translate(0, -42px)', opacity: 1, easing: 'ease-out' },
  { offset: 0.6, transform: 'translate(44px, -72px)', opacity: 1 },
  { offset: 0.9, transform: 'translate(44px, -72px)', opacity: 1 },
  { offset: 1, transform: 'translate(44px, -72px)', opacity: 0 },
];
const REEL = [{ transform: 'translateY(0)' }, { transform: 'translateY(-1200px)' }];
const SPINS: Partial<Record<GameId, Spin[]>> = {
  wheel: [{ selector: '.lk-mini-wheel', keyframes: [{ rotate: '0deg' }, { rotate: '360deg' }], duration: 40000, fast: 40 / 6 }],
  roulette: [{ selector: '.lk-mini-roulette', keyframes: [{ rotate: '0deg' }, { rotate: '-360deg' }], duration: 24000, fast: 24 / 5 }],
  slot: [
    ...[5000, 6400, 7600].map((duration, index) => ({ selector: `.lk-reel:nth-child(${index + 1}) ul`, keyframes: REEL, duration, fast: duration / 600 })),
    // The clock the take-off multiplier is read from, and the flight around the still plane: hovering speeds
    // them up together, like the reels.
    { selector: '.lk-mini-multiplier', keyframes: [{ opacity: 1 }, { opacity: 1 }], duration: TAKEOFF_LOOP, fast: 5 },
    { selector: '.lk-mini-rays', keyframes: [{ rotate: '0deg' }, { rotate: '-15deg' }], duration: 6000, fast: 5 },
    { selector: '.lk-mini-speed', keyframes: [{ transform: 'translate(0, 0)' }, { transform: 'translate(-220px, 60px)' }], duration: 3000, fast: 5 },
    { selector: '.lk-mini-glint', keyframes: [{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }], duration: 2200, fast: 5 },
    { selector: '.lk-mini-football', keyframes: FOOTBALL_RUN, duration: 3200, fast: 3 },
  ],
};

// The room's home: the main hall's game tables and, below them, the Salon Privé with the card tables, reached
// by scrolling or swiping anywhere in the room without the page scrolling. Fires `page` and `play`.
@customElement('fl-lobby')
export class Lobby extends LuckyElement {
  // 0 the games, 1 the private room with the card tables.
  @property({ type: Number }) page = 0;
  @state() private takeoffShown = TAKEOFF_FROM;
  @query('.lk-grid') private grid?: HTMLElement;

  private strips: SlotSymbol[][] = [];
  private stripsFor?: string[];
  private struck = stormNumbers();
  private flipping = 0;
  private touchY: number | null = null;
  private takeoffRaf = 0;
  private observer?: ResizeObserver;
  private spins = new Map<GameId, { animations: { animation: Animation; fast: number }[]; ramp: number }>();

  protected willUpdate(changed: PropertyValues<this>) {
    super.willUpdate(changed);
    if (this.stripsFor !== this.room.prizeIds) {
      this.stripsFor = this.room.prizeIds;
      this.strips = slotStrips(this.room.prizeIds);
    }
  }

  private turnPage(to: number) {
    const next = Math.max(0, Math.min(PAGES.length - 1, to));
    if (next === this.page || performance.now() < this.flipping) return;
    this.page = next;
    this.flipping = performance.now() + (reducedMotion() ? 0 : 900);
    sound.play('whoosh', 0.5);
    this.dispatchEvent(new CustomEvent('page', { detail: next }));
  }

  // Anywhere in the room turns the page, the sides and the header too, not only the tables.
  private inRoom = (event: Event) => event.composedPath().some((target) => target instanceof Element && target.classList.contains('lk-room'));
  private flip = (event: WheelEvent) => this.inRoom(event) && Math.abs(event.deltaY) > 6 && this.turnPage(this.page + Math.sign(event.deltaY));
  private touchStart = (event: TouchEvent) => (this.touchY = this.inRoom(event) ? (event.touches[0]?.clientY ?? null) : null);
  private touchEnd = (event: TouchEvent) => {
    const endY = event.changedTouches[0]?.clientY;
    if (this.touchY !== null && endY !== undefined && Math.abs(this.touchY - endY) > 50) this.turnPage(this.page + Math.sign(this.touchY - endY));
    this.touchY = null;
  };
  private pageKeys = (event: KeyboardEvent) => {
    if (event.key === 'PageDown' || event.key === 'ArrowDown') this.turnPage(this.page + 1);
    if (event.key === 'PageUp' || event.key === 'ArrowUp') this.turnPage(this.page - 1);
  };

  private climb = () => {
    const animation = this.grid?.querySelector('.lk-mini-multiplier')?.getAnimations()[0];
    if (animation) this.takeoffShown = Math.min(TAKEOFF_TO, takeoffAt(takeoffTime(TAKEOFF_FROM) + (Number(animation.currentTime) % TAKEOFF_LOOP) / 1000));
    this.takeoffRaf = requestAnimationFrame(this.climb);
  };

  private accelerate(game: GameId, hovered: boolean) {
    const spin = this.spins.get(game);
    if (!spin) return;
    cancelAnimationFrame(spin.ramp);
    const ramps = spin.animations.map(({ animation, fast }) => ({ animation, from: animation.playbackRate, to: hovered ? fast : 1 }));
    const start = performance.now();
    const step = (now: number) => {
      const eased = 1 - (1 - Math.min(1, (now - start) / 600)) ** 3;
      ramps.forEach(({ animation, from, to }) => (animation.playbackRate = from + (to - from) * eased));
      if (eased < 1) spin.ramp = requestAnimationFrame(step);
    };
    spin.ramp = requestAnimationFrame(step);
  }

  connectedCallback() {
    super.connectedCallback();
    addEventListener('keydown', this.pageKeys);
    addEventListener('wheel', this.flip, { passive: true });
    addEventListener('touchstart', this.touchStart, { passive: true });
    addEventListener('touchend', this.touchEnd);
  }

  // The mini arts are elements of their games: they must have rendered before their boxes can be animated.
  async firstUpdated() {
    await Promise.all([...this.querySelectorAll<LuckyElement>('fl-wheel-face, fl-slot-machine, fl-roulette-wheel')].map((element) => element.updateComplete));
    if (!this.isConnected) return;
    if (!reducedMotion()) {
      for (const game of Object.keys(SPINS) as GameId[]) {
        const animations = SPINS[game]!.flatMap(({ selector, keyframes, duration, fast }) => {
          const element = this.grid?.querySelector(`.lk-table--${game} ${selector}`);
          return element ? [{ animation: element.animate(keyframes, { duration, iterations: Infinity }), fast }] : [];
        });
        this.spins.set(game, { animations, ramp: 0 });
      }
      this.takeoffRaf = requestAnimationFrame(this.climb);
    }
    // Every mini art is sized from its table's art box; the slot, being HTML, through its zoom.
    this.observer = new ResizeObserver((entries) =>
      entries.forEach(({ target, contentRect: { width, height } }) => {
        (target as HTMLElement).style.setProperty('--lk-art-h', String(height));
        const slot = target.querySelector<HTMLElement>('.lk-mini-slot');
        if (slot) slot.style.zoom = String(Math.min((height * 0.8) / 495, (width * 0.72) / 560));
      }),
    );
    this.grid?.querySelectorAll('.lk-art').forEach((art) => this.observer!.observe(art));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    removeEventListener('keydown', this.pageKeys);
    removeEventListener('wheel', this.flip);
    removeEventListener('touchstart', this.touchStart);
    removeEventListener('touchend', this.touchEnd);
    this.observer?.disconnect();
    this.spins.forEach((spin) => cancelAnimationFrame(spin.ramp));
    cancelAnimationFrame(this.takeoffRaf);
  }

  private play(game: GameId) {
    sound.play('tick');
    this.dispatchEvent(new CustomEvent('play', { detail: game }));
  }

  private meta(game: GameId) {
    return html`
      <div class="lk-meta">
        <span>
          <b>${this.t(`games.${game}.name`)}</b>
          <small>${this.t(`games.${game}.summary`)}</small>
        </span>
        ${icon(ChevronRight)}
      </div>
    `;
  }

  private takeoffArt() {
    return html`
      <svg class="lk-mini-takeoff" viewBox="0 0 220 190" aria-hidden="true">
        <defs>
          <radialGradient id="lk-mini-sky-wood" cx="0" cy="1" r="1.2"><stop offset="0" stop-color="#3a1a0b" /><stop offset="1" stop-color="#120804" /></radialGradient>
          <linearGradient id="lk-mini-trail" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#b9791c" stop-opacity=".3" /><stop offset=".7" stop-color="#f6c453" /><stop offset="1" stop-color="#fff6d2" /></linearGradient>
        </defs>
        <rect width="220" height="190" rx="18" fill="url(#lk-mini-sky-wood)" stroke="#d4a94e" stroke-opacity=".6" stroke-width="2" />
        <clipPath id="lk-mini-takeoff-clip"><rect width="220" height="190" rx="18" /></clipPath>
        <g clip-path="url(#lk-mini-takeoff-clip)">
          <g class="lk-mini-rays" fill="#e2bd63" fill-opacity=".06">${RAYS.map((ray) => svg`<path d=${ray} />`)}</g>
          <g class="lk-mini-speed" stroke="#f6e2a6" stroke-opacity=".35" stroke-width="1.5" stroke-linecap="round">
            ${[1, 2].map((copy) => SPEED.map((dash) => svg`<line x1=${dash.x + copy * 220} y1=${dash.y - copy * 60} x2=${dash.x + copy * 220 + dash.w} y2=${dash.y - copy * 60 - dash.w * 0.27} />`))}
          </g>
        </g>
        <path class="lk-mini-trail" d=${TRAIL} fill="none" stroke="url(#lk-mini-trail)" stroke-width="4" stroke-linecap="round" pathLength="100" />
        <text x="110" y="74" class="lk-mini-multiplier" text-anchor="middle">${this.takeoffShown.toFixed(2)}×</text>
        <path class="lk-mini-glint" d=${TRAIL} fill="none" stroke="#fffbe8" stroke-width="3" stroke-linecap="round" pathLength="100" />
        ${roomTheme() === 'christmas'
          ? svg`<g class="lk-mini-plane"><g transform="translate(156 128) rotate(-36) scale(.62)">
              ${SANTA_SLEIGH.map((part) => svg`<path d=${part.d} fill=${part.fill ?? 'none'} stroke=${part.stroke ?? nothing} stroke-width=${part.width ?? nothing} stroke-linecap="round" class=${part.glow ? 'lk-mini-nose' : nothing} />`)}
            </g></g>`
          : svg`<g class="lk-mini-plane"><g transform="translate(160 124) rotate(-36) scale(.62)">
              <path d="M-24 -2L-34 -15L-27 -15L-15 -5Z" fill="#7d1c24" />
              <ellipse rx="26" ry="7.5" fill="#f6e2a6" stroke="#8a6420" stroke-width="1.2" />
              <path d="M-6 2L7 2L-3 17L-14 17Z" fill="#9e1b22" />
              <circle cx="26" r="3" fill="#d4a94e" />
            </g></g>`}
      </svg>
    `;
  }

  private breakawayArt() {
    return html`
      <svg class="lk-mini-breakaway" viewBox="0 0 260 220" aria-hidden="true">
        <defs>${STANDS.map((stand, key) => svg`<clipPath id="lk-mini-stand-${key}"><polygon points=${stand} /></clipPath>`)}</defs>
        ${STANDS.map(
          (stand, key) => svg`
            <g>
              <polygon points=${stand} fill="#2a1208" />
              <g clip-path="url(#lk-mini-stand-${key})">
                <rect x=${key ? 224 : 20} y="0" width="16" height="220" fill="#3a1a0b" />
                <rect x=${key ? 240 : 4} y="0" width="16" height="220" fill="#2e150a" />
              </g>
              <polygon points=${stand} fill="none" stroke="#d4a94e" stroke-opacity=".5" stroke-linejoin="round" />
            </g>
          `,
        )}
        ${STAND_FANS.map(
          (fan) => svg`
            <g class="lk-mini-fan" style="--d: ${fan.delay}">
              <path class="lk-mini-fan-arms" d="M${fan.x - 3.5} ${fan.y + 2}l-2.5 -5M${fan.x + 3.5} ${fan.y + 2}l2.5 -5" stroke=${fan.color} stroke-width="1.6" stroke-linecap="round" />
              <rect x=${fan.x - 3.5} y=${fan.y + 1} width="7" height="6" rx="2" fill=${fan.color} />
              <circle cx=${fan.x} cy=${fan.y - 1.5} r="2.6" fill="#f2c9a0" />
            </g>
          `,
        )}
        <g transform="translate(50 0)">
          <rect width="160" height="220" rx="14" fill="#1a5c36" stroke="#d4a94e" stroke-opacity=".6" stroke-width="2" />
          ${range(1, 5).map((stripe) => svg`<rect x="2" y=${(stripe - 1) * 44 + 8} width="156" height="22" fill="#fff" fill-opacity=".035" />`)}
          <g fill="none" stroke="#e2bd63" stroke-opacity=".5" stroke-width="1.5">
            <rect x="10" y="10" width="140" height="200" rx="2" />
            <rect x="40" y="10" width="80" height="44" />
            <path d="M10 196H150" />
            <path d="M58 210a22 22 0 0 1 44 0" />
          </g>
          <rect x="62" y="2" width="36" height="8" fill="none" stroke="#f1d892" stroke-width="2.5" />
          ${range(1, 4).map((line) =>
            range(1, 3).map(
              (lane) =>
                svg`<rect x=${18 + (lane - 1) * 44} y=${168 - line * 30} width="36" height="24" rx="5" fill=${line < 3 && lane === 1 + line ? 'rgb(226 189 99 / .35)' : 'rgb(255 250 240 / .08)'} stroke=${line === 3 ? '#f6e2a6' : 'rgb(246 226 166 / .3)'} stroke-width="1" />`,
            ),
          )}
          <circle class="lk-mini-football" cx="80" cy="180" r="6" fill="#fff" stroke="#1a1a1a" stroke-width="1" />
        </g>
      </svg>
    `;
  }

  private rouletteArt() {
    const storm = gameBoost('roulette') > 1;
    return html`
      <div class="lk-mini-storm ${storm ? 'is-storm' : ''}">
        <fl-roulette-wheel rootClass="lk-mini-roulette" prefix="mr" .struck=${storm ? this.struck : undefined}></fl-roulette-wheel>
        ${storm
          ? html`<svg class="lk-mini-bolts" viewBox="0 0 220 220" aria-hidden="true">
              ${BOLTS.map((points, key) => svg`<polyline points=${points} style="--d: ${key * 0.8}s" />`)}
            </svg>`
          : nothing}
      </div>
    `;
  }

  private pachinkoArt() {
    const colorful = gameBoost('pachinko') > 1;
    return html`
      <svg class="lk-mini-pachinko ${colorful ? 'is-colorful' : ''}" viewBox="0 0 220 260" aria-hidden="true">
        <defs>
          <linearGradient id="lk-mini-pachi-board" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#102941" /><stop offset="1" stop-color="#080e1c" /></linearGradient>
          <radialGradient id="lk-mini-pachi-gold" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff6d2" /><stop offset=".5" stop-color="#f6c453" /><stop offset="1" stop-color="#b9791c" /></radialGradient>
        </defs>
        ${colorful
          ? svg`
              <path d="M10 250V110a100 100 0 0 1 200 0v140z" fill="url(#lk-mini-pachi-board)" stroke="#d4a94e" stroke-width="3" />
              ${pegs.map((peg, key) => {
                const violet = orbOf(key) === 'violet';
                return svg`
                  <g>
                    <circle cx=${peg.x} cy=${peg.y} r=${violet ? 5.6 : 4.4} fill=${ORBS[orbOf(key)][1]} stroke="#f1cf72" stroke-width=".8" />
                    <circle cx=${peg.x - 1.3} cy=${peg.y - 1.3} r=${violet ? 1.9 : 1.4} fill=${ORBS[orbOf(key)][0]} />
                  </g>
                `;
              })}
              ${pockets.map((color, key) => svg`<rect x=${14 + key * 28} y="226" width="24" height="20" rx="4" fill=${color} />`)}
              ${range(1, 8).map((step) => svg`<circle class="lk-ball lk-ball-trail" cx="110" cy="30" r=${6 - step * 0.55} fill="#ffd36e" fill-opacity=${0.75 - step * 0.08} style="--k: ${step}" />`)}
              <circle class="lk-ball lk-ball--gold" cx="110" cy="30" r="6" fill="url(#lk-mini-pachi-gold)" />
            `
          : svg`
              <path d="M10 250V110a100 100 0 0 1 200 0v140z" fill="#2a140a" stroke="#d4a94e" stroke-width="3" />
              ${pegs.map((peg) => svg`<circle cx=${peg.x} cy=${peg.y} r="3" fill="#d4a94e" />`)}
              ${pockets.map((color, key) => svg`<rect x=${14 + key * 28} y="226" width="24" height="20" rx="4" fill=${color} />`)}
              <circle class="lk-ball" cx="110" cy="30" r="6" fill="#f4ecdc" />
            `}
      </svg>
    `;
  }

  private scratchArt() {
    const ticket = gameBoost('scratch') > 1 ? ticketOfDay() : 'classic';
    const art = coverArt(this.t('scratch.prize'));
    if (ticket === 'double')
      return html`
        <svg class="lk-mini-scratch" viewBox="0 0 200 250" aria-hidden="true">
          <defs>
            <clipPath id="lk-mini-double-clip"><rect width="200" height="250" rx="18" /></clipPath>
            <pattern id="lk-mini-dots" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.8" fill="#fff" fill-opacity=".2" /><circle cx="9" cy="9" r="1.8" fill="#fff" fill-opacity=".12" /></pattern>
          </defs>
          <g clip-path="url(#lk-mini-double-clip)">
            <rect width="200" height="250" fill="#c8161e" />
            <rect width="200" height="250" fill="url(#lk-mini-dots)" />
            <text x="100" y="32" class="lk-mini-title lk-mini-title--double" text-anchor="middle">${this.t('scratch.double.first')} ${this.t('scratch.double.second')}</text>
            <rect x="10" y="44" width="180" height="42" rx="9" fill="#2fa7e0" stroke="#fff" stroke-width="2" />
            ${range(1, 5).map((index) => svg`<image href=${art.coin} x=${18 + (index - 1) * 34} y="51" width="28" height="28" />`)}
            <rect x="10" y="94" width="180" height="146" rx="9" fill="#8fd8f5" stroke="#fff" stroke-width="2" />
            ${range(1, 3).map((row) => range(1, 4).map((column) => svg`<image href=${art.bundle} x=${16 + (column - 1) * 43} y=${101 + (row - 1) * 46} width="40" height="40" />`))}
            <rect x="59" y="147" width="40" height="40" rx="6" fill="#fffaf0" />
            <text x="79" y="174" class="lk-mini-number" text-anchor="middle">17</text>
            <rect class="lk-shine" width="60" height="250" fill="#fff" opacity=".3" transform="skewX(-18)" />
          </g>
        </svg>
      `;
    if (ticket === 'forever')
      return html`
        <svg class="lk-mini-scratch" viewBox="0 0 200 250" aria-hidden="true">
          <defs>
            <clipPath id="lk-mini-forever-clip"><rect width="200" height="250" rx="18" /></clipPath>
            <linearGradient id="lk-mini-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b9fe0" /><stop offset=".35" stop-color="#9ddcf7" /><stop offset=".7" stop-color="#f3dcab" /><stop offset="1" stop-color="#e6c27f" /></linearGradient>
          </defs>
          <g clip-path="url(#lk-mini-forever-clip)">
            <rect width="200" height="250" fill="url(#lk-mini-sky)" />
            <text x="100" y="30" class="lk-mini-title lk-mini-title--forever" text-anchor="middle">${this.t('scratch.forever.first')} ${this.t('scratch.forever.middle')} ${this.t('scratch.forever.second')}</text>
            ${range(1, 4).map((index) => svg`<image href=${art.boat} x=${12 + (index - 1) * 34} y="42" width="30" height="28" />`)}
            <rect x="152" y="40" width="38" height="32" rx="6" fill="#ffe14d" stroke="#e5302a" stroke-width="2" transform="rotate(-4 171 56)" />
            <text x="171" y="64" class="lk-mini-inf" text-anchor="middle">∞</text>
            <image href=${art.beach} x="10" y="80" width="180" height="96" preserveAspectRatio="none" />
            <g stroke="#fff" stroke-width="2">
              ${range(1, 4).map((column) => svg`<line x1=${10 + column * 36} y1="80" x2=${10 + column * 36} y2="176" />`)}
              ${range(1, 2).map((row) => svg`<line x1="10" y1=${80 + row * 32} x2="190" y2=${80 + row * 32} />`)}
            </g>
            <rect x="83" y="113" width="34" height="30" fill="#fffaf0" />
            <text x="100" y="135" class="lk-mini-number" text-anchor="middle">17</text>
            ${range(1, 5).map((index) => svg`<image href=${art.flipflop} x=${12 + (index - 1) * 36} y="190" width="32" height="24" />`)}
            <rect class="lk-shine" width="60" height="250" fill="#fff" opacity=".3" transform="skewX(-18)" />
          </g>
        </svg>
      `;
    return html`
      <svg class="lk-mini-scratch" viewBox="0 0 200 250" aria-hidden="true">
        <defs>
          <clipPath id="lk-mini-scratch-clip"><rect width="200" height="250" rx="18" /></clipPath>
          <linearGradient id="lk-mini-foil" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9edf1" /><stop offset=".45" stop-color="#9aa3af" /><stop offset=".55" stop-color="#7d8692" /><stop offset="1" stop-color="#e4e8ee" /></linearGradient>
        </defs>
        <g clip-path="url(#lk-mini-scratch-clip)">
          <rect width="200" height="250" fill="#f7efdc" />
          ${range(1, 3).map(
            (column) => svg`
              <rect x=${16 + (column - 1) * 58} y="56" width="52" height="56" rx="10" fill="url(#lk-mini-foil)" />
              <rect x=${16 + (column - 1) * 58} y="122" width="52" height="56" rx="10" fill="url(#lk-mini-foil)" />
            `,
          )}
          <rect x="16" y="190" width="168" height="40" rx="10" fill="url(#lk-mini-foil)" />
          <rect x="74" y="122" width="52" height="56" rx="10" fill="#fffaf0" />
          <image href=${this.room.icon(this.room.prizeIds[0]!)} x="84" y="130" width="32" height="40" />
          <rect class="lk-shine" width="60" height="250" fill="#fff" opacity=".35" transform="skewX(-18)" />
          <rect x="16" y="20" width="90" height="12" rx="6" fill="#7d1c24" opacity=".75" />
        </g>
      </svg>
    `;
  }

  private art(game: GameId) {
    if (game === 'wheel') return html`<fl-wheel-face rootClass="lk-mini-wheel" prefix="mw"></fl-wheel-face>`;
    if (game === 'slot') {
      const machine = gameBoost('slot') > 1 ? machineOfDay() : 'classic';
      if (machine === 'takeoff') return this.takeoffArt();
      if (machine === 'breakaway') return this.breakawayArt();
      return html`<div class="lk-mini-slot"><fl-slot-machine .strips=${this.strips} mini></fl-slot-machine></div>`;
    }
    if (game === 'roulette') return this.rouletteArt();
    if (game === 'pachinko') return this.pachinkoArt();
    return this.scratchArt();
  }

  render() {
    const { page } = this;
    const featured = boostedGame();
    const games = featured ? [featured, ...BONUS_GAMES.filter((game) => game !== featured)] : BONUS_GAMES;
    return html`
      <div class="lk-lobby" style="--page: ${page}">
        <div class="lk-pages">
          <section class="lk-page ${page === 0 ? 'is-current' : ''}" style="--index: 0" ?inert=${page !== 0} aria-label=${this.t(PAGES[0]!)}>
            <div class="lk-grid">
              ${games.map(
                (game, index) => html`
                  <button
                    class="lk-table lk-table--${game}"
                    style="--i: ${index}"
                    @pointerenter=${() => this.accelerate(game, true)}
                    @pointerleave=${() => this.accelerate(game, false)}
                    @click=${() => this.play(game)}
                  >
                    <i class="lk-bulbs" aria-hidden="true"></i>
                    ${gameBoost(game) > 1 ? boost(this.room.t, gameBoost(game)) : nothing}
                    <div class="lk-table-body">
                      <div class="lk-art">${this.art(game)}</div>
                      ${this.meta(game)}
                    </div>
                  </button>
                `,
              )}
            </div>
          </section>

          <section class="lk-page lk-page--private ${page === 1 ? 'is-current' : ''}" style="--index: 1" ?inert=${page !== 1} aria-label=${this.t(PAGES[1]!)}>
            <header class="lk-private-head">
              <i class="lk-rope" aria-hidden="true"><b></b><b></b></i>
              <h3>${this.t('lobby.private')}</h3>
              <small>${this.t('lobby.privateLine')}</small>
            </header>
            <div class="lk-grid lk-grid--private">
              ${PRIVATE_GAMES.map(
                (game, index) => html`
                  <button class="lk-table lk-table--private lk-table--${game}" style="--i: ${index}" @click=${() => this.play(game)}>
                    <div class="lk-table-body">
                      <div class="lk-art">
                        <div class="lk-mini-cards">
                          <div class="lk-mini-hand is-dealer">${MINI_HANDS[game]!.dealer.map((dealt, at) => card(dealt, { hidden: at === 1 }))}</div>
                          ${game === 'holdem' ? html`<div class="lk-mini-hand is-board">${MINI_BOARD.map((dealt) => card(dealt))}</div>` : nothing}
                          <div class="lk-mini-hand is-player">${MINI_HANDS[game]!.player.map((dealt) => card(dealt))}</div>
                        </div>
                      </div>
                      ${this.meta(game)}
                    </div>
                  </button>
                `,
              )}
            </div>
          </section>
        </div>

        <nav class="lk-pager" aria-label=${this.t('lobby.pager')}>
          ${PAGES.map(
            (label, index) => html`<button
              type="button"
              class=${page === index ? 'is-current' : ''}
              aria-current=${page === index ? 'page' : nothing}
              aria-label=${this.t(label)}
              data-tip=${this.t(label)}
              @click=${() => this.turnPage(index)}
            ></button>`,
          )}
        </nav>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fl-lobby': Lobby;
  }
}
