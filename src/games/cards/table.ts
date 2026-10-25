import { html, nothing, type TemplateResult } from 'lit';
import type { RoomContext } from '../../runtime/context';
import './dealer';

// The player's seat, on the middle of the table's edge, half over the rail.
const SEAT = 'left: 50%; top: 100%';

export const silhouette = html`<svg class="lk-seat-avatar" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="15" r="7" /><path d="M5 40c0-8.5 6.5-14 15-14s15 5.5 15 14Z" /></svg>`;

// A private-room card table: the dealer's hand on the straight edge, the player's seat on the rail, the other players'
// seats around it at a shared table. On shift, the dealer stands behind the table: on, the index of the one at the
// tables; dealing, while the cards come out. A shared table brings every seat, the player's too.
export function cardTable(
  room: RoomContext,
  print: string,
  { dealer, centre, bet, player, seats }: { dealer: TemplateResult; centre: TemplateResult; bet?: TemplateResult; player: TemplateResult; seats?: TemplateResult },
  { on, dealing }: { on: number | null; dealing: boolean },
) {
  const { t } = room;
  const me = room.player;
  return html`
    <div class="lk-ctable ${on !== null && room.dealers[on] ? 'has-dealer' : ''}">
      <div class="lk-dealer"><fl-dealer .dealer=${on} ?dealing=${dealing}></fl-dealer></div>
      <div class="lk-ctable-felt">
        <i class="lk-ctable-rail" aria-hidden="true"></i>
        <i class="lk-ctable-cloth" aria-hidden="true"></i>
        <i class="lk-ctable-notch" aria-hidden="true"></i>
        <svg class="lk-ctable-print" viewBox="0 0 900 500" aria-hidden="true">
          <path id="lk-ctable-arc" d="M150 170Q450 330 750 170" fill="none" />
          <text><textPath href="#lk-ctable-arc" startOffset="50%" text-anchor="middle">${print}</textPath></text>
        </svg>
        <i class="lk-ctable-shoe" aria-hidden="true"><b></b><b></b><b></b></i>
        <div class="lk-ctable-dealer">${dealer}</div>
        <div class="lk-ctable-centre">${centre}</div>
        ${seats ??
        html`<div class="lk-seat is-mine" style=${SEAT}>
          ${me?.avatar ? html`<img src=${me.avatar} alt="" />` : silhouette}
          <b>${me?.name || t('cards.you')}</b>
        </div>`}
        ${bet ? html`<div class="lk-ctable-bet">${bet}</div>` : nothing}
        <div class="lk-ctable-player">${player}</div>
      </div>
    </div>
  `;
}
