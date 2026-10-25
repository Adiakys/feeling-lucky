# feeling-lucky

A casino room for any web app: players try their luck on classic casino games and win the prizes you configure.

**[Live demo](https://adiakys.github.io/feeling-lucky/)**: Ctrl+Shift+L in the room opens the developer menu.

- **Framework-free:** a single entry point that works with React, Angular, Vue or plain HTML.
- **No runtime dependencies:** built with [Lit](https://lit.dev) and [Lucide](https://lucide.dev) icons, both bundled.
- **Isolated:** the room lives in a shadow root mounted on `body`, so the host's CSS never reaches it and its CSS never leaks out.

## Install

```bash
npm install @adiakys/feeling-lucky
```

Without a bundler, the IIFE build exposes a global:

```html
<script src="https://cdn.jsdelivr.net/npm/@adiakys/feeling-lucky/dist/feeling-lucky.iife.js"></script>
<script>
  const lucky = FeelingLucky.createFeelingLucky({ prizes: [/* … */] });
</script>
```

## Usage

```ts
import { createFeelingLucky } from '@adiakys/feeling-lucky';

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
| `dealers` | `Dealer[]`: the dealers who take the Salon Privé's shifts, see [Dealers](#dealers) | the library's own dealer |
| `player` | `{ name, avatar? }`, shown at the card tables | anonymous seat |
| `onWin` | `(win: Win) => void` | none |
| `onClaim` | `(win: Win) => Promise<void>`; shows **Claim** on the certificate | no claim button |
| `developer` | `true` or `{ passwordHash? }`: enables the developer menu (Ctrl+Shift+L), behind a password when the hash is given | disabled |
| `multiplayer` | base URL of a [multiplayer server](#multiplayer), or `{ url, headers? }` | single player |

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
import { createFeelingLucky, en } from '@adiakys/feeling-lucky';

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
- **Dealers:** three shifts a day, the same for everyone, from the date's hash, see [Dealers](#dealers).
- **Room themes:** Christmas, Halloween, Easter and August, taken from the calendar.

## Dealers

A dealer stands at the Salon Privé's tables during three shifts a day of 30 to 90 minutes between 10:00 and 23:00, local time. The shifts come from the date's hash, and the dealers in the list take them in turn. While a dealer is on shift, Blackjack and Texas Hold'em win twice as often. A dealer arriving or leaving mid-game walks in or out of the table, and the odds change from the next hand.

```ts
interface Dealer {
  image: string;    // waist-up portrait, transparent background, forearms resting forward at the bottom
  name?: string;
  hands?: string;   // CSS clip-path of the forearms and hands, drawn over the table's rim
}
```

Without `dealers`, the library's own illustrated dealer takes every shift; `dealers: []` leaves the tables without one.

## Multiplayer

Optional: with `multiplayer`, Blackjack and Texas Hold'em are played at shared tables, one per game, up to five players, each against the house.

- **Seats:** players watch from the rail and pick a free seat, the same places for everyone; they can move or stand up between hands. A browser holds one seat per table, whatever its tabs; a signed-in user holds one across devices.
- **Outcomes:** the server deals and draws them, with the same odds as single player, a dealer's bonus included; wins still reach `onWin` and `onClaim` in each player's browser.
- **Fallback:** without the server the room plays single player; the developer menu switches between the two.
- **Size:** the client code loads only when `multiplayer` is set.

```ts
createFeelingLucky({ prizes, multiplayer: '/feeling-lucky' });

createFeelingLucky({
  prizes,
  multiplayer: { url: 'https://tables.example.com/feeling-lucky', headers: async () => ({ Authorization: `Bearer ${await token()}` }) },
});
```

`headers` is asked for again on every request. On the same origin the browser's cookies go along, so the server sees the signed-in user.

### Server

In your ASP.NET Core app, from NuGet:

```bash
dotnet add package Adiakys.FeelingLucky
```

```cs
builder.Services.AddFeelingLucky();
app.MapFeelingLucky();                       // /feeling-lucky, chain .RequireAuthorization() or .RequireCors() as needed
```

Or standalone, from the container:

```bash
docker run -p 8080:8080 -e Cors__Origins__0=https://app.example.com ghcr.io/adiakys/feeling-lucky-server
```

| Option (`FeelingLucky__*` in the container) | Default |
|---|---|
| `Seats` | 5 |
| `Pace`: the time between two cards | 480 ms |
| `BettingTime`: from the first bet to the deal | 10 s |
| `ActionTime`: to hit, stand, call or fold | 20 s |
| `TimeZone`: the dealers' shifts, IANA id | the server's |

Tables live in memory: one instance, no storage.

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
server/         multiplayer server: the NuGet package, the standalone host, tests
```

### Rules

- **`engine/` decides every outcome** and never touches the DOM. Games only stage what it decides.
- **Rig seam:** the developer menu reaches the outcomes only through `engine/rig` (`decide(key, context, draw)`). Games don't know it exists.
- **Lit elements render into the room's shadow root, not into their own.** One stylesheet styles the whole room.
- **Every text lives in `locales/`.** Icons are inline SVG.

## Development

```bash
npm install
npm run dev        # playground; multiplayer through docker compose up -d
npm test           # unit tests
npm run test:e2e   # one smoke test per game
npm run typecheck
npm run build      # dist/: ESM + IIFE
npm run build:demo # site/: the playground, as on GitHub Pages
```

## Release

Publish a GitHub release or pre-release on a `v<version>` tag, e.g. `v1.2.0` or `v1.3.0-beta.1`: the version comes from the tag, `package.json` only holds a placeholder. The release workflow:
- runs the checks;
- publishes the package to npm: `latest` for a release, `next` for a pre-release;
- attaches the packed `.tgz` to the release;
- publishes the server to NuGet through Trusted Publishing, and its image to `ghcr.io/adiakys/feeling-lucky-server`, `latest` for a release;
- deploys the playground to GitHub Pages, for releases only.

## License

[GPL-3.0-or-later](LICENSE)
