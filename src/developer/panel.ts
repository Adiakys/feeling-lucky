import { html, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { live } from 'lit/directives/live.js';
import { Check, ChevronRight, CodeXml, GripVertical, LockOpen, Minus, RotateCcw, X } from 'lucide';
import type { GameId, PrizeTier } from '../config/types';
import { awardKey, PRIZE_TIERS, type Award } from '../engine/awards';
import { PACHINKO_POCKETS } from '../engine/pachinko';
import { installRig, restartGame, rigChanged } from '../engine/rig';
import { THEMES, type Theme } from '../engine/themes';
import { GAME_IDS } from '../engine/tiers';
import { boosterKeys, wheelSegments } from '../engine/wheel';
import { LuckyElement } from '../runtime/element';
import { icon } from '../runtime/icons';
import { developerRig } from './rig';
import { ADVANCED, blankSettings, DECISIVE, parseAward, passwordMatches, RESULTS, room, settings, settingsOf, VARIANTS, type Field, type GameSettings } from './settings';

const STORAGE_KEY = 'feeling-lucky.developer';
const MARGIN = 8;
const SEGMENT_ORDER = ['small', 'big', 'coin', 'hunt', 'pachinko', 'jackpot'];

// Unlocked once for the page, as the rig stays installed: a room opened again needs no password.
let unlocked = false;

type Option = { value: string; label: string };

// The room renders it once the first Ctrl+Shift+L has loaded it; from then on the panel answers the shortcut itself.
@customElement('fl-developer')
export class Developer extends LuckyElement {
  @property({ attribute: false }) passwordHash?: string;

  @state() private open = true;
  @state() private unlocked = unlocked;
  @state() private password = '';
  @state() private wrong = false;
  @state() private minimized = false;
  @state() private position = { x: innerWidth - 416 - 16, y: 108 };
  @state() private selected: GameId = 'wheel';
  @state() private draft: GameSettings = blankSettings();
  // A loaded draft renders the game's fields anew: an option the user has picked ignores a new selected attribute.
  @state() private loads = 0;
  @state() private advancedOpen = false;

  @query('.lk-dev') private box?: HTMLElement;
  @query('.lk-dev [data-first]') private first?: HTMLInputElement | HTMLSelectElement;
  @query('.lk-dev-icon') private iconButton?: HTMLButtonElement;

  private drag: { offsetX: number; offsetY: number; startX: number; startY: number } | null = null;
  private dragged = false;
  private lastFocus: Element | null = null;

  constructor() {
    super();
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as { x: number; y: number; minimized: boolean } | null;
      if (stored) {
        this.position = { x: stored.x, y: stored.y };
        this.minimized = stored.minimized;
      }
    } catch {
      // Without storage the panel opens where it opens by default.
    }
    this.load(this.selected);
  }

  protected willUpdate() {
    room.prizes = this.room.prizes;
    if (!this.unlocked && this.passwordHash === undefined) this.grant();
  }

  private get activeElement() {
    return (this.getRootNode() as Document | ShadowRoot).activeElement;
  }

  private load(game: GameId) {
    this.draft = structuredClone(settingsOf(game));
    this.loads++;
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...this.position, minimized: this.minimized }));
    } catch {
      // The position is a convenience: losing it only reopens the panel at its default place.
    }
  }

  // Kept whole inside the window, whatever it is resized to.
  private place(x: number, y: number) {
    const width = this.box?.offsetWidth ?? 0;
    const height = this.box?.offsetHeight ?? 0;
    this.position = {
      x: Math.max(MARGIN, Math.min(innerWidth - width - MARGIN, x)),
      y: Math.max(MARGIN, Math.min(innerHeight - height - MARGIN, y)),
    };
  }

  private async focusFirst() {
    await this.updateComplete;
    this.place(this.position.x, this.position.y);
    (this.minimized && this.unlocked ? this.iconButton : this.first)?.focus();
  }

  private grab = (event: PointerEvent) => {
    if (event.button !== 0 || (!this.minimized && (event.target as Element).closest('button'))) return;
    const rect = this.box!.getBoundingClientRect();
    this.drag = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, startX: event.clientX, startY: event.clientY };
    this.dragged = false;
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
  };

  private move = (event: PointerEvent) => {
    if (!this.drag) return;
    if (!this.dragged && Math.hypot(event.clientX - this.drag.startX, event.clientY - this.drag.startY) < 4) return;
    this.dragged = true;
    this.place(event.clientX - this.drag.offsetX, event.clientY - this.drag.offsetY);
  };

  private release = () => {
    if (this.drag && this.dragged) this.save();
    this.drag = null;
  };

  private minimize(value: boolean) {
    this.minimized = value;
    this.save();
    void this.focusFirst();
  }

  private restore = () => {
    if (this.dragged) this.dragged = false;
    else this.minimize(false);
  };

  private grant() {
    installRig(developerRig);
    this.unlocked = unlocked = true;
  }

  private unlock = async (event: SubmitEvent) => {
    event.preventDefault();
    const password = this.password;
    this.password = '';
    this.wrong = !(await passwordMatches(password, this.passwordHash ?? ''));
    if (this.wrong) return;
    this.grant();
    void this.focusFirst();
  };

  private apply = () => {
    const advanced = Object.fromEntries(Object.entries(this.draft.advanced).filter(([, value]) => value !== undefined));
    const changed = this.draft.multiplier !== undefined || this.draft.variant !== undefined || this.draft.result !== 'automatic' || Object.keys(advanced).length;
    if (changed) settings[this.selected] = { ...this.draft, advanced };
    else delete settings[this.selected];
    restartGame(this.selected);
  };

  private reset = () => {
    for (const game of GAME_IDS) delete settings[game];
    this.load(this.selected);
    restartGame(this.selected);
  };

  private toggle = () => {
    this.open = !this.open;
    if (this.open) {
      this.lastFocus = this.activeElement;
      void this.focusFirst();
    } else if (this.lastFocus instanceof HTMLElement && this.lastFocus.isConnected) this.lastFocus.focus();
  };

  // The language applies at once too, over the configured and the page's one.
  private setLanguage(value: string) {
    room.locale = value || undefined;
    rigChanged.value++;
  }

  // The dealer at the Salon Privé's tables, over the day's shifts, comes or leaves at once.
  private setDealer(value: string) {
    room.dealer = value === '' ? undefined : value === 'none' ? 'none' : Number(value);
    rigChanged.value++;
    this.requestUpdate();
  }

  // The card tables switch between the server's shared ones and single player at once.
  private setTables(value: string) {
    room.singlePlayer = value === 'single' || undefined;
    rigChanged.value++;
    this.requestUpdate();
  }

  // The theme is no game's: it applies at once, so the room renders again.
  private setTheme(value: string) {
    room.theme = (value || undefined) as Theme | 'none' | undefined;
    rigChanged.value++;
    this.requestUpdate();
  }

  // Ctrl+Shift+L is caught before anything else in the room, so no game sees it.
  private shortcut = (event: KeyboardEvent) => {
    if (!(event.ctrlKey && event.shiftKey && event.code === 'KeyL')) return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) this.toggle();
  };

  // The panel keeps its keys to itself: neither a game nor the room's Escape reacts to typing here.
  private keydown = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === 'Escape') this.toggle();
  };

  private fit = () => this.place(this.position.x, this.position.y);

  connectedCallback() {
    super.connectedCallback();
    this.lastFocus = this.activeElement;
    addEventListener('keydown', this.shortcut, true);
    addEventListener('resize', this.fit);
  }

  firstUpdated() {
    void this.focusFirst();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    removeEventListener('keydown', this.shortcut, true);
    removeEventListener('resize', this.fit);
  }

  private awardLabel(tier: PrizeTier, award: Award) {
    return this.t('developer.option.award', { tier: this.t(`tier.${tier}`), award: this.room.award(tier, award) });
  }

  private segmentOption = (value: string): Option => {
    if (value === 'none') return { value, label: this.t('developer.option.nothing') };
    if (value === 'jackpot') return { value, label: this.t('developer.jackpot') };
    if (value === 'coin' || value === 'hunt' || value === 'pachinko') return { value, label: this.t(`wheel.segment.${value}`) };
    const { tier, award } = parseAward(value);
    return { value, label: this.awardLabel(tier, award) };
  };

  private options(field: Field): Option[] {
    const comesOut = (lands: string, misses: string) => [
      { value: 'hit', label: this.t(`developer.option.${lands}`) },
      { value: 'miss', label: this.t(`developer.option.${misses}`) },
    ];
    const segmentKeys = () =>
      boosterKeys(wheelSegments(this.room.board)).sort((a, b) => SEGMENT_ORDER.indexOf(a.split(':')[0]!) - SEGMENT_ORDER.indexOf(b.split(':')[0]!));
    switch (field) {
      case 'segment':
        return ['none', ...segmentKeys()].map(this.segmentOption);
      case 'booster':
        return segmentKeys().map(this.segmentOption);
      case 'prize':
        return this.room.prizes.map((prize) => ({ value: prize.id, label: prize.name }));
      case 'combination':
        return ['none', 'pair', 'logos', 'sevens', 'infinities'].map((value) => ({ value, label: this.t(`developer.option.${value}`) }));
      case 'number':
        return Array.from({ length: 37 }, (_, number) => ({ value: String(number), label: String(number) }));
      case 'storm':
        return comesOut('lands', 'misses');
      case 'violet':
        return comesOut('hit', 'miss');
      case 'pocket':
        return PACHINKO_POCKETS.map((_, index) => ({ value: String(index + 1), label: this.t('developer.option.pocket', { n: index + 1 }) }));
      case 'award':
        return PRIZE_TIERS.flatMap((tier) => this.room.board[tier].map((award) => ({ value: awardKey(tier, award), label: this.awardLabel(tier, award) })));
    }
  }

  private change<K extends keyof GameSettings>(key: K, value: GameSettings[K]) {
    this.draft = { ...this.draft, [key]: value };
  }

  private changeAdvanced(field: Field, value: string) {
    this.draft = { ...this.draft, advanced: { ...this.draft.advanced, [field]: value || undefined } };
  }

  private selectGame = (event: Event) => {
    this.selected = (event.target as HTMLSelectElement).value as GameId;
    this.load(this.selected);
  };

  // A select's options with an unset first one.
  private choices(options: Option[], chosen: string | undefined, unset: string) {
    return html`<option value="" ?selected=${chosen === undefined}>${unset}</option>
      ${options.map((option) => html`<option value=${option.value} ?selected=${option.value === chosen}>${option.label}</option>`)}`;
  }

  private renderBody() {
    if (!this.unlocked)
      return html`<form class="lk-dev-body" @submit=${this.unlock}>
        <label class="lk-dev-row">${this.t('developer.password')}
          <input
            data-first
            type="password"
            autocomplete="off"
            .value=${live(this.password)}
            aria-invalid=${this.wrong}
            aria-describedby=${this.wrong ? 'lk-dev-wrong' : nothing}
            @input=${(event: Event) => {
              this.password = (event.target as HTMLInputElement).value;
              this.wrong = false;
            }}
          />
        </label>
        ${this.wrong ? html`<p id="lk-dev-wrong" class="lk-dev-error" role="alert">${this.t('developer.wrongPassword')}</p>` : nothing}
        <footer>
          <button type="submit" class="is-primary" ?disabled=${!this.password}>${icon(LockOpen)}${this.t('developer.unlock')}</button>
        </footer>
      </form>`;

    const { selected, draft } = this;
    const decidedBy = ADVANCED[selected].find((field) => DECISIVE.includes(field) && draft.advanced[field] !== undefined);
    const variants = VARIANTS[selected];
    const value = (event: Event) => (event.target as HTMLSelectElement).value;
    return html`<div class="lk-dev-body">
      <p class="lk-dev-hint">${this.t('developer.hint')}</p>
      <label class="lk-dev-row">${this.t('developer.theme')}
        <select data-first @change=${(event: Event) => this.setTheme(value(event))}>
          ${this.choices(
            [{ value: 'none', label: this.t('developer.noTheme') }, ...THEMES.map((theme) => ({ value: theme, label: this.t(`themes.${theme}.name`) }))],
            room.theme,
            this.t('developer.calendar'),
          )}
        </select>
      </label>
      <label class="lk-dev-row">${this.t('developer.language')}
        <select @change=${(event: Event) => this.setLanguage(value(event))}>
          ${this.choices(
            this.room.locales.map((code) => ({ value: code, label: new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code })),
            room.locale,
            this.t('developer.autoLanguage'),
          )}
        </select>
      </label>
      ${this.room.multiplayer
        ? html`<label class="lk-dev-row">${this.t('developer.tables')}
            <select @change=${(event: Event) => this.setTables(value(event))}>
              ${this.choices([{ value: 'single', label: this.t('developer.singlePlayer') }], room.singlePlayer ? 'single' : undefined, this.t('developer.multiplayer'))}
            </select>
          </label>`
        : nothing}
      ${this.room.dealers.length
        ? html`<label class="lk-dev-row">${this.t('developer.dealer')}
            <select @change=${(event: Event) => this.setDealer(value(event))}>
              ${this.choices(
                [
                  { value: 'none', label: this.t('developer.dealerAbsent') },
                  ...this.room.dealers.map((dealer, index) => ({ value: String(index), label: dealer.name ?? this.t('developer.dealerNumber', { n: index + 1 }) })),
                ],
                room.dealer === undefined ? undefined : String(room.dealer),
                this.t('developer.dealerShifts'),
              )}
            </select>
          </label>`
        : nothing}
      <label class="lk-dev-row">${this.t('developer.game')}
        <select @change=${this.selectGame}>
          ${GAME_IDS.map((game) => html`<option value=${game} ?selected=${game === selected}>${this.t(`games.${game}.name`)}</option>`)}
        </select>
      </label>
      ${keyed(this.loads, html`<label class="lk-dev-row">${this.t('developer.multiplier')}
        <select @change=${(event: Event) => this.change('multiplier', Number(value(event)) || undefined)}>
          ${this.choices([1, 2, 3, 4, 5].map((multiplier) => ({ value: String(multiplier), label: `×${multiplier}` })), draft.multiplier?.toString(), this.t('developer.daily'))}
        </select>
      </label>
      ${variants
        ? html`<label class="lk-dev-row">${this.t(`developer.variant.${selected}`)}
            <select @change=${(event: Event) => this.change('variant', value(event) || undefined)}>
              ${this.choices(variants.map((variant) => ({ value: variant, label: this.t(`${selected}.names.${variant}`) })), draft.variant, this.t('developer.daily'))}
            </select>
          </label>`
        : nothing}
      <label class="lk-dev-row">${this.t('developer.result')}
        <select ?disabled=${!!decidedBy} @change=${(event: Event) => this.change('result', value(event) as GameSettings['result'])}>
          ${RESULTS.map((result) => html`<option value=${result} ?selected=${result === draft.result}>${this.t(`developer.${result}`)}</option>`)}
        </select>
      </label>
      ${decidedBy ? html`<p class="lk-dev-note">${this.t('developer.decidedBy', { field: this.t(`developer.field.${decidedBy}`) })}</p>` : nothing}

      <details
        class="lk-dev-advanced"
        ?open=${this.advancedOpen || ADVANCED[selected].some((field) => draft.advanced[field] !== undefined)}
        @toggle=${(event: Event) => (this.advancedOpen = (event.target as HTMLDetailsElement).open)}
      >
        <summary>${icon(ChevronRight)}${this.t('developer.advanced')}</summary>
        ${ADVANCED[selected].map(
          (field) => html`<label class="lk-dev-row">${this.t(`developer.field.${field}`)}
            <select @change=${(event: Event) => this.changeAdvanced(field, value(event))}>
              ${this.choices(this.options(field), draft.advanced[field], this.t('developer.automatic'))}
            </select>
          </label>`,
        )}
        <p class="lk-dev-note">${this.t(`developer.about.${selected}`)}</p>
      </details>`)}

      <footer>
        <button type="button" @click=${this.reset}>${icon(RotateCcw)}${this.t('developer.reset')}</button>
        <button type="button" class="is-primary" @click=${this.apply}>${icon(Check)}${this.t('developer.apply')}</button>
      </footer>
    </div>`;
  }

  render() {
    if (!this.open) return nothing;
    const iconOnly = this.unlocked && this.minimized;
    return html`<div class="lk-dev ${iconOnly ? 'is-icon' : ''}" style="left: ${this.position.x}px; top: ${this.position.y}px" @keydown=${this.keydown}>
      ${iconOnly
        ? html`<button
            type="button"
            class="lk-dev-icon"
            aria-label=${this.t('developer.restore')}
            title=${this.t('developer.restore')}
            @pointerdown=${this.grab}
            @pointermove=${this.move}
            @pointerup=${this.release}
            @pointercancel=${this.release}
            @click=${this.restore}
          >
            ${icon(CodeXml)}
          </button>`
        : html`<section class="lk-dev-panel" aria-label=${this.t('developer.title')}>
            <header @pointerdown=${this.grab} @pointermove=${this.move} @pointerup=${this.release} @pointercancel=${this.release}>
              ${icon(GripVertical, 'lk-dev-grip')}
              <strong>${icon(CodeXml)}${this.t('developer.title')}</strong>
              ${this.unlocked
                ? html`<button type="button" aria-label=${this.t('developer.minimize')} title=${this.t('developer.minimize')} @click=${() => this.minimize(true)}>
                    ${icon(Minus)}
                  </button>`
                : nothing}
              <button type="button" aria-label=${this.t('developer.close')} title=${this.t('developer.close')} @click=${this.toggle}>${icon(X)}</button>
            </header>
            ${this.renderBody()}
          </section>`}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fl-developer': Developer;
  }
}
