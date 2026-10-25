export default {
  games: {
    blackjack: {
      name: 'Blackjack',
      summary: 'Schlag die Bank, ohne über 21 zu kommen',
      rules:
        'Setz bis zu 5 Chips eines Preises in den Kreis vor deinem Platz: Alle Chips gehören zum Preis des ersten. Dann schlag die Bank, ohne über 21 zu kommen; die Bank steht bei 17. Auf deine ersten zwei Karten kannst du verdoppeln, mit einem zweiten Stapel Chips und nur einer Karte, oder zwei gleichwertige Karten in zwei Hände mit je einem Stapel teilen; nach dem Teilen zählt die beste Hand, geteilte Asse bekommen nur eine Karte. Gewinnst du die Hand, gibt es den Preis der Chips: einen kleinen Preis, einen großen mit einem ausgeteilten Blackjack, Ass und Zehn oder Bild. Der Pik-Blackjack, Pik-Ass und Pik-Bube, ist der Jackpot.',
    },
    holdem: {
      name: "Texas Hold'em",
      summary: 'Die beste Hand gegen die Bank',
      rules:
        'Du und die Bank bekommt je zwei Karten, dann kommen die drei Karten des Flops: mitgehen oder aussteigen. Gehst du mit, folgen Turn und River, und die beste Hand aus fünf Karten gewinnt. Ein Sieg mit höchster Karte, Paar, zwei Paaren oder Drilling bringt einen kleinen Preis, mit Straße oder besser einen großen; der Royal Flush ist der Jackpot. Wer aussteigt, verliert die Hand.',
    },
  },
  cards: {
    you: 'Du',
    dealer: 'Bank',
    deal: 'Geben',
    player: 'Spieler',
    stand: 'Vom Tisch aufstehen',
    sit: 'Hier hinsetzen',
    chooseSeat: 'Wähle einen Platz',
    dealingIn: 'Neue Hand in {seconds}s',
    playIn: '{seconds}s zum Spielen',
    nextHand: 'Du spielst ab der nächsten Hand',
  },
  blackjack: {
    print: 'Bank steht bei 17 · Pik-Blackjack: Jackpot',
    hit: 'Karte',
    stand: 'Stehen',
    double: 'Verdoppeln',
    split: 'Teilen',
    bet: 'Chip für {prize} setzen',
    result: {
      bust: 'Überkauft',
      lose: 'Die Bank gewinnt',
      win: 'Du schlägst die Bank',
      dealerBust: 'Die Bank überkauft sich',
      natural: 'Blackjack!',
      spades: 'Pik-Blackjack!',
    },
  },
  holdem: {
    print: 'Die Bank spielt jede Hand · Royal Flush: Jackpot',
    call: 'Mitgehen',
    fold: 'Aussteigen',
    hands: {
      highCard: 'Höchste Karte',
      pair: 'Paar',
      twoPair: 'Zwei Paare',
      trips: 'Drilling',
      straight: 'Straße',
      flush: 'Flush',
      fullHouse: 'Full House',
      quads: 'Vierling',
      straightFlush: 'Straight Flush',
      royalFlush: 'Royal Flush',
    },
    result: {
      folded: 'Du bist ausgestiegen',
      won: 'Du gewinnst mit {hand}',
      lost: 'Die Bank gewinnt mit {hand}',
      split: 'Unentschieden',
    },
  },
  detail: {
    blackjack: {
      win: 'Hand gewonnen',
      dealerBust: 'Bank überkauft',
      natural: 'ausgeteilter Blackjack',
      spades: 'Pik-Blackjack',
    },
    holdem: 'gewonnen mit {hand}',
  },
};
