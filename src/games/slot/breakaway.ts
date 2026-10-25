import { html, nothing, svg } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { HandCoins, RotateCcw } from 'lucide';
import { prizesPaying } from '../../engine/awards';
import { BREAKAWAY_LANES, BREAKAWAY_STEPS, breakawayStep, breakawayTackle, cashAwards, type CashStep, type Priced } from '../../engine/cashout';
import type { Message } from '../../engine/outcome';
import { pick, random, range } from '../../engine/random';
import { decide } from '../../engine/rig';
import { gameBoost, gamePrize, gameTier } from '../../engine/tiers';
import { stage } from '../../room/stage';
import type { GameOptions } from '../../runtime/context';
import { LuckyElement } from '../../runtime/element';
import { fx, SPARKS } from '../../runtime/fx';
import { icon } from '../../runtime/icons';
import { reducedMotion } from '../../runtime/motion';
import { sound } from '../../runtime/sound';

type Step = Priced<CashStep>;

const LINES = BREAKAWAY_STEPS.length;
// The shot: two rows of three corners of the goal.
const ZONES = range(0, 5);

// The pitch, upright: kick-off at the bottom, the goal at the top, the prize of each line on its left.
const FIELD = { width: 430, height: 590, centre: 247, kickOff: 548, lanes: [122, 205, 289, 372], lines: [492, 432, 372, 312, 252, 192] };
const STRIPES = range(0, 9);
const STRIKER = '--shirt: #f6e2a6; --trim: #8a6420; --shorts: #7d1c24';
const DEFENDER = '--shirt: #1d3561; --trim: #d4a94e; --shorts: #f6e2a6';
const KEEPER = '--shirt: #c99a3e; --trim: #2a1208; --shorts: #1a1a1a';
const FANS = range(0, 4).flatMap((row) => range(0, 21).map((seat) => ({ x: 12 + seat * 18 + (row % 2) * 9, y: 30 + row * 22, color: pick(['#9e1b22', '#1d3561', '#d4a94e', '#f6e2a6', '#1c6136', '#5b2a6e']), delay: `${random(0, 0.5).toFixed(2)}s` })));

const player = (style: string) => svg`<use href="#lk-fb-player" x="-14" y="-34" width="28" height="37" style=${style} />`;
const square = (line: number, lane: number) => ({ x: FIELD.lanes[lane]!, y: FIELD.lines[line - 1]! });

@customElement('fl-breakaway')
export class Breakaway extends LuckyElement {
  @property({ attribute: false }) options: GameOptions = {};

  @state() private phase: 'ready' | 'running' | 'moving' | 'shot' | 'shooting' | 'tackled' | 'won' = 'ready';
  @state() private cleared = 0;
  @state() private runner = { line: 0, lane: 0 };
  @state() private chosen: number[] = [];
  @state() private defenders: (number | null)[] = [];
  @state() private aim: number | null = null;
  @state() private keeper: number | null = null;

  @query('.lk-field') private field?: SVGSVGElement;

  private boost = gameBoost('slot');
  private tackle: number | null = null;

  private get steps(): (Step | null)[] {
    return cashAwards(BREAKAWAY_STEPS, this.room.board);
  }

  private get collected() {
    return breakawayStep(this.cleared, this.steps);
  }

  private get shooting() {
    return this.phase === 'shot' || this.phase === 'shooting' || (this.phase === 'won' && this.aim !== null);
  }

  private open(line: number) {
    return (this.phase === 'running' || this.phase === 'ready') && line === this.cleared + 1;
  }

  private label(step: Step | null) {
    return step ? this.room.award(step.tier, step.award) : '—';
  }

  private kickOff() {
    const tier = gameTier('slot', this.boost);
    this.tackle = decide('breakaway.tackle', { tier }, () => breakawayTackle(tier));
    this.phase = 'running';
  }

  private step(line: number, lane: number) {
    if (this.phase === 'ready') this.kickOff();
    if (this.phase !== 'running' || line !== this.cleared + 1) return;
    this.phase = 'moving';
    this.runner = { line, lane };
    sound.play('bounce', 1.1);
    this.later(() => (line === this.tackle ? this.tackled(line, lane) : this.advance(line, lane)), reducedMotion() ? 0 : 480);
  }

  private advance(line: number, lane: number) {
    this.chosen = [...this.chosen, lane];
    this.cleared = line;
    sound.play('tick', 1 + line * 0.08);
    this.phase = line === LINES ? 'shot' : 'running';
  }

  // Every other line shows where its defender stood: never on the square the ball went through.
  private tackled(line: number, lane: number) {
    this.defenders = range(1, LINES).map((other) => (other === line ? lane : pick(range(0, BREAKAWAY_LANES - 1).filter((free) => free !== this.chosen[other - 1]))));
    this.phase = 'tackled';
    sound.play('stop', 0.7);
  }

  // The step reached is the award paid: the prize is drawn among the ones that pay it.
  private win(detail: Message) {
    const step = this.collected!;
    this.phase = 'won';
    sound.play(step.tier === 'jackpot' ? 'jackpot' : 'win');
    const rect = this.field?.getBoundingClientRect();
    if (rect && !reducedMotion()) fx.burst(rect.left + rect.width / 2, rect.top + rect.height / 3, { count: 60, type: 'spark', speed: 680, life: 0.9, gravity: 300, colors: SPARKS });
    const prize = this.room.prize(gamePrize('slot', prizesPaying(this.room.prizes, step.tier, step.award).map(({ id }) => id)));
    const won = { game: 'slot' as const, tier: step.tier, prizeId: prize.id, award: step.award, detail };
    this.later(() => this.room.finish(won), reducedMotion() ? 300 : 2600);
  }

  private cashOut() {
    if (this.phase !== 'running' || !this.collected) return;
    this.win({ key: 'detail.slot.breakaway', params: { n: this.cleared } });
  }

  // Only a jackpot run gets to shoot: the keeper dives the other way and the stands go wild.
  private shoot(zone: number) {
    if (this.phase !== 'shot') return;
    this.phase = 'shooting';
    this.aim = zone;
    this.keeper = pick(ZONES.filter((other) => other !== zone));
    sound.play('whoosh', 1.2);
    this.later(() => this.win({ key: 'detail.slot.goal' }), reducedMotion() ? 0 : 700);
  }

  private again() {
    this.phase = 'ready';
    this.runner = { line: 0, lane: 0 };
    this.cleared = 0;
    this.chosen = [];
    this.defenders = [];
    this.aim = null;
    this.keeper = null;
  }

  private get hint() {
    if (this.shooting) return this.t('slot.breakaway.shoot');
    if (this.phase === 'tackled') return this.t('slot.breakaway.tackled');
    return this.t('slot.breakaway.pick', { n: Math.min(LINES, this.cleared + 1) });
  }

  private onSquareKey(event: KeyboardEvent, line: number, lane: number) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (this.open(line)) this.step(line, lane);
  }

  private shot() {
    const { phase, aim, keeper } = this;
    return html`
      <div class="lk-shot ${phase === 'won' ? 'is-celebrating' : ''}">
        <svg class="lk-shot-stands" viewBox="0 0 400 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <rect width="400" height="120" fill="#1e0d06" />
          ${range(1, 4).map((row) => svg`<rect x="0" y=${18 + (row - 1) * 22} width="400" height="22" fill=${row % 2 ? '#2e150a' : '#3a1a0b'} />`)}
          ${FANS.map(
            (fan) => svg`
              <g class="lk-fan" style="--d: ${fan.delay}">
                <rect x=${fan.x - 5} y=${fan.y + 2} width="10" height="11" rx="3" fill=${fan.color} />
                <circle cx=${fan.x} cy=${fan.y - 2} r="4" fill="#f2c9a0" />
                <path class="lk-fan-arms" d=${`M${fan.x - 5} ${fan.y + 4}l-4 -9M${fan.x + 5} ${fan.y + 4}l4 -9`} stroke=${fan.color} stroke-width="2.5" stroke-linecap="round" />
              </g>
            `,
          )}
        </svg>
        <div class="lk-shot-goal">
          ${ZONES.map((zone) => html`<button class="lk-shot-zone" ?disabled=${phase !== 'shot'} aria-label=${this.t('slot.breakaway.zone', { n: zone + 1 })} @click=${() => this.shoot(zone)}></button>`)}
          <svg class="lk-shot-keeper ${keeper !== null ? `is-diving-${keeper}` : ''}" viewBox="-14 -34 28 37" aria-hidden="true">${player(KEEPER)}</svg>
          <svg class="lk-shot-ball ${aim !== null ? `is-at-${aim}` : ''}" viewBox="-6 -6 12 12" aria-hidden="true"><use href="#lk-fb-ball" x="-6" y="-6" width="12" height="12" /></svg>
        </div>
        <svg class="lk-shot-striker" viewBox="-14 -34 28 37" aria-hidden="true">${player(STRIKER)}</svg>
        ${phase === 'won' ? html`<strong class="lk-shot-goal-call">${this.t('slot.breakaway.goal')}</strong>` : nothing}
      </div>
    `;
  }

  render() {
    const { phase, cleared, chosen, collected, shooting } = this;
    const steps = this.steps;
    const striker = this.runner.line ? square(this.runner.line, this.runner.lane) : { x: FIELD.centre, y: FIELD.kickOff };
    const state = phase === 'won' ? 'won' : phase === 'ready' || phase === 'tackled' ? 'idle' : 'spinning';
    return stage(
      this.room.t,
      { state, rules: this.t('slot.breakaway.rules', { n: this.boost }), multiplier: this.boost },
      html`
        <div class="lk-breakaway">
          <div class="lk-field-wrap">
            <svg class="lk-field ${phase === 'tackled' ? 'is-tackled' : ''}" viewBox="0 0 ${FIELD.width} ${FIELD.height}" role="group" aria-label=${this.t('slot.names.breakaway')}>
              <defs>
                <symbol id="lk-fb-player" viewBox="-14 -34 28 37">
                  <ellipse cy="1" rx="9" ry="2.5" fill="rgb(0 0 0 / .35)" />
                  <rect x="-6" y="-8" width="4" height="8" rx="1.5" fill="#f2c9a0" />
                  <rect x="2" y="-8" width="4" height="8" rx="1.5" fill="#f2c9a0" />
                  <rect x="-7" y="-13" width="14" height="6" rx="2" style="fill: var(--shorts)" />
                  <path d="M-7 -24h14l5 6-3 2.5-3-3V-12h-12v-8.5l-3 3-3-2.5z" style="fill: var(--shirt); stroke: var(--trim); stroke-width: 1" />
                  <circle cy="-28" r="5" fill="#f2c9a0" />
                  <path d="M-5 -29a5 5 0 0 1 10 0z" fill="#3a2416" />
                </symbol>
                <symbol id="lk-fb-ball" viewBox="-6 -6 12 12">
                  <circle r="5.5" fill="#fff" stroke="#1a1a1a" stroke-width=".7" />
                  <path d="M0 -2.4l2.3 1.7-.9 2.7h-2.8l-.9-2.7z" fill="#1a1a1a" />
                </symbol>
                <pattern id="lk-fb-net" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 0L6 6M6 0L0 6" stroke="#fff" stroke-opacity=".35" stroke-width=".6" /></pattern>
              </defs>

              <rect x="70" y="6" width="354" height="578" rx="12" fill="#1a5c36" />
              ${STRIPES.map((stripe) => svg`<rect x="70" y=${6 + stripe * 64.2} width="354" height="32.1" fill="#fff" fill-opacity=".035" />`)}
              <g class="lk-field-lines">
                <rect x="80" y="16" width="334" height="558" rx="2" />
                <line x1="80" y1=${FIELD.kickOff} x2="414" y2=${FIELD.kickOff} />
                <circle cx=${FIELD.centre} cy=${FIELD.kickOff} r="42" />
                <rect x="147" y="16" width="200" height="140" />
                <rect x="197" y="16" width="100" height="48" />
                <path d="M210 156a46 46 0 0 0 74 0" />
                <circle cx=${FIELD.centre} cy="116" r="2.5" class="lk-field-spot" />
                <circle cx=${FIELD.centre} cy=${FIELD.kickOff} r="2.5" class="lk-field-spot" />
              </g>
              <rect x="212" y="1" width="70" height="15" fill="url(#lk-fb-net)" stroke="#f1d892" stroke-width="3" />
              <g transform="translate(${FIELD.centre} 54)"><g class="lk-field-keeper">${player(KEEPER)}</g></g>

              ${range(1, LINES).map(
                (line) => svg`
                  <g class="lk-field-prize ${line === cleared && phase !== 'tackled' ? 'is-collected' : ''} ${line === LINES ? 'is-jackpot' : ''}" transform="translate(35 ${FIELD.lines[line - 1]})">
                    <rect x="-31" y="-12" width="62" height="24" rx="12" />
                    <text text-anchor="middle" dominant-baseline="central">${this.label(steps[line - 1]!)}</text>
                  </g>
                `,
              )}

              ${range(1, LINES).map((line) =>
                range(0, BREAKAWAY_LANES - 1).map((lane) => {
                  const open = this.open(line);
                  return svg`<rect
                    class="lk-field-square ${open ? 'is-open' : ''} ${chosen[line - 1] === lane ? 'is-path' : ''}"
                    x=${square(line, lane).x - 35}
                    y=${square(line, lane).y - 23}
                    width="70"
                    height="46"
                    rx="9"
                    role=${open ? 'button' : nothing}
                    tabindex=${open ? 0 : -1}
                    aria-label=${this.t('slot.breakaway.square', { column: line, row: lane + 1 })}
                    @click=${() => open && this.step(line, lane)}
                    @keydown=${(event: KeyboardEvent) => this.onSquareKey(event, line, lane)}
                  />`;
                }),
              )}

              ${this.defenders.map((lane, index) =>
                lane === null
                  ? nothing
                  : svg`<g class="lk-field-defender" transform="translate(${square(index + 1, lane).x + (index + 1 === this.tackle ? 15 : 0)} ${square(index + 1, lane).y + 14})">${player(DEFENDER)}</g>`,
              )}

              <g class="lk-field-striker" style="transform: translate(${striker.x}px, ${striker.y + 14}px)">
                ${player(STRIKER)}
                <use class="lk-field-ball" href="#lk-fb-ball" x="2" y="-9" width="11" height="11" />
              </g>
            </svg>
            ${shooting ? this.shot() : nothing}
          </div>
          <div class="lk-controls">
            ${phase === 'tackled'
              ? html`<button class="lk-btn lk-btn--primary lk-btn--lg" @click=${() => this.again()}>${icon(RotateCcw)}${this.t('slot.breakaway.again')}</button>`
              : html`<button class="lk-btn lk-btn--primary lk-btn--lg ${shooting ? 'is-hidden' : ''}" ?disabled=${phase !== 'running' || !collected} @click=${() => this.cashOut()}>
                  ${icon(HandCoins)}${collected ? this.t('slot.breakaway.cashOut', { prize: this.label(collected) }) : this.t('slot.breakaway.cashFrom', { n: 2 })}
                </button>`}
            <div class="lk-hint">${this.hint}</div>
          </div>
        </div>
      `,
    );
  }
}
