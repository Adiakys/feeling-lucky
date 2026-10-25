export default {
  games: {
    blackjack: {
      name: 'Blackjack',
      summary: 'Batti il banco senza superare 21',
      rules:
        'Punta fino a 5 fiches di un premio nel cerchio davanti al tuo posto: tutte le fiches sono del premio della prima. Poi batti il banco senza superare 21; il banco sta su 17. Sulle prime due carte puoi raddoppiare, con una seconda pila di fiches e una sola carta, o dividere due carte dello stesso valore in due mani con una pila ciascuna; dividendo conta la mano migliore, gli assi divisi ricevono una carta sola. Vincere la mano vale il premio delle fiches: un premio piccolo, un premio grande con il blackjack servito, asso e dieci o figura. Il blackjack di picche, asso e jack di picche, è il jackpot.',
    },
    holdem: {
      name: "Texas Hold'em",
      summary: 'La mano migliore contro il banco',
      rules:
        'Tu e il banco ricevete due carte, poi escono le tre del flop: vedi o lascia. Se vedi escono turn e river e vince la mano migliore di cinque carte. Vincere con carta alta, coppia, doppia coppia o tris vale un premio piccolo, con una scala o più un premio grande; la scala reale è il jackpot. Se lasci, la mano è persa.',
    },
  },
  cards: {
    you: 'Tu',
    dealer: 'Banco',
    deal: 'Distribuisci',
  },
  blackjack: {
    print: 'Il banco sta su 17 · Blackjack di picche: jackpot',
    hit: 'Carta',
    stand: 'Stai',
    double: 'Raddoppia',
    split: 'Dividi',
    bet: 'Punta una fiche di {prize}',
    result: {
      bust: 'Sballato',
      lose: 'Vince il banco',
      win: 'Hai battuto il banco',
      dealerBust: 'Il banco sballa',
      natural: 'Blackjack!',
      spades: 'Blackjack di picche!',
    },
  },
  holdem: {
    print: 'Il banco gioca ogni mano · Scala reale: jackpot',
    call: 'Vedi',
    fold: 'Lascia',
    hands: {
      highCard: 'Carta alta',
      pair: 'Coppia',
      twoPair: 'Doppia coppia',
      trips: 'Tris',
      straight: 'Scala',
      flush: 'Colore',
      fullHouse: 'Full',
      quads: 'Poker',
      straightFlush: 'Scala colore',
      royalFlush: 'Scala reale',
    },
    result: {
      folded: 'Hai lasciato la mano',
      won: 'Vinci con {hand}',
      lost: 'Il banco vince con {hand}',
      split: 'Pareggio',
    },
  },
  detail: {
    blackjack: {
      win: 'mano vinta',
      dealerBust: 'banco sballato',
      natural: 'blackjack servito',
      spades: 'blackjack di picche',
    },
    holdem: 'vinto con {hand}',
  },
};
