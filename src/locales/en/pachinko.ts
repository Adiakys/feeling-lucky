export default {
  games: {
    pachinko: {
      name: 'Pachinko',
      summary: 'The pocket decides the prize',
      rules:
        'Choose the prize and where to drop the ball: the pocket decides what you win, a small prize or a big one; the middle pocket is the jackpot. Pockets with a dash pay nothing.',
      bonusRules: 'Grand Wheel bonus: the prize stays {prize}. Choose where to drop the ball, the pocket shows what you win.',
    },
  },
  pachinko: {
    launch: 'Drop the ball',
    hint: 'Move the mouse over the board to choose where it falls, then click. Arrow keys and the space bar work too.',
    redHits: 'Red pegs hit',
    powerOn: 'Violet activated',
    powerOff: 'Hit the violet peg',
    chance: 'Win probability',
    detail: 'Pachinko · coloured pegs',
    colorRules:
      'Pockets with a dash pay nothing; the others climb with every red hit, from a small prize up to a big one. With all 8 reds the middle pocket is the jackpot. The violet orb multiplies the day’s odds once more.',
    fever: 'Gold fever',
    feverTitle: 'ALL REDS CLEARED!',
  },
  detail: {
    pachinko: 'winning pocket',
  },
};
