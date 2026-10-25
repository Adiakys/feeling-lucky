import type { GameId, Tier } from '../config/types';
import { prizesPaying } from '../engine/awards';
import { PACHINKO_POCKETS, PACHINKO_RED_PEGS, PACHINKO_VIOLET_ROWS, type PachinkoPeg } from '../engine/pachinko';
import { pick, random } from '../engine/random';
import type { Rig } from '../engine/rig';
import { ROULETTE_ORDER, rouletteWin } from '../engine/roulette';
import type { DayMachine, DayTicket } from '../engine/tiers';
import { boosterKeys, segmentKey } from '../engine/wheel';
import { COMBINATION_TIER, parseAward, room, settingsOf, type Result } from './settings';

const FORCED: Record<Result, Tier | undefined> = { automatic: undefined, loss: 'none', win: 'small', jackpot: 'jackpot' };
const JACKPOT_POCKET = PACHINKO_POCKETS.indexOf('jackpot');

function settledTier(game: GameId, draw: () => Tier): Tier {
  const { result, advanced } = settingsOf(game);
  if (game === 'wheel' && advanced.segment) {
    const kind = advanced.segment.split(':')[0]!;
    if (kind === 'coin' || kind === 'hunt' || kind === 'pachinko') return draw() === 'big' ? 'big' : 'small';
    return kind as Tier;
  }
  if (game === 'slot' && advanced.combination) return COMBINATION_TIER[advanced.combination]!;
  if (game === 'pachinko' && advanced.pocket) return PACHINKO_POCKETS[Number(advanced.pocket) - 1]!;
  if (game === 'scratch' && advanced.award) return parseAward(advanced.award).tier;
  return FORCED[result] ?? draw();
}

// The coloured board's jackpot is collected for real: the reds are laid down a zig-zag from the middle,
// one a row, and the ball is steered onto each in turn; a violet to hit takes a stop of its own on the way.
const collectsReds = () => settingsOf('pachinko').result === 'jackpot' && !settingsOf('pachinko').advanced.pocket;

function path(pegs: PachinkoPeg[], stops: number) {
  const left = Math.min(...pegs.map((peg) => peg.x)) + 16;
  const right = Math.max(...pegs.map((peg) => peg.x)) - 16;
  let along = (left + right) / 2;
  const rows = [...new Set(pegs.map((peg) => peg.y))].sort((a, b) => a - b).slice(1, 1 + stops);
  return rows.flatMap((y) => {
    const aim = Math.max(left, Math.min(right, along + random(-25, 25)));
    const peg = pegs.filter((candidate) => candidate.y === y).sort((a, b) => Math.abs(a.x - aim) - Math.abs(b.x - aim))[0];
    if (!peg) return [];
    along = peg.x;
    return [peg];
  });
}

export const developerRig: Rig = {
  boost: ({ game }, draw) => settingsOf(game).multiplier ?? draw(),
  tier: ({ game }, draw) => settledTier(game, draw),
  // A scratch award chosen alone goes to a prize that pays it.
  prize: ({ game, prizeIds }, draw) => {
    const { prize, award } = settingsOf(game).advanced;
    if (prize && prizeIds.includes(prize)) return prize;
    if (game !== 'scratch' || !award) return draw();
    const { tier, award: label } = parseAward(award);
    const paying = prizesPaying(room.prizes.filter(({ id }) => prizeIds.includes(id)), tier, label);
    return paying.length ? pick(paying).id : draw();
  },
  'wheel.segment': ({ segments }, draw) => {
    const chosen = settingsOf('wheel').advanced.segment;
    const indexes = chosen ? segments.flatMap((segment, index) => (segmentKey(segment) === chosen ? [index] : [])) : [];
    return indexes.length ? pick(indexes) : draw();
  },
  'wheel.booster': ({ segments }, draw) => {
    const chosen = settingsOf('wheel').advanced.booster;
    return chosen && boosterKeys(segments).includes(chosen) ? chosen : draw();
  },
  'slot.line': ({ prizeId }, draw) => {
    const { combination } = settingsOf('slot').advanced;
    const symbol = combination === 'logos' ? prizeId : combination === 'sevens' ? 'seven' : undefined;
    if (!symbol) return draw();
    return [symbol, symbol, symbol];
  },
  // A forced result, or a storm number to land on or to miss, draws among the numbers that give it
  // with the bets on the table, the storm ones weighted as in the game; with none, the draw is the game's.
  'roulette.number': ({ bets, storm, boost }, draw) => {
    const { result, advanced } = settingsOf('roulette');
    if (advanced.number) return Number(advanced.number);
    const forced = FORCED[result];
    if (!forced && !advanced.storm) return draw();
    const candidates = ROULETTE_ORDER.filter((number) => {
      const tier = rouletteWin(bets, number)?.tier ?? 'none';
      const gives = !forced || (forced === 'small' ? tier !== 'none' : tier === forced);
      return gives && (!advanced.storm || storm.includes(number) === (advanced.storm === 'hit'));
    });
    if (!candidates.length) return draw();
    return pick(candidates.flatMap((number) => Array<number>(storm.includes(number) ? boost : 1).fill(number)));
  },
  'pachinko.board': ({ pegs }, draw) => {
    const natural = draw();
    if (!collectsReds()) return natural;
    const [top, bottom] = PACHINKO_VIOLET_ROWS;
    const inRange = (peg: PachinkoPeg) => peg.y >= top && peg.y <= bottom;
    if (settingsOf('pachinko').advanced.violet === 'hit') {
      const stops = path(pegs, PACHINKO_RED_PEGS + 1);
      const violet = pick(stops.filter(inRange));
      return { violet, reds: stops.filter((peg) => peg !== violet) };
    }
    const reds = path(pegs, PACHINKO_RED_PEGS);
    const free = pegs.filter((peg) => !reds.includes(peg) && inRange(peg));
    return { violet: free.includes(natural.violet) ? natural.violet : pick(free), reds };
  },
  'pachinko.route': ({ violet, reds }, draw) => {
    const { violet: setting } = settingsOf('pachinko').advanced;
    if (!collectsReds() && !setting) return draw();
    const through = [...(collectsReds() ? reds : []), ...(setting === 'hit' ? [violet] : [])].sort((a, b) => a.y - b.y);
    return { through, avoid: setting === 'miss' ? [violet] : [] };
  },
  'pachinko.wins': (_, draw) => {
    const forced = FORCED[settingsOf('pachinko').result];
    return forced ? forced !== 'none' : draw();
  },
  'pachinko.pocket': (_, draw) => {
    const { pocket } = settingsOf('pachinko').advanced;
    return pocket ? Number(pocket) - 1 : collectsReds() ? JACKPOT_POCKET : draw();
  },
  'scratch.ticket': (_, draw) => (settingsOf('scratch').variant as DayTicket | undefined) ?? draw(),
  locale: (_, draw) => room.locale ?? draw(),
  theme: (_, draw) => (room.theme === undefined ? draw() : room.theme === 'none' ? null : room.theme),
  'slot.machine': (_, draw) => (settingsOf('slot').variant as DayMachine | undefined) ?? draw(),
  // A forced win lets the run go all the way: the player chooses where to cash out.
  'breakaway.tackle': (_, draw) => (FORCED[settingsOf('slot').result] && FORCED[settingsOf('slot').result] !== 'none' ? null : draw()),
  'scratch.award': (_, draw) => {
    const { award } = settingsOf('scratch').advanced;
    return award ? parseAward(award).award : draw();
  },
};
