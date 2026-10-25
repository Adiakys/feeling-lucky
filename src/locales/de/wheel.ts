export default {
  games: {
    wheel: {
      name: 'Großes Rad',
      summary: 'Multiplikator: Preis · Rad: Gewinn',
      rules: 'Der Multiplikator wählt den Preis, das Rad den Gewinn: einen kleinen oder einen großen Preis. Kopf oder Zahl, Preisjagd und Pachinko decken den Gewinn auf; Großes Rad ist der Jackpot.',
    },
  },
  wheel: {
    booster: 'MULTIPLIKATOR',
    spin: 'Rad drehen',
    hint: 'Oder pack das Rad und schleudere es; zoome auf das Rad, um es aus der Nähe zu sehen',
    segment: { coin: 'KOPF ODER ZAHL', hunt: 'PREISJAGD', pachinko: 'PACHINKO', jackpot: 'GROSSES RAD' },
    pachinkoTitle: 'Pachinko-Bonus',
    pachinkoText: 'Die Kugel entscheidet den Gewinn. Der Preis bleibt {prize}.',
    toPachinko: 'Zum Pachinko',
    boosterRules:
      'Multiplikator des Tages: Bei jeder Drehung wählt der Multiplikator auch eine Feldart, die {n}-mal so oft kommt. Der Multiplikator wählt den Preis, das Rad den Gewinn: einen kleinen oder einen großen Preis. Kopf oder Zahl, Preisjagd und Pachinko decken den Gewinn auf; Großes Rad ist der Jackpot.',
  },
  coin: { text: 'Gold oder Rubin: Die Münze entscheidet den Gewinn.', gold: 'Gold', ruby: 'Rubin', flip: 'Münze werfen' },
  hunt: { text: 'Achtzehn Felder, unter jedem ein Gewinn. Wähl eins.', tile: 'Feld {n}' },
  detail: {
    wheel: { small: 'Gewinnfeld', big: 'Gewinnfeld', jackpot: 'Jackpotfeld', coin: 'Kopf oder Zahl', hunt: 'Preisjagd', pachinko: 'Pachinko-Bonus' },
  },
};
