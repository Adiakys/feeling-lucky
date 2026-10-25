export default {
  games: {
    roulette: {
      name: 'Roulette',
      summary: 'Coloca las fichas y lanza la bola',
      rules:
        'Coloca hasta {n} fichas de un premio, en la mesa o con Nassa, Huérfanos y Tercio, que las reparten en sus plenos y caballos: todas las fichas son del premio de la primera. El pleno gana el jackpot; caballo, transversal, cuadro y seisena un premio grande; columnas, docenas y suertes sencillas un premio pequeño. Si ganan varias apuestas, cuenta la mejor.',
    },
  },
  roulette: {
    launch: 'Lanza la bola',
    clear: 'Retira las fichas',
    table: 'Mesa',
    call: { made: 'Les jeux sont faits', closed: 'Rien ne va plus' },
    board: { column: '2 a 1', dozen1: '1ª 12', dozen2: '2ª 12', dozen3: '3ª 12', low: 'Falta', even: 'Par', odd: 'Impar', high: 'Pasa' },
    kind: { straight: 'Pleno {numbers}', split: 'Caballo {numbers}', street: 'Transversal {numbers}', corner: 'Cuadro {numbers}', line: 'Seisena {numbers}' },
    spot: {
      column: { 1: 'Columna 1-34', 2: 'Columna 2-35', 3: 'Columna 3-36' },
      dozen: { 1: 'Primera docena', 2: 'Segunda docena', 3: 'Tercera docena' },
      chance: { low: 'Falta, del 1 al 18', even: 'Par', red: 'Rojo', black: 'Negro', odd: 'Impar', high: 'Pasa, del 19 al 36' },
    },
    track: 'Apuestas anunciadas',
    announced: { nassa: 'Nassa', orphans: 'Huérfanos', tiers: 'Tercio', cost: '{n} fichas', label: '{name}, {n} fichas' },
    surface: 'Dónde apostar',
    storm: {
      title: 'Tormenta',
      rules:
        'Ruleta Tormenta, el bonus del día. Coloca hasta {n} fichas como en la ruleta; en cada tirada, con las apuestas cerradas, el rayo cae sobre 3 números que salen {m} veces más a menudo. El pleno gana el jackpot; caballos, transversales, cuadros y seisenas un premio grande; columnas, docenas y suertes sencillas un premio pequeño.',
      odds: 'Salen {n}× más a menudo',
      numbers: 'Números rayo',
    },
    undo: 'Quita la última ficha',
    rebet: 'Repite la apuesta',
  },
  detail: {
    roulette: 'número {n}',
    storm: 'número rayo {n}',
  },
};
