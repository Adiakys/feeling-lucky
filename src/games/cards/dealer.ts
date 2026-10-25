import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LuckyElement } from '../../runtime/element';
import { sound } from '../../runtime/sound';

// The default cut of a portrait's forearms and hands, over the table's rim.
const HANDS = 'polygon(0 70%, 30% 80%, 36% 84%, 64% 84%, 70% 80%, 100% 70%, 100% 100%, 0 100%)';

// The dealer at a card table, standing behind it in its notch. The portrait is drawn twice: behind the felt, and over
// it cut down to the forearms and hands, so they rest on the rim. She stays drawn once she has come, so she can leave
// as she came; while she deals, she leans in.
@customElement('fl-dealer')
export class DealerPortrait extends LuckyElement {
  // The dealer at the tables, by index in the host's list; null when none is.
  @property({ attribute: false }) dealer: number | null = null;
  @property({ type: Boolean }) dealing = false;

  private last: number | null = null;

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('dealer') && this.dealer !== null && changed.get('dealer') == null) sound.play('dealer');
  }

  render() {
    if (this.dealer !== null) this.last = this.dealer;
    const portrait = this.last === null ? undefined : this.room.dealers[this.last];
    if (!portrait) return nothing;
    const classes = `lk-dealer-photo ${this.dealer !== null ? 'is-shown' : ''} ${this.dealing ? 'is-dealing' : ''}`;
    return html`
      <img class=${classes} src=${portrait.image} alt=${portrait.name ?? this.t('cards.dealer')} />
      <img class="${classes} is-hands" style="clip-path: ${portrait.hands ?? HANDS}" src=${portrait.image} alt="" aria-hidden="true" />
    `;
  }
}
