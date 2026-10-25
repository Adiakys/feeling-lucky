import { html, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { ChevronsUp, CopyPlus, Hand as HandIcon, Layers, Repeat, Split, Trash2, Undo2 } from 'lucide';
import type { Tier } from '../../config/types';
import { drawAward } from '../../engine/awards';
import { blackjackDeal, blackjackDealer, blackjackHit, canSplit, handTotal, isNatural, type Card } from '../../engine/cards';
import { onDuty } from '../../engine/dealer';
import { gameBoost, gamePrize, gameTier } from '../../engine/tiers';
import '../../room/chips';
import { stage } from '../../room/stage';
import type { GameOptions } from '../../runtime/context';
import { LuckyElement } from '../../runtime/element';
import { fx, SPARKS } from '../../runtime/fx';
import { icon } from '../../runtime/icons';
import { reducedMotion } from '../../runtime/motion';
import { sound } from '../../runtime/sound';
import { card } from '../cards/card';
import { cardTable } from '../cards/table';

type Result = 'bust' | 'lose' | 'win' | 'dealerBust' | 'natural' | 'spades';
// One hand, or two after a split, each with its stack of chips: a doubled hand has two.
interface Hand { cards: Card[]; stacks: number; done: boolean }

// Up to five chips of one prize on the betting circle: a win pays that prize.
const BLACKJACK_CHIPS = 5;
const WINS: Result[] = ['win', 'dealerBust', 'natural', 'spades'];
const totalOf = (cards: Card[]) => handTotal(cards).total;

@customElement('fl-blackjack')
export class Blackjack extends LuckyElement {
  @property({ attribute: false }) options: GameOptions = {};

  @state() private phase: 'ready' | 'dealing' | 'player' | 'dealer' | 'done' = 'ready';
  @state() private hands: Hand[] = [];
  @state() private active = 0;
  @state() private dealer: Card[] = [];
  @state() private holeShown = false;
  @state() private clearing = false;
  @state() private result: Result | null = null;
  @state() private chosen = '';
  @state() private chips: string[] = [];
  @state() private history: string[][] = [];
  @state() private lastBet: string[] | null = null;

  @query('.lk-cards') private table?: HTMLElement;

  private boost = gameBoost('blackjack');
  private prizeId: string | null = null;
  private tier: Tier = 'none';
  private pace = reducedMotion() ? 0 : 480;

  constructor() {
    super();
    this.watch(onDuty);
  }

  // A dealer coming or leaving changes the odds from the next hand, never during one.
  protected willUpdate() {
    if (!this.room.prizeIds.includes(this.chosen)) this.chosen = this.room.prizeIds[0]!;
    if (this.phase === 'ready') this.boost = gameBoost('blackjack');
  }

  private get betting() {
    return this.phase === 'ready';
  }

  private get left() {
    return BLACKJACK_CHIPS - this.chips.length;
  }

  private get won() {
    return !!this.result && WINS.includes(this.result);
  }

  private get hand() {
    return this.hands[this.active];
  }

  private get theirs() {
    return totalOf(this.holeShown ? this.dealer : this.dealer.slice(0, 1));
  }

  private get canDouble() {
    return this.phase === 'player' && this.hand?.cards.length === 2;
  }

  private get canSplitHand() {
    return this.phase === 'player' && this.hands.length === 1 && canSplit(this.hand!.cards);
  }

  // A hand wins when the dealer busts or stops below it; the best hand pays the prize.
  private beats(cards: Card[]) {
    return totalOf(cards) <= 21 && (this.theirs > 21 || this.theirs < totalOf(cards));
  }

  private wait(ms: number) {
    return new Promise<void>((resolve) => this.later(resolve, ms));
  }

  private bet() {
    if (!this.betting || !this.left) return;
    this.history = [...this.history, [...this.chips]];
    this.chips = [...this.chips, this.chosen];
    sound.play('tick', 1.4);
  }

  private undo() {
    const previous = this.history.at(-1);
    if (!previous) return;
    this.history = this.history.slice(0, -1);
    this.chips = previous;
  }

  private rebet() {
    if (!this.lastBet || this.chips.length) return;
    this.history = [...this.history, []];
    this.chips = [...this.lastBet];
  }

  private clearChips() {
    this.history = [...this.history, [...this.chips]];
    this.chips = [];
  }

  private give(cards: Card[], dealt: Card) {
    cards.push(dealt);
    this.requestUpdate();
    sound.play('tick', 1.25);
  }

  private async deal() {
    if (this.phase !== 'ready' || !this.chips.length) return;
    const tier = (this.tier = gameTier('blackjack', this.boost));
    this.prizeId = gamePrize('blackjack', [this.chips[0]!]);
    this.lastBet = [...this.chips];
    this.history = [];
    const opening = blackjackDeal(tier);
    this.hands = [{ cards: [], stacks: 1, done: false }];
    this.active = 0;
    this.dealer = [];
    this.holeShown = false;
    this.result = null;
    this.phase = 'dealing';
    sound.play('whoosh', 0.6);
    const mine = this.hands[0]!.cards;
    for (const [to, dealt] of [[mine, opening.player[0]], [this.dealer, opening.dealer[0]], [mine, opening.player[1]], [this.dealer, opening.dealer[1]]] as const) {
      await this.wait(this.pace);
      this.give(to, dealt!);
    }
    await this.wait(this.pace);
    if (isNatural(mine)) return this.settle(tier === 'jackpot' ? 'spades' : 'natural');
    this.phase = 'player';
  }

  private hit() {
    if (this.phase !== 'player') return;
    this.give(this.hand!.cards, blackjackHit(this.tier, this.hand!.cards));
    if (totalOf(this.hand!.cards) >= 21) this.next();
  }

  // Doubling puts a second stack beside the first and takes one card only.
  private double() {
    if (!this.canDouble) return;
    this.hand!.stacks++;
    this.give(this.hand!.cards, blackjackHit(this.tier, this.hand!.cards));
    this.next();
  }

  // Splitting makes two hands of the pair, each with its own stack and a second card; split aces take one card each.
  private async split() {
    if (!this.canSplitHand) return;
    const [first, second] = this.hand!.cards;
    this.phase = 'dealing';
    this.hands = [{ cards: [first!], stacks: 1, done: false }, { cards: [second!], stacks: 1, done: false }];
    const aces = first!.rank === 14;
    for (const each of this.hands) {
      await this.wait(this.pace);
      this.give(each.cards, blackjackHit(this.tier, each.cards));
      each.done = aces || totalOf(each.cards) === 21;
    }
    if (this.hands.every(({ done }) => done)) return this.dealerTurn();
    this.phase = 'player';
    if (this.hands[0]!.done) this.active = 1;
  }

  private stand() {
    if (this.phase === 'player') this.next();
  }

  private next() {
    this.hand!.done = true;
    const waiting = this.hands.findIndex(({ done }) => !done);
    if (waiting === -1) this.dealerTurn();
    else this.active = waiting;
  }

  private async dealerTurn() {
    this.phase = 'dealer';
    const standing = this.hands.map(({ cards }) => totalOf(cards)).filter((total) => total <= 21);
    if (!standing.length) return this.settle('bust');
    await this.wait(this.pace / 2);
    this.holeShown = true;
    sound.play('tick', 1);
    for (const dealt of blackjackDealer(this.tier, this.dealer, Math.max(...standing))) {
      await this.wait(this.pace * 1.4);
      this.give(this.dealer, dealt);
    }
    await this.wait(this.pace);
    this.settle(!this.hands.some(({ cards }) => this.beats(cards)) ? 'lose' : this.theirs > 21 ? 'dealerBust' : 'win');
  }

  // A lost hand stays on the felt a moment, then the dealer sweeps cards and chips away.
  private collect() {
    this.clearing = true;
    sound.play('whoosh', 0.4);
    this.later(() => {
      this.hands = [];
      this.dealer = [];
      this.chips = [];
      this.holeShown = false;
      this.result = null;
      this.clearing = false;
      this.phase = 'ready';
    }, reducedMotion() ? 0 : 650);
  }

  private settle(outcome: Result) {
    this.holeShown = true;
    this.result = outcome;
    this.phase = 'done';
    if (!this.won) {
      sound.play('stop', 0.7);
      this.later(() => this.collect(), reducedMotion() ? 600 : 2600);
      return;
    }
    const { tier } = this;
    const prizeId = this.prizeId!;
    sound.play(tier === 'jackpot' ? 'jackpot' : 'win');
    const rect = this.table?.getBoundingClientRect();
    if (rect && !reducedMotion()) fx.burst(rect.left + rect.width / 2, rect.top + rect.height * 0.6, { count: 50, type: 'spark', speed: 640, life: 0.8, gravity: 300, colors: SPARKS });
    const outcomeWon = { game: 'blackjack' as const, tier, prizeId, award: drawAward(this.room.prize(prizeId), tier), detail: { key: `detail.blackjack.${outcome}` } };
    this.later(() => this.room.finish(outcomeWon), reducedMotion() ? 300 : 1600);
  }

  render() {
    const { room, phase, hands, chips, won, result, betting, left } = this;
    const state = won ? 'won' : phase === 'dealing' || phase === 'dealer' ? 'spinning' : 'idle';
    const stacks = hands.reduce((sum, { stacks: count }) => sum + count, 0) || 1;
    const dealer = html`
      <span class="lk-hand-name">${this.t('cards.dealer')}${this.dealer.length ? html`<b>${this.theirs}</b>` : nothing}</span>
      <div class="lk-hand">${this.dealer.map((dealt, index) => card(dealt, { hidden: index === 1 && !this.holeShown }))}</div>
    `;
    const centre = html`${result ? html`<p class="lk-cards-result ${won ? 'is-won' : ''}">${this.t(`blackjack.result.${result}`)}</p>` : nothing}`;
    const bet = html`
      <button class="lk-bet ${betting && left > 0 ? 'is-open' : ''}" ?disabled=${!betting || !left} aria-label=${this.t('blackjack.bet', { prize: room.name(this.chosen) })} @click=${this.bet}>
        ${Array.from({ length: stacks }, (_, stack) =>
          chips.map(
            (id, index) =>
              html`<i class="lk-bet-chip ${won && id === this.prizeId ? 'is-winning' : ''}" style="--lk-chip: ${room.color(id)}; --n: ${index}; --stack: ${stack - (stacks - 1) / 2}"><img src=${room.icon(id)} alt="" /></i>`,
          ),
        )}
      </button>
    `;
    const player = html`${hands.map(
      (hand, index) => html`
        <div class="lk-split ${hands.length > 1 && phase === 'player' && index === this.active ? 'is-active' : ''}">
          <div class="lk-hand">${hand.cards.map((dealt) => card(dealt, { lit: won && (result === 'natural' || result === 'spades' || this.beats(hand.cards)) }))}</div>
          ${hand.cards.length
            ? html`<span class="lk-hand-total ${totalOf(hand.cards) > 21 ? 'is-bust' : ''}">${totalOf(hand.cards)}${hand.stacks > 1 ? html`<small>×2</small>` : nothing}</span>`
            : nothing}
        </div>
      `,
    )}`;
    return stage(
      room.t,
      { state, rules: this.t('games.blackjack.rules'), multiplier: this.boost, dealer: true },
      html`
        <div class="lk-cards lk-cards--blackjack ${this.clearing ? 'is-clearing' : ''}">
          ${cardTable(room, this.t('blackjack.print'), { dealer, centre, bet, player }, { on: onDuty.value, dealing: phase === 'dealing' || phase === 'dealer' })}
          <div class="lk-rl-rack lk-cards-rack">
            <fl-chips
              .chosen=${this.chosen}
              .disabled=${!betting}
              .locked=${chips[0] ?? null}
              .count=${{ used: chips.length, max: BLACKJACK_CHIPS }}
              @choose=${(event: CustomEvent<string>) => (this.chosen = event.detail)}
            ></fl-chips>
            <div class="lk-rl-actions">
              <div class="lk-rl-quick">
                <button class="lk-round" aria-label=${this.t('roulette.undo')} data-tip=${this.t('roulette.undo')} ?disabled=${!this.history.length || !betting} @click=${this.undo}>
                  ${icon(Undo2)}
                </button>
                <button class="lk-round" aria-label=${this.t('roulette.rebet')} data-tip=${this.t('roulette.rebet')} ?disabled=${!this.lastBet || !!chips.length || !betting} @click=${this.rebet}>
                  ${icon(Repeat)}
                </button>
                <button class="lk-round" aria-label=${this.t('roulette.clear')} data-tip=${this.t('roulette.clear')} ?disabled=${!chips.length || !betting} @click=${this.clearChips}>
                  ${icon(Trash2)}
                </button>
              </div>
              ${phase === 'player'
                ? html`
                    <button class="lk-btn lk-btn--primary lk-btn--lg" @click=${this.hit}>${icon(CopyPlus)}${this.t('blackjack.hit')}</button>
                    <button class="lk-btn lk-btn--outline lk-btn--lg" @click=${this.stand}>${icon(HandIcon)}${this.t('blackjack.stand')}</button>
                    <button class="lk-btn lk-btn--outline lk-btn--lg" ?disabled=${!this.canDouble} @click=${this.double}>${icon(ChevronsUp)}${this.t('blackjack.double')}</button>
                    <button class="lk-btn lk-btn--outline lk-btn--lg" ?disabled=${!this.canSplitHand} @click=${this.split}>${icon(Split)}${this.t('blackjack.split')}</button>
                  `
                : html`<button class="lk-btn lk-btn--primary lk-btn--lg" ?disabled=${!betting || !chips.length} @click=${this.deal}>${icon(Layers)}${this.t('cards.deal')}</button>`}
            </div>
          </div>
        </div>
      `,
    );
  }
}
