export default {
  games: {
    pachinko: {
      name: 'Pachinko',
      summary: 'La case décide du lot',
      rules:
        "Choisissez le lot et d'où lâcher la bille : la case décide de ce que vous gagnez, un petit lot ou un gros ; la case centrale est le jackpot. Les cases avec un tiret ne paient rien.",
      bonusRules: "Bonus de la Grande Roue : le lot reste {prize}. Choisissez d'où lâcher la bille, la case indique ce que vous gagnez.",
    },
  },
  pachinko: {
    launch: 'Lâcher la bille',
    hint: "Déplacez la souris sur le plateau pour choisir d'où elle tombe, puis cliquez. Les flèches et la barre d'espace marchent aussi.",
    redHits: 'Rouges touchés',
    powerOn: 'Violet activé',
    powerOff: 'Touchez le violet',
    chance: 'Probabilité de gain',
    detail: 'Pachinko · clous colorés',
    colorRules:
      "Les cases avec un tiret ne paient rien ; les autres montent à chaque rouge touché, d'un petit lot jusqu'à un gros. Avec les 8 rouges, la case centrale est le jackpot. L'orbe violet multiplie encore les chances du jour.",
    fever: 'Fièvre de l’or',
    feverTitle: 'TOUS LES ROUGES !',
  },
  detail: {
    pachinko: 'case gagnante',
  },
};
