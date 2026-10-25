import { html, nothing, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ROULETTE_ORDER, ROULETTE_RED } from '../../engine/roulette';
import { LuckyElement } from '../../runtime/element';

const WIDTH = 360 / ROULETTE_ORDER.length;

export const polar = (radius: number, degrees: number) => {
  const radians = (degrees * Math.PI) / 180;
  return [radius * Math.sin(radians), -radius * Math.cos(radians)] as const;
};

function sector(inner: number, outer: number, from: number, to: number) {
  const [x0, y0] = polar(outer, from);
  const [x1, y1] = polar(outer, to);
  const [x2, y2] = polar(inner, to);
  const [x3, y3] = polar(inner, from);
  return `M${x3.toFixed(2)} ${y3.toFixed(2)}L${x0.toFixed(2)} ${y0.toFixed(2)}A${outer} ${outer} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}A${inner} ${inner} 0 0 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z`;
}

const colorOf = (number: number) => (number === 0 ? ['#156b3c', '#0e4a29'] : ROULETTE_RED.has(number) ? ['#9e1b22', '#6e1218'] : ['#17120e', '#0c0906']);

const pockets = ROULETTE_ORDER.map((number, index) => {
  const from = index * WIDTH - WIDTH / 2;
  const [outer, inner] = colorOf(number);
  return {
    number,
    outer: { d: sector(206, 236, from, from + WIDTH), fill: outer },
    inner: { d: sector(174, 206, from, from + WIDTH), fill: inner },
    whole: sector(176, 234, from + 0.6, from + WIDTH - 0.6),
    label: `rotate(${index * WIDTH}) translate(0 -221)`,
    fret: [polar(174, from), polar(236, from)] as const,
  };
});
const diamonds = Array.from({ length: 8 }, (_, index) => index * 45 + 22.5);
const rosette = Array.from({ length: 24 }, (_, index) => index * 7.5);

// A European wheel seen from above: mahogany bowl, gold frets, a cylinder the game turns.
// struck: the pockets lightning struck in Storm Roulette, lit in gold. rootClass goes on the svg.
@customElement('fl-roulette-wheel')
export class RouletteWheel extends LuckyElement {
  @property() prefix = 'rl';
  @property({ type: Boolean }) ball = false;
  @property({ attribute: false }) struck?: number[];
  @property() rootClass = '';

  render() {
    const { prefix, struck } = this;
    const gold = `url(#${prefix}-gold)`;
    return html`
      <svg class=${this.rootClass || nothing} viewBox="-320 -320 640 640">
        <defs>
          <radialGradient id="${prefix}-cone" cx="-.2" cy="-.3" r="1.1"><stop offset="0" stop-color="#8a4a24" /><stop offset="1" stop-color="#3a1a0b" /></radialGradient>
          <radialGradient id="${prefix}-track" r=".5"><stop offset=".78" stop-color="#0c0906" /><stop offset=".9" stop-color="#6b3519" /><stop offset="1" stop-color="#4a2410" /></radialGradient>
          <radialGradient id="${prefix}-gloss" cx="-100" cy="-160" r="380" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".18" /><stop offset=".6" stop-color="#fff" stop-opacity="0" /></radialGradient>
          <linearGradient id="${prefix}-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3c4" /><stop offset=".42" stop-color="#d4a94e" /><stop offset=".55" stop-color="#8a6420" /><stop offset="1" stop-color="#f1d892" /></linearGradient>
          <radialGradient id="${prefix}-ball" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff" /><stop offset=".5" stop-color="#ece6d8" /><stop offset="1" stop-color="#8a7f6a" /></radialGradient>
        </defs>
        <circle r="314" fill="#4a2410" />
        <circle r="306" fill="none" stroke=${gold} stroke-width="10" />
        <circle r="296" fill="url(#${prefix}-track)" />
        <circle r="242" fill="#0c0906" />
        ${diamonds.map((angle) => svg`<path transform="rotate(${angle}) translate(0 -258)" d="M0 -9 L6 0 L0 9 L-6 0Z" fill=${gold} stroke="#3a2a10" stroke-width=".8" />`)}
        <g class="lk-rl-rotor">
          <circle r="238" fill="#0c0906" />
          ${pockets.map(
            (pocket) => svg`
              <path d=${pocket.outer.d} fill=${pocket.outer.fill} />
              <path d=${pocket.inner.d} fill=${pocket.inner.fill} />
              ${struck?.includes(pocket.number) ? svg`<path d=${pocket.whole} class="lk-rl-struck" fill=${gold} />` : nothing}
              <text transform=${pocket.label} text-anchor="middle" dominant-baseline="middle" font-weight="700" font-size="13" fill="#f6efe0">${pocket.number}</text>
              <line x1=${pocket.fret[0][0]} y1=${pocket.fret[0][1]} x2=${pocket.fret[1][0]} y2=${pocket.fret[1][1]} stroke=${gold} stroke-width="2" />
            `,
          )}
          <circle r="174" fill="url(#${prefix}-cone)" />
          ${rosette.map((angle) => svg`<ellipse rx="120" ry="34" transform="rotate(${angle})" fill="none" stroke="#f3d488" stroke-opacity=".25" stroke-width=".7" />`)}
          <circle r="174" fill="none" stroke=${gold} stroke-width="3" />
          <circle r="236" fill="none" stroke=${gold} stroke-width="3" />
          <g stroke=${gold} stroke-width="9" stroke-linecap="round"><line x1="-62" y1="0" x2="62" y2="0" /><line x1="0" y1="-62" x2="0" y2="62" /></g>
          <circle r="22" fill=${gold} stroke="#3a2a10" />
          <circle r="9" fill="#9e1b2a" />
        </g>
        ${this.ball ? svg`<g class="lk-rl-ball"><circle r="9.5" fill="url(#${prefix}-ball)" /><circle cx="-3" cy="-3" r="2.6" fill="#fff" /></g>` : nothing}
        <circle r="300" fill="url(#${prefix}-gloss)" pointer-events="none" />
      </svg>
    `;
  }
}
