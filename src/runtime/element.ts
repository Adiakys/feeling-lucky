import { consume } from '@lit/context';
import { LitElement } from 'lit';
import { state } from 'lit/decorators.js';
import { roomContext, type RoomContext } from './context';
import type { Signal } from './signal';

// Every element of the room renders into the room's shadow root, not into its own, so one stylesheet styles
// them all; the host takes no box of its own, so the markup lays out as written.
export class LuckyElement extends LitElement {
  @consume({ context: roomContext, subscribe: true })
  @state()
  protected room!: RoomContext;

  private timers = new Set<ReturnType<typeof setTimeout>>();
  private unsubscribes: (() => void)[] = [];
  private watched: Signal<unknown>[] = [];

  protected createRenderRoot() {
    return this;
  }

  protected t(key: string, params?: Record<string, string | number>) {
    return this.room.t(key, params);
  }

  // Re-renders whenever one of these signals changes, while connected.
  protected watch(...signals: Signal<unknown>[]) {
    this.watched.push(...signals);
    if (this.isConnected) this.unsubscribes.push(...signals.map((watched) => watched.subscribe(() => this.requestUpdate())));
  }

  // A delayed step of a play, cancelled when the element leaves, so a restarted game gets no stale step.
  protected later(callback: () => void, delay: number) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay);
    this.timers.add(timer);
    return timer;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'contents';
    this.unsubscribes = this.watched.map((watched) => watched.subscribe(() => this.requestUpdate()));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.unsubscribes.forEach((unsubscribe) => unsubscribe());
    this.unsubscribes = [];
  }
}
