import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameId, Prize } from '../../src/config/types';
import { developerRig } from '../../src/developer/rig';
import { blankSettings, passwordMatches, room, settings, type GameSettings } from '../../src/developer/settings';
import { boardOf } from '../../src/engine/awards';
import { PACHINKO_POCKETS, PACHINKO_RED_PEGS, type PachinkoPeg } from '../../src/engine/pachinko';
import { decide, installRig, type Decisions } from '../../src/engine/rig';
import { rouletteWin, type RouletteBet } from '../../src/engine/roulette';
import { GAME_IDS } from '../../src/engine/tiers';
import { boosterKeys, segmentKey, wheelSegments } from '../../src/engine/wheel';

const pro: Prize = {
  id: 'pro',
  name: 'Pro',
  icon: '',
  variants: [
    { tier: 'small', label: '7 days', short: '7D' },
    { tier: 'small', label: '1 month', short: '1M' },
    { tier: 'big', label: '1 year', short: '1Y' },
  ],
};
const mug: Prize = { id: 'mug', name: 'Mug', icon: '' };
const SEGMENTS = wheelSegments(boardOf([pro, mug]));

const set = (game: GameId, changes: Partial<GameSettings>) => (settings[game] = { ...blankSettings(), ...changes });
const settle = <K extends keyof Decisions>(key: K, context: Decisions[K]['context'], draw: () => Decisions[K]['value']) => developerRig[key]!(context as never, draw as never) as Decisions[K]['value'];
const never = () => {
  throw new Error('drawn');
};

afterEach(() => {
  for (const game of GAME_IDS) delete settings[game];
  delete room.theme;
  room.prizes = [];
  installRig({});
  vi.restoreAllMocks();
});

describe('the rig seam', () => {
  it('draws every decision until a rig is installed, then lets the rig settle it', () => {
    expect(decide('boost', { game: 'slot' }, () => 1)).toBe(1);
    installRig({ boost: () => 4 });
    expect(decide('boost', { game: 'slot' }, () => 1)).toBe(4);
    expect(decide('tier', { game: 'slot', boost: 1 }, () => 'none' as const)).toBe('none');
  });

  it('unlocks only with the password whose SHA-256 is given', async () => {
    const hash = '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8';
    expect(await passwordMatches('password', hash)).toBe(true);
    expect(await passwordMatches('password', hash.toUpperCase())).toBe(true);
    for (const wrong of ['', 'Password', 'password ', 'pass']) expect(await passwordMatches(wrong, hash)).toBe(false);
  });
});

describe('the developer rig', () => {
  it('leaves to the draw every game it has no settings for', () => {
    for (const game of GAME_IDS) {
      expect(settle('boost', { game }, () => 3)).toBe(3);
      expect(settle('tier', { game, boost: 1 }, () => 'big')).toBe('big');
      expect(settle('prize', { game, prizeIds: ['pro'] }, () => 'pro')).toBe('pro');
    }
    expect(settle('roulette.number', { bets: [], storm: [], boost: 1 }, () => 17)).toBe(17);
    expect(settle('wheel.segment', { tier: 'small', segments: SEGMENTS }, () => 5)).toBe(5);
    expect(settle('scratch.award', { tier: 'small', prizeId: 'pro' }, () => '7D')).toBe('7D');
  });

  it('applies the multiplier and the forced result', () => {
    set('slot', { multiplier: 5, result: 'jackpot' });
    expect(settle('boost', { game: 'slot' }, never)).toBe(5);
    expect(settle('tier', { game: 'slot', boost: 5 }, never)).toBe('jackpot');
    set('slot', { result: 'loss' });
    expect(settle('tier', { game: 'slot', boost: 1 }, never)).toBe('none');
    set('slot', { result: 'win' });
    expect(settle('tier', { game: 'slot', boost: 1 }, never)).toBe('small');
  });

  it('chooses the prize only among the ones offered', () => {
    set('holdem', { advanced: { prize: 'mug' } });
    expect(settle('prize', { game: 'holdem', prizeIds: ['pro', 'mug'] }, never)).toBe('mug');
    expect(settle('prize', { game: 'holdem', prizeIds: ['pro'] }, () => 'pro')).toBe('pro');
  });

  it('stops the Grand Wheel on the segment chosen, with the tier it pays', () => {
    for (const key of ['none', ...boosterKeys(SEGMENTS)]) {
      set('wheel', { result: 'loss', advanced: { segment: key } });
      const tier = settle('tier', { game: 'wheel', boost: 1 }, () => 'none');
      const segment = SEGMENTS[settle('wheel.segment', { tier, segments: SEGMENTS }, never)]!;
      expect(segmentKey(segment)).toBe(key);
      if (segment.kind === 'coin' || segment.kind === 'hunt' || segment.kind === 'pachinko') expect(tier).toBe('small');
      else expect(tier).toBe(segment.kind);
    }
    set('wheel', { advanced: { segment: 'small:gone' } });
    expect(settle('wheel.segment', { tier: 'small', segments: SEGMENTS }, () => 4)).toBe(4);
  });

  it('picks the Booster segment among the wheel’s', () => {
    set('wheel', { advanced: { booster: 'coin' } });
    expect(settle('wheel.booster', { boost: 3, segments: SEGMENTS }, never)).toBe('coin');
    set('wheel', { advanced: { booster: 'big:gone' } });
    expect(settle('wheel.booster', { boost: 3, segments: SEGMENTS }, () => 'hunt')).toBe('hunt');
  });

  it('lines up the slot combination chosen', () => {
    const line = (combination: string) => {
      set('slot', { advanced: { combination } });
      return { tier: settle('tier', { game: 'slot', boost: 1 }, never), symbols: settle('slot.line', { tier: 'big', prizeId: 'pro' }, () => ['drawn']) };
    };
    expect(line('logos')).toEqual({ tier: 'big', symbols: ['pro', 'pro', 'pro'] });
    expect(line('sevens')).toEqual({ tier: 'big', symbols: ['seven', 'seven', 'seven'] });
    expect(line('pair')).toEqual({ tier: 'small', symbols: ['drawn'] });
    expect(line('infinities').tier).toBe('jackpot');
    expect(line('none').tier).toBe('none');
  });

  it('lands the roulette on the number chosen, or on one that gives the forced result with the bets', () => {
    const bets: RouletteBet[] = [{ spot: 'chance:red', prizeId: 'pro', chips: 1 }, { spot: 'straight:3', prizeId: 'pro', chips: 1 }];
    set('roulette', { result: 'jackpot', advanced: { number: '0' } });
    expect(settle('roulette.number', { bets, storm: [], boost: 1 }, never)).toBe(0);
    for (const [result, tier] of [['loss', 'none'], ['win', 'small'], ['jackpot', 'jackpot']] as const) {
      set('roulette', { result });
      for (let i = 0; i < 50; i++) {
        const won = rouletteWin(bets, settle('roulette.number', { bets, storm: [], boost: 1 }, never))?.tier ?? 'none';
        if (result === 'win') expect(won).not.toBe('none');
        else expect(won).toBe(tier);
      }
    }
    set('roulette', { result: 'jackpot' });
    expect(settle('roulette.number', { bets: [bets[0]!], storm: [], boost: 1 }, () => 36)).toBe(36);
  });

  it('lands on a storm number or misses them all, weighting them as the game does', () => {
    const bets: RouletteBet[] = [{ spot: 'chance:red', prizeId: 'pro', chips: 1 }];
    const storm = [1, 2, 3];
    set('roulette', { advanced: { storm: 'hit' } });
    for (let i = 0; i < 50; i++) expect(storm).toContain(settle('roulette.number', { bets, storm, boost: 3 }, never));
    set('roulette', { advanced: { storm: 'miss' } });
    for (let i = 0; i < 50; i++) expect(storm).not.toContain(settle('roulette.number', { bets, storm, boost: 3 }, never));
    set('roulette', { result: 'win', advanced: { storm: 'hit' } });
    for (let i = 0; i < 50; i++) expect([1, 3]).toContain(settle('roulette.number', { bets, storm, boost: 3 }, never));
    set('roulette', { advanced: { storm: 'hit' } });
    expect(settle('roulette.number', { bets, storm: [], boost: 1 }, () => 36)).toBe(36);
    set('roulette', { result: 'loss' });
    const counts = new Map<number, number>();
    const random = vi.spyOn(Math, 'random');
    const losing = 17 + 2 * 4;
    for (let index = 0; index < losing; index++) {
      random.mockReturnValue((index + 0.5) / losing);
      const number = settle('roulette.number', { bets, storm: [0, 2, 3], boost: 4 }, never);
      counts.set(number, (counts.get(number) ?? 0) + 1);
    }
    expect(counts.get(0)).toBe(4);
    expect(counts.get(2)).toBe(4);
    expect(counts.has(3)).toBe(false);
  });

  it('sets the slot of the day, or leaves it to the date', () => {
    expect(settle('slot.machine', {}, () => 'takeoff')).toBe('takeoff');
    set('slot', { multiplier: 3, variant: 'breakaway' });
    expect(settle('slot.machine', {}, never)).toBe('breakaway');
  });

  it('lets a forced win run past every defender', () => {
    expect(settle('breakaway.tackle', { tier: 'small' }, () => 3)).toBe(3);
    set('slot', { result: 'win' });
    expect(settle('breakaway.tackle', { tier: 'small' }, never)).toBeNull();
    set('slot', { result: 'loss' });
    expect(settle('breakaway.tackle', { tier: 'none' }, () => 1)).toBe(1);
  });

  it('sets the ticket of the day of the scratch card, or leaves it to the date', () => {
    expect(settle('scratch.ticket', {}, () => 'double')).toBe('double');
    set('scratch', { multiplier: 4, variant: 'forever' });
    expect(settle('scratch.ticket', {}, never)).toBe('forever');
    expect(settle('boost', { game: 'scratch' }, never)).toBe(4);
  });

  it('lays the jackpot reds down the board, one a row, and steers the ball through them', () => {
    const pegs: PachinkoPeg[] = [];
    for (let row = 0; row < 10; row++) for (let x = 25; x <= 375; x += 50) pegs.push({ x: x + (row % 2) * 25, y: 112 + row * 44, hit: -1 });
    const natural = () => ({ violet: pegs[30]!, reds: pegs.slice(0, PACHINKO_RED_PEGS) });
    set('pachinko', { result: 'jackpot', advanced: { violet: 'hit' } });
    const board = settle('pachinko.board', { pegs }, natural);
    const rows = board.reds.map((peg) => peg.y);
    expect(rows).toEqual([...new Set(rows)].sort((a, b) => a - b));
    expect(rows).toHaveLength(PACHINKO_RED_PEGS);
    expect(board.reds).not.toContain(board.violet);
    const route = settle('pachinko.route', board, never);
    expect(route.through).toEqual([...board.reds, board.violet].sort((a, b) => a.y - b.y));
    expect(settle('pachinko.pocket', { near: 0 }, never)).toBe(PACHINKO_POCKETS.indexOf('jackpot'));
    expect(settle('pachinko.wins', { boost: 2, violet: false }, never)).toBe(true);
  });

  it('steers the Pachinko ball around the violet orb or into the pocket chosen', () => {
    const violet = { x: 200, y: 300, hit: -1 };
    set('pachinko', { result: 'loss', advanced: { violet: 'miss', pocket: '2' } });
    expect(settle('pachinko.route', { violet, reds: [] }, never)).toEqual({ through: [], avoid: [violet] });
    expect(settle('pachinko.pocket', { near: 7 }, never)).toBe(1);
    expect(settle('tier', { game: 'pachinko', boost: 1 }, never)).toBe(PACHINKO_POCKETS[1]);
    expect(settle('pachinko.wins', { boost: 2, violet: true }, never)).toBe(false);
  });

  it('prints the scratch card with the award chosen, the tier it pays and a prize that pays it', () => {
    room.prizes = [pro, mug];
    for (const [key, tier, award, prizeId] of [['small:7D', 'small', '7D', 'pro'], ['big:1Y', 'big', '1Y', 'pro'], ['big:', 'big', null, 'mug']] as const) {
      set('scratch', { result: 'loss', advanced: { award: key } });
      expect(settle('tier', { game: 'scratch', boost: 1 }, never)).toBe(tier);
      expect(settle('scratch.award', { tier, prizeId }, never)).toBe(award);
      expect(settle('prize', { game: 'scratch', prizeIds: ['pro', 'mug'] }, never)).toBe(prizeId);
    }
    set('scratch', { result: 'loss', advanced: { award: 'jackpot:' } });
    expect(settle('tier', { game: 'scratch', boost: 1 }, never)).toBe('jackpot');
    set('scratch', { advanced: { award: 'small:7D', prize: 'mug' } });
    expect(settle('prize', { game: 'scratch', prizeIds: ['pro', 'mug'] }, never)).toBe('mug');
  });
});

describe('the room theme', () => {
  it('follows the calendar until one is chosen, none included', () => {
    expect(settle('theme', {}, () => 'august')).toBe('august');
    room.theme = 'christmas';
    expect(settle('theme', {}, never)).toBe('christmas');
    room.theme = 'none';
    expect(settle('theme', {}, never)).toBeNull();
  });
});
