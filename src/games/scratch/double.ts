import { html, nothing } from 'lit';
import type { NumbersTicket } from '../../engine/scratch';
import type { RoomContext } from '../../runtime/context';

// Double Luck: winning numbers on coins, yours over a bundle of banknotes.
export function ticketDouble(room: RoomContext, ticket: NumbersTicket, matched: boolean, serial: string) {
  const { t } = room;
  const lit = (spot: string) => (matched && ticket.hit.includes(spot) ? 'is-match' : '');
  return html`
    <div class="lk-td-head">
      <h3 aria-label=${`${t('scratch.double.first')} ${t('scratch.double.second')}`}>
        <span>${t('scratch.double.first')}</span>
        <svg viewBox="0 0 60 72" aria-hidden="true">
          <g fill="#f6c9a2" stroke="#9c6640" stroke-width="1.6">
            <rect x="14" y="4" width="12" height="40" rx="6" transform="rotate(-16 20 42)" />
            <rect x="30" y="2" width="12" height="42" rx="6" transform="rotate(13 36 42)" />
            <rect x="12" y="34" width="36" height="32" rx="12" />
            <path d="M41 36c5 0 7 3 7 7M43 46c4 0 5 3 5 6" fill="none" />
            <path d="M10 46c4-6 14-6 20 0c-4 5-14 6-20 0z" />
          </g>
          <path d="M14 66h32v6H14z" fill="#2b5bb8" />
        </svg>
        <span>${t('scratch.double.second')}</span>
      </h3>
      <p>${t('scratch.double.tagline')}</p>
    </div>
    <section class="lk-td-band">
      <h4>${t('scratch.winningNumbers')}</h4>
      <div class="lk-td-coins">
        ${ticket.winningNumbers.map(
          (number, index) => html`
            <div class="lk-td-coin ${lit(`w${index}`)}">
              <b>${number}</b>
              <canvas class="lk-foil" data-spot=${`w${index}`} data-cover="coin"></canvas>
            </div>
          `,
        )}
      </div>
    </section>
    <section class="lk-td-yours">
      <h4>${t('scratch.yourNumbers')}</h4>
      <div class="lk-td-grid">
        ${ticket.yours.map(
          (cell, index) => html`
            <div class="lk-td-cell ${lit(`y${index}`)}">
              ${typeof cell.value === 'string'
                ? html`<img class="lk-tk-logo" src=${room.icon(cell.value)} alt=${room.name(cell.value)} />`
                : html`
                    <b>${cell.value}</b>
                    ${cell.prize
                      ? html`<small>
                          ${t('scratch.prize')}
                          <strong><img src=${room.icon(cell.prize.prizeId)} alt=${room.name(cell.prize.prizeId)} />${room.award(cell.prize.tier, cell.prize.award)}</strong>
                        </small>`
                      : nothing}
                  `}
              <canvas class="lk-foil" data-spot=${`y${index}`} data-cover="bundle"></canvas>
            </div>
          `,
        )}
      </div>
    </section>
    <div class="lk-td-foot">
      <strong>${t('scratch.topPrize')}</strong>
      <span>N. ${serial}</span>
    </div>
  `;
}
