export default {
  games: {
    wheel: {
      name: 'Gran Ruota',
      summary: 'Moltiplicatore: premio · Ruota: vincita',
      rules: 'Il Moltiplicatore sceglie il premio, la ruota la vincita: un premio piccolo o un premio grande. Testa o Croce, Caccia al Premio e Pachinko rivelano la vincita; Gran Ruota è il jackpot.',
    },
  },
  wheel: {
    booster: 'MOLTIPLICATORE',
    spin: 'Gira la ruota',
    hint: 'Oppure afferra la ruota e lanciala; fai zoom sulla ruota per vederla da vicino',
    segment: { coin: 'TESTA O CROCE', hunt: 'CACCIA AL PREMIO', pachinko: 'PACHINKO', jackpot: 'GRAN RUOTA' },
    pachinkoTitle: 'Bonus Pachinko',
    pachinkoText: 'La vincita la decide la pallina. Il premio resta {prize}.',
    toPachinko: 'Vai al Pachinko',
    boosterRules:
      'Moltiplicatore del giorno: a ogni giro il Moltiplicatore sceglie anche un tipo di spicchio, che esce {n} volte più spesso. Il Moltiplicatore sceglie il premio, la ruota la vincita: un premio piccolo o un premio grande. Testa o Croce, Caccia al Premio e Pachinko rivelano la vincita; Gran Ruota è il jackpot.',
  },
  coin: { text: 'Oro o rubino: la moneta sceglie la vincita.', gold: 'oro', ruby: 'rubino', flip: 'Lancia la moneta' },
  hunt: { text: 'Diciotto caselle, una vincita sotto ognuna. Scegline una.', tile: 'Casella {n}' },
  detail: {
    wheel: { small: 'spicchio vincente', big: 'spicchio vincente', jackpot: 'spicchio jackpot', coin: 'Testa o Croce', hunt: 'Caccia al Premio', pachinko: 'bonus Pachinko' },
  },
};
