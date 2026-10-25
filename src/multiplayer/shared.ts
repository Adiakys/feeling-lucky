import { property, query, state } from 'lit/decorators.js';
import type { Outcome } from '../engine/outcome';
import type { GameOptions } from '../runtime/context';
import { onDuty } from '../engine/dealer';
import { LuckyElement } from '../runtime/element';
import { fx, SPARKS } from '../runtime/fx';
import { reducedMotion } from '../runtime/motion';
import { sound } from '../runtime/sound';
import { sharedTable, type SharedGame, type SharedSeat, type SharedTable, type TableView } from './client';

const dealt = (view: TableView) =>
  view.dealer.length + view.seats.reduce((sum, seat) => sum + (seat?.hands.reduce((cards, hand) => cards + hand.cards.length, 0) ?? 0), 0);
const shown = (view: TableView) =>
  [...view.dealer, ...view.board, ...view.seats.flatMap((seat) => seat?.hands.flatMap((hand) => hand.cards) ?? [])].filter(Boolean).length;

// A card table shared through the host's server: it shows the table as the server deals it and sends the player's
// moves. The server's boost is the table's, a dealer on shift included; which dealer stands there, or one the
// developer menu calls, is the room's to show. The player watches from the rail until taking a seat. Without the server the single-player game takes its
// place.
export abstract class SharedTableElement extends LuckyElement {
  @property({ attribute: false }) options: GameOptions = {};

  @state() protected view: TableView | null = null;
  @state() protected offline = false;
  @state() protected clearing = false;

  @query('.lk-cards') private felt?: HTMLElement;

  protected abstract readonly game: SharedGame;
  protected table!: SharedTable;
  private stop = new AbortController();
  private next: TableView | null = null;
  private ticker = 0;
  private finished = -1;

  constructor() {
    super();
    this.watch(onDuty);
  }

  protected get mine(): SharedSeat | null {
    return this.view?.you == null ? null : (this.view.seats[this.view.you] ?? null);
  }

  // A free seat takes the player from the rail, or moves them between hands, before they bet.
  protected get canSit() {
    return !this.mine || (this.view?.phase === 'betting' && !this.mine.ready);
  }

  protected sit = (seat: number) => {
    if (this.canSit) void this.table.sit(seat, this.room.player);
  };

  // Standing up takes the player back to the rail, between hands, before they bet.
  protected get canStand() {
    return !!this.mine && this.view?.phase === 'betting' && !this.mine.ready;
  }

  protected stand = () => {
    if (this.canStand) void this.table.stand();
  };

  connectedCallback() {
    super.connectedCallback();
    this.table = sharedTable(this.room.multiplayer!, this.game);
    this.stop = new AbortController();
    this.table.listen((view) => this.receive(view), this.stop.signal).catch(() => (this.offline = true));
    // The countdowns tick on their own between the server's views.
    this.ticker = window.setInterval(() => this.view?.deadline && this.requestUpdate(), 250);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stop.abort();
    clearInterval(this.ticker);
  }

  protected act(action: string, details?: { prize?: string; chips?: number }) {
    void this.table.act(action, details);
  }

  // A finished hand stays on the felt a moment, then the dealer sweeps the cards away before the next one shows.
  private receive(view: TableView) {
    if (this.clearing) {
      this.next = view;
      return;
    }
    if (this.view?.phase === 'done' && view.phase === 'betting') {
      this.clearing = true;
      this.next = view;
      sound.play('whoosh', 0.4);
      this.later(
        () => {
          this.clearing = false;
          if (this.next) this.show(this.next);
          this.next = null;
        },
        reducedMotion() ? 0 : 650,
      );
      return;
    }
    this.show(view);
  }

  private show(view: TableView) {
    const previous = this.view;
    this.view = view;
    if (previous && view.phase === 'dealing' && previous.phase === 'betting') sound.play('whoosh', 0.6);
    if (previous && dealt(view) > dealt(previous)) sound.play('tick', 1.25);
    else if (previous && shown(view) > shown(previous)) sound.play('tick', 1.1);
    this.betting(previous, view);
    const mine = this.mine;
    if (!mine?.result || this.finished === view.round) return;
    this.finished = view.round;
    if (!mine.tier || mine.tier === 'none') {
      sound.play('stop', 0.7);
      return;
    }
    const outcome = this.outcome(mine);
    sound.play(outcome.tier === 'jackpot' ? 'jackpot' : 'win');
    const rect = this.felt?.getBoundingClientRect();
    if (rect && !reducedMotion())
      fx.burst(rect.left + rect.width / 2, rect.top + rect.height * 0.55, { count: 50, type: 'spark', speed: 640, life: 0.8, gravity: 300, colors: SPARKS });
    this.later(() => this.room.finish(outcome), reducedMotion() ? 300 : 1700);
  }

  // A new view during the betting, for the game's own bet.
  protected betting(_previous: TableView | null, _view: TableView) {}

  // The win of the player's seat, for the certificate.
  protected abstract outcome(mine: SharedSeat): Outcome;
}
