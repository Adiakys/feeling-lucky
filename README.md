# feeling-lucky

A casino room for any web app: players try their luck on classic casino games and win the prizes you configure.

- **Framework-free:** a single entry point that works with React, Angular, Vue or plain HTML.
- **No runtime dependencies:** built with [Lit](https://lit.dev) and [Lucide](https://lucide.dev) icons, both bundled.
- **Isolated:** the room lives in a shadow root mounted on `body`, so the host's CSS never reaches it and its CSS never leaks out.

## Install

```bash
npm install feeling-lucky
```

Without a bundler, the IIFE build exposes a global:

```html
<script src="https://unpkg.com/feeling-lucky"></script>
<script>
  const lucky = FeelingLucky.createFeelingLucky({ prizes: [/* … */] });
</script>
```

## Usage

```ts
import { createFeelingLucky } from 'feeling-lucky';

const lucky = createFeelingLucky({
  prizes: [
    {
      id: 'pro',
      name: 'Pro',
      icon: '/icons/pro.svg',
      variants: [
        { tier: 'small', label: '7 days', short: '7D' },
        { tier: 'big', label: '1 year', short: '1Y' },
      ],
    },
    { id: 'basic', name: 'Basic', icon: '/icons/basic.svg' },
  ],
  onWin: (win) => console.log(win),
});

button.addEventListener('click', (event) => lucky.open({ from: event.currentTarget }));
```

| Method | |
|---|---|
| `open({ from? })` | Opens the room, growing out of `from` (an element or `{ x, y }`) |
| `close()` | Closes the room |
| `update(config)` | Merges a partial config |
| `destroy()` | Removes the room and its listeners |

## Config

Every field takes a value, a function, or a function returning a Promise.

| Field | Type | Default |
|---|---|---|
| `prizes` | `Prize[]`, 1 to n | required |
| `locale` | language code, e.g. `'it'` or `'pt-BR'` | follows the host page, see [Languages](#languages) |
| `messages` | `{ [locale]: Messages }`: new languages, or overrides of the built-in ones | none |
| `logo` | image URL of your brand mark, on the certificate, the wheel's hub and the scratch card | a clover |
| `player` | `{ name, avatar? }`, shown at the card tables | anonymous seat |
| `onWin` | `(win: Win) => void` | none |
| `onClaim` | `(win: Win) => Promise<void>`; shows **Claim** on the certificate | no claim button |
| `developer` | `true` or `{ passwordHash? }`: enables the developer menu (Ctrl+Shift+L), behind a password when the hash is given | disabled |

```ts
interface Prize {
  id: string;
  name: string;
  icon: string;                      // image URL
  color?: string;                    // chip colour
  variants?: Variant[] | ((tier: PrizeTier) => Variant | Promise<Variant>);
}

type PrizeTier = 'small' | 'big' | 'jackpot';

interface Variant {
  tier: PrizeTier;
  label: string;                     // certificate: "7 days"
  short?: string;                    // game boards: "7D"
  details?: { label: string; value: string }[];
}

interface Win {
  prize: Prize;
  variant: Variant | null;           // null: the full prize
  tier: PrizeTier;
  game: GameId;
}
```

### Prizes and variants

- **Every play draws a tier first** (`none`, `small`, `big` or `jackpot`), then the game stages it.
- **Variants are optional.** A prize without variants is won in full, whatever the tier.
- **Board labels:** game boards (wheel segments, pachinko pockets, cash-out steps, scratch tickets) show the variants' `short` labels.
- **Tier symbol fallback:** a prize without variants, or with a variants function, shows the tier symbol on the board instead. Its variant is revealed on the certificate.
- **No signing or issuing.** `onClaim` hands the win to the host, which does whatever claiming means for it, e.g. closing the room and opening its own page, prefilled from the variant.
- **Your own fields:** variants can carry fields of yours. The win hands back the very object you gave, typed as yours:

```ts
interface Plan extends Variant {
  months: number;
}

const lucky = createFeelingLucky<Plan>({
  prizes: [{ id: 'pro', name: 'Pro', icon: '/pro.svg', variants: [{ tier: 'big', label: '1 year', months: 12 }] }],
  onClaim: async (win) => {
    lucky.close();
    router.push(`/redeem/${win.prize.id}?months=${win.variant?.months ?? 'all'}`);
  },
});
```

### Developer menu

Ctrl+Shift+L in the room opens a password-gated panel that forces outcomes, themes and bonuses, for demos and testing. Without `passwordHash` it opens without a password. With it, only the password's SHA-256 hex goes in the config; checking it needs a secure context (https or localhost):

```bash
printf '%s' 'my password' | sha256sum
```

## Languages

Every text, game names included, comes from the locale. Built in: `en`, `it`, `es`, `fr`, `de`. English ships with the library; the others load on demand, only when the room speaks them.

- **Default locale:** without `locale`, the room follows `<html lang>` and switches when the host app changes it, falling back to `navigator.language`.
- **Matching:** `pt-BR` uses `pt-BR`, then `pt`, then `en`.
- **New languages:** add them through `messages`. Missing keys fall back to `en`.

```ts
import { createFeelingLucky, en } from 'feeling-lucky';

createFeelingLucky({
  prizes,
  messages: {
    pt: { ...en, room: 'Sala de jogos' /* … */ },
    it: { games: { wheel: { name: 'Ruota d’oro' } } },
  },
});
```

## Games

| Room | Games |
|---|---|
| Main hall | Grand Wheel (Prize Hunt, Heads or Tails, Pachinko bonus), Roulette, Slot, Pachinko, Scratch card |
| Salon Privé | Blackjack, Texas Hold'em, single player against the house |

- **Bonus of the day:** one main-hall game per day, the same for everyone, gets its own variant and boosted odds:
  - Storm Roulette
  - Booster on the Grand Wheel
  - Takeoff or Breakaway in place of the slot
  - Double Luck or Forever in place of the scratch card
  - colour Pachinko
- **Room themes:** Christmas, Halloween, Easter and August, taken from the calendar.

## Structure

```
src/
  index.ts      public API
  config/       config types, defaults
  engine/       outcomes, no DOM
  runtime/      i18n, icons, sound, fx
  room/         room, lobby, certificate
  games/        one folder per game:
                wheel, roulette, slot, pachinko,
                scratch, blackjack, holdem
  developer/    developer menu, lazy
  styles/       CSS per area
  locales/      en, it, es, fr, de
playground/     demo with sample prizes
tests/          unit (engine), e2e
```

### Rules

- **`engine/` decides every outcome** and never touches the DOM. Games only stage what it decides.
- **Rig seam:** the developer menu reaches the outcomes only through `engine/rig` (`decide(key, context, draw)`). Games don't know it exists.
- **Lit elements render into the room's shadow root, not into their own.** One stylesheet styles the whole room.
- **Every text lives in `locales/`.** Icons are inline SVG.

## Development

```bash
npm install
npm run dev        # playground
npm test           # unit tests
npm run test:e2e   # one smoke test per game
npm run typecheck
npm run build      # dist/: ESM + IIFE
```

## License

[GPL-3.0-or-later](LICENSE)
