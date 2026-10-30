import type { FeelingLuckyConfig, Resolvable } from './types';
import type { RoomConfig } from '../room/room';

export const resolve = async <T>(value: Resolvable<T>): Promise<T> => (typeof value === 'function' ? (value as () => T | Promise<T>)() : value);

export async function resolveConfig(config: FeelingLuckyConfig): Promise<RoomConfig> {
  const [prizes, locale, messages, player, developer, logo, dealers, multiplayer, odds] = await Promise.all([
    resolve(config.prizes),
    config.locale === undefined ? undefined : resolve(config.locale),
    config.messages === undefined ? {} : resolve(config.messages),
    config.player === undefined ? null : resolve(config.player),
    config.developer === undefined ? false : resolve(config.developer),
    config.logo === undefined ? undefined : resolve(config.logo),
    config.dealers === undefined ? undefined : resolve(config.dealers),
    config.multiplayer === undefined ? undefined : resolve(config.multiplayer),
    config.odds === undefined ? undefined : resolve(config.odds),
  ]);
  if (!prizes.length) throw new Error('feeling-lucky: at least one prize is needed');
  return {
    prizes,
    locale,
    messages,
    player,
    logo,
    dealers,
    developer: developer === false ? null : { passwordHash: developer === true ? undefined : developer.passwordHash },
    multiplayer: typeof multiplayer === 'string' ? { url: multiplayer } : multiplayer,
    odds,
    onWin: config.onWin,
    onClaim: config.onClaim,
  };
}
