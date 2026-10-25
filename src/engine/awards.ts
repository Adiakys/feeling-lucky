import type { Prize, PrizeTier, Tier, Variant } from '../config/types';
import { pick, range } from './random';

// What a winning play pays as the game boards show it: a variant's short label, or null for the tier's symbol,
// which stands for a prize won in full or for a variant revealed only at the win.
export type Award = string | null;
export type Board = Record<PrizeTier, Award[]>;

export const PRIZE_TIERS: PrizeTier[] = ['small', 'big', 'jackpot'];

export const variantsOf = (prize: Prize, tier: PrizeTier): Variant[] => (Array.isArray(prize.variants) ? prize.variants.filter((variant) => variant.tier === tier) : []);
export const awardOf = (variant: Variant) => variant.short ?? variant.label;

// Each tier's labels, in the order the prizes declare them, plus the symbol when some prize has no variant of it.
export function boardOf(prizes: Prize[]): Board {
  const awards = (tier: PrizeTier): Award[] => {
    const labels = [...new Set(prizes.flatMap((prize) => variantsOf(prize, tier).map(awardOf)))];
    return prizes.some((prize) => !variantsOf(prize, tier).length) ? [...labels, null] : labels;
  };
  return { small: awards('small'), big: awards('big'), jackpot: awards('jackpot') };
}

// What a prize pays for a tier, when the game draws it for a prize already chosen.
export function drawAward(prize: Prize, tier: Tier): Award {
  if (tier === 'none') return null;
  const variants = variantsOf(prize, tier);
  return variants.length ? awardOf(pick(variants)) : null;
}

// The prizes that pay an award: the ones with that variant, or, for the symbol, the ones without a variant of the tier.
export function prizesPaying(prizes: Prize[], tier: PrizeTier, award: Award): Prize[] {
  const paying = prizes.filter((prize) => {
    const variants = variantsOf(prize, tier);
    return award === null ? !variants.length : variants.some((variant) => awardOf(variant) === award);
  });
  return paying.length ? paying : prizes;
}

// The variant a win hands over; null means the prize in full.
export async function resolveVariant(prize: Prize, tier: PrizeTier, award: Award): Promise<Variant | null> {
  if (typeof prize.variants === 'function') return prize.variants(tier);
  const variants = variantsOf(prize, tier);
  return variants.find((variant) => awardOf(variant) === award) ?? (variants.length ? pick(variants) : null);
}

// count slots of a board filled in order with the awards, each over an equal stretch.
export const spread = <T>(items: readonly T[], count: number): T[] => range(0, count - 1).map((index) => items[Math.floor((index * items.length) / count)]!);

export const awardKey = (tier: PrizeTier, award: Award) => `${tier}:${award ?? ''}`;
