import { html, nothing, svg } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { pick, random } from '../engine/random';
import { THEME_COLORS, type Theme } from '../engine/themes';
import { LuckyElement } from '../runtime/element';
import { reducedMotion } from '../runtime/motion';

const TILE = 140;
const TILES = Array.from({ length: 20 }, (_, index) => index * TILE);
// The festoon's swag between two nails, and the points along it where things hang.
const SWAG = `M0 2Q${TILE / 2} 24 ${TILE} 2`;
const along = (t: number) => ({ x: t * TILE, y: 2 + 2 * (1 - t) * t * 22 });
const HANGERS = [0.2, 0.5, 0.8].map(along);
const FLAGS = [0.08, 0.25, 0.42, 0.58, 0.75, 0.92].map(along);
const LIGHTS = [0.1, 0.3, 0.5, 0.7, 0.9].map(along);
const EGGS = ['#ffc8dd', '#cdb4ff', '#b8f0c8'];
const FLAG_COLORS = ['#ffd23f', '#3ec1c9', '#ff6f59', '#fff4d6', '#3ec1c9', '#ff6f59'];

// The scenes standing in the bottom corners, on a strip of ground across the room.
const star = (x: number, y: number, outer: number, inner: number) =>
  Array.from({ length: 10 }, (_, index) => {
    const angle = (index * Math.PI) / 5 - Math.PI / 2;
    const radius = index % 2 ? inner : outer;
    return `${(x + Math.cos(angle) * radius).toFixed(1)},${(y + Math.sin(angle) * radius).toFixed(1)}`;
  }).join(' ');
const TREE_STAR = star(110, 40, 14, 6);
const TREE_TIERS = [
  { d: 'M30 245L110 120L190 245Q150 236 110 246Q70 236 30 245Z', snow: 'M30 245Q70 236 110 246Q150 236 190 245' },
  { d: 'M45 185L110 80L175 185Q142 177 110 187Q78 177 45 185Z', snow: 'M45 185Q78 177 110 187Q142 177 175 185' },
  { d: 'M62 128L110 42L158 128Q134 121 110 130Q86 121 62 128Z', snow: 'M62 128Q86 121 110 130Q134 121 158 128' },
];
const TREE_LIGHTS = [
  [78, 110, 140, 122],
  [66, 165, 154, 178],
  [50, 222, 172, 236],
].flatMap(([x1, y1, x2, y2], row) =>
  Array.from({ length: 6 + row }, (_, index) => {
    const t = (index + 0.5) / (6 + row);
    return { x: x1! + (x2! - x1!) * t, y: y1! + (y2! - y1!) * t + Math.sin(Math.PI * t) * 6, color: ['#ffe3a0', '#ff6b5e', '#7fd6ff', '#fff4d6'][(index + row) % 4]!, delay: (index + row) % 3 };
  }),
);
const TREE_GARLANDS = [1, 2, 3].map(
  (row) => `M${TREE_LIGHTS.filter((_, at) => at >= [0, 6, 13][row - 1]! && at < [6, 13, 21][row - 1]!).map((light) => `${light.x.toFixed(1)} ${light.y.toFixed(1)}`).join('L')}`,
);
const BAUBLES = [
  { x: 100, y: 90, color: '#c8202f' },
  { x: 92, y: 142, color: '#d4a94e' },
  { x: 130, y: 150, color: '#c8202f' },
  { x: 84, y: 200, color: '#1d6fb8' },
  { x: 120, y: 206, color: '#d4a94e' },
  { x: 152, y: 198, color: '#c8202f' },
];
const GIFTS = [
  { x: 40, y: 200, width: 80, height: 70, box: '#1c6136', lid: '#237a45', ribbon: '#c8202f' },
  { x: 128, y: 222, width: 60, height: 48, box: '#c8202f', lid: '#d63040', ribbon: '#f3d488' },
  { x: 54, y: 162, width: 50, height: 38, box: '#d4a94e', lid: '#e2bd63', ribbon: '#9e1b22' },
];
const CANDIES = [
  { x: 104, y: 200, color: '#6b2fa0' },
  { x: 122, y: 198, color: '#9be36a' },
  { x: 92, y: 203, color: '#ffd23f' },
];
const PAILS = [{ x: 56, y: 0, scale: 1 }, { x: 34, y: 120, scale: 0.55 }].reverse();
const LOOSE_CANDIES = [{ x: 110, y: 270, color: '#9be36a' }, { x: 204, y: 272, color: '#6b2fa0' }];
const BASKET_EGGS = [
  { x: 70, y: 210, color: '#ffc8dd' },
  { x: 150, y: 210, color: '#fff1a8' },
  { x: 96, y: 200, color: '#cdb4ff' },
  { x: 124, y: 202, color: '#b8f0c8' },
  { x: 110, y: 214, color: '#a8dcff' },
];
const DAISIES = [12, 48, 86, 118];

const candy = ({ x, y, color }: { x: number; y: number; color: string }) => svg`<g>
  <path d=${`M${x - 14} ${y - 5}L${x - 8} ${y}L${x - 14} ${y + 5}ZM${x + 14} ${y - 5}L${x + 8} ${y}L${x + 14} ${y + 5}Z`} fill=${color} />
  <ellipse cx=${x} cy=${y} rx="9" ry="6" fill=${color} />
</g>`;

interface Mote { x: number; y: number; size: number; speed: number; drift: number; phase: number; spin: number; color: string }
interface Spark { x: number; y: number; vx: number; vy: number; age: number; life: number; color: string }

// The room dressed for the season, behind the games: snow, leaves or petals, bats and fireworks on a canvas,
// a scene in each bottom corner on a strip of ground, and a festoon under the header.
@customElement('fl-theme')
export class ThemeScene extends LuckyElement {
  @property({ attribute: false }) theme!: Theme;

  @query('.lk-theme-sky') private canvas?: HTMLCanvasElement;

  private raf = 0;

  firstUpdated() {
    this.start();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    cancelAnimationFrame(this.raf);
  }

  private start() {
    const element = this.canvas;
    if (!element || reducedMotion()) return;
    const theme = this.theme;
    const context = element.getContext('2d')!;
    const ratio = Math.min(2, devicePixelRatio);
    element.width = innerWidth * ratio;
    element.height = innerHeight * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const W = innerWidth;
    const H = innerHeight;
    const colors = THEME_COLORS[theme].confetti;
    const count = { christmas: 120, halloween: 30, easter: 46, august: 0 }[theme];
    const motes: Mote[] = Array.from({ length: count }, () => ({
      x: random(0, W),
      y: random(-H, H),
      size: theme === 'christmas' ? random(1, 3.4) : random(5, 9),
      speed: theme === 'christmas' ? random(18, 55) : random(26, 60),
      drift: random(-12, 12),
      phase: random(0, Math.PI * 2),
      spin: random(-2, 2),
      color: theme === 'halloween' ? pick(['#c2561b', '#8f3a12', '#d98a2b', '#6b2a10']) : pick(colors),
    }));
    const bats = theme === 'halloween' ? Array.from({ length: 6 }, () => ({ x: random(0, W), y: random(H * 0.15, H * 0.7), speed: random(50, 110) * pick([-1, 1]), size: random(1, 1.7), phase: random(0, 6) })) : [];
    const sparks: Spark[] = [];
    let nextRocket = 600;
    let previous = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      const time = now / 1000;
      context.clearRect(0, 0, W, H);

      for (const mote of motes) {
        mote.y += mote.speed * dt;
        mote.x += (mote.drift + Math.sin(time * 0.9 + mote.phase) * 14) * dt;
        if (mote.y > H + 12) Object.assign(mote, { y: -12, x: random(0, W) });
        if (theme === 'christmas') snowflake(context, mote);
        else leaf(context, mote, time, theme);
      }
      for (const bat of bats) {
        bat.x += bat.speed * dt;
        if (bat.x < -60) bat.x = W + 60;
        if (bat.x > W + 60) bat.x = -60;
        drawBat(context, bat.x, bat.y + Math.sin(time * 1.6 + bat.phase) * 18, bat.size * Math.sign(bat.speed), Math.sin(time * 14 + bat.phase));
      }

      if (theme === 'august') {
        nextRocket -= dt * 1000;
        if (nextRocket <= 0) {
          nextRocket = random(900, 2600);
          const x = random(W * 0.12, W * 0.88);
          const y = random(H * 0.16, H * 0.45);
          const color = pick(colors);
          for (let index = 0; index < 46; index++) {
            const angle = (index / 46) * Math.PI * 2;
            const speed = random(60, 150);
            sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, life: random(1.1, 1.8), color });
          }
        }
        context.globalCompositeOperation = 'lighter';
        for (let index = sparks.length - 1; index >= 0; index--) {
          const spark = sparks[index]!;
          spark.age += dt;
          if (spark.age > spark.life) {
            sparks.splice(index, 1);
            continue;
          }
          spark.vx *= 0.985;
          spark.vy = spark.vy * 0.985 + 40 * dt;
          spark.x += spark.vx * dt;
          spark.y += spark.vy * dt;
          context.globalAlpha = 0.5 * (1 - spark.age / spark.life);
          context.fillStyle = spark.color;
          context.beginPath();
          context.arc(spark.x, spark.y, 1.8, 0, Math.PI * 2);
          context.fill();
        }
        context.globalCompositeOperation = 'source-over';
        context.globalAlpha = 1;
      }
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  private ground(theme: Theme) {
    if (theme === 'christmas')
      return svg`
        <path d="M0 46Q35 34 70 44T140 46V80H0Z" fill="#cfdcec" />
        <path d="M0 54Q35 44 70 52T140 54V80H0Z" fill="#f4f8fc" />`;
    if (theme === 'halloween')
      return svg`
        <path d="M0 52Q17 46 35 52T70 52T105 52T140 52V80H0Z" fill="#1d1220" />
        <path d="M20 52l3-9 2 9M90 52l2-7 3 7M120 52l-2-8 4 8" stroke="#2e2036" stroke-width="2" fill="none" />`;
    if (theme === 'easter')
      return svg`
        <path d="M0 50Q17 42 35 50T70 50T105 50T140 50V80H0Z" fill="#4a8a3a" />
        <path d="M0 58Q17 52 35 58T70 58T105 58T140 58V80H0Z" fill="#5e9e4a" />
        ${DAISIES.map(
          (daisy) => svg`<g transform=${`translate(${daisy + 8} ${62 + (daisy % 3) * 4})`}>
            ${[1, 2, 3, 4, 5, 6].map((petal) => svg`<circle cx=${Math.cos(petal) * 3} cy=${Math.sin(petal) * 3} r="2" fill="#fff" />`)}
            <circle r="1.6" fill="#ffd23f" />
          </g>`,
        )}`;
    return svg`
      <rect y="22" width="140" height="30" fill="#1e8fa0" />
      <rect y="22" width="140" height="8" fill="#3ec1c9" />
      <path class="lk-scene-waves" d="M0 30Q17.5 25 35 30T70 30T105 30T140 30T175 30T210 30T245 30T280 30" stroke="#e8fbff" stroke-opacity=".7" stroke-width="1.5" fill="none" />
      <path d="M0 50Q35 44 70 50T140 50V80H0Z" fill="#e9c98a" />
      <path d="M0 50Q35 44 70 50T140 50" stroke="#fff6e0" stroke-opacity=".8" stroke-width="2" fill="none" />`;
  }

  private left(theme: Theme) {
    if (theme === 'christmas')
      return svg`
        <defs>
          <linearGradient id="lk-scene-fir" x1="0" x2="1"><stop offset="0" stop-color="#2f8a4e" /><stop offset="1" stop-color="#164226" /></linearGradient>
        </defs>
        <rect x="100" y="238" width="20" height="30" fill="#5a3418" />
        ${TREE_TIERS.map(
          (tier) => svg`<g>
            <path d=${tier.d} fill="url(#lk-scene-fir)" />
            <path d=${tier.snow} fill="none" stroke="#f4f8fc" stroke-width="4" stroke-linecap="round" opacity=".9" />
          </g>`,
        )}
        ${TREE_GARLANDS.map((garland) => svg`<path d=${garland} fill="none" stroke="#f3d488" stroke-opacity=".6" />`)}
        ${BAUBLES.map((bauble) => svg`<circle cx=${bauble.x} cy=${bauble.y} r="6" fill=${bauble.color} />`)}
        ${BAUBLES.map((bauble) => svg`<circle cx=${bauble.x - 2} cy=${bauble.y - 2} r="1.8" fill="#fff" opacity=".7" />`)}
        ${TREE_LIGHTS.map((light) => svg`<circle class="lk-scene-light" cx=${light.x} cy=${light.y} r="2.6" fill=${light.color} style=${`--i: ${light.delay}`} />`)}
        <polygon class="lk-scene-star" points=${TREE_STAR} fill="#ffd86b" stroke="#fff4d6" stroke-width="1" />
        <rect x="26" y="240" width="40" height="30" fill="#c8202f" />
        <path d="M43 240h6v30h-6zM26 252h40v6h-40z" fill="#f3d488" />
        <path d="M46 240c-12-12-20 0 0 0M46 240c12-12 20 0 0 0" stroke="#f3d488" stroke-width="3" fill="none" />
        <rect x="152" y="246" width="38" height="24" fill="#1d3561" />
        <path d="M168 246h6v24h-6z" fill="#fff4d6" />`;
    if (theme === 'halloween')
      return svg`
        <ellipse cx="34" cy="254" rx="26" ry="20" fill="#c95a14" />
        <ellipse cx="34" cy="254" rx="12" ry="20" fill="#de6f1e" />
        <path d="M32 236q1-8 7-11" stroke="#4a6b22" stroke-width="4" fill="none" stroke-linecap="round" />
        <ellipse cx="100" cy="228" rx="58" ry="44" fill="#d9661a" />
        <ellipse cx="100" cy="228" rx="36" ry="44" fill="#e57a24" />
        <ellipse cx="100" cy="228" rx="15" ry="44" fill="#f08d34" />
        <path d="M96 186q1-12 12-18l4 4q-8 6-8 16z" fill="#4a6b22" />
        <g class="lk-scene-flicker">
          <path d="M70 216l14-14 6 18zM130 216l-14-14-6 18zM100 224l-6 10h12zM66 240q34 26 68 0l-8 4-6-6-8 8-12-6-12 6-8-8-6 6z" fill="#ffd36e" />
        </g>
        <ellipse cx="178" cy="252" rx="32" ry="24" fill="#c95a14" />
        <ellipse cx="178" cy="252" rx="14" ry="24" fill="#de6f1e" />
        <path d="M176 230q2-9 9-12" stroke="#4a6b22" stroke-width="4" fill="none" stroke-linecap="round" />`;
    if (theme === 'easter')
      return svg`
        <ellipse cx="96" cy="234" rx="48" ry="38" fill="#f5efe6" />
        <circle cx="50" cy="234" r="12" fill="#fffaf2" />
        <path d="M128 182Q116 118 132 114Q146 118 142 180Z" fill="#f5efe6" />
        <path d="M132 176Q124 128 133 124Q140 128 138 176Z" fill="#ffc8dd" />
        <path d="M148 182Q150 114 168 120Q176 132 158 184Z" fill="#ebe3d6" />
        <circle cx="142" cy="198" r="26" fill="#f5efe6" />
        <circle cx="152" cy="192" r="3.2" fill="#2a1a12" />
        <circle cx="166" cy="202" r="3" fill="#ff8fb1" />
        <path d="M160 206l18-2M160 209l17 4" stroke="#c9bb98" stroke-width="1" />
        <ellipse cx="124" cy="268" rx="24" ry="7" fill="#ebe3d6" />`;
    return svg`
      <defs><clipPath id="lk-scene-canopy"><path d="M30 122Q118 30 206 122Q184 112 162 122Q140 112 118 122Q96 112 74 122Q52 112 30 122Z" /></clipPath></defs>
      <line x1="118" y1="74" x2="112" y2="270" stroke="#f5f0e6" stroke-width="4" />
      <g transform="rotate(-8 118 100)">
        <g clip-path="url(#lk-scene-canopy)">
          <rect x="20" y="20" width="200" height="110" fill="#ff6f59" />
          <path d="M118 40L52 130H90ZM118 40L146 130H184Z" fill="#fff4e6" />
        </g>
        <circle cx="118" cy="72" r="4" fill="#fff4e6" />
      </g>
      <path d="M30 270L74 190M92 270L44 222M38 246H86" stroke="#8a5a2b" stroke-width="4" stroke-linecap="round" fill="none" />
      <path d="M72 196Q56 238 96 258" stroke="#3ec1c9" stroke-width="10" fill="none" />
      <path d="M72 196Q56 238 96 258" stroke="#fff4e6" stroke-width="10" stroke-dasharray="6 6" fill="none" />`;
  }

  private right(theme: Theme) {
    if (theme === 'christmas')
      return svg`
        <path d="M0 280Q40 262 90 268Q150 258 220 272V280Z" fill="#f4f8fc" />
        ${GIFTS.map(
          (gift) => svg`<g transform="translate(16 0)">
            <rect x=${gift.x} y=${gift.y} width=${gift.width} height=${gift.height} fill=${gift.box} />
            <rect x=${gift.x - 4} y=${gift.y - 4} width=${gift.width + 8} height="11" fill=${gift.lid} />
            <rect x=${gift.x + gift.width / 2 - 4} y=${gift.y - 4} width="8" height=${gift.height + 4} fill=${gift.ribbon} />
            <path d=${`M${gift.x + gift.width / 2} ${gift.y - 4}c-14-14-22 0 0 0M${gift.x + gift.width / 2} ${gift.y - 4}c14-14 22 0 0 0`} stroke=${gift.ribbon} stroke-width="4" fill="none" />
          </g>`,
        )}
        <path d="M214 270V204Q214 188 200 188Q186 188 186 200" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" />
        <path d="M214 270V204Q214 188 200 188Q186 188 186 200" stroke="#c8202f" stroke-width="8" stroke-dasharray="6 6" fill="none" />`;
    if (theme === 'halloween')
      return svg`
        ${PAILS.map(
          (pail) => svg`<g transform=${`translate(${pail.x} ${pail.y}) scale(${pail.scale})`}>
            <path d="M62 210Q100 150 138 210" stroke="#1b1210" stroke-width="3" fill="none" />
            <circle cx="82" cy="180" r="9" fill="#ff5fa2" />
            <path d="M82 180m-5 0a5 5 0 1 1 10 0" stroke="#fff" stroke-width="1.5" fill="none" />
            <line x1="84" y1="188" x2="88" y2="206" stroke="#fff4e6" stroke-width="2" />
            ${CANDIES.map(candy)}
            <path d="M60 210Q56 270 100 272Q144 270 140 210Z" fill="#e8781e" />
            <ellipse cx="100" cy="210" rx="40" ry="8" fill="#b5520f" />
            <path d="M80 228l8-8 4 10zM120 228l-8-8-4 10zM78 246q22 16 44 0l-6 3-5-4-6 5-5-5-5 5-6-5-5 4z" fill="#2a1208" />
          </g>`,
        )}
        ${LOOSE_CANDIES.map(candy)}`;
    if (theme === 'easter')
      return svg`
        <ellipse cx="44" cy="262" rx="11" ry="14" fill="#ffc8dd" transform="rotate(-24 44 262)" />
        <g transform="translate(34 0)">
          <path d="M50 222Q110 116 170 222" stroke="#9a6a32" stroke-width="8" fill="none" />
          ${BASKET_EGGS.map(
            (egg) => svg`<g>
              <ellipse cx=${egg.x} cy=${egg.y} rx="13" ry="17" fill=${egg.color} />
              <path d=${`M${egg.x - 13} ${egg.y}q6.5-4 13 0t13 0`} stroke="#fff" stroke-width="2" fill="none" opacity=".85" />
            </g>`,
          )}
          <path d="M40 220H180L166 272H54Z" fill="#b98544" />
          <path d="M44 234H176M48 248H172M52 262H168" stroke="#8a5a2b" stroke-width="2" />
          <path d="M40 220H180" stroke="#7fbf5a" stroke-width="5" stroke-dasharray="3 4" />
        </g>`;
    return svg`
      <g transform="translate(40 0)">
        <path d="M58 270V200h12v8h8v-8h12v8h8v-8h12v70Z" fill="#e2bd7a" />
        <path d="M44 270v-44h10v6h8v-6h10v44ZM110 270v-44h10v6h8v-6h10v44Z" fill="#d6ad68" />
        <path d="M80 270v-22a8 8 0 0 1 16 0v22Z" fill="#a8844c" />
        <line x1="88" y1="200" x2="88" y2="172" stroke="#8a5a2b" stroke-width="2" />
        <path d="M88 172l18 6-18 6z" fill="#ff6f59" />
      </g>
      <circle cx="196" cy="254" r="18" fill="#fff" />
      <path d="M196 236a18 18 0 0 1 0 36a10 18 0 0 0 0-36Z" fill="#ff6f59" />
      <path d="M196 236a18 18 0 0 0 0 36a10 18 0 0 1 0-36Z" fill="#3ec1c9" />
      <path d="M196 236a10 18 0 0 1 0 36a4 18 0 0 0 0-36Z" fill="#ffd23f" />`;
  }

  private festoon(theme: Theme, tile: number) {
    if (theme === 'christmas')
      return svg`
        <path d=${SWAG} class="lk-fes-fir" />
        <path d=${SWAG} class="lk-fes-needles" />
        ${HANGERS.map(
          (point, index) => svg`<g transform=${`translate(${point.x} ${point.y})`}>
            <line y2="7" class="lk-fes-thread" />
            <circle cy="12" r="5" fill=${index === 1 ? '#c8202f' : '#d4a94e'} />
            <circle cx="-1.6" cy="10.4" r="1.4" fill="#fff" opacity=".6" />
          </g>`,
        )}
        ${LIGHTS.map((point, index) => svg`<circle cx=${point.x} cy=${point.y} r="1.8" class="lk-fes-light" style=${`--i: ${(tile + index) % 3}`} />`)}`;
    if (theme === 'halloween')
      return svg`
        <path d=${SWAG} class="lk-fes-string lk-fes-string--web" />
        <g transform=${`translate(${HANGERS[1]!.x} ${HANGERS[1]!.y})`}>
          <line y2="5" class="lk-fes-thread" />
          <ellipse cy="13" rx="9" ry="7.5" fill="#e0731f" />
          <path d="M-3 7.5Q0 13 -3 20.5M3 7.5Q0 13 3 20.5" fill="none" stroke="#a84a10" stroke-width="1" />
          <path d="M-1 4.5h2v2.5h-2z" fill="#3d5a1e" />
          <path d="M-5.5 10.5l2.2-2 1.2 2.4zM5.5 10.5l-2.2-2-1.2 2.4zM-5 15.5q5 3.5 10 0l-2 1.6-1.4-1-1.6 1.2-1.6-1.2-1.4 1z" class="lk-fes-glow" />
        </g>
        ${[0, 2].map(
          (index) => svg`<g transform=${`translate(${HANGERS[index]!.x} ${HANGERS[index]!.y + 7}) scale(.5)`}>
            <line y1="-14" y2="-4" class="lk-fes-thread" />
            <path d="M0-4c-3 0-4 2-4 2-4-5-11-5-15-1 3 0 4 3 3 5 2-2 5-1 6 1 1-2 4-3 6-1 0 2 2 4 4 4s4-2 4-4c2-2 5-1 6 1 1-2 4-3 6-1-1-2 0-5 3-5-4-4-11-4-15 1 0 0-1-2-4-2z" fill="#5a2f78" stroke="#c48bff" stroke-opacity=".6" stroke-width="1.2" />
          </g>`,
        )}`;
    if (theme === 'easter')
      return svg`
        <path d=${SWAG} class="lk-fes-ribbon" />
        ${HANGERS.map(
          (point, index) => svg`<g transform=${`translate(${point.x} ${point.y})`}>
            <line y2="5" class="lk-fes-thread" />
            <ellipse cy="13" rx="6" ry="8" fill=${EGGS[(tile + index) % 3]!} />
            <path d="M-6 12q3-2.4 6 0t6 0" fill="none" stroke="#fff" stroke-width="1.4" opacity=".85" />
            ${[-3, 0, 3].map((dot) => svg`<circle cx=${dot} cy="17" r=".9" fill="#fff" opacity=".85" />`)}
          </g>`,
        )}`;
    return svg`
      <path d=${SWAG} class="lk-fes-string" />
      ${FLAGS.map((point, index) => svg`<path d=${`M${point.x - 6} ${point.y}h12l-6 13z`} fill=${FLAG_COLORS[index]!} transform=${`rotate(${(2.5 - index) * 6} ${point.x} ${point.y})`} />`)}`;
  }

  render() {
    const theme = this.theme;
    const width = TILES.length * TILE;
    return html`
      <canvas class="lk-theme-sky" aria-hidden="true"></canvas>
      <div class="lk-scene lk-scene--${theme}" aria-hidden="true">
        <div class="lk-scene-ground">
          <svg viewBox="0 0 ${width} 80" width=${width} height="80" preserveAspectRatio="xMinYMax meet">
            ${TILES.map((x) => svg`<g transform=${`translate(${x} 0)`}>${this.ground(theme)}</g>`)}
          </svg>
        </div>

        ${theme === 'august'
          ? html`<svg class="lk-scene-sun" viewBox="-70 -70 140 140">
              <defs>
                <radialGradient id="lk-scene-sun"><stop offset="0" stop-color="#fff6c8" /><stop offset=".6" stop-color="#ffd23f" /><stop offset="1" stop-color="#ff9f2e" /></radialGradient>
              </defs>
              <g class="lk-scene-rays">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((ray) => svg`<path d="M-4-40L0-64L4-40Z" fill="#ffd23f" transform=${`rotate(${ray * 30})`} />`)}</g>
              <circle r="34" fill="url(#lk-scene-sun)" />
            </svg>`
          : nothing}

        <svg class="lk-scene-side lk-scene-side--left" viewBox="0 0 220 280">${this.left(theme)}</svg>
        <svg class="lk-scene-side lk-scene-side--right" viewBox="0 0 220 280">${this.right(theme)}</svg>
      </div>
      <div class="lk-festoon lk-festoon--${theme}" aria-hidden="true">
        <svg viewBox="0 0 ${width} 40" width=${width} height="40">
          ${TILES.map((x, tile) => svg`<g transform=${`translate(${x} 0)`}>${this.festoon(theme, tile)}</g>`)}
        </svg>
      </div>
    `;
  }
}

function snowflake(context: CanvasRenderingContext2D, mote: Mote) {
  context.globalAlpha = 0.25 + mote.size * 0.15;
  context.fillStyle = '#fffaf0';
  context.beginPath();
  context.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
}

// A falling leaf at Halloween, a petal at Easter: both flutter as they fall.
function leaf(context: CanvasRenderingContext2D, mote: Mote, time: number, theme: Theme) {
  context.save();
  context.translate(mote.x, mote.y);
  context.rotate(mote.phase + time * mote.spin);
  context.scale(1, Math.cos(time * 2.4 + mote.phase));
  context.globalAlpha = 0.8;
  context.fillStyle = mote.color;
  context.beginPath();
  if (theme === 'halloween') {
    context.moveTo(-mote.size, 0);
    context.quadraticCurveTo(0, -mote.size * 0.8, mote.size, 0);
    context.quadraticCurveTo(0, mote.size * 0.8, -mote.size, 0);
  } else context.ellipse(0, 0, mote.size * 0.6, mote.size * 0.38, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawBat(context: CanvasRenderingContext2D, x: number, y: number, size: number, flap: number) {
  context.save();
  context.translate(x, y);
  context.scale(size, Math.abs(size));
  context.fillStyle = 'rgb(74 38 98 / 0.9)';
  context.shadowColor = 'rgb(255 140 50 / 0.7)';
  context.shadowBlur = 8;
  for (const side of [-1, 1]) {
    context.save();
    context.scale(side, 0.35 + 0.65 * Math.abs(flap));
    context.beginPath();
    context.moveTo(2, -2);
    context.quadraticCurveTo(10, -12, 22, -6);
    context.quadraticCurveTo(19, -1, 20, 3);
    context.quadraticCurveTo(15, 0, 13, 4);
    context.quadraticCurveTo(8, 1, 3, 4);
    context.closePath();
    context.fill();
    context.restore();
  }
  context.beginPath();
  context.ellipse(0, 0, 3.6, 5.2, 0, 0, Math.PI * 2);
  context.moveTo(-3, -4);
  context.lineTo(-2.2, -8);
  context.lineTo(-0.8, -4.6);
  context.moveTo(3, -4);
  context.lineTo(2.2, -8);
  context.lineTo(0.8, -4.6);
  context.fill();
  context.restore();
}
