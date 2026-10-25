export default {
  games: {
    roulette: {
      name: 'Roulette',
      summary: 'Setz deine Chips, dann wirf die Kugel',
      rules:
        'Setz bis zu {n} Chips eines Preises, auf den Tisch oder mit Nassa, Orphelins und Tiers, die sie auf ihre Pleins und Chevaux verteilen: Alle Chips gehören zum Preis des ersten. Ein Plein gewinnt den Jackpot; Cheval, Transversale pleine, Carré und Transversale simple einen großen Preis; Kolonnen, Dutzende und einfache Chancen einen kleinen Preis. Gewinnen mehrere Einsätze, zählt der beste.',
    },
  },
  roulette: {
    launch: 'Kugel werfen',
    clear: 'Chips zurücknehmen',
    table: 'Tisch',
    call: { made: 'Les jeux sont faits', closed: 'Rien ne va plus' },
    board: { column: '2:1', dozen1: '12P', dozen2: '12M', dozen3: '12D', low: 'Manque', even: 'Pair', odd: 'Impair', high: 'Passe' },
    kind: { straight: 'Plein {numbers}', split: 'Cheval {numbers}', street: 'Transversale pleine {numbers}', corner: 'Carré {numbers}', line: 'Transversale simple {numbers}' },
    spot: {
      column: { 1: 'Kolonne 1-34', 2: 'Kolonne 2-35', 3: 'Kolonne 3-36' },
      dozen: { 1: 'Erstes Dutzend', 2: 'Mittleres Dutzend', 3: 'Letztes Dutzend' },
      chance: { low: 'Manque, 1 bis 18', even: 'Pair', red: 'Rouge', black: 'Noir', odd: 'Impair', high: 'Passe, 19 bis 36' },
    },
    track: 'Annoncen',
    announced: { nassa: 'Nassa', orphans: 'Orphelins', tiers: 'Tiers', cost: '{n} Chips', label: '{name}, {n} Chips' },
    surface: 'Wo setzen',
    storm: {
      title: 'Sturm',
      rules:
        'Sturm-Roulette, der Bonus des Tages. Setz bis zu {n} Chips wie beim Roulette; bei jedem Wurf schlägt nach Rien ne va plus der Blitz in 3 Zahlen ein, die {m}-mal so oft kommen. Ein Plein gewinnt den Jackpot; Chevaux, Transversales pleines, Carrés und Transversales simples einen großen Preis; Kolonnen, Dutzende und einfache Chancen einen kleinen Preis.',
      odds: 'Kommen {n}× so oft',
      numbers: 'Blitzzahlen',
    },
    undo: 'Letzten Chip entfernen',
    rebet: 'Einsatz wiederholen',
  },
  detail: {
    roulette: 'Zahl {n}',
    storm: 'Blitzzahl {n}',
  },
};
