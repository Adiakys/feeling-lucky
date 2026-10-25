import { resolve } from '../config/resolve';
import type { Multiplayer, Player, Tier } from '../config/types';
import type { Card } from '../engine/cards';

export type SharedGame = 'blackjack' | 'holdem';

// The table as the server shows it to one seat: null cards are face down.
export interface TableView {
  game: SharedGame;
  round: number;
  phase: 'betting' | 'dealing' | 'acting' | 'dealer' | 'done';
  // Unix ms: the end of the betting countdown or of the time to act.
  deadline: number | null;
  // The table's boost, a dealer on shift included.
  boost: number;
  // The viewer's seat; null while watching from the rail.
  you: number | null;
  dealer: (Card | null)[];
  board: (Card | null)[];
  seats: (SharedSeat | null)[];
}

export interface SharedHand {
  cards: (Card | null)[];
  stacks: number;
  done: boolean;
}

export interface SharedSeat {
  name: string | null;
  avatar: string | null;
  ready: boolean;
  playing: boolean;
  prize: string | null;
  chips: number;
  hands: SharedHand[];
  active: number;
  folded: boolean;
  decided: boolean;
  result: string | null;
  tier: Tier | null;
}

const RETRIES = 3;

export async function* events(body: ReadableStream<Uint8Array>): AsyncGenerator<TableView> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, '\n');
    for (let end = buffer.indexOf('\n\n'); end >= 0; end = buffer.indexOf('\n\n')) {
      const data = buffer
        .slice(0, end)
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(line.startsWith('data: ') ? 6 : 5))
        .join('\n');
      buffer = buffer.slice(end + 2);
      if (data) yield JSON.parse(data) as TableView;
    }
  }
}

const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((done) => {
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', () => (clearTimeout(timer), done()), { once: true });
  });

// One of the server's tables, watched from the rail until the player sits. The seat's token is kept in the browser,
// so every tab of the player takes the same seat, and a tab follows when another one sits or moves.
export class SharedTable {
  private memory: string | null = null;
  private connections = new Set<AbortController>();

  constructor(
    public server: Multiplayer,
    readonly game: SharedGame,
  ) {}

  private get key() {
    return `feeling-lucky:${this.server.url}:${this.game}`;
  }

  private get token() {
    try {
      return localStorage.getItem(this.key);
    } catch {
      return this.memory;
    }
  }

  private set token(token: string | null) {
    this.memory = token;
    try {
      if (token) localStorage.setItem(this.key, token);
      else localStorage.removeItem(this.key);
    } catch {
      // Storage off: the seat lasts as long as this page.
    }
  }

  private async request(path: string, init: RequestInit = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.server.headers ? await resolve(this.server.headers) : {}),
      ...(init.headers as Record<string, string>),
    };
    return fetch(`${this.server.url.replace(/\/$/, '')}/${this.game}${path}`, { ...init, headers });
  }

  private reconnect() {
    this.connections.forEach((connection) => connection.abort());
  }

  // Every view of the table until aborted, the seat's or a spectator's. A dropped stream reconnects, a lost seat goes
  // back to the rail; it gives up after a few failures in a row.
  async listen(onView: (view: TableView) => void, signal: AbortSignal) {
    const followTabs = (event: StorageEvent) => event.key === this.key && this.reconnect();
    addEventListener('storage', followTabs);
    try {
      for (let failures = 0; !signal.aborted; await pause(1000 * failures, signal)) {
        const connection = new AbortController();
        this.connections.add(connection);
        try {
          const token = this.token;
          const response = await this.request('', { headers: token ? { 'X-Seat-Token': token } : {}, signal: AbortSignal.any([signal, connection.signal]) });
          if (response.status === 404 && token) {
            this.token = null;
            continue;
          }
          if (!response.ok || !response.body) throw new Error(`feeling-lucky: the ${this.game} table did not answer (${response.status})`);
          failures = 0;
          for await (const view of events(response.body)) onView(view);
        } catch (error) {
          if (signal.aborted || connection.signal.aborted) continue;
          if (++failures > RETRIES) throw error;
        } finally {
          this.connections.delete(connection);
        }
      }
    } finally {
      removeEventListener('storage', followTabs);
    }
  }

  // Takes a free seat, leaving the one the player had.
  async sit(seat: number, player: Player | null) {
    await this.leave();
    const response = await this.request('/seats', {
      method: 'POST',
      body: JSON.stringify({ seat, name: player?.name ?? null, avatar: player?.avatar ?? null }),
    });
    this.token = response.ok ? ((await response.json()) as { token: string }).token : null;
    this.reconnect();
  }

  async stand() {
    await this.leave();
    this.reconnect();
  }

  private async leave() {
    const token = this.token;
    this.token = null;
    if (token) await this.request('/seats', { method: 'DELETE', headers: { 'X-Seat-Token': token } }).catch(() => undefined);
  }

  async act(action: string, details: { prize?: string; chips?: number } = {}) {
    const token = this.token;
    if (!token) return false;
    const response = await this.request('/actions', { method: 'POST', headers: { 'X-Seat-Token': token }, body: JSON.stringify({ action, ...details }) });
    return response.ok;
  }
}

const tables = new Map<string, SharedTable>();

export function sharedTable(server: Multiplayer, game: SharedGame) {
  const key = `${server.url} ${game}`;
  const table = tables.get(key) ?? new SharedTable(server, game);
  tables.set(key, table);
  table.server = server;
  return table;
}
