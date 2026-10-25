export default {
  games: {
    pachinko: {
      name: 'Pachinko',
      summary: 'La casilla decide el premio',
      rules:
        'Elige el premio y desde dónde soltar la bola: la casilla decide cuánto ganas, un premio pequeño o uno grande; la casilla central es el jackpot. Las casillas con guion no pagan.',
      bonusRules: 'Bonus de la Gran Rueda: el premio sigue siendo {prize}. Elige desde dónde soltar la bola; la casilla muestra cuánto ganas.',
    },
  },
  pachinko: {
    launch: 'Suelta la bola',
    hint: 'Mueve el ratón sobre el tablero para elegir por dónde cae y haz clic. También con las flechas y la barra espaciadora.',
    redHits: 'Rojos tocados',
    powerOn: 'Violeta activado',
    powerOff: 'Toca el violeta',
    chance: 'Probabilidad de ganar',
    detail: 'Pachinko · clavos de colores',
    colorRules:
      'Las casillas con guion no pagan; las demás suben de premio con cada rojo tocado, de un premio pequeño hasta uno grande. Con los 8 rojos, la casilla central es el jackpot. El orbe violeta multiplica otra vez las probabilidades del día.',
    fever: 'Fiebre del oro',
    feverTitle: '¡TODOS LOS ROJOS!',
  },
  detail: {
    pachinko: 'casilla ganadora',
  },
};
