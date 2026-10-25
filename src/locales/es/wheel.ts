export default {
  games: {
    wheel: {
      name: 'Gran Rueda',
      summary: 'Multiplicador: premio · Rueda: pago',
      rules: 'El Multiplicador elige el premio y la rueda cuánto ganas: un premio pequeño o un premio grande. Cara o Cruz, Caza del Premio y Pachinko desvelan cuánto ganas; Gran Rueda es el jackpot.',
    },
  },
  wheel: {
    booster: 'MULTIPLICADOR',
    spin: 'Gira la rueda',
    hint: 'O agarra la rueda y lánzala; haz zoom sobre la rueda para verla de cerca',
    segment: { coin: 'CARA O CRUZ', hunt: 'CAZA DEL PREMIO', pachinko: 'PACHINKO', jackpot: 'GRAN RUEDA' },
    pachinkoTitle: 'Bonus Pachinko',
    pachinkoText: 'La bola decide cuánto ganas. El premio sigue siendo {prize}.',
    toPachinko: 'Ir al Pachinko',
    boosterRules:
      'Multiplicador del día: en cada tirada el Multiplicador elige también un tipo de sector, que sale {n} veces más a menudo. El Multiplicador elige el premio y la rueda cuánto ganas: un premio pequeño o un premio grande. Cara o Cruz, Caza del Premio y Pachinko desvelan cuánto ganas; Gran Rueda es el jackpot.',
  },
  coin: { text: 'Oro o rubí: la moneda decide cuánto ganas.', gold: 'oro', ruby: 'rubí', flip: 'Lanza la moneda' },
  hunt: { text: 'Dieciocho casillas y un premio bajo cada una. Elige una.', tile: 'Casilla {n}' },
  detail: {
    wheel: { small: 'sector ganador', big: 'sector ganador', jackpot: 'sector jackpot', coin: 'Cara o Cruz', hunt: 'Caza del Premio', pachinko: 'bonus Pachinko' },
  },
};
