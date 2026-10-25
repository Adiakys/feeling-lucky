import { html, svg } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { wheelSegments, type WheelSegment } from '../../engine/wheel';
import { LuckyElement } from '../../runtime/element';

const RADIUS = 250;

const polar = (radius: number, degrees: number) => {
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

const rosette = Array.from({ length: 18 }, (_, index) => index * 10);

// The Grand Wheel: a rotor of 54 segments inside a gold rim of lamps. rootClass goes on the svg, so the
// parent's selectors reach it. boosted: the segments the Booster of the day lit, with their label.
@customElement('fl-wheel-face')
export class WheelFace extends LuckyElement {
  @property() rootClass = '';
  @property() prefix = 'wheel';
  @property({ attribute: false }) boosted: number[] = [];
  @property() boostLabel = '';
  @state() private winPath = '';
  @query('.lk-rotor') rotor?: SVGGElement;

  get segments(): WheelSegment[] {
    return wheelSegments(this.room.board);
  }

  highlight(index: number | null) {
    const width = 360 / this.segments.length;
    this.winPath = index === null ? '' : sector(64, RADIUS, index * width, (index + 1) * width);
  }

  render() {
    const { prefix, segments } = this;
    const width = 360 / segments.length;
    const style: Record<WheelSegment['kind'], { fill: string; ink: string }> = {
      none: { fill: '#2a170c', ink: '#d4a94e' },
      small: { fill: '#1d3561', ink: '#f6e2a6' },
      big: { fill: '#7d1c24', ink: '#f6e2a6' },
      coin: { fill: '#1d3561', ink: '#fff' },
      hunt: { fill: '#1c6136', ink: '#fff' },
      pachinko: { fill: '#22584d', ink: '#fff' },
      jackpot: { fill: `url(#${prefix}-jackpot)`, ink: '#2a1a05' },
    };
    const faces = segments.map((segment, index) => {
      const from = index * width;
      const mid = from + width / 2;
      const pale = segment.kind === 'small' && segment.pale;
      return {
        path: sector(64, RADIUS, from, from + width),
        split: segment.kind === 'coin' ? sector(64, RADIUS, mid, from + width) : null,
        fill: pale ? '#efe4c8' : style[segment.kind].fill,
        ink: pale ? '#3a240a' : style[segment.kind].ink,
        label:
          segment.kind === 'none' ? '' : segment.kind === 'small' || segment.kind === 'big' ? this.room.award(segment.kind, segment.award) : this.t(`wheel.segment.${segment.kind}`),
        labelTransform: `rotate(${mid - 90}) translate(158 0)`,
        dot: segment.kind === 'none' ? polar(214, mid) : null,
        peg: polar(RADIUS - 3, from),
        spoke: [polar(64, from), polar(RADIUS, from)] as const,
      };
    });
    const boostMarks = this.boosted.map((index) => ({
      path: sector(64, RADIUS, index * width, (index + 1) * width),
      badge: `rotate(${index * width + width / 2}) translate(0 -226)`,
    }));
    const lamps = segments.map((_, index) => polar(268, index * width + width / 2));
    return html`
      <svg class=${this.rootClass} viewBox="-300 -300 600 600">
        <defs>
          <linearGradient id="${prefix}-jackpot" gradientUnits="userSpaceOnUse" x1="-60" y1="-250" x2="60" y2="-60">
            <stop offset="0" stop-color="#6b4a14" /><stop offset=".45" stop-color="#f3d488" /><stop offset=".6" stop-color="#c79a3e" /><stop offset="1" stop-color="#5a3c0e" />
          </linearGradient>
          <radialGradient id="${prefix}-shade" cx="0" cy="0" r="250" gradientUnits="userSpaceOnUse">
            <stop offset=".26" stop-color="#000" stop-opacity=".5" /><stop offset=".62" stop-color="#000" stop-opacity=".08" /><stop offset=".95" stop-color="#000" stop-opacity="0" /><stop offset="1" stop-color="#000" stop-opacity=".35" />
          </radialGradient>
          <radialGradient id="${prefix}-gloss" cx="-90" cy="-140" r="340" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#fff" stop-opacity=".2" /><stop offset=".6" stop-color="#fff" stop-opacity="0" />
          </radialGradient>
          <radialGradient id="${prefix}-hub" cx="-.3" cy="-.4" r="1.3"><stop offset="0" stop-color="#3a2010" /><stop offset="1" stop-color="#120a05" /></radialGradient>
          <linearGradient id="${prefix}-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#fff3c4" /><stop offset=".42" stop-color="#d4a94e" /><stop offset=".55" stop-color="#8a6420" /><stop offset="1" stop-color="#f1d892" />
          </linearGradient>
        </defs>
        <g class="lk-rotor">
          ${faces.map(
            (face) => svg`
              <path d=${face.path} fill=${face.fill} />
              ${face.split ? svg`<path d=${face.split} fill="#7d1c24" />` : ''}
              <line x1=${face.spoke[0][0]} y1=${face.spoke[0][1]} x2=${face.spoke[1][0]} y2=${face.spoke[1][1]} stroke="rgb(243 212 136 / .35)" stroke-width="1.2" />
            `,
          )}
          <circle r=${RADIUS} fill="url(#${prefix}-shade)" />
          ${boostMarks.map((mark) => svg`<path class="lk-wheel-boost" d=${mark.path} />`)}
          ${faces.map(
            (face) => svg`
              ${face.label
                ? svg`<text
                    transform=${face.labelTransform}
                    text-anchor="middle"
                    dominant-baseline="middle"
                    font-weight="800"
                    font-size="13"
                    letter-spacing="1"
                    fill=${face.ink}
                    stroke="rgb(0 0 0 / .3)"
                    stroke-width="2.2"
                    paint-order="stroke"
                  >${face.label}</text>`
                : ''}
              ${face.dot ? svg`<circle cx=${face.dot[0]} cy=${face.dot[1]} r="3" fill="#d4a94e" opacity=".55" />` : ''}
              <circle cx=${face.peg[0]} cy=${face.peg[1]} r="3.4" fill="url(#${prefix}-gold)" stroke="#3a2a10" stroke-width=".8" />
            `,
          )}
          <circle r="66" fill="url(#${prefix}-gold)" />
          <circle r="58" fill="url(#${prefix}-hub)" />
          ${rosette.map((angle) => svg`<ellipse rx="44" ry="15" transform="rotate(${angle})" fill="none" stroke="#f3d488" stroke-opacity=".35" stroke-width=".6" />`)}
          <foreignObject class="lk-wheel-logo" x="-17" y="-17" width="34" height="34">${this.room.logo()}</foreignObject>
          ${boostMarks.map(
            (mark) => svg`
              <g class="lk-wheel-badge" transform=${mark.badge}>
                <rect x="-19" y="-11" width="38" height="22" rx="11" fill="url(#${prefix}-gold)" stroke="#3a2a10" stroke-width="1" /><text>${this.boostLabel}</text>
              </g>
            `,
          )}
          <path class="lk-win-seg" fill="#fff" d=${this.winPath} />
        </g>
        <circle r="267" fill="none" stroke="url(#${prefix}-gold)" stroke-width="30" />
        <circle r="252" fill="none" stroke="#120a05" stroke-width="3" />
        <circle r="282" fill="none" stroke="#6b4a14" stroke-width="2" />
        ${lamps.map(([x, y], index) => svg`<circle class="lk-lamp" style="--i: ${index}" cx=${x} cy=${y} r="4.4" />`)}
        <circle r="250" fill="url(#${prefix}-gloss)" pointer-events="none" />
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fl-wheel-face': WheelFace;
  }
}
