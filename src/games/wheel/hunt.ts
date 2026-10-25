import { html, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { Sparkles } from 'lucide';
import type { PrizeTier } from '../../config/types';
import type { Award } from '../../engine/awards';
import { pick } from '../../engine/random';
import { LuckyElement } from '../../runtime/element';
import { icon } from '../../runtime/icons';
import { reducedMotion, wait } from '../../runtime/motion';
import { sound } from '../../runtime/sound';

type Tile = { tier: PrizeTier; award: Award; open: boolean };

// Prize Hunt: the tile picked shows the award already drawn, the others what was missed. Fires `done`.
@customElement('fl-wheel-hunt')
export class WheelHunt extends LuckyElement {
  @property({ attribute: false }) won!: { tier: PrizeTier; award: Award };
  @state() private tiles: Tile[] = [];
  @state() private picked: number | null = null;

  protected willUpdate(changed: PropertyValues<this>) {
    super.willUpdate(changed);
    if (this.tiles.length) return;
    const { small, big } = this.room.board;
    const awards = [...[...small, ...small].map((award) => ({ tier: 'small' as PrizeTier, award })), ...big.map((award) => ({ tier: 'big' as PrizeTier, award }))];
    this.tiles = Array.from({ length: 18 }, () => ({ ...pick(awards), open: false }));
  }

  private async choose(index: number) {
    if (this.picked !== null) return;
    this.picked = index;
    this.tiles = this.tiles.map((tile, at) => (at === index ? { ...this.won, open: true } : tile));
    sound.play('tick', 1.3);
    await wait(reducedMotion() ? 0 : 700);
    sound.play('chime');
    this.tiles.forEach((_, other) => this.later(() => (this.tiles = this.tiles.map((tile, at) => (at === other ? { ...tile, open: true } : tile))), reducedMotion() ? 0 : other * 35));
    this.later(() => this.dispatchEvent(new CustomEvent('done')), reducedMotion() ? 0 : 1600);
  }

  render() {
    return html`
      <div class="lk-bonus">
        <div class="lk-bonus-card">
          <h3>${this.t('wheel.segment.hunt')}</h3>
          <p>${this.t('hunt.text')}</p>
          <div class="lk-hunt">
            ${this.tiles.map(
              (tile, index) => html`
                <button class=${tile.open ? 'is-open' : ''} aria-label=${this.t('hunt.tile', { n: index + 1 })} @click=${() => this.choose(index)}>
                  <span class="lk-face">${icon(Sparkles)}</span>
                  <span class="lk-back ${this.picked === index ? 'is-pick' : ''}">${this.room.award(tile.tier, tile.award)}</span>
                </button>
              `,
            )}
          </div>
        </div>
      </div>
    `;
  }
}
