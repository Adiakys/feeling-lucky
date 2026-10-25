export default {
  games: {
    blackjack: {
      name: 'Blackjack',
      summary: 'Gana a la banca sin pasarte de 21',
      rules:
        'Coloca hasta 5 fichas de un premio en el círculo delante de tu puesto: todas las fichas son del premio de la primera. Después gana a la banca sin pasarte de 21; la banca se planta con 17. Con tus dos primeras cartas puedes doblar, con una segunda pila de fichas y una sola carta, o dividir dos cartas del mismo valor en dos manos con una pila cada una; al dividir cuenta la mejor mano, y los ases divididos reciben una sola carta. Ganar la mano vale el premio de las fichas: un premio pequeño, o uno grande con un blackjack servido, as y diez o figura. El blackjack de picas, as y jota de picas, es el jackpot.',
    },
    holdem: {
      name: "Texas Hold'em",
      summary: 'La mejor mano contra la banca',
      rules:
        'Tú y la banca recibís dos cartas y luego salen las tres del flop: ves o te retiras. Si ves, siguen el turn y el river y gana la mejor mano de cinco cartas. Ganar con carta alta, pareja, doble pareja o trío vale un premio pequeño; con escalera o mejor, un premio grande; la escalera real es el jackpot. Si te retiras, pierdes la mano.',
    },
  },
  cards: {
    you: 'Tú',
    dealer: 'Banca',
    deal: 'Repartir',
    player: 'Jugador',
    stand: 'Levantarse de la mesa',
    sit: 'Siéntate aquí',
    chooseSeat: 'Elige un asiento',
    dealingIn: 'Se reparte en {seconds}s',
    playIn: '{seconds}s para jugar',
    nextHand: 'Juegas desde la próxima mano',
  },
  blackjack: {
    print: 'Banca se planta en 17 · Blackjack de picas: jackpot',
    hit: 'Pedir',
    stand: 'Plantarse',
    double: 'Doblar',
    split: 'Dividir',
    bet: 'Apuesta una ficha de {prize}',
    result: {
      bust: 'Te pasas',
      lose: 'Gana la banca',
      win: 'Ganas a la banca',
      dealerBust: 'La banca se pasa',
      natural: '¡Blackjack!',
      spades: '¡Blackjack de picas!',
    },
  },
  holdem: {
    print: 'La banca juega cada mano · Escalera real: jackpot',
    call: 'Ver',
    fold: 'Retirarse',
    hands: {
      highCard: 'Carta alta',
      pair: 'Pareja',
      twoPair: 'Doble pareja',
      trips: 'Trío',
      straight: 'Escalera',
      flush: 'Color',
      fullHouse: 'Full',
      quads: 'Póker',
      straightFlush: 'Escalera de color',
      royalFlush: 'Escalera real',
    },
    result: {
      folded: 'Te has retirado',
      won: 'Ganas con {hand}',
      lost: 'La banca gana con {hand}',
      split: 'Empate',
    },
  },
  detail: {
    blackjack: {
      win: 'mano ganada',
      dealerBust: 'la banca se pasa',
      natural: 'blackjack servido',
      spades: 'blackjack de picas',
    },
    holdem: 'ganado con {hand}',
  },
};
