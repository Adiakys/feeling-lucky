import { html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { Eye, Layers, X } from 'lucide';
import type { Tier } from '../config/types';
import { drawAward } from '../engine/awards';
import { bestHand, combination, HAND_NAMES, holdemResult, type Card } from '../engine/cards';
import { onDuty } from '../engine/dealer';
import { gamePrize } from '../engine/tiers';
import { stage } from '../room/stage';
import { icon } from '../runtime/icons';
import { cardTable } from '../games/cards/table';
import type { SharedSeat } from './client';
import { cardOf, tableSeats, secondsLeft } from './seats';
import { SharedTableElement } from './shared';

const known = (cards: (Card | null)[]): Card[] | null => (cards.every(Boolean) ? (cards as Card[]) : null);

// Texas Hold'em at the shared table: everyone plays against the dealer, on the same board.
@customElement('fl-holdem-shared')
export class SharedHoldem extends SharedTableElement {
  protected readonly game = 'holdem';

  private handName(category: number) {
    return this.t(`holdem.hands.${HAND_NAMES[category]}`);
  }

  // Once the dealer shows the cards, the hand each player made.
  private made(cards: (Card | null)[]) {
    const view = this.view;
    const board = known(view?.board ?? []);
    const mine = known(cards);
    const dealer = known(view?.dealer ?? []);
    return board?.length === 5 && mine?.length && dealer?.length ? holdemResult(mine, dealer, board) : null;
  }

  protected outcome(mine: SharedSeat) {
    const prizeId = gamePrize('holdem', this.room.prizeIds);
    const tier = mine.tier as Tier;
    const made = this.made(mine.hands[0]?.cards ?? []);
    return {
      game: 'holdem' as const,
      tier,
      prizeId,
      award: drawAward(this.room.prize(prizeId), tier),
      detail: { key: 'detail.holdem', params: { hand: made ? this.handName(made.mine.category) : '' } },
    };
  }

  render() {
    if (this.offline) return html`<fl-holdem .options=${this.options}></fl-holdem>`;
    const { room, view, mine } = this;
    const phase = view?.phase ?? 'betting';
    const cards = mine?.hands[0]?.cards ?? [];
    const made = mine?.folded ? null : this.made(cards);
    const won = !!mine?.tier && mine.tier !== 'none';
    const dealing = phase === 'dealing' || phase === 'dealer';
    const turn = phase === 'acting' && !!mine?.playing && !mine.decided;
    const seconds = secondsLeft(view?.deadline ?? null);
    const status = !view
      ? null
      : !mine
        ? this.t('cards.chooseSeat')
        : !mine.playing && phase !== 'betting'
          ? this.t('cards.nextHand')
          : phase === 'betting' && seconds !== null
            ? this.t('cards.dealingIn', { seconds })
            : turn && seconds !== null
              ? this.t('cards.playIn', { seconds })
              : null;
    // At the showdown the cards of the winning combination light up, the player's or the dealer's.
    const winning =
      !made || this.clearing
        ? []
        : made.lost
          ? combination(made.theirs)
          : won
            ? combination(made.mine)
            : [...combination(made.mine), ...combination(made.theirs)];
    const lit = (dealt: Card | null) => !!dealt && winning.some((other) => other.rank === dealt.rank && other.suit === dealt.suit);
    const dealer = html`
      <span class="lk-hand-name">${this.t('cards.dealer')}${made ? html`<b>${this.handName(made.theirs.category)}</b>` : nothing}</span>
      <div class="lk-hand">${view?.dealer.map((dealt) => cardOf(dealt, { lit: lit(dealt) })) ?? nothing}</div>
    `;
    const result =
      mine?.result === 'folded'
        ? this.t('holdem.result.folded')
        : made && mine?.result
          ? won
            ? this.t('holdem.result.won', { hand: this.handName(made.mine.category) })
            : made.lost
              ? this.t('holdem.result.lost', { hand: this.handName(made.theirs.category) })
              : this.t('holdem.result.split')
          : null;
    const centre = html`
      <div class="lk-board">
        ${(view?.board.length ? view.board : Array.from({ length: 5 }, () => null)).map((dealt) => (dealt ? cardOf(dealt, { lit: lit(dealt) }) : html`<i class="lk-board-slot"></i>`))}
      </div>
      ${result ? html`<p class="lk-cards-result ${won ? 'is-won' : ''}">${result}</p>` : status ? html`<p class="lk-cards-status">${status}</p>` : nothing}
    `;
    const player = html`
      <div class="lk-hand">${cards.map((dealt) => cardOf(dealt, { lit: lit(dealt) }))}</div>
      ${made ? html`<span class="lk-hand-total is-name">${this.handName(made.mine.category)}</span>` : nothing}
    `;
    const seats = view
      ? tableSeats(room, view, {
          cards: (seat, isMine) => {
            if (!seat.playing) return nothing;
            if (isMine) return player;
            const theirs = known(seat.hands[0]?.cards ?? []);
            const board = known(view.board);
            return html`
              <div class="lk-hand">${seat.hands[0]?.cards.map((dealt) => cardOf(dealt)) ?? nothing}</div>
              ${theirs?.length && board?.length === 5 && !seat.folded
                ? html`<span class="lk-hand-total is-name">${this.handName(bestHand([...theirs, ...board]).category)}</span>`
                : nothing}
            `;
          },
          outcome: (seat) => (!seat.result ? null : seat.tier && seat.tier !== 'none' ? 'won' : 'lost'),
          sit: this.canSit ? this.sit : null,
          stand: this.canStand ? this.stand : null,
        })
      : undefined;
    return stage(
      room.t,
      { state: won && mine?.result ? 'won' : dealing ? 'spinning' : 'idle', rules: this.t('games.holdem.rules'), multiplier: view?.boost ?? 1, dealer: true },
      html`
        <div class="lk-cards lk-cards--holdem lk-cards--shared ${this.clearing ? 'is-clearing' : ''}">
          ${cardTable(room, this.t('holdem.print'), { dealer, centre, player: html``, seats }, { on: onDuty.value, dealing })}
          <div class="lk-controls lk-cards-controls">
            ${
              phase === 'acting' && mine?.playing
                ? html`
                    <button class="lk-btn lk-btn--primary lk-btn--lg" ?disabled=${!turn} @click=${() => this.act('call')}>
                      ${icon(Eye)}${this.t('holdem.call')}
                    </button>
                    <button class="lk-btn lk-btn--outline lk-btn--lg" ?disabled=${!turn} @click=${() => this.act('fold')}>
                      ${icon(X)}${this.t('holdem.fold')}
                    </button>
                  `
                : html`<button
                    class="lk-btn lk-btn--primary lk-btn--lg"
                    ?disabled=${phase !== 'betting' || !mine || mine.ready}
                    @click=${() => this.act('deal')}
                  >
                    ${icon(Layers)}${this.t('cards.deal')}
                  </button>`
            }
          </div>
        </div>
      `,
    );
  }
}
