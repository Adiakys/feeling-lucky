export default {
  games: {
    roulette: {
      name: 'Roulette',
      summary: 'Place your chips, then throw the ball',
      rules:
        "Place up to {n} chips of one prize, on the table or with Nassa, Orphelins and Tiers, which lay them on their straight-ups and splits: every chip is of the first one's prize. A straight-up wins the jackpot; split, street, corner and six line a big prize; columns, dozens and even-money bets a small prize. When several bets win the best one counts.",
    },
  },
  roulette: {
    launch: 'Throw the ball',
    clear: 'Take back the chips',
    table: 'Table',
    call: { made: 'Les jeux sont faits', closed: 'Rien ne va plus' },
    board: { column: '2 to 1', dozen1: '1st 12', dozen2: '2nd 12', dozen3: '3rd 12', low: '1–18', even: 'Even', odd: 'Odd', high: '19–36' },
    kind: { straight: 'Straight-up {numbers}', split: 'Split {numbers}', street: 'Street {numbers}', corner: 'Corner {numbers}', line: 'Six line {numbers}' },
    spot: {
      column: { 1: 'Column 1-34', 2: 'Column 2-35', 3: 'Column 3-36' },
      dozen: { 1: 'First dozen', 2: 'Second dozen', 3: 'Third dozen' },
      chance: { low: '1 to 18', even: 'Even', red: 'Red', black: 'Black', odd: 'Odd', high: '19 to 36' },
    },
    track: 'Announced bets',
    announced: { nassa: 'Nassa', orphans: 'Orphelins', tiers: 'Tiers', cost: '{n} chips', label: '{name}, {n} chips' },
    surface: 'Where to bet',
    storm: {
      title: 'Storm',
      rules:
        'Storm Roulette, the bonus of the day. Lay up to {n} chips as on the roulette; at every throw, once the bets are closed, lightning strikes 3 numbers that come out {m} times as often. A straight-up wins the jackpot, splits, streets, corners and six lines a big prize, columns, dozens and even chances a small prize.',
      odds: 'Land {n}× as often',
      numbers: 'Lightning numbers',
    },
    undo: 'Remove last chip',
    rebet: 'Repeat the bet',
  },
  detail: {
    roulette: 'number {n}',
    storm: 'lightning number {n}',
  },
};
