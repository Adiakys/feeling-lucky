import { createContext } from '@lit/context';
import type { TemplateResult } from 'lit';
import type { GameId, Player, Prize, Tier } from '../config/types';
import type { Award, Board } from '../engine/awards';
import type { Outcome } from '../engine/outcome';
import type { Translate } from './i18n';

export interface GameOptions {
  // A bonus played from the Grand Wheel: its prize, tier and award are already drawn.
  bonus?: { prizeId: string; tier: Tier; award: Award };
}

// What every element of the room shares: a new object whenever prizes, player or language change.
export interface RoomContext {
  prizes: Prize[];
  prizeIds: string[];
  board: Board;
  player: Player | null;
  locale: string;
  // Every language the room can speak: the built-in ones and the host's.
  locales: string[];
  t: Translate;
  prize: (id: string) => Prize;
  icon: (id: string) => string;
  name: (id: string) => string;
  color: (id: string) => string;
  // The board label of an award: the variant's short label, or the tier's symbol.
  award: (tier: Tier, award: Award) => string;
  // The host's logo, or the clover, sized like an icon.
  logo: (className?: string) => TemplateResult;
  finish: (outcome: Outcome) => void;
  go: (view: GameId | 'lobby', options?: GameOptions) => void;
}

export const roomContext = createContext<RoomContext>(Symbol('fl-room'));

const CHIP_COLORS = ['#9e1b22', '#1d3561', '#1c6136', '#5b2a6e', '#7a5418'];
export const defaultColor = (index: number) => CHIP_COLORS[index % CHIP_COLORS.length]!;
