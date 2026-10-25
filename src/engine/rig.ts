import { signal } from '../runtime/signal';
import type { GameId } from '../config/types';

// Every chance a play takes goes through decide(): the game draws it, unless a rig, installed by the
// unlocked developer menu, settles it. Each game adds its own decisions to this interface.
export interface Decisions {}

type Settle<K extends keyof Decisions> = (
  context: Decisions[K] extends { context: infer C } ? C : never,
  draw: () => Decisions[K] extends { value: infer V } ? V : never,
) => Decisions[K] extends { value: infer V } ? V : never;
export type Rig = { [K in keyof Decisions]?: Settle<K> };

let rig: Rig = {};

// The developer menu exists only while the room is open.
export const roomOpen = signal(false);
export const restartRequest = signal<{ game: GameId } | undefined>(undefined);
// Bumped when the rig's settings change what the room shows at once, like its theme.
export const rigChanged = signal(0);

export function installRig(next: Rig) {
  rig = next;
}

export function restartGame(game: GameId) {
  restartRequest.value = { game };
}

export function decide<K extends keyof Decisions>(
  key: K,
  context: Decisions[K] extends { context: infer C } ? C : never,
  draw: () => Decisions[K] extends { value: infer V } ? V : never,
) {
  const settle = rig[key] as Settle<K> | undefined;
  return settle ? settle(context, draw) : draw();
}
