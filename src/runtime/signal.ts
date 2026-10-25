// A value elements re-render on: whoever sets it notifies every subscriber.
export interface Signal<T> {
  value: T;
  subscribe(listener: () => void): () => void;
  notify(): void;
}

export function signal<T>(initial: T): Signal<T> {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get value() {
      return current;
    },
    set value(next: T) {
      if (Object.is(next, current)) return;
      current = next;
      this.notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notify() {
      listeners.forEach((listener) => listener());
    },
  };
}
