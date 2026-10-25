import { provide } from '@lit/context';
import { html, nothing, svg, type PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';
import { ArrowLeft, Clover, Volume2, VolumeX } from 'lucide';
import type { GameId, Messages, Player, Prize, Win } from '../config/types';
import { boardOf, resolveVariant } from '../engine/awards';
import type { Outcome } from '../engine/outcome';
import { random } from '../engine/random';
import { decide, restartRequest, rigChanged, roomOpen } from '../engine/rig';
import { roomTheme, THEME_COLORS } from '../engine/themes';
import { gameBoost, machineOfDay, PRIVATE_GAMES } from '../engine/tiers';
import { defaultColor, roomContext, type GameOptions, type RoomContext } from '../runtime/context';
import { fx, guilloche, shake, SPARKS } from '../runtime/fx';
import { loadLocale, localeLoaded, pageLocale, translator } from '../runtime/i18n';
import { LuckyElement } from '../runtime/element';
import { icon } from '../runtime/icons';
import { reducedMotion, wait } from '../runtime/motion';
import { sound } from '../runtime/sound';
import { BUILT_IN_LOCALES } from '../locales';
import '../games';
import './certificate';
import './lobby';
import './theme';

declare module '../engine/rig' {
  interface Decisions {
    locale: { context: Record<string, never>; value: string };
  }
}

export interface RoomConfig {
  prizes: Prize[];
  player: Player | null;
  // The host's logo, where the room shows a brand mark; undefined: the clover.
  logo?: string;
  // undefined: the host page's language.
  locale?: string;
  messages: Record<string, Messages>;
  onWin?: (win: Win) => void;
  onClaim?: (win: Win) => Promise<void>;
  // null: no developer menu; without a hash, no password.
  developer: { passwordHash?: string } | null;
}

const GAMES: Record<GameId, string> = {
  wheel: 'fl-wheel',
  slot: 'fl-slot',
  roulette: 'fl-roulette',
  pachinko: 'fl-pachinko',
  scratch: 'fl-scratch',
  blackjack: 'fl-blackjack',
  holdem: 'fl-holdem',
};

// On its bonus day the slot is the slot of the day.
const tagOf = (game: GameId) => (game === 'slot' && gameBoost('slot') > 1 ? (machineOfDay() === 'takeoff' ? 'fl-takeoff' : 'fl-breakaway') : GAMES[game]);

const roomGuilloche = guilloche(700, 450, 1.4);

// The room: lobby, the game being played, the win and its certificate, over the host page. Fires `closed`.
@customElement('fl-room')
export class Room extends LuckyElement {
  @property({ attribute: false }) config!: RoomConfig;
  @property({ attribute: false }) origin = { x: innerWidth / 2, y: innerHeight / 2 };

  @provide({ context: roomContext })
  @state()
  protected room!: RoomContext;

  @state() private phase: 'closed' | 'open' | 'ready' | 'closing' = 'closed';
  @state() private view: GameId | 'lobby' = 'lobby';
  // The lobby's screen, kept while a game is played: 0 the main hall, 1 the Salon Privé.
  @state() private lobbyPage = 0;
  @state() private options: GameOptions = {};
  @state() private round = 0;
  @state() private certificate: { outcome: Outcome; win: Win } | null = null;
  @state() private banner: { title: string; line: string; jackpot: boolean } | null = null;
  @state() private celebrating: 'win' | 'jackpot' | null = null;
  @state() private soundOn = sound.enabled;
  @state() private developerLoaded = false;

  @query('.lk-room') private section?: HTMLElement;
  @query('.lk-lights') private lightsCanvas?: HTMLCanvasElement;
  @query('.lk-fx') private fxCanvas?: HTMLCanvasElement;

  private lightsFrame = 0;
  private ambient = 0;
  private boost = 0;

  constructor() {
    super();
    this.watch(pageLocale, restartRequest, rigChanged);
  }

  private get theme() {
    return roomTheme();
  }

  // A language not loaded yet keeps the room in the current one until it arrives.
  protected willUpdate(changed: PropertyValues<this>) {
    const locale = this.locale();
    if (!localeLoaded(locale)) void loadLocale(locale).then(() => this.requestUpdate(), () => undefined);
    if (!this.room || (localeLoaded(locale) && (changed.has('config') || this.room.locale !== locale))) this.room = this.context();
    fx.confetti = this.theme ? THEME_COLORS[this.theme].confetti : undefined;
    const request = restartRequest.value;
    if (request) {
      restartRequest.value = undefined;
      this.banner = null;
      this.celebrating = null;
      this.boost = 0;
      this.go(request.game);
    }
  }

  // The configured language, else the page's, unless the developer menu forces one.
  private locale() {
    return decide('locale', {}, () => this.config.locale ?? pageLocale.value);
  }

  // A new language or new prizes reach every element through a new context.
  private context(): RoomContext {
    const { prizes, player, messages } = this.config;
    const locale = this.locale();
    const t = translator(locale, messages);
    const byId = new Map(prizes.map((prize, index) => [prize.id, { prize, index }]));
    const entry = (id: string) => byId.get(id) ?? { prize: prizes[0]!, index: 0 };
    return {
      prizes,
      prizeIds: prizes.map((prize) => prize.id),
      board: boardOf(prizes),
      player,
      locale,
      locales: [...new Set([...BUILT_IN_LOCALES, ...Object.keys(messages)])],
      t,
      prize: (id) => entry(id).prize,
      icon: (id) => entry(id).prize.icon,
      name: (id) => entry(id).prize.name,
      color: (id) => entry(id).prize.color ?? defaultColor(entry(id).index),
      award: (tier, award) => award ?? t(`tier.symbol.${tier}`),
      logo: (className = '') => (this.config.logo ? html`<img class="fl-icon fl-logo ${className}" src=${this.config.logo} alt="" />` : icon(Clover, className)),
      finish: (outcome) => void this.finish(outcome),
      go: (view, options) => this.go(view, options),
    };
  }

  private go(target: GameId | 'lobby', next: GameOptions = {}) {
    this.certificate = null;
    this.options = next;
    this.view = target;
    this.round++;
  }

  // Only a win reaches the room: a play that wins nothing stays in its game, ready to play again.
  private async finish(outcome: Outcome) {
    if (outcome.tier === 'none') return;
    const finishedRound = this.round;
    const prize = this.room.prize(outcome.prizeId);
    const variant = await resolveVariant(prize, outcome.tier, outcome.award);
    const win: Win = { prize, variant, tier: outcome.tier, game: outcome.game };
    this.config.onWin?.(win);
    const jackpot = outcome.tier === 'jackpot';
    await this.celebrate({ title: this.t(jackpot ? 'win.jackpot' : 'win.title'), line: `${prize.name} · ${variant?.label ?? this.t('cert.fullPrize')}`, jackpot });
    if (this.round === finishedRound) this.certificate = { outcome, win };
  }

  private async celebrate(next: { title: string; line: string; jackpot: boolean }) {
    const celebrationRound = this.round;
    this.banner = next;
    this.celebrating = next.jackpot ? 'jackpot' : 'win';
    this.boost = next.jackpot ? 2.4 : 1;
    setTimeout(() => this.round === celebrationRound && (this.celebrating = null), next.jackpot ? 6000 : 1800);
    sound.play(next.jackpot ? 'jackpot' : 'win');
    if (!reducedMotion() && next.jackpot) {
      await this.updateComplete;
      this.querySelectorAll('.lk-win-text h2 span').forEach((letter, index) =>
        setTimeout(() => {
          if (this.round !== celebrationRound || !this.section) return;
          shake(this.section, 0.5 + index * 0.08);
          const rect = letter.getBoundingClientRect();
          fx.burst(rect.left + rect.width / 2, rect.top + rect.height * 0.6, { count: 18, type: 'spark', speed: 640, life: 0.6, gravity: 300, colors: SPARKS });
          sound.play('tick', 1 + index * 0.08);
        }, 260 + index * 110),
      );
      fx.cannons(2400);
      setTimeout(() => this.round === celebrationRound && fx.fountain(2600), 700);
    } else {
      fx.burst(innerWidth / 2, innerHeight * 0.45, { count: 70, speed: 820 });
    }
    await wait(reducedMotion() ? 700 : next.jackpot ? 2500 : 1250);
    if (this.round === celebrationRound) this.banner = null;
  }

  close() {
    this.phase = 'closing';
    this.stopLights();
    setTimeout(() => this.dispatchEvent(new Event('closed')), reducedMotion() ? 0 : 560);
  }

  private toggleSound() {
    this.soundOn = !this.soundOn;
    sound.enable(this.soundOn);
    sound.play('chime');
  }

  private onKey = (event: KeyboardEvent) => {
    if (this.config.developer && !this.developerLoaded && event.ctrlKey && event.shiftKey && event.code === 'KeyL') {
      event.preventDefault();
      event.stopPropagation();
      void import('../developer/panel').then(() => (this.developerLoaded = true));
      return;
    }
    if (event.key !== 'Escape' || this.banner) return;
    if (this.certificate) this.certificate = null;
    else if (this.view !== 'lobby') this.go('lobby');
    else this.close();
  };

  /* Room lights: warm chandelier sparkles and distant lamps, brighter while the room celebrates. */

  private startLights() {
    const canvas = this.lightsCanvas;
    if (!canvas || reducedMotion()) return;
    const context = canvas.getContext('2d')!;
    const ratio = Math.min(2, devicePixelRatio);
    canvas.width = innerWidth * ratio;
    canvas.height = innerHeight * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const colors = ['#ffe3a0', '#f6d27a', '#fff4d6', '#e8b45c', '#ffffff', '#ffcf7a', '#f9e7bd', '#7fd6a0'];
    const bulbs = Array.from({ length: 90 }, () => {
      const small = Math.random() < 0.7;
      return {
        x: Math.random(),
        y: Math.random(),
        radius: small ? random(2.5, 9) : random(14, 34),
        tone: Math.floor(random(0, 840)),
        alpha: small ? random(0.35, 0.8) : random(0.08, 0.2),
        phase: random(0, Math.PI * 2),
        speed: random(0.6, 2.6),
        blink: small && Math.random() < 0.35 ? random(2, 6) : 0,
        drift: random(-0.006, -0.002),
      };
    });
    let previous = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      this.boost = Math.max(0, this.boost - dt * 0.6);
      const time = now / 1000;
      context.clearRect(0, 0, innerWidth, innerHeight);
      context.globalCompositeOperation = 'lighter';
      const theme = this.theme;
      const palette = theme ? THEME_COLORS[theme].lights : colors;
      for (const bulb of bulbs) {
        const color = palette[bulb.tone % palette.length]!;
        bulb.y = (bulb.y + bulb.drift * dt + 1) % 1;
        const wave = bulb.blink ? (Math.sin(time * bulb.blink + bulb.phase) > 0.2 ? 1 : 0.12) : 0.55 + 0.45 * Math.sin(time * bulb.speed + bulb.phase);
        const x = bulb.x * innerWidth;
        const y = bulb.y * innerHeight;
        const radius = bulb.radius * (1 + this.boost * 0.35);
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.35, `${color}aa`);
        gradient.addColorStop(1, `${color}00`);
        context.globalAlpha = Math.min(1, bulb.alpha * wave * (1 + this.boost * 2.2));
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      this.lightsFrame = requestAnimationFrame(frame);
    };
    this.lightsFrame = requestAnimationFrame(frame);
    const jingle = () => {
      sound.play('ambient');
      this.ambient = window.setTimeout(jingle, random(2600, 6200));
    };
    this.ambient = window.setTimeout(jingle, 1800);
  }

  private stopLights() {
    cancelAnimationFrame(this.lightsFrame);
    clearTimeout(this.ambient);
  }

  private previousOverflow = '';

  connectedCallback() {
    super.connectedCallback();
    roomOpen.value = true;
    this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    addEventListener('keydown', this.onKey);
  }

  firstUpdated() {
    fx.attach(this.fxCanvas ?? null);
    sound.play('whoosh');
    // One frame at the closed circle first, so the reveal has somewhere to start from.
    requestAnimationFrame(() => {
      this.phase = 'open';
      setTimeout(() => {
        if (this.phase !== 'open') return;
        this.phase = 'ready';
        this.startLights();
      }, reducedMotion() ? 0 : 850);
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    roomOpen.value = false;
    this.stopLights();
    fx.attach(null);
    document.body.style.overflow = this.previousOverflow;
    removeEventListener('keydown', this.onKey);
  }

  render() {
    const { view, phase, celebrating, banner, theme } = this;
    const privateRoom = view === 'lobby' ? this.lobbyPage === 1 : PRIVATE_GAMES.includes(view);
    const title = view === 'lobby' ? this.t('room') : this.t(`games.${view}.name`);
    const tickerItems = [...(theme ? [this.t(`themes.${theme}.greeting`)] : []), ...[1, 2, 3, 4, 5, 6].map((index) => this.t(`ticker.${index}`))];
    const classes = [
      'lk-room',
      phase === 'open' || phase === 'ready' ? 'is-open' : '',
      phase === 'ready' ? 'is-ready' : '',
      phase === 'closing' ? 'is-closing' : '',
      celebrating ? 'is-celebrating' : '',
      celebrating === 'jackpot' ? 'is-jackpot' : '',
      privateRoom ? 'is-private' : '',
    ].join(' ');
    return html`
      <section
        class=${classes}
        style="--lk-ox: ${this.origin.x}px; --lk-oy: ${this.origin.y}px"
        data-theme=${theme ?? nothing}
        role="dialog"
        aria-modal="true"
        aria-label=${this.t('title')}
      >
        <div class="lk-pools" aria-hidden="true"><i></i><i></i></div>
        <div class="lk-chandelier" aria-hidden="true"><i></i></div>
        <div class="lk-beams" aria-hidden="true"><i></i><i></i></div>
        <canvas class="lk-lights" aria-hidden="true"></canvas>
        <div class="lk-drapes" aria-hidden="true"><i></i><i></i></div>
        <div class="lk-veil" aria-hidden="true"></div>
        <svg class="lk-guilloche" viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          ${roomGuilloche.map((points) => svg`<polyline points=${points} fill="none" stroke="#d4a94e" stroke-opacity="0.16" stroke-width="0.5" />`)}
        </svg>
        <div class="lk-twinkles" aria-hidden="true"><i></i><i></i></div>

        <header class="lk-head">
          <button class="lk-btn lk-btn--outline" @click=${() => (view === 'lobby' ? this.close() : this.go('lobby'))}>
            ${icon(ArrowLeft)} ${view === 'lobby' ? this.t('backToOverview') : this.t('backToGames')}
          </button>
          <h2>${title}${view !== 'lobby' ? html`<small>${this.t('title')}</small>` : nothing}</h2>
          <div class="lk-end">
            <button
              class="lk-sound"
              aria-pressed=${this.soundOn}
              aria-label=${this.t(this.soundOn ? 'soundOn' : 'soundOff')}
              data-tip=${this.t(this.soundOn ? 'soundOn' : 'soundOff')}
              @click=${this.toggleSound}
            >
              ${icon(this.soundOn ? Volume2 : VolumeX)}
            </button>
          </div>
        </header>
        <div class="lk-ticker" aria-hidden="true">
          <div class="lk-ticker-track">
            ${[0, 1].map(() => html`<div>${tickerItems.map((item) => html`<span>${item}</span><b>•</b>`)}</div>`)}
          </div>
        </div>

        ${theme ? keyed(theme, html`<fl-theme .theme=${theme}></fl-theme>`) : nothing}

        <div class="lk-view">
          ${view === 'lobby'
            ? html`<fl-lobby
                .page=${this.lobbyPage}
                @page=${(event: CustomEvent<number>) => (this.lobbyPage = event.detail)}
                @play=${(event: CustomEvent<GameId>) => this.go(event.detail)}
              ></fl-lobby>`
            : keyed(this.round, staticHtml`<${unsafeStatic(tagOf(view))} .options=${this.options}></${unsafeStatic(tagOf(view))}>`)}
        </div>

        ${this.certificate
          ? html`<fl-certificate
              .outcome=${this.certificate.outcome}
              .win=${this.certificate.win}
              .claim=${this.config.onClaim}
              @again=${() => this.go(this.certificate!.outcome.game)}
              @lobby=${() => this.go('lobby')}
            ></fl-certificate>`
          : nothing}
        ${banner
          ? html`<div class="lk-win ${banner.jackpot ? 'is-jackpot' : ''}" aria-live="polite">
              <div class="lk-win-flash"></div>
              ${banner.jackpot ? html`<div class="lk-rays"><i></i><i></i></div><div class="lk-searchlights"><i></i><i></i><i></i></div>` : nothing}
              <div class="lk-win-text">
                <h2>${[...banner.title].map((char, index) => html`<span style="--i: ${index}">${char === ' ' ? ' ' : char}</span>`)}</h2>
                <p>${banner.line}</p>
              </div>
            </div>`
          : nothing}
        ${this.developerLoaded ? html`<fl-developer .passwordHash=${this.config.developer?.passwordHash}></fl-developer>` : nothing}

        <canvas class="lk-fx" aria-hidden="true"></canvas>
      </section>
    `;
  }
}
