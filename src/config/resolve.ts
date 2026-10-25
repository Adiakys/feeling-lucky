import type { FeelingLuckyConfig, Resolvable } from './types';
import type { RoomConfig } from '../room/room';

export const resolve = async <T>(value: Resolvable<T>): Promise<T> => (typeof value === 'function' ? (value as () => T | Promise<T>)() : value);

export async function resolveConfig(config: FeelingLuckyConfig): Promise<RoomConfig> {
  const [prizes, locale, messages, player, developer, logo] = await Promise.all([
    resolve(config.prizes),
    config.locale === undefined ? undefined : resolve(config.locale),
    config.messages === undefined ? {} : resolve(config.messages),
    config.player === undefined ? null : resolve(config.player),
    config.developer === undefined ? false : resolve(config.developer),
    config.logo === undefined ? undefined : resolve(config.logo),
  ]);
  if (!prizes.length) throw new Error('feeling-lucky: at least one prize is needed');
  return {
    prizes,
    locale,
    messages,
    player,
    logo,
    developer: developer === false ? null : { passwordHash: developer === true ? undefined : developer.passwordHash },
    onWin: config.onWin,
    onClaim: config.onClaim,
  };
}
