export default {
  games: {
    wheel: {
      name: 'Grand Wheel',
      summary: 'Booster: prize · Wheel: win',
      rules: 'The Booster picks the prize, the wheel what you win: a small prize or a big prize. Heads or Tails, Prize Hunt and Pachinko reveal the win; Grand Wheel is the jackpot.',
    },
  },
  wheel: {
    booster: 'BOOSTER',
    spin: 'Spin the wheel',
    hint: 'Or grab the wheel and fling it; zoom on the wheel for a close-up',
    segment: { coin: 'HEADS OR TAILS', hunt: 'PRIZE HUNT', pachinko: 'PACHINKO', jackpot: 'GRAND WHEEL' },
    pachinkoTitle: 'Pachinko bonus',
    pachinkoText: 'The ball decides the win. The prize stays {prize}.',
    toPachinko: 'Go to Pachinko',
    boosterRules:
      'Booster of the day: at every spin the Booster also picks a kind of segment, which comes out {n} times as often. The Booster picks the prize, the wheel what you win: a small prize or a big prize. Heads or Tails, Prize Hunt and Pachinko reveal the win; Grand Wheel is the jackpot.',
  },
  coin: { text: 'Gold or ruby: the coin picks the win.', gold: 'gold', ruby: 'ruby', flip: 'Flip the coin' },
  hunt: { text: 'Eighteen tiles, a win under each. Pick one.', tile: 'Tile {n}' },
  detail: {
    wheel: { small: 'winning segment', big: 'winning segment', jackpot: 'jackpot segment', coin: 'Heads or Tails', hunt: 'Prize Hunt', pachinko: 'Pachinko bonus' },
  },
};
