import { resolveConfig } from './config/resolve';
import type { FeelingLucky, FeelingLuckyConfig, Variant } from './config/types';
import { loadLocale, pageLocale, watchPageLocale } from './runtime/i18n';
import type { Room } from './room/room';

export type * from './config/types';
export { en } from './locales';

// The single entry point: the room opens over the page on open(), in a shadow root of its own.
export function createFeelingLucky<V extends Variant = Variant>(initial: FeelingLuckyConfig<V>): FeelingLucky<V> {
  // The room only ever hands back the host's own variant objects, so its wins are Win<V>.
  let config = initial as unknown as FeelingLuckyConfig;
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
      void (async () => {
        const [resolved, { mountRoom }] = await Promise.all([resolveConfig(config), import('./room/mount')]);
        // The room opens already speaking its language; English stands in if it fails to load.
        await loadLocale(resolved.locale ?? pageLocale.value).catch(() => undefined);
        if (host !== opened) return;
        room = mountRoom(opened, resolved, origin);
        room.addEventListener('closed', remove);
      })().catch((error) => {
        if (host === opened) remove();
        console.error(error);
      });
    },
    close() {
      if (room) room.close();
      else remove();
    },
    update(partial) {
      config = { ...config, ...(partial as Partial<FeelingLuckyConfig>) };
      const current = room;
      if (current) void resolveConfig(config).then((resolved) => current === room && (current.config = resolved));
    },
    destroy() {
      remove();
    },
  };
}
