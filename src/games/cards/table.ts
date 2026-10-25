import { html, nothing, type TemplateResult } from 'lit';
import type { RoomContext } from '../../runtime/context';

// The player's seat, on the middle of the table's edge, half over the rail.
const SEAT = 'left: 50%; top: 100%';

const silhouette = html`<svg class="lk-seat-avatar" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="15" r="7" /><path d="M5 40c0-8.5 6.5-14 15-14s15 5.5 15 14Z" /></svg>`;

// A private-room card table: the dealer on the straight edge, the player's seat on the rail.
export function cardTable(
  room: RoomContext,
  print: string,
  { dealer, centre, bet, player }: { dealer: TemplateResult; centre: TemplateResult; bet?: TemplateResult; player: TemplateResult },
) {
  const { t } = room;
  const me = room.player;
  return html`
    <div class="lk-ctable">
      <div class="lk-ctable-felt">
        <svg class="lk-ctable-print" viewBox="0 0 900 500" aria-hidden="true">
          <path id="lk-ctable-arc" d="M150 170Q450 330 750 170" fill="none" />
          <text><textPath href="#lk-ctable-arc" startOffset="50%" text-anchor="middle">${print}</textPath></text>
        </svg>
        <i class="lk-ctable-shoe" aria-hidden="true"><b></b><b></b><b></b></i>
        <div class="lk-ctable-dealer">${dealer}</div>
        <div class="lk-ctable-centre">${centre}</div>
        <div class="lk-seat is-mine" style=${SEAT}>
          ${me?.avatar ? html`<img src=${me.avatar} alt="" />` : silhouette}
          <b>${me?.name || t('cards.you')}</b>
        </div>
        ${bet ? html`<div class="lk-ctable-bet">${bet}</div>` : nothing}
        <div class="lk-ctable-player">${player}</div>
      </div>
    </div>
  `;
}
