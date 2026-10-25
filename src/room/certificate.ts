import { html, nothing, svg } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { Check, CircleDashed, Clover, Gift, LayoutGrid, LoaderCircle, RotateCcw } from 'lucide';
import type { Win } from '../config/types';
import type { Outcome } from '../engine/outcome';
import { roomTheme, THEME_COLORS } from '../engine/themes';
import { fx, guilloche, SPARKS } from '../runtime/fx';
import { LuckyElement } from '../runtime/element';
import { icon } from '../runtime/icons';
import { reducedMotion, wait } from '../runtime/motion';
import { sound } from '../runtime/sound';

const lines = guilloche(470, 110, 0.9);

// The prize the play won, as a certificate. With onClaim, the player claims it from here; the host does the rest.
// Fires `again` and `lobby`.
@customElement('fl-certificate')
export class Certificate extends LuckyElement {
  @property({ attribute: false }) outcome!: Outcome;
  @property({ attribute: false }) win!: Win;
  @property({ attribute: false }) claim?: (win: Win) => Promise<void>;

  @state() private stage: 'printing' | 'revealed' | 'stamped' = 'printing';
  // At Christmas the prize comes out of a gift box: wrapped, then opened.
  @state() private gift: 'wrapped' | 'open' | null = roomTheme() === 'christmas' && !reducedMotion() ? 'wrapped' : null;
  @state() private rising = false;
  @state() private claiming = false;
  @state() private claimed = false;
  @state() private error: string | null = null;

  @query('.lk-seal') private seal?: HTMLElement;
  @query('.lk-gift-lid') private lid?: HTMLElement;

  private get jackpot() {
    return this.outcome.tier === 'jackpot';
  }

  private stamp() {
    this.stage = 'stamped';
    sound.play('stamp');
    const rect = this.seal?.getBoundingClientRect();
    if (rect) fx.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, { count: 26, type: 'spark', speed: 620, life: 0.6, gravity: 200, colors: SPARKS });
  }

  private async unwrap() {
    await wait(1300);
    this.gift = 'open';
    this.rising = true;
    sound.play('chime', 1.2);
    await this.updateComplete;
    const rect = this.lid?.getBoundingClientRect();
    if (rect) fx.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, { count: 70, speed: 760, life: 1.6, colors: THEME_COLORS.christmas.confetti });
    await wait(1400);
    this.rising = false;
  }

  private async onClaim() {
    this.error = null;
    this.claiming = true;
    try {
      await this.claim!(this.win);
      this.claimed = true;
      sound.play('chime', 1.2);
      requestAnimationFrame(() => this.stamp());
    } catch (caught) {
      this.error = caught instanceof Error && caught.message ? caught.message : this.t('cert.claimFailed');
    } finally {
      this.claiming = false;
    }
  }

  async firstUpdated() {
    if (this.gift) await this.unwrap();
    else {
      sound.play('whoosh');
      await wait(reducedMotion() ? 0 : 750);
    }
    this.stage = 'revealed';
    await wait(reducedMotion() ? 0 : 900);
    this.stamp();
    if (this.jackpot) {
      fx.fountain(2200);
      fx.cannons(900);
    }
  }

  render() {
    const { room, outcome, win } = this;
    const gameName = this.t(`games.${outcome.game}.name`);
    const rows = [
      { label: this.t('cert.prize'), value: win.prize.name },
      { label: this.t('cert.variant'), value: win.variant?.label ?? this.t('cert.fullPrize') },
      ...(win.variant?.details ?? []),
      { label: this.t('cert.wonOn'), value: new Date().toLocaleDateString(room.locale, { day: '2-digit', month: 'short', year: 'numeric' }) },
    ];
    return html`
      <div class="lk-cert-layer" role="dialog" aria-modal="true" aria-label=${this.t('cert.title')}>
        ${this.jackpot ? html`<div class="lk-rays"><i></i><i></i></div>` : nothing}
        ${this.gift
          ? html`<div class="lk-gift-lid is-${this.gift}" aria-hidden="true"></div><div class="lk-gift-box is-${this.gift}" aria-hidden="true"></div>`
          : nothing}
        ${this.gift === 'wrapped'
          ? nothing
          : html`
              <article
                class="lk-cert ${this.rising ? 'is-rising' : ''} ${this.stage === 'printing' ? 'is-printing' : 'is-revealed'} ${this.stage === 'stamped' ? 'is-stamped' : ''} ${this.claimed ? 'is-issued' : ''}"
              >
                <svg viewBox="0 0 600 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                  ${lines.map((points) => svg`<polyline points=${points} fill="none" stroke="#b08a3a" stroke-opacity="0.18" stroke-width="0.5" />`)}
                </svg>
                <div class="lk-cert-head">
                  ${room.logo('lk-cert-logo')}
                  ${this.claim
                    ? html`<span class="lk-badge ${this.claimed ? 'is-success' : ''}">${icon(this.claimed ? Check : CircleDashed)}${this.t(this.claimed ? 'cert.claimed' : 'cert.notClaimed')}</span>`
                    : nothing}
                  <span class="lk-badge lk-badge--from">${icon(Clover)}${gameName} · ${this.t(outcome.detail.key, outcome.detail.params)}</span>
                </div>
                <div class="lk-cert-product">
                  <img src=${room.icon(win.prize.id)} alt="" />
                  <div>
                    <h2>${win.prize.name}${this.jackpot ? html`<span class="lk-jackpot-tag">JACKPOT</span>` : nothing}</h2>
                    <p>${this.t(`tier.${outcome.tier}`)} · ${win.variant?.label ?? this.t('cert.fullPrize')}</p>
                  </div>
                </div>
                <div class="lk-seal" aria-hidden="true">
                  <div class="lk-seal-ring"></div>
                  <div class="lk-seal-holo"></div>
                  <svg viewBox="-52 -52 104 104">
                    <circle r="34" fill="#faf3e3" />
                    <circle r="34" fill="none" stroke="#8a6420" stroke-opacity=".5" stroke-dasharray="1.5 3" />
                    <path id="lk-seal-path" d="M-26 0a26 26 0 1 1 52 0a26 26 0 1 1 -52 0" fill="none" />
                    <text font-size="7.5" font-weight="700" fill="#6e5a3a" letter-spacing="1.6"><textPath href="#lk-seal-path">${this.t(this.claimed ? 'cert.sealClaimed' : 'cert.seal')}</textPath></text>
                    <foreignObject class="lk-seal-logo" x="-12" y="-14" width="24" height="28">${room.logo()}</foreignObject>
                  </svg>
                </div>
                <div class="lk-info">
                  ${rows.map(
                    (row, index) => html`<div class="lk-info-row" style="--i: ${index}"><span>${row.label}</span><b>${row.value}</b></div>`,
                  )}
                </div>
                ${this.error ? html`<p class="lk-note" role="alert">${this.error}</p>` : nothing}
                <div class="lk-actions">
                  ${this.claim && !this.claimed
                    ? html`<button class="lk-btn lk-btn--primary" ?disabled=${this.claiming} @click=${this.onClaim}>
                        ${icon(this.claiming ? LoaderCircle : Gift, this.claiming ? 'lk-spinning' : '')}${this.t(this.claiming ? 'cert.claiming' : 'cert.claim')}
                      </button>`
                    : nothing}
                  <button class="lk-btn ${this.claim && !this.claimed ? 'lk-btn--outline' : 'lk-btn--primary'}" @click=${() => this.dispatchEvent(new Event('again'))}>
                    ${icon(RotateCcw)}${this.t('cert.again', { game: gameName })}
                  </button>
                  <button class="lk-btn lk-btn--outline" @click=${() => this.dispatchEvent(new Event('lobby'))}>${icon(LayoutGrid)}${this.t('cert.otherGame')}</button>
                </div>
              </article>
            `}
      </div>
    `;
  }
}
