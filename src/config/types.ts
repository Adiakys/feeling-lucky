export type Tier = 'none' | 'small' | 'big' | 'jackpot';
export type PrizeTier = Exclude<Tier, 'none'>;
export type GameId = 'wheel' | 'slot' | 'roulette' | 'pachinko' | 'scratch' | 'blackjack' | 'holdem';

export type Resolvable<T> = T | (() => T | Promise<T>);

export interface Variant {
  tier: PrizeTier;
  label: string;
  short?: string;
  details?: { label: string; value: string }[];
}

export interface Prize {
  id: string;
  name: string;
  icon: string;
  color?: string;
  variants?: Variant[] | ((tier: PrizeTier) => Variant | Promise<Variant>);
}

export interface Win {
  prize: Prize;
  variant: Variant | null;
  tier: PrizeTier;
  game: GameId;
}

export interface Player {
  name: string;
  avatar?: string;
}

export type Messages = { [key: string]: string | Messages };

export interface FeelingLuckyConfig {
  prizes: Resolvable<Prize[]>;
  locale?: Resolvable<string>;
  messages?: Resolvable<Record<string, Messages>>;
  player?: Resolvable<Player>;
  logo?: Resolvable<string>;
  onWin?: (win: Win) => void;
  onClaim?: (win: Win) => Promise<void>;
  developer?: Resolvable<boolean | { passwordHash?: string }>;
}

export interface FeelingLucky {
  open(options?: { from?: Element | { x: number; y: number } }): void;
  close(): void;
  update(config: Partial<FeelingLuckyConfig>): void;
  destroy(): void;
}
