import { expectTypeOf, it } from 'vitest';
import { createFeelingLucky, type Variant, type Win } from '../../src';

interface Plan extends Variant {
  months: number;
}

it('types the wins with the host’s own variants', () => {
  createFeelingLucky<Plan>({
    prizes: [{ id: 'pro', name: 'Pro', icon: '', variants: [{ tier: 'big', label: '1 year', months: 12 }] }],
    onClaim: async (win) => {
      expectTypeOf(win).toEqualTypeOf<Win<Plan>>();
    },
  });
  createFeelingLucky({
    prizes: [{ id: 'pro', name: 'Pro', icon: '', variants: (tier) => ({ tier, label: '1 year', months: 12 }) }],
    onWin: (win) => expectTypeOf(win.variant?.months).toEqualTypeOf<number | undefined>(),
  });
  createFeelingLucky({
    prizes: [{ id: 'mug', name: 'Mug', icon: '' }],
    onWin: (win) => expectTypeOf(win.variant).toEqualTypeOf<Variant | null>(),
  });
});
