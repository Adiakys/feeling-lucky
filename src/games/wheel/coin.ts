import { html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { Coins } from 'lucide';
import type { Tier } from '../../config/types';
import { awardOf, variantsOf, type Award } from '../../engine/awards';
import { LuckyElement } from '../../runtime/element';
import { icon } from '../../runtime/icons';
import { reducedMotion, wait } from '../../runtime/motion';
import { sound } from '../../runtime/sound';

export type CoinFace = { tier: Tier; award: Award };

// Heads or Tails: one face carries the award already drawn, the other an award of the other tier. Fires `done`.
@customElement('fl-wheel-coin')
export class WheelCoin extends LuckyElement {
  @property({ attribute: false }) won!: CoinFace;
  @property({ attribute: false }) other!: CoinFace;
  @property({ attribute: false }) prizeId!: string;
  @state() private flipping = false;
  @query('.lk-coin') private coin?: HTMLElement;
  @query('.lk-coin-shadow') private shadow?: HTMLElement;
  private goldWins = Math.random() < 0.5;

  private async flip() {
    this.flipping = true;
    sound.play('whoosh');
    const end = 8 * 360 + (this.goldWins ? 0 : 180);
    const duration = reducedMotion() ? 1 : 1800;
    this.coin?.animate(
      [
        { transform: 'translateY(0) rotateX(0) scale(1)', easing: 'cubic-bezier(.15,.75,.35,1)' },
        { transform: `translateY(-150px) rotateX(${end * 0.55}deg) scale(1.25)`, offset: 0.45, easing: 'cubic-bezier(.6,0,.9,.5)' },
        { transform: `translateY(0) rotateX(${end - 12}deg) scale(1)`, offset: 0.9 },
        { transform: `translateY(0) rotateX(${end}deg) scale(1)` },
      ],
      { duration, fill: 'forwards' },
    );
    this.shadow?.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.45)', opacity: 0.25, offset: 0.45 }, { transform: 'scale(1)', opacity: 1 }], { duration });
    await wait(duration);
    sound.play('stop');
    sound.play('chime', 1.2);
    this.later(() => this.dispatchEvent(new CustomEvent('done')), reducedMotion() ? 0 : 800);
  }

  // The coin has room for the variant's full label.
  private label({ tier, award }: CoinFace) {
    const variant = tier === 'none' ? undefined : variantsOf(this.room.prize(this.prizeId), tier).find((candidate) => awardOf(candidate) === award);
    return variant?.label ?? this.room.award(tier, award);
  }

  render() {
    const [gold, ruby] = this.goldWins ? [this.won, this.other] : [this.other, this.won];
    return html`
      <div class="lk-bonus">
        <div class="lk-bonus-card">
          <h3>${this.t('wheel.segment.coin')}</h3>
          <p>${this.t('coin.text')}</p>
          <div class="lk-coin-stage">
            <div class="lk-coin-shadow"></div>
            <div class="lk-coin">
              <div class="lk-coin-face lk-coin-face--gold"><span>${this.label(gold)}<small>${this.t('coin.gold')}</small></span></div>
              <div class="lk-coin-face lk-coin-face--ruby"><span>${this.label(ruby)}<small>${this.t('coin.ruby')}</small></span></div>
            </div>
          </div>
          <button class="lk-btn lk-btn--primary lk-btn--lg" ?disabled=${this.flipping} @click=${this.flip}>${icon(Coins)}${this.t('coin.flip')}</button>
        </div>
      </div>
    `;
  }
}
