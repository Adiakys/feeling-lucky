export default {
  games: {
    roulette: {
      name: 'Roulette',
      summary: 'Punta le fiches, poi lancia la pallina',
      rules:
        'Posa fino a {n} fiches di un premio, sul tavolo o con Nassa, Orfanelli e Serie 5/8, che le mettono sui loro pieni e cavalli: tutte le fiches sono del premio della prima. Il pieno vince il jackpot; cavallo, terzina, carré e sestina un premio grande; colonne, dozzine e chances semplici un premio piccolo. Se vincono più puntate conta la migliore.',
    },
  },
  roulette: {
    launch: 'Lancia la pallina',
    clear: 'Ritira le fiches',
    table: 'Tavolo',
    call: { made: 'Les jeux sont faits', closed: 'Rien ne va plus' },
    board: { column: '2:1', dozen1: '1ª 12', dozen2: '2ª 12', dozen3: '3ª 12', low: '1–18', even: 'Pari', odd: 'Dispari', high: '19–36' },
    kind: { straight: 'Pieno {numbers}', split: 'Cavallo {numbers}', street: 'Terzina {numbers}', corner: 'Carré {numbers}', line: 'Sestina {numbers}' },
    spot: {
      column: { 1: 'Colonna 1-34', 2: 'Colonna 2-35', 3: 'Colonna 3-36' },
      dozen: { 1: 'Prima dozzina', 2: 'Seconda dozzina', 3: 'Terza dozzina' },
      chance: { low: 'Da 1 a 18', even: 'Pari', red: 'Rosso', black: 'Nero', odd: 'Dispari', high: 'Da 19 a 36' },
    },
    track: 'Giocate annunciate',
    announced: { nassa: 'Nassa', orphans: 'Orfanelli', tiers: 'Serie 5/8', cost: '{n} fiches', label: '{name}, {n} fiches' },
    surface: 'Dove puntare',
    storm: {
      title: 'Tempesta',
      rules:
        'Roulette Tempesta, il bonus del giorno. Posa fino a {n} fiches come alla roulette; a ogni lancio, a puntate chiuse, il fulmine colpisce 3 numeri che escono {m} volte più spesso. Il pieno vince il jackpot, cavalli, terzine, carré e sestine un premio grande, colonne, dozzine e chances semplici un premio piccolo.',
      odds: 'Escono {n}× più spesso',
      numbers: 'Numeri fulmine',
    },
    undo: "Togli l'ultima fiche",
    rebet: 'Ripeti la puntata',
  },
  detail: {
    roulette: 'numero {n}',
    storm: 'numero fulmine {n}',
  },
};
