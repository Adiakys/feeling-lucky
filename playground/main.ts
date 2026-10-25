import { createFeelingLucky, type Prize } from '../src';

const badge = (color: string, letter: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="12" fill="${color}"/><text x="24" y="32" font-family="system-ui" font-size="22" font-weight="700" fill="#fff" text-anchor="middle">${letter}</text></svg>`)}`;

const ALL_PRIZES: Prize[] = [
  {
    id: 'pro',
    name: 'Pro plan',
    icon: badge('#3559c7', 'P'),
    variants: [
      { tier: 'small', label: '7 days', short: '7D' },
      { tier: 'small', label: '1 month', short: '1M' },
      { tier: 'big', label: '1 year', short: '1Y' },
      { tier: 'jackpot', label: 'Lifetime', short: '∞', details: [{ label: 'Seats', value: 'Unlimited' }] },
    ],
  },
  { id: 'mug', name: 'Coffee mug', icon: badge('#b8442c', 'M') },
  {
    id: 'credits',
    name: 'Cloud credits',
    icon: badge('#1f8a5b', 'C'),
    variants: (tier) => ({ tier, label: `${{ small: 10, big: 100, jackpot: 1000 }[tier]} credits` }),
  },
  { id: 'tee', name: 'T-shirt', icon: badge('#7a3fb0', 'T') },
  { id: 'stickers', name: 'Stickers', icon: badge('#c08a1e', 'S') },
  { id: 'book', name: 'Book', icon: badge('#2a7d9a', 'B') },
];

const count = document.querySelector<HTMLSelectElement>('#count')!;
const lang = document.querySelector<HTMLSelectElement>('#lang')!;
const logo = document.querySelector<HTMLSelectElement>('#logo')!;
const ACME = badge('#111', 'A');

const lucky = createFeelingLucky({
  prizes: () => ALL_PRIZES.slice(0, Number(count.value)),
  player: { name: 'Ada' },
  onWin: (win) => console.info('win', win),
  onClaim: async (win) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    console.info('claimed', win);
  },
  developer: { passwordHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8' },
});

lang.addEventListener('change', () => (document.documentElement.lang = lang.value));
count.addEventListener('change', () => lucky.update({}));
logo.addEventListener('change', () => lucky.update({ logo: logo.value ? ACME : undefined }));
document.querySelector('#open')!.addEventListener('click', (event) => lucky.open({ from: event.currentTarget as Element }));
