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

// V: the host's own variants, with any fields of theirs; the win hands back the very object it was given.
export interface Prize<V extends Variant = Variant> {
  id: string;
  name: string;
  icon: string;
  color?: string;
  variants?: V[] | ((tier: PrizeTier) => V | Promise<V>);
}

export interface Win<V extends Variant = Variant> {
  prize: Prize<V>;
  variant: V | null;
  tier: PrizeTier;
  game: GameId;
}

export interface Player {
  name: string;
  avatar?: string;
}

export type Messages = { [key: string]: string | Messages };

export interface FeelingLuckyConfig<V extends Variant = Variant> {
  prizes: Resolvable<Prize<V>[]>;
  locale?: Resolvable<string>;
  messages?: Resolvable<Record<string, Messages>>;
  player?: Resolvable<Player>;
  logo?: Resolvable<string>;
  onWin?: (win: Win<V>) => void;
  onClaim?: (win: Win<V>) => Promise<void>;
  developer?: Resolvable<boolean | { passwordHash?: string }>;
}

export interface FeelingLucky<V extends Variant = Variant> {
  open(options?: { from?: Element | { x: number; y: number } }): void;
  close(): void;
  update(config: Partial<FeelingLuckyConfig<V>>): void;
  destroy(): void;
}
