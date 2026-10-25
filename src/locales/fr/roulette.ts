export default {
  games: {
    roulette: {
      name: 'Roulette',
      summary: 'Misez vos jetons, puis lancez la bille',
      rules:
        "Posez jusqu'à {n} jetons d'un même lot, sur le tapis ou avec Nassa, Orphelins et Tiers, qui les placent sur leurs pleins et chevaux : tous les jetons sont du lot du premier. Le plein gagne le jackpot ; cheval, transversale, carré et sixain un gros lot ; colonnes, douzaines et chances simples un petit lot. Si plusieurs mises gagnent, la meilleure compte.",
    },
  },
  roulette: {
    launch: 'Lancer la bille',
    clear: 'Retirer les jetons',
    table: 'Tapis',
    call: { made: 'Les jeux sont faits', closed: 'Rien ne va plus' },
    board: { column: '2 à 1', dozen1: '12P', dozen2: '12M', dozen3: '12D', low: 'Manque', even: 'Pair', odd: 'Impair', high: 'Passe' },
    kind: { straight: 'Plein {numbers}', split: 'Cheval {numbers}', street: 'Transversale {numbers}', corner: 'Carré {numbers}', line: 'Sixain {numbers}' },
    spot: {
      column: { 1: 'Colonne 1-34', 2: 'Colonne 2-35', 3: 'Colonne 3-36' },
      dozen: { 1: 'Première douzaine', 2: 'Moyenne douzaine', 3: 'Dernière douzaine' },
      chance: { low: 'Manque, 1 à 18', even: 'Pair', red: 'Rouge', black: 'Noir', odd: 'Impair', high: 'Passe, 19 à 36' },
    },
    track: 'Annonces',
    announced: { nassa: 'Nassa', orphans: 'Orphelins', tiers: 'Tiers', cost: '{n} jetons', label: '{name}, {n} jetons' },
    surface: 'Où miser',
    storm: {
      title: 'Tempête',
      rules:
        "Roulette Tempête, le bonus du jour. Posez jusqu'à {n} jetons comme à la roulette ; à chaque lancer, une fois les mises closes, la foudre frappe 3 numéros qui sortent {m} fois plus souvent. Le plein gagne le jackpot ; chevaux, transversales, carrés et sixains un gros lot ; colonnes, douzaines et chances simples un petit lot.",
      odds: 'Sortent {n}× plus souvent',
      numbers: 'Numéros foudre',
    },
    undo: 'Retirer le dernier jeton',
    rebet: 'Rejouer la mise',
  },
  detail: {
    roulette: 'numéro {n}',
    storm: 'numéro foudre {n}',
  },
};
