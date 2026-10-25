export default {
  games: {
    blackjack: {
      name: 'Blackjack',
      summary: 'Battez la banque sans dépasser 21',
      rules:
        "Posez jusqu'à 5 jetons d'un même lot dans le cercle devant votre place : tous les jetons sont du lot du premier. Puis battez la banque sans dépasser 21 ; la banque reste à 17. Sur vos deux premières cartes, vous pouvez doubler, avec une seconde pile de jetons et une seule carte, ou séparer deux cartes de même valeur en deux mains avec une pile chacune ; après une séparation, la meilleure main compte et les as séparés reçoivent une seule carte. Gagner la main rapporte le lot des jetons : un petit lot, ou un gros lot avec un blackjack servi, un as avec un dix ou une figure. Le blackjack de pique, as et valet de pique, est le jackpot.",
    },
    holdem: {
      name: "Texas Hold'em",
      summary: 'La meilleure main contre la banque',
      rules:
        'Vous et la banque recevez deux cartes, puis les trois cartes du flop sont retournées : suivez ou couchez-vous. Si vous suivez, viennent le turn et la river, et la meilleure main de cinq cartes gagne. Gagner avec une carte haute, une paire, une double paire ou un brelan rapporte un petit lot, avec une quinte ou mieux un gros lot ; la quinte flush royale est le jackpot. Se coucher fait perdre la main.',
    },
  },
  cards: {
    you: 'Vous',
    dealer: 'Banque',
    deal: 'Distribuer',
    player: 'Joueur',
    stand: 'Quitter la table',
    sit: 'S’asseoir ici',
    chooseSeat: 'Choisissez une place',
    dealingIn: 'Distribution dans {seconds}s',
    playIn: '{seconds}s pour jouer',
    nextHand: 'Vous jouez dès la prochaine main',
  },
  blackjack: {
    print: 'La banque reste à 17 · Blackjack de pique : jackpot',
    hit: 'Carte',
    stand: 'Rester',
    double: 'Doubler',
    split: 'Séparer',
    bet: 'Miser un jeton {prize}',
    result: {
      bust: 'Brûlé',
      lose: 'La banque gagne',
      win: 'Vous battez la banque',
      dealerBust: 'La banque brûle',
      natural: 'Blackjack !',
      spades: 'Blackjack de pique !',
    },
  },
  holdem: {
    print: 'La banque joue tout · Quinte flush royale : jackpot',
    call: 'Suivre',
    fold: 'Se coucher',
    hands: {
      highCard: 'Carte haute',
      pair: 'Paire',
      twoPair: 'Double paire',
      trips: 'Brelan',
      straight: 'Quinte',
      flush: 'Couleur',
      fullHouse: 'Full',
      quads: 'Carré',
      straightFlush: 'Quinte flush',
      royalFlush: 'Quinte flush royale',
    },
    result: {
      folded: 'Vous vous êtes couché',
      won: 'Vous gagnez avec {hand}',
      lost: 'La banque gagne avec {hand}',
      split: 'Égalité',
    },
  },
  detail: {
    blackjack: {
      win: 'main gagnée',
      dealerBust: 'la banque brûle',
      natural: 'blackjack servi',
      spades: 'blackjack de pique',
    },
    holdem: 'gagné avec {hand}',
  },
};
