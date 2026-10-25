import type { GameId, Tier } from '../config/types';
import type { Award } from './awards';

export interface Message {
  key: string;
  params?: Record<string, string | number>;
}

// A play's result: what the game drew and staged. award is what the board showed for the win.
export interface Outcome {
  game: GameId;
  tier: Tier;
  prizeId: string;
  award: Award;
  detail: Message;
}
