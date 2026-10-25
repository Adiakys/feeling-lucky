import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ChevronsUp, CopyPlus, Hand as HandIcon, Layers, Repeat, Split, Trash2, Undo2 } from 'lucide';
import type { Tier } from '../config/types';
import { drawAward } from '../engine/awards';
import { canSplit, handTotal, type Card } from '../engine/cards';
import { onDuty } from '../engine/dealer';
import '../room/chips';
import { stage } from '../room/stage';
import { icon } from '../runtime/icons';
import { cardTable } from '../games/cards/table';
import type { SharedHand, SharedSeat, TableView } from './client';
import { cardOf, tableSeats, secondsLeft } from './seats';
import { SharedTableElement } from './shared';

const BLACKJACK_CHIPS = 5;
const WINS = ['win', 'dealerBust', 'natural', 'spades'];
const totalOf = (cards: (Card | null)[]) => handTotal(cards.filter((dealt): dealt is Card => !!dealt)).total;

// Blackjack at the shared table: everyone plays their own hands against the same dealer, all at once.
@customElement('fl-blackjack-shared')
export class SharedBlackjack extends SharedTableElement {
  protected readonly game = 'blackjack';

  @state() private chosen = '';
  @state() private chips: string[] = [];
  @state() private history: string[][] = [];
  @state() private lastBet: string[] | null = null;

  protected willUpdate() {
    if (!this.room.prizeIds.includes(this.chosen)) this.chosen = this.room.prizeIds[0]!;
  }

  // Chips go on the circle until the player deals; a new betting round starts with an empty circle.
  protected betting(previous: TableView | null, view: TableView) {
    if (view.phase === 'betting' && previous?.phase !== 'betting') {
      this.chips = [];
      this.history = [];
    }
  }

  private get open() {
    const mine = this.mine;
    return this.view?.phase === 'betting' && !!mine && !mine.ready;
  }

  private get turn() {
    const mine = this.mine;
    return this.view?.phase === 'acting' && !!mine?.playing && !mine.decided;
  }

  private get hand(): SharedHand | undefined {
    return this.mine?.hands[this.mine.active];
  }

  private get theirs() {
    return totalOf(this.view?.dealer ?? []);
  }

  private beats(cards: (Card | null)[]) {
    return totalOf(cards) <= 21 && (this.theirs > 21 || this.theirs < totalOf(cards));
  }

  private bet() {
    if (!this.open || this.chips.length >= BLACKJACK_CHIPS) return;
    this.history = [...this.history, [...this.chips]];
    this.chips = [...this.chips, this.chosen];
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
    this.chips = this.lastBet.filter((id) => this.room.prizeIds.includes(id));
  }

  private clearChips() {
    this.history = [...this.history, [...this.chips]];
    this.chips = [];
  }

  private deal() {
    if (!this.open || !this.chips.length) return;
    this.lastBet = [...this.chips];
    this.act('bet', { prize: this.chips[0], chips: this.chips.length });
  }

  protected outcome(mine: SharedSeat) {
    const prizeId = mine.prize && this.room.prizeIds.includes(mine.prize) ? mine.prize : this.room.prizeIds[0]!;
    const tier = mine.tier as Tier;
    return { game: 'blackjack' as const, tier, prizeId, award: drawAward(this.room.prize(prizeId), tier), detail: { key: `detail.blackjack.${mine.result}` } };
  }

  private hands(seat: SharedSeat, lit: (cards: (Card | null)[]) => boolean, active = -1) {
    return seat.hands.map(
      (hand, index) => html`
        <div class="lk-split ${index === active ? 'is-active' : ''}">
          <div class="lk-hand">${hand.cards.map((dealt) => cardOf(dealt, { lit: lit(hand.cards) }))}</div>
          ${
            hand.cards.length
              ? html`<span class="lk-hand-total ${totalOf(hand.cards) > 21 ? 'is-bust' : ''}"
                  >${totalOf(hand.cards)}${hand.stacks > 1 ? html`<small>×2</small>` : nothing}</span
                >`
              : nothing
          }
        </div>
      `,
    );
  }

  private chipsOf(ids: string[], stacks: number, winning: boolean) {
    const { room } = this;
    return Array.from({ length: stacks }, (_, stack) =>
      ids.map(
        (id, index) =>
          html`<i class="lk-bet-chip ${winning ? 'is-winning' : ''}" style="--lk-chip: ${room.color(id)}; --n: ${index}; --stack: ${stack - (stacks - 1) / 2}"><img src=${room.icon(id)} alt="" /></i>`,
      ),
    );
  }

  render() {
    if (this.offline) return html`<fl-blackjack .options=${this.options}></fl-blackjack>`;
    const { room, view, mine } = this;
    const phase = view?.phase ?? 'betting';
    const result = mine?.result ?? null;
    const won = !!result && WINS.includes(result) && !!mine?.tier && mine.tier !== 'none';
    const dealing = phase === 'dealing' || phase === 'dealer';
    const placed = mine?.ready || mine?.playing ? Array.from({ length: mine.chips }, () => mine.prize ?? room.prizeIds[0]!) : this.chips;
    const stacks = mine?.hands.reduce((sum, hand) => sum + hand.stacks, 0) || 1;
    const seconds = secondsLeft(view?.deadline ?? null);
    const status = !view
      ? null
      : !mine
        ? this.t('cards.chooseSeat')
        : !mine.playing && phase !== 'betting'
          ? this.t('cards.nextHand')
          : phase === 'betting' && seconds !== null
            ? this.t('cards.dealingIn', { seconds })
            : this.turn && seconds !== null
              ? this.t('cards.playIn', { seconds })
              : null;
    const dealer = html`
      <span class="lk-hand-name">${this.t('cards.dealer')}${view?.dealer.length ? html`<b>${this.theirs}</b>` : nothing}</span>
      <div class="lk-hand">${view?.dealer.map((dealt) => cardOf(dealt)) ?? nothing}</div>
    `;
    const centre = html`${
      result
        ? html`<p class="lk-cards-result ${won ? 'is-won' : ''}">${this.t(`blackjack.result.${result}`)}</p>`
        : status
          ? html`<p class="lk-cards-status">${status}</p>`
          : nothing
    }`;
    const bet = html`
      <button
        class="lk-bet ${this.open && placed.length < BLACKJACK_CHIPS ? 'is-open' : ''}"
        ?disabled=${!this.open || placed.length >= BLACKJACK_CHIPS}
        aria-label=${this.t('blackjack.bet', { prize: room.name(this.chosen) })}
        @click=${this.bet}
      >
        ${this.chipsOf(placed, stacks, won)}
      </button>
    `;
    const seats = view
      ? tableSeats(room, view, {
          cards: (seat, isMine) =>
            !seat.playing
              ? nothing
              : html`${this.hands(
                  seat,
                  (cards) => isMine && won && (result === 'natural' || result === 'spades' || this.beats(cards)),
                  isMine && seat.hands.length > 1 && this.turn ? seat.active : -1,
                )}`,
          chips: (seat, isMine) =>
            isMine
              ? bet
              : seat.ready || seat.playing
                ? html`<span class="lk-bet">${this.chipsOf(Array.from({ length: seat.chips }, () => seat.prize ?? room.prizeIds[0]!), seat.hands.reduce((sum, hand) => sum + hand.stacks, 0) || 1, false)}</span>`
                : nothing,
          outcome: (seat) => (!seat.result ? null : seat.tier && seat.tier !== 'none' ? 'won' : 'lost'),
          sit: this.canSit ? this.sit : null,
          stand: this.canStand ? this.stand : null,
        })
      : undefined;
    return stage(
      room.t,
      { state: won ? 'won' : dealing ? 'spinning' : 'idle', rules: this.t('games.blackjack.rules'), multiplier: view?.boost ?? 1, dealer: true },
      html`
        <div class="lk-cards lk-cards--blackjack lk-cards--shared ${this.clearing ? 'is-clearing' : ''}">
          ${cardTable(room, this.t('blackjack.print'), { dealer, centre, player: html``, seats }, { on: onDuty.value, dealing })}
          <div class="lk-rl-rack lk-cards-rack">
            <fl-chips
              .chosen=${this.chosen}
              .disabled=${!this.open}
              .locked=${placed[0] ?? null}
              .count=${{ used: placed.length, max: BLACKJACK_CHIPS }}
              @choose=${(event: CustomEvent<string>) => (this.chosen = event.detail)}
            ></fl-chips>
            <div class="lk-rl-actions">
              <div class="lk-rl-quick">
                <button
                  class="lk-round"
                  aria-label=${this.t('roulette.undo')}
                  data-tip=${this.t('roulette.undo')}
                  ?disabled=${!this.history.length || !this.open}
                  @click=${this.undo}
                >
                  ${icon(Undo2)}
                </button>
                <button
                  class="lk-round"
                  aria-label=${this.t('roulette.rebet')}
                  data-tip=${this.t('roulette.rebet')}
                  ?disabled=${!this.lastBet || !!this.chips.length || !this.open}
                  @click=${this.rebet}
                >
                  ${icon(Repeat)}
                </button>
                <button
                  class="lk-round"
                  aria-label=${this.t('roulette.clear')}
                  data-tip=${this.t('roulette.clear')}
                  ?disabled=${!this.chips.length || !this.open}
                  @click=${this.clearChips}
                >
                  ${icon(Trash2)}
                </button>
              </div>
              ${
                phase === 'acting' && mine?.playing
                  ? html`
                      <button class="lk-btn lk-btn--primary lk-btn--lg" ?disabled=${!this.turn} @click=${() => this.act('hit')}>
                        ${icon(CopyPlus)}${this.t('blackjack.hit')}
                      </button>
                      <button class="lk-btn lk-btn--outline lk-btn--lg" ?disabled=${!this.turn} @click=${() => this.act('stand')}>
                        ${icon(HandIcon)}${this.t('blackjack.stand')}
                      </button>
                      <button
                        class="lk-btn lk-btn--outline lk-btn--lg"
                        ?disabled=${!this.turn || this.hand?.cards.length !== 2}
                        @click=${() => this.act('double')}
                      >
                        ${icon(ChevronsUp)}${this.t('blackjack.double')}
                      </button>
                      <button
                        class="lk-btn lk-btn--outline lk-btn--lg"
                        ?disabled=${!this.turn || mine.hands.length !== 1 || !canSplit(mine.hands[0]!.cards.filter((dealt): dealt is Card => !!dealt))}
                        @click=${() => this.act('split')}
                      >
                        ${icon(Split)}${this.t('blackjack.split')}
                      </button>
                    `
                  : html`<button class="lk-btn lk-btn--primary lk-btn--lg" ?disabled=${!this.open || !this.chips.length} @click=${this.deal}>
                      ${icon(Layers)}${this.t('cards.deal')}
                    </button>`
              }
            </div>
          </div>
        </div>
      `,
    );
  }
}
