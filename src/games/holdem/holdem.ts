import { html, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { Eye, Layers, X } from 'lucide';
import type { Tier } from '../../config/types';
import { drawAward } from '../../engine/awards';
import { combination, HAND_NAMES, holdemDeal, holdemResult, type Card } from '../../engine/cards';
import { gameBoost, gamePrize, gameTier } from '../../engine/tiers';
import { stage } from '../../room/stage';
import type { GameOptions } from '../../runtime/context';
import { LuckyElement } from '../../runtime/element';
import { fx, SPARKS } from '../../runtime/fx';
import { icon } from '../../runtime/icons';
import { reducedMotion } from '../../runtime/motion';
import { sound } from '../../runtime/sound';
import { card } from '../cards/card';
import { cardTable } from '../cards/table';

@customElement('fl-holdem')
export class Holdem extends LuckyElement {
  @property({ attribute: false }) options: GameOptions = {};

  @state() private phase: 'ready' | 'dealing' | 'decide' | 'showdown' | 'done' = 'ready';
  @state() private player: Card[] = [];
  @state() private dealer: Card[] = [];
  @state() private board: Card[] = [];
  @state() private shown = 0;
  @state() private dealerShown = false;
  @state() private folded = false;
  @state() private clearing = false;

  @query('.lk-cards') private table?: HTMLElement;

  private boost = gameBoost('holdem');
  private prizeId: string | null = null;
  private tier: Tier = 'none';
  private pace = reducedMotion() ? 0 : 480;

  private get result() {
    return this.dealerShown ? holdemResult(this.player, this.dealer, this.board) : null;
  }

  private handName(category: number) {
    return this.t(`holdem.hands.${HAND_NAMES[category]}`);
  }

  private wait(ms: number) {
    return new Promise<void>((resolve) => this.later(resolve, ms));
  }

  private async deal() {
    if (this.phase !== 'ready') return;
    this.tier = gameTier('holdem', this.boost);
    const { prizeIds } = this.room;
    this.prizeId = gamePrize('holdem', prizeIds);
    const hand = holdemDeal(this.tier);
    this.player = [];
    this.dealer = [];
    this.board = hand.board;
    this.shown = 0;
    this.dealerShown = false;
    this.folded = false;
    this.phase = 'dealing';
    sound.play('whoosh', 0.6);
    for (const [to, dealt] of [['player', hand.player[0]], ['dealer', hand.dealer[0]], ['player', hand.player[1]], ['dealer', hand.dealer[1]]] as const) {
      await this.wait(this.pace);
      this[to] = [...this[to], dealt!];
      sound.play('tick', 1.25);
    }
    await this.turn(3);
    this.phase = 'decide';
  }

  private async turn(count: number) {
    for (let index = 0; index < count; index++) {
      await this.wait(this.pace * 1.2);
      this.shown++;
      sound.play('tick', 1.1);
    }
  }

  private async call() {
    if (this.phase !== 'decide') return;
    this.phase = 'showdown';
    await this.turn(2);
    await this.wait(this.pace * 1.4);
    this.dealerShown = true;
    this.phase = 'done';
    const result = this.result!;
    if (result.tier === 'none') {
      sound.play('stop', 0.7);
      this.later(() => this.collect(), reducedMotion() ? 600 : 2600);
      return;
    }
    const { tier } = this;
    const prizeId = this.prizeId!;
    sound.play(tier === 'jackpot' ? 'jackpot' : 'win');
    const rect = this.table?.getBoundingClientRect();
    if (rect && !reducedMotion()) fx.burst(rect.left + rect.width / 2, rect.top + rect.height * 0.45, { count: 50, type: 'spark', speed: 640, life: 0.8, gravity: 300, colors: SPARKS });
    const outcome = { game: 'holdem' as const, tier, prizeId, award: drawAward(this.room.prize(prizeId), tier), detail: { key: 'detail.holdem', params: { hand: this.handName(result.mine.category) } } };
    this.later(() => this.room.finish(outcome), reducedMotion() ? 300 : 1800);
  }

  private fold() {
    if (this.phase !== 'decide') return;
    this.folded = true;
    this.phase = 'done';
    sound.play('stop', 0.6);
    this.later(() => this.collect(), reducedMotion() ? 600 : 2000);
  }

  // A lost hand stays on the felt a moment, then the dealer sweeps the cards away.
  private collect() {
    this.clearing = true;
    sound.play('whoosh', 0.4);
    this.later(() => {
      this.player = [];
      this.dealer = [];
      this.board = [];
      this.shown = 0;
      this.dealerShown = false;
      this.folded = false;
      this.clearing = false;
      this.phase = 'ready';
    }, reducedMotion() ? 0 : 650);
  }

  render() {
    const { room, phase, result } = this;
    const won = !!result && result.tier !== 'none';
    const state = won ? 'won' : phase === 'dealing' || phase === 'showdown' ? 'spinning' : 'idle';
    // At the showdown the cards of the winning combination light up, the player's or the dealer's.
    const winning = !result || this.clearing ? [] : result.lost ? combination(result.theirs) : won ? combination(result.mine) : [...combination(result.mine), ...combination(result.theirs)];
    const lit = (dealt: Card) => winning.includes(dealt);
    const dealer = html`
      <span class="lk-hand-name">${this.t('cards.dealer')}${result ? html`<b>${this.handName(result.theirs.category)}</b>` : nothing}</span>
      <div class="lk-hand">${this.dealer.map((dealt) => card(dealt, { hidden: !this.dealerShown, lit: lit(dealt) }))}</div>
    `;
    const centre = html`
      <div class="lk-board">${this.board.map((dealt, index) => (index < this.shown ? card(dealt, { lit: lit(dealt) }) : html`<i class="lk-board-slot"></i>`))}</div>
      ${this.folded || result
        ? html`<p class="lk-cards-result ${won ? 'is-won' : ''}">
            ${this.folded
              ? this.t('holdem.result.folded')
              : won
                ? this.t('holdem.result.won', { hand: this.handName(result!.mine.category) })
                : result!.lost
                  ? this.t('holdem.result.lost', { hand: this.handName(result!.theirs.category) })
                  : this.t('holdem.result.split')}
          </p>`
        : nothing}
    `;
    const player = html`
      <div class="lk-hand">${this.player.map((dealt) => card(dealt, { lit: lit(dealt) }))}</div>
      ${result ? html`<span class="lk-hand-total is-name">${this.handName(result.mine.category)}</span>` : nothing}
    `;
    return stage(
      room.t,
      { state, rules: this.t('games.holdem.rules'), multiplier: this.boost },
      html`
        <div class="lk-cards lk-cards--holdem ${this.clearing ? 'is-clearing' : ''}">
          ${cardTable(room, this.t('holdem.print'), { dealer, centre, player })}
          <div class="lk-controls lk-cards-controls">
            ${phase === 'decide'
              ? html`
                  <button class="lk-btn lk-btn--primary lk-btn--lg" @click=${this.call}>${icon(Eye)}${this.t('holdem.call')}</button>
                  <button class="lk-btn lk-btn--outline lk-btn--lg" @click=${this.fold}>${icon(X)}${this.t('holdem.fold')}</button>
                `
              : html`<button class="lk-btn lk-btn--primary lk-btn--lg" ?disabled=${phase !== 'ready'} @click=${this.deal}>${icon(Layers)}${this.t('cards.deal')}</button>`}
          </div>
        </div>
      `,
    );
  }
}
