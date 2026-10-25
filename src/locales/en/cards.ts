export default {
  games: {
    blackjack: {
      name: 'Blackjack',
      summary: 'Beat the dealer without going over 21',
      rules:
        "Place up to 5 chips of one prize on the circle in front of your seat: every chip is of the first one's prize. Then beat the dealer without going over 21; the dealer stands on 17. On your first two cards you can double, with a second stack of chips and one card only, or split two cards of the same value into two hands with a stack each; after a split the best hand counts, split aces take one card each. Winning the hand pays the chips' prize: a small prize, a big prize with a dealt blackjack, an ace with a ten or a picture card. The blackjack of spades, ace and jack of spades, is the jackpot.",
    },
    holdem: {
      name: "Texas Hold'em",
      summary: 'The best hand against the dealer',
      rules:
        'You and the dealer get two cards, then the three of the flop come out: call or fold. If you call, turn and river follow and the best five-card hand wins. Winning with a high card, a pair, two pair or three of a kind pays a small prize, with a straight or better a big prize; the royal flush is the jackpot. Folding loses the hand.',
    },
  },
  cards: {
    you: 'You',
    dealer: 'Dealer',
    deal: 'Deal',
  },
  blackjack: {
    print: 'Dealer stands on 17 · Blackjack of spades: jackpot',
    hit: 'Hit',
    stand: 'Stand',
    double: 'Double',
    split: 'Split',
    bet: 'Place a {prize} chip',
    result: {
      bust: 'Bust',
      lose: 'Dealer wins',
      win: 'You beat the dealer',
      dealerBust: 'Dealer busts',
      natural: 'Blackjack!',
      spades: 'Blackjack of spades!',
    },
  },
  holdem: {
    print: 'The dealer plays every hand · Royal flush: jackpot',
    call: 'Call',
    fold: 'Fold',
    hands: {
      highCard: 'High card',
      pair: 'Pair',
      twoPair: 'Two pair',
      trips: 'Three of a kind',
      straight: 'Straight',
      flush: 'Flush',
      fullHouse: 'Full house',
      quads: 'Four of a kind',
      straightFlush: 'Straight flush',
      royalFlush: 'Royal flush',
    },
    result: {
      folded: 'You folded',
      won: 'You win with {hand}',
      lost: 'Dealer wins with {hand}',
      split: 'Split',
    },
  },
  detail: {
    blackjack: {
      win: 'hand won',
      dealerBust: 'dealer bust',
      natural: 'dealt blackjack',
      spades: 'blackjack of spades',
    },
    holdem: 'won with {hand}',
  },
};
