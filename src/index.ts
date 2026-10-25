import { resolveConfig } from './config/resolve';
import type { FeelingLucky, FeelingLuckyConfig } from './config/types';
import { watchPageLocale } from './runtime/i18n';
import type { Room } from './room/room';

export type * from './config/types';
export { BUILT_IN as locales, en, it, es, fr, de } from './locales';

// The single entry point: the room opens over the page on open(), in a shadow root of its own.
export function createFeelingLucky(initial: FeelingLuckyConfig): FeelingLucky {
  let config = initial;
  let host: HTMLElement | null = null;
  let room: Room | null = null;

  const remove = () => {
    host?.remove();
    host = null;
    room = null;
  };

  return {
    open({ from } = {}) {
      if (host) return;
      watchPageLocale();
      const rect = from instanceof Element ? from.getBoundingClientRect() : null;
      const origin = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : (from as { x: number; y: number } | undefined);
      host = document.body.appendChild(document.createElement('feeling-lucky'));
      const opened = host;
      void Promise.all([resolveConfig(config), import('./room/mount')]).then(([resolved, { mountRoom }]) => {
        if (host !== opened) return;
        room = mountRoom(opened, resolved, origin);
        room.addEventListener('closed', remove);
      }, (error) => {
        remove();
        console.error(error);
      });
    },
    close() {
      if (room) room.close();
      else remove();
    },
    update(partial) {
      config = { ...config, ...partial };
      const current = room;
      if (current) void resolveConfig(config).then((resolved) => current === room && (current.config = resolved));
    },
    destroy() {
      remove();
    },
  };
}
