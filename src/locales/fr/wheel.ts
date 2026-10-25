export default {
  games: {
    wheel: {
      name: 'Grande Roue',
      summary: 'Multiplicateur : lot · Roue : gain',
      rules: 'Le Multiplicateur choisit le lot, la roue ce que vous gagnez : un petit lot ou un gros lot. Pile ou Face, Chasse au Trésor et Pachinko révèlent le gain ; Grande Roue, c’est le jackpot.',
    },
  },
  wheel: {
    booster: 'MULTIPLICATEUR',
    spin: 'Lancer la roue',
    hint: 'Ou attrapez la roue et lancez-la ; zoomez sur la roue pour la voir de près',
    segment: { coin: 'PILE OU FACE', hunt: 'CHASSE AU TRÉSOR', pachinko: 'PACHINKO', jackpot: 'GRANDE ROUE' },
    pachinkoTitle: 'Bonus Pachinko',
    pachinkoText: 'La bille décide du gain. Le lot reste {prize}.',
    toPachinko: 'Aller au Pachinko',
    boosterRules:
      'Multiplicateur du jour : à chaque tour, le Multiplicateur choisit aussi un type de secteur, qui sort {n} fois plus souvent. Le Multiplicateur choisit le lot, la roue ce que vous gagnez : un petit lot ou un gros lot. Pile ou Face, Chasse au Trésor et Pachinko révèlent le gain ; Grande Roue, c’est le jackpot.',
  },
  coin: { text: 'Or ou rubis : la pièce décide du gain.', gold: 'or', ruby: 'rubis', flip: 'Lancer la pièce' },
  hunt: { text: 'Dix-huit cases, un gain sous chacune. Choisissez-en une.', tile: 'Case {n}' },
  detail: {
    wheel: { small: 'secteur gagnant', big: 'secteur gagnant', jackpot: 'secteur jackpot', coin: 'Pile ou Face', hunt: 'Chasse au Trésor', pachinko: 'bonus Pachinko' },
  },
};
