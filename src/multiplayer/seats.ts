import { html, nothing, type TemplateResult } from 'lit';
import { Armchair, LogOut } from 'lucide';
import type { Card } from '../engine/cards';
import { card } from '../games/cards/card';
import { silhouette } from '../games/cards/table';
import type { RoomContext } from '../runtime/context';
import { icon } from '../runtime/icons';
import type { SharedSeat, TableView } from './client';

// A card face down where the server hides it.
export const BACK: Card = { rank: 2, suit: 'spades' };
export const cardOf = (dealt: Card | null, options: { lit?: boolean } = {}) => card(dealt ?? BACK, { hidden: !dealt, ...options });

// A point on the table's half ellipse at this angle, a fraction of the way out to the rail.
const place = (angle: number, across: number, down: number) => {
  const radians = (angle * Math.PI) / 180;
  return `left: ${50 + 50 * across * Math.cos(radians)}%; top: ${100 * down * Math.sin(radians)}%`;
};

// Every seat in the same place for everyone, from 160° to 20° along the rail: the player's, the other players', the
// free ones to sit on. In front of each seated player their chips, then their cards towards the middle of the felt;
// without chips the cards come up to the seat. cards, chips: a seat's, or nothing; outcome: the end of a player's hand.
export function tableSeats(
  room: RoomContext,
  view: TableView,
  {
    cards,
    chips = () => nothing,
    outcome,
    sit,
    stand,
  }: {
    cards: (seat: SharedSeat, mine: boolean) => TemplateResult | typeof nothing;
    chips?: (seat: SharedSeat, mine: boolean) => TemplateResult | typeof nothing;
    outcome: (seat: SharedSeat) => 'won' | 'lost' | null;
    sit: ((seat: number) => void) | null;
    stand: (() => void) | null;
  },
) {
  const angle = (index: number) => 160 - (index * 140) / Math.max(1, view.seats.length - 1);
  return html`${view.seats.map((seat, index) => {
    if (!seat)
      return html`<button
        class="lk-seat is-free"
        style=${place(angle(index), 1, 1)}
        ?disabled=${!sit}
        aria-label=${room.t('cards.sit')}
        data-tip=${room.t('cards.sit')}
        @click=${() => sit?.(index)}
      >
        ${icon(Armchair)}
      </button>`;
    const mine = index === view.you;
    const ended = outcome(seat);
    const dealt = cards(seat, mine);
    const bet = chips(seat, mine);
    return html`
      <div class="lk-seat ${mine ? 'is-mine' : 'is-taken'} ${seat.ready || seat.playing ? 'is-in' : ''} ${ended ? `is-${ended}` : ''}" style=${place(angle(index), 1, 1)}>
        ${seat.avatar ? html`<img src=${seat.avatar} alt="" />` : silhouette}
        <b>${seat.name || room.t(mine ? 'cards.you' : 'cards.player')}</b>
        ${mine && stand
          ? html`<button class="lk-seat-leave ${index < (view.seats.length - 1) / 2 ? 'is-left' : ''}" aria-label=${room.t('cards.stand')} data-tip=${room.t('cards.stand')} @click=${stand}>${icon(LogOut)}</button>`
          : nothing}
      </div>
      ${bet === nothing ? nothing : html`<div class="lk-seat-play lk-seat-bet ${mine ? 'is-mine' : ''}" style=${place(angle(index), 0.84, 0.86)}>${bet}</div>`}
      ${dealt === nothing
        ? nothing
        : html`<div class="lk-seat-play ${mine ? 'is-mine' : ''} ${seat.folded ? 'is-folded' : ''}" style=${bet === nothing ? place(angle(index), 0.76, 0.82) : place(angle(index), 0.6, 0.66)}>
            ${dealt}
          </div>`}
    `;
  })}`;
}

// The seconds left to a deadline of the table, while it runs.
export const secondsLeft = (deadline: number | null) => (deadline === null ? null : Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
