import { html } from 'lit';
import type { NumbersTicket, TicketPrize } from '../../engine/scratch';
import type { RoomContext } from '../../runtime/context';

// Forever: game 1 on the beach, with the winning numbers on boats; game 2 under the flip-flops.
export function ticketForever(room: RoomContext, ticket: NumbersTicket, matched: boolean, serial: string) {
  const { t } = room;
  const lit = (spot: string) => (matched && ticket.hit.includes(spot) ? 'is-match' : '');
  const prize = (won: TicketPrize) => html`<img src=${room.icon(won.prizeId)} alt=${room.name(won.prizeId)} />${room.award(won.tier, won.award)}`;
  return html`
    <div class="lk-tf-head">
      <h3><span>${t('scratch.forever.first')}</span><i>${t('scratch.forever.middle')}</i><span>${t('scratch.forever.second')}</span></h3>
    </div>
    <section class="lk-tf-game">
      <em class="lk-tf-tag">${t('scratch.game', { n: 1 })}</em>
      <div class="lk-tf-sea">
        <div>
          <h4>${t('scratch.winningNumbers')}</h4>
          <div class="lk-tf-boats">
            ${ticket.winningNumbers.map(
              (number, index) => html`
                <div class="lk-tf-boat ${lit(`w${index}`)}">
                  <b>${number}</b>
                  <canvas class="lk-foil" data-spot=${`w${index}`} data-cover="boat"></canvas>
                </div>
              `,
            )}
          </div>
        </div>
        <p class="lk-tf-jackpot"><b>∞</b>${t('scratch.forever.jackpot')}</p>
      </div>
      <h4>${t('scratch.yourNumbers')}</h4>
      <div class="lk-tf-beach">
        ${ticket.yours.map(
          (cell, index) => html`
            <div class="lk-tf-cell ${lit(`y${index}`)}">
              ${typeof cell.value === 'string'
                ? html`<img class="lk-tk-logo" src=${room.icon(cell.value)} alt=${room.name(cell.value)} />`
                : html`<b>${cell.value}</b>${cell.prize ? html`<small>${prize(cell.prize)}</small>` : ''}`}
              <canvas class="lk-foil" data-spot=${`y${index}`} data-cover="beach"></canvas>
            </div>
          `,
        )}
      </div>
    </section>
    <section class="lk-tf-game lk-tf-game--two">
      <em class="lk-tf-tag">${t('scratch.game', { n: 2 })}</em>
      <span>${t('scratch.forever.pairRule')}</span>
      <div class="lk-tf-flops">
        ${ticket.second.map(
          (won, index) => html`
            <div class="lk-tf-flop ${lit(`s${index}`)}">
              <b>${won ? prize(won) : '—'}</b>
              <canvas class="lk-foil" data-spot=${`s${index}`} data-cover="flipflop"></canvas>
            </div>
          `,
        )}
      </div>
    </section>
    <div class="lk-tf-foot"><span>N. ${serial}</span></div>
  `;
}
