import { html, nothing, type PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { CircleArrowDown, Flame, Target } from 'lucide';
import type { Tier } from '../../config/types';
import {
  PACHINKO_POCKETS,
  PACHINKO_RED_PEGS,
  PACHINKO_VIOLET_ROWS,
  pachinkoChance,
  pachinkoPocket,
  pachinkoPockets,
  plainPockets,
  type PachinkoPeg,
  type PachinkoPocket,
} from '../../engine/pachinko';
import { random, shuffle } from '../../engine/random';
import { decide } from '../../engine/rig';
import { gameBoost, gameTier } from '../../engine/tiers';
import { stage } from '../../room/stage';
import type { GameOptions } from '../../runtime/context';
import { LuckyElement } from '../../runtime/element';
import { fx, SPARKS } from '../../runtime/fx';
import { icon } from '../../runtime/icons';
import { reducedMotion } from '../../runtime/motion';
import { sound } from '../../runtime/sound';

const RAINBOW = ['#ff657c', '#ffbb66', '#fff19c', '#8df0b5', '#6ecbff', '#c797ff'];
const GOLD = ['#fff6d2', '#ffe08a', '#f6c453', '#e0a12e', '#b9791c'];

const W = 400;
const H = 620;
const CENTER = { x: 200, y: 220 };
const ARC = 184;
const RIGHT = W - 12;
const POCKET_TOP = 560;
const POCKET_WIDTH = (RIGHT - 12) / PACHINKO_POCKETS.length;
const POCKET_COLORS: Record<Tier, string> = { none: '#2a170c', small: '#1d3561', big: '#7d1c24', jackpot: '#c79a3e' };
// The ball is dropped from under the arch, across the width the arch leaves at that height.
const DROP_Y = 72;
const DROP_REACH = Math.sqrt((ARC - 7) ** 2 - (CENTER.y - DROP_Y) ** 2) - 4;
const clampDrop = (x: number) => Math.max(CENTER.x - DROP_REACH, Math.min(CENTER.x + DROP_REACH, x));

const ORB_COLORS = { blue: ['#8cc8ff', '#2f7fe6', '#163f8c'], red: ['#ffa08c', '#f0433f', '#8c1420'], violet: ['#ffc4f4', '#e04fd0', '#7a1f8c'] } as const;
const ORB_RADIUS = { blue: 7.2, red: 7.2, violet: 9 } as const;

@customElement('fl-pachinko')
export class Pachinko extends LuckyElement {
  @property({ attribute: false }) options: GameOptions = {};

  @state() private state: 'idle' | 'spinning' | 'won' = 'idle';
  @state() private chosen = '';
  @state() private redHits = 0;
  @state() private fever = false;
  @state() private violetHit = false;

  @query('canvas') private canvas?: HTMLCanvasElement;

  private boost = 1;
  private colorful = false;
  private dropX = CENTER.x;
  private pegs: PachinkoPeg[] = [];
  // The orbs the ball is steered onto in turn, and the ones it is steered around.
  private guide: PachinkoPeg[] = [];
  private avoid: PachinkoPeg[] = [];
  private board: { violet: PachinkoPeg; reds: PachinkoPeg[] } | null = null;
  private ball: { x: number; y: number; vx: number; vy: number } | null = null;
  private trail: { x: number; y: number }[] = [];
  private target = 0;
  private tier: Tier = 'none';
  // The coloured board's win, rolled at the drop; hitting the violet orb rolls again for the odds it adds.
  private wins = false;
  private landed: number | null = null;
  private raf = 0;
  private previous = performance.now();
  private time = 0;
  private stillSince = 0;
  private slowMotionUntil = 0;
  // The camera closes in on the last red while the ball slows down toward it, and pulls back after the fever starts.
  private zoom = 1;
  private camera = { x: CENTER.x, y: CENTER.y };
  private lastFirework = 0;
  private pending: ReturnType<typeof setTimeout>[] = [];

  private get pockets(): PachinkoPocket[] {
    const { bonus } = this.options;
    if (this.colorful) return pachinkoPockets(this.redHits, this.room.board);
    const pockets = plainPockets(this.room.board);
    // The Grand Wheel already drew the award: every pocket of its tier shows it.
    return bonus ? pockets.map((pocket) => (pocket.tier === bonus.tier ? { tier: pocket.tier, award: bonus.award } : pocket)) : pockets;
  }

  protected willUpdate(changed: PropertyValues) {
    if (!this.hasUpdated) {
      const { bonus } = this.options;
      this.boost = bonus ? 1 : gameBoost('pachinko');
      this.colorful = this.boost > 1 && !bonus;
      this.chosen = bonus?.prizeId ?? this.room.prizeIds[0]!;
      this.buildPegs();
      this.colorPegs();
    } else if (changed.has('room') && !this.room.prizeIds.includes(this.chosen)) this.chosen = this.room.prizeIds[0]!;
  }

  private buildPegs() {
    // The coloured board spaces its orbs like Peggle, wide enough for the ball to fall and bounce between them.
    const grid = this.colorful ? { rows: 10, top: 112, rowStep: 44, step: 50, reach: 4 } : { rows: 16, top: 92, rowStep: 29, step: 28, reach: 6 };
    for (let row = 0; row < grid.rows; row++) {
      const y = grid.top + row * grid.rowStep;
      if (y > 535) break;
      for (let offset = (row % 2 ? 0.5 - grid.reach : -grid.reach) * grid.step; offset <= grid.reach * grid.step; offset += grid.step) {
        const x = CENTER.x + offset;
        if (x < 24 || x > W - 24) continue;
        if (Math.hypot(x - CENTER.x, y - CENTER.y) > ARC - 20 && y < CENTER.y) continue;
        this.pegs.push({ x, y, hit: -1 });
      }
    }
    for (let k = 1; k < PACHINKO_POCKETS.length; k++) this.pegs.push({ x: 12 + k * POCKET_WIDTH, y: POCKET_TOP - 4, hit: -1, divider: true });
  }

  private colorPegs() {
    for (const peg of this.pegs) {
      peg.hit = -1;
      peg.lit = false;
      peg.color = undefined;
    }
    if (!this.colorful) return;
    const playable = this.pegs.filter((peg) => !peg.divider);
    const board = decide('pachinko.board', { pegs: playable }, () => {
      const [top, bottom] = PACHINKO_VIOLET_ROWS;
      const violet = shuffle(playable.filter((peg) => peg.y >= top && peg.y <= bottom))[0]!;
      return { violet, reds: shuffle(playable.filter((peg) => peg !== violet)).slice(0, PACHINKO_RED_PEGS) };
    });
    this.board = board;
    playable.forEach((peg) => (peg.color = 'blue'));
    board.reds.forEach((peg) => (peg.color = 'red'));
    board.violet.color = 'violet';
  }

  private drawBoard(context: CanvasRenderingContext2D) {
    const { colorful, time, dropX } = this;
    const background = context.createLinearGradient(0, 0, 0, H);
    background.addColorStop(0, colorful ? '#102941' : '#4a2614');
    background.addColorStop(1, colorful ? '#080e1c' : '#22100a');
    context.fillStyle = background;
    context.beginPath();
    context.moveTo(4, H - 4);
    context.lineTo(4, CENTER.y);
    context.arc(CENTER.x, CENTER.y, ARC + 12, Math.PI, 0);
    context.lineTo(W - 4, H - 4);
    context.closePath();
    context.fill();

    context.strokeStyle = 'rgb(243 212 136 / 0.14)';
    context.lineWidth = 0.6;
    // The rosette leaves a bare disc in its middle: on the coloured board, full of orbs, it reads as a hole.
    for (let k = 0; k < (colorful ? 0 : 24); k++) {
      context.beginPath();
      context.ellipse(CENTER.x, 380, 170, 46, (k * Math.PI) / 24, 0, Math.PI * 2);
      context.stroke();
    }

    context.strokeStyle = '#d4a94e';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(CENTER.x, CENTER.y, ARC + 6, Math.PI, 0);
    context.stroke();

    for (let i = 0; i < 30; i++) {
      const theta = Math.PI * (i / 29);
      const on = this.state === 'spinning' ? (Math.floor(time * 18) - i) % 6 === 0 : (Math.floor(time * 1.6) + i) % 2 === 0;
      context.fillStyle = on ? '#ffe3a0' : '#4a3a1e';
      context.shadowColor = '#ffcf7a';
      context.shadowBlur = on ? 10 : 0;
      context.beginPath();
      context.arc(CENTER.x + Math.cos(Math.PI - theta) * (ARC + 14), CENTER.y - Math.sin(theta) * (ARC + 14), 3.2, 0, Math.PI * 2);
      context.fill();
    }
    context.shadowBlur = 0;

    context.strokeStyle = 'rgb(226 189 99 / 0.55)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(CENTER.x - DROP_REACH, DROP_Y - 11);
    context.lineTo(CENTER.x + DROP_REACH, DROP_Y - 11);
    context.stroke();
    if (this.state === 'idle' && !this.ball) {
      context.setLineDash([3, 5]);
      context.strokeStyle = 'rgb(255 227 160 / 0.45)';
      context.lineWidth = 1.2;
      context.beginPath();
      context.moveTo(dropX, DROP_Y + 8);
      context.lineTo(dropX, DROP_Y + 60);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = '#d4a94e';
      context.beginPath();
      context.roundRect(dropX - 9, DROP_Y - 15, 18, 8, 3);
      context.fill();
      context.globalAlpha = 0.55 + 0.35 * Math.sin(time * 4);
      this.drawSphere(context, dropX, DROP_Y);
      context.globalAlpha = 1;
    }

    this.pockets.forEach((pocket, k) => {
      const x = 12 + k * POCKET_WIDTH;
      const gradient = context.createLinearGradient(0, POCKET_TOP, 0, H - 10);
      gradient.addColorStop(0, POCKET_COLORS[pocket.tier]);
      gradient.addColorStop(1, '#120a05');
      context.fillStyle = gradient;
      context.globalAlpha = this.landed === k ? 1 : 0.85;
      context.beginPath();
      context.roundRect(x + 2, POCKET_TOP, POCKET_WIDTH - 4, H - POCKET_TOP - 14, 8);
      context.fill();
      context.globalAlpha = 1;
      if (this.landed === k) {
        context.strokeStyle = '#fff4d6';
        context.lineWidth = 2;
        context.stroke();
      }
      context.fillStyle = pocket.tier === 'jackpot' ? '#2a1a05' : '#f6e2a6';
      // A tier symbol is a glyph of its own: drawn larger than the labels to read the same.
      context.font = pocket.tier !== 'none' && pocket.award === null ? '700 14px sans-serif' : '700 10px ui-monospace, Menlo, monospace';
      context.textAlign = 'center';
      context.fillText(pocket.tier === 'none' ? '—' : this.room.award(pocket.tier, pocket.award), x + POCKET_WIDTH / 2, POCKET_TOP + 30);
    });

    for (const peg of this.pegs) {
      if (colorful && peg.divider) continue;
      const glow = peg.hit >= 0 ? Math.max(0, 1 - (time - peg.hit) / 0.35) : 0;
      if (glow > 0) {
        context.fillStyle = `rgba(255, 214, 130, ${glow * 0.6})`;
        context.beginPath();
        context.arc(peg.x, peg.y, 4 + glow * 9, 0, Math.PI * 2);
        context.fill();
      }
      if (colorful && !peg.divider) {
        this.drawOrb(context, peg.x, peg.y, peg.color!, peg.lit === true, glow);
        continue;
      }
      const gradient = context.createRadialGradient(peg.x - 1.4, peg.y - 1.4, 0.5, peg.x, peg.y, 4.6);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.5, glow > 0 ? '#fff4d6' : '#d4a94e');
      gradient.addColorStop(1, '#4b3a1c');
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(peg.x, peg.y, peg.divider ? 4 : 3.6, 0, Math.PI * 2);
      context.fill();
    }
  }

  // Peggle-like orbs: glossy two-tone ball, gold rim, a wide white gleam. Lit ones glow brighter; the violet one pulses.
  private drawOrb(context: CanvasRenderingContext2D, x: number, y: number, color: keyof typeof ORB_COLORS, lit: boolean, flash: number) {
    const pulse = color === 'violet' && !lit && !reducedMotion() ? 1 + 0.08 * Math.sin(this.time * 5) : 1;
    const radius = ORB_RADIUS[color] * pulse * (1 + flash * 0.25);
    const [light, base, dark] = ORB_COLORS[color];
    if (lit || color === 'violet') {
      context.fillStyle = lit ? 'rgb(255 248 220 / 0.35)' : 'rgb(240 120 230 / 0.35)';
      context.beginPath();
      context.arc(x, y, radius + 4 + flash * 4, 0, Math.PI * 2);
      context.fill();
    }
    const body = context.createLinearGradient(x, y - radius, x, y + radius);
    body.addColorStop(0, lit ? '#ffffff' : light);
    body.addColorStop(0.45, lit ? light : base);
    body.addColorStop(1, lit ? base : dark);
    context.fillStyle = body;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#f1cf72';
    context.lineWidth = 1.8;
    context.stroke();
    context.strokeStyle = '#5a3a0c';
    context.lineWidth = 0.8;
    context.beginPath();
    context.arc(x, y, radius + 1.3, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = 'rgb(255 255 255 / 0.85)';
    context.beginPath();
    context.ellipse(x - radius * 0.12, y - radius * 0.5, radius * 0.6, radius * 0.28, -0.15, 0, Math.PI * 2);
    context.fill();
    if (color === 'violet') {
      context.fillStyle = '#ffffff';
      context.strokeStyle = dark;
      context.lineWidth = 2.4;
      context.font = '900 13px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.strokeText('+', x, y + 1);
      context.fillText('+', x, y + 1);
      context.textBaseline = 'alphabetic';
    }
  }

  private drawSphere(context: CanvasRenderingContext2D, x: number, y: number) {
    const gradient = context.createRadialGradient(x - 2.2, y - 2.4, 0.6, x, y, 7);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.5, '#ece6d8');
    gradient.addColorStop(1, '#6d6250');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, 6.5, 0, Math.PI * 2);
    context.fill();
  }

  private drawBall(context: CanvasRenderingContext2D) {
    const { ball, trail } = this;
    if (!ball) return;
    if (this.fever) {
      // The fever's comet: a glowing gold ribbon behind the ball, the gold sparkling along it.
      context.save();
      context.shadowColor = '#ffcf5a';
      context.shadowBlur = 14;
      trail.forEach((point, index) => {
        const along = index / trail.length;
        context.globalAlpha = along * 0.9;
        context.fillStyle = GOLD[Math.floor((1 - along) * (GOLD.length - 1))]!;
        context.beginPath();
        context.arc(point.x, point.y, 2 + 6 * along, 0, Math.PI * 2);
        context.fill();
        if (index % 4 === 0) {
          context.fillStyle = '#ffffff';
          context.beginPath();
          context.arc(point.x + random(-5, 5), point.y + random(-5, 5), random(0.6, 1.6), 0, Math.PI * 2);
          context.fill();
        }
      });
      context.restore();
    } else {
      trail.forEach((point, index) => {
        context.fillStyle = '#ffecc8';
        context.globalAlpha = (index / trail.length) * 0.25;
        context.beginPath();
        context.arc(point.x, point.y, 6.5 * (index / trail.length), 0, Math.PI * 2);
        context.fill();
      });
      context.globalAlpha = 1;
    }
    this.drawSphere(context, ball.x, ball.y);
  }

  // Real collisions with pins and walls, with a gentle pull toward the drawn pocket.
  private physics(dt: number) {
    const { ball, colorful } = this;
    if (!ball) return;
    // Halfway down the ball picks the pocket of the drawn tier closest to where it is.
    const near = (ball.x - 12) / POCKET_WIDTH - 0.5;
    if (!colorful && this.target < 0 && ball.y > 330) this.target = decide('pachinko.pocket', { near }, () => pachinkoPocket(this.tier, near));
    // The coloured board drifts all the way down toward the closest pocket of its outcome: winning and dashed
    // pockets alternate, so it is never more than one pocket away.
    if (colorful && ball.y < POCKET_TOP - 30) {
      const options = PACHINKO_POCKETS.flatMap((tier, index) => ((tier !== 'none') === this.wins ? [index] : []));
      this.target = decide('pachinko.pocket', { near }, () => options.sort((a, b) => Math.abs(a - near) - Math.abs(b - near))[0]!);
    }
    const targetX = 12 + (this.target + 0.5) * POCKET_WIDTH;
    const steps = 4;
    const h = dt / steps;
    const first = this.guide[0];
    if (first && (first.lit || ball.y > first.y + 10 || (this.stillSince && this.time - this.stillSince > 1))) this.guide = this.guide.slice(1);
    const next = this.guide[0];
    for (let s = 0; s < steps; s++) {
      ball.vy += (colorful ? 1150 : 1500) * h;
      if (next && ball.y < next.y - 4) {
        // The sideways speed that, falling as it does, brings the ball onto the shoulder of the next orb on
        // its own side: dead centre it would bounce in place on top of it.
        const reach = (ORB_RADIUS[next.color!] + 6.5) / 2;
        const shoulder = next.x + (ball.x < next.x ? -reach : reach);
        const rise = next.y - ORB_RADIUS[next.color!] - 6.5 - ball.y;
        const fall = (-ball.vy + Math.sqrt(Math.max(0, ball.vy ** 2 + 2 * 1150 * rise))) / 1150;
        if (fall > 0.02) ball.vx = Math.max(-600, Math.min(600, (shoulder - ball.x) / fall));
      } else if (colorful) ball.vx += Math.max(-220, Math.min(220, (targetX - ball.x) * (ball.y > 470 ? 9 : 3))) * h;
      else if (this.target >= 0) ball.vx += Math.max(-320, Math.min(320, (targetX - ball.x) * (ball.y > 440 ? 16 : 5))) * h;
      for (const peg of this.avoid) {
        const side = ball.x - peg.x;
        if (peg.y - ball.y > -6 && peg.y - ball.y < 90 && Math.abs(side) < 30) ball.vx += Math.sign(side || 1) * 2600 * h;
      }
      ball.x += ball.vx * h;
      ball.y += ball.vy * h;
      if (ball.y < CENTER.y) {
        const dx = ball.x - CENTER.x;
        const dy = ball.y - CENTER.y;
        const distance = Math.hypot(dx, dy);
        if (distance > ARC - 7) {
          const nx = dx / distance;
          const ny = dy / distance;
          ball.x = CENTER.x + nx * (ARC - 7);
          ball.y = CENTER.y + ny * (ARC - 7);
          const dot = ball.vx * nx + ball.vy * ny;
          if (dot > 0) {
            ball.vx -= 1.5 * dot * nx;
            ball.vy -= 1.5 * dot * ny;
          }
        }
      }
      if (ball.x < 18) Object.assign(ball, { x: 18, vx: Math.abs(ball.vx) * 0.5 });
      if (ball.x > RIGHT - 6) Object.assign(ball, { x: RIGHT - 6, vx: -Math.abs(ball.vx) * 0.5 });
      for (const peg of this.pegs) {
        if (ball.y > POCKET_TOP - 20 && peg.divider) continue;
        const dx = ball.x - peg.x;
        const dy = ball.y - peg.y;
        const distance = Math.hypot(dx, dy);
        const minimum = 6.5 + (peg.divider ? 4 : colorful ? ORB_RADIUS[peg.color!] : 3.6);
        if (distance >= minimum || distance === 0) continue;
        const nx = dx / distance;
        const ny = dy / distance;
        ball.x = peg.x + nx * minimum;
        ball.y = peg.y + ny * minimum;
        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
          // The coloured board bounces like Peggle: livelier orbs and next to no random kick, so the path looks real.
          const bounce = colorful && !peg.divider ? 1.78 : 1.62;
          ball.vx -= bounce * dot * nx;
          ball.vy -= bounce * dot * ny;
          const kick = colorful ? random(-6, 6) : random(-38, 38);
          ball.vx += -ny * kick;
          ball.vy += nx * kick;
          if (this.time - peg.hit > 0.08) sound.play('bounce', 0.8 + (ball.y / H) * 0.6, 0.5);
          if (colorful && !peg.divider && !peg.lit) {
            peg.lit = true;
            if (peg.color === 'red') {
              this.redHits++;
              if (this.redHits === PACHINKO_RED_PEGS) this.startFever();
            }
            if (peg.color === 'violet') {
              const before = pachinkoChance(this.boost, false);
              if (!this.wins && before < 1)
                this.wins = decide('pachinko.wins', { boost: this.boost, violet: true }, () => Math.random() < (pachinkoChance(this.boost, true) - before) / (1 - before));
              this.violetHit = true;
            }
            if (peg.color !== 'blue') sound.play('chime', peg.color === 'violet' ? 1.8 : 1 + this.redHits * 0.08);
          }
          peg.hit = this.time;
        }
      }
      if (ball.y > POCKET_TOP) {
        const minX = 12 + this.target * POCKET_WIDTH + 8;
        const maxX = 12 + (this.target + 1) * POCKET_WIDTH - 8;
        ball.x = Math.max(minX, Math.min(maxX, ball.x));
        if (ball.y > H - 30) return this.land();
      }
    }
    if (Math.hypot(ball.vx, ball.vy) < 30) {
      this.stillSince ||= this.time;
      if (this.time - this.stillSince > 0.8) Object.assign(ball, { vx: ball.vx + random(-80, 80), vy: ball.vy - 60 });
    } else this.stillSince = 0;
  }

  private startFever() {
    if (this.fever) return;
    this.fever = true;
    this.slowMotionUntil = this.time + 1.5;
    sound.play('jackpot');
    if (reducedMotion()) return;
    const rect = this.canvas!.getBoundingClientRect();
    fx.burst(rect.left + rect.width / 2, rect.top + rect.height / 3, { count: 110, colors: RAINBOW, speed: 800, life: 2.3 });
  }

  private land() {
    if (!this.ball) return;
    this.ball.y = H - 30;
    this.landed = this.target;
    const pocket = this.pockets[this.target]!;
    sound.play('stop');
    if (pocket.tier === 'none') {
      this.ball = null;
      if (this.colorful) {
        this.pending.push(
          this.later(() => {
            this.colorPegs();
            this.state = 'idle';
          }, reducedMotion() ? 0 : 600),
        );
      } else this.state = 'idle';
      if (this.fever) this.pending.push(this.later(() => (this.fever = false), 3000));
      return;
    }
    if (this.colorful && pocket.tier === 'jackpot') this.startFever();
    sound.play('chime', pocket.tier === 'jackpot' ? 1.5 : 1.1);
    const rect = this.canvas!.getBoundingClientRect();
    fx.burst(rect.left + ((12 + (this.target + 0.5) * POCKET_WIDTH) * rect.width) / W, rect.top + (POCKET_TOP * rect.height) / H, {
      count: 30,
      type: 'spark',
      speed: 520,
      spread: 1.6,
      life: 0.7,
      gravity: 600,
      colors: SPARKS,
    });
    this.state = 'won';
    this.ball = null;
    const { bonus } = this.options;
    const won = {
      game: bonus ? ('wheel' as const) : ('pachinko' as const),
      tier: pocket.tier,
      prizeId: this.chosen,
      award: pocket.award,
      detail: { key: bonus ? 'detail.wheel.pachinko' : this.colorful ? 'pachinko.detail' : 'detail.pachinko' },
    };
    this.pending.push(this.later(() => this.room.finish(won), reducedMotion() ? 300 : this.fever ? 3800 : 2000));
  }

  private frame = (now: number) => {
    const dt = Math.min(0.033, (now - this.previous) / 1000);
    this.previous = now;
    this.time += dt;
    const { time } = this;
    if (this.ball) {
      const lastRed = this.colorful && this.redHits === PACHINKO_RED_PEGS - 1 ? this.pegs.find((peg) => peg.color === 'red' && !peg.lit) : undefined;
      const nearLast = lastRed && Math.hypot(this.ball.x - lastRed.x, this.ball.y - lastRed.y) < 65;
      if (nearLast) this.camera = { x: lastRed.x, y: lastRed.y };
      this.physics(dt * (!reducedMotion() && (nearLast || time < this.slowMotionUntil) ? 0.24 : 1));
      if (this.ball) this.trail = [...this.trail, { x: this.ball.x, y: this.ball.y }].slice(this.fever ? -40 : -8);
      const closeUp = !reducedMotion() && (nearLast || time < this.slowMotionUntil);
      this.zoom += ((closeUp ? 2.4 : 1) - this.zoom) * Math.min(1, dt * (closeUp ? 5 : 2.5));
    } else this.zoom += (1 - this.zoom) * Math.min(1, dt * 2.5);
    if (this.fever && !reducedMotion() && time - this.lastFirework > 0.3) {
      this.lastFirework = time;
      const rect = this.canvas!.getBoundingClientRect();
      fx.burst(rect.left + random(0, rect.width), rect.top + random(0, rect.height * 0.7), { count: 20, colors: RAINBOW, type: 'spark', speed: 420, life: 0.9 });
    }
    const context = this.canvas?.getContext('2d');
    if (context) {
      const ratio = Math.min(2, devicePixelRatio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, W, H);
      if (this.zoom > 1.001) {
        context.translate(this.camera.x, this.camera.y);
        context.scale(this.zoom, this.zoom);
        context.translate(-this.camera.x, -this.camera.y);
      }
      this.drawBoard(context);
      this.drawBall(context);
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private aim(event: PointerEvent) {
    if (this.state !== 'idle') return;
    const rect = this.canvas!.getBoundingClientRect();
    this.dropX = clampDrop(((event.clientX - rect.left) * W) / rect.width);
  }

  private drop() {
    if (this.state !== 'idle') return;
    this.pending.forEach(clearTimeout);
    this.pending = [];
    const { bonus } = this.options;
    this.tier = bonus?.tier ?? (this.colorful ? 'none' : gameTier('pachinko', this.boost));
    this.redHits = 0;
    this.fever = false;
    this.slowMotionUntil = 0;
    this.violetHit = false;
    this.wins = decide('pachinko.wins', { boost: this.boost, violet: false }, () => Math.random() < pachinkoChance(this.boost, false));
    ({ through: this.guide, avoid: this.avoid } =
      this.colorful && this.board ? decide('pachinko.route', this.board, () => ({ through: [], avoid: [] })) : { through: [], avoid: [] });
    this.target = -1;
    this.landed = null;
    this.state = 'spinning';
    sound.play('whoosh');
    this.ball = { x: this.dropX, y: DROP_Y, vx: this.colorful ? random(-70, 70) : random(-15, 15), vy: 90 };
    this.trail = [];
    if (reducedMotion() && !this.colorful) {
      this.target = pachinkoPocket(this.tier, (this.dropX - 12) / POCKET_WIDTH - 0.5);
      this.land();
    }
  }

  private keydown = (event: KeyboardEvent) => {
    const target = event.composedPath()[0];
    if (this.state !== 'idle' || event.repeat || (target instanceof HTMLElement && target.closest('input, select, textarea, [role=dialog] input'))) return;
    if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
      event.preventDefault();
      this.dropX = clampDrop(this.dropX + (event.code === 'ArrowLeft' ? -10 : 10));
    }
    if (event.code === 'Space' && !(target instanceof HTMLButtonElement)) {
      event.preventDefault();
      this.drop();
    }
  };

  protected firstUpdated() {
    const ratio = Math.min(2, devicePixelRatio);
    this.canvas!.width = W * ratio;
    this.canvas!.height = H * ratio;
    this.canvas!.getContext('2d')!.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.raf = requestAnimationFrame(this.frame);
  }

  connectedCallback() {
    super.connectedCallback();
    addEventListener('keydown', this.keydown);
    if (this.hasUpdated) this.raf = requestAnimationFrame(this.frame);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    cancelAnimationFrame(this.raf);
    removeEventListener('keydown', this.keydown);
  }

  render() {
    const { bonus } = this.options;
    const { colorful, boost, state } = this;
    const rules = bonus
      ? this.t('games.pachinko.bonusRules', { prize: this.room.name(bonus.prizeId) })
      : this.t(colorful ? 'pachinko.colorRules' : 'games.pachinko.rules');
    const chance = Math.round(pachinkoChance(boost, this.violetHit) * 1000) / 10;
    return stage(
      this.room.t,
      { state, rules, multiplier: boost },
      html`
        <div class="lk-pachinko ${colorful ? 'lk-pachinko--color' : ''}">
          ${colorful
            ? html`<div class="lk-peg-score" aria-live="polite">
                <span class="lk-peg-red">${icon(Target)}<b>${this.redHits} / ${PACHINKO_RED_PEGS}</b> <small>${this.t('pachinko.redHits')}</small></span>
                <span class="lk-peg-power ${this.violetHit ? 'is-active' : ''}">${icon(Flame)}<b>${boost}× → ${boost * boost}×</b><small>${this.t(this.violetHit ? 'pachinko.powerOn' : 'pachinko.powerOff')}</small></span>
                <span><b>${chance}%</b><small>${this.t('pachinko.chance')}</small></span>
              </div>`
            : nothing}
          <div class="lk-pachinko-cab ${this.fever ? 'is-fever' : ''}">
            ${this.fever
              ? html`<div class="lk-peg-fever" aria-live="assertive"><span>${this.t('pachinko.fever')}</span><strong>${this.t('pachinko.feverTitle')}</strong></div>`
              : nothing}
            <canvas width="400" height="620" class=${state === 'idle' ? 'is-aiming' : ''} aria-label=${rules} @pointermove=${this.aim} @click=${this.drop}></canvas>
          </div>
          <div class="lk-pachinko-controls">
            <fl-chips .chosen=${this.chosen} ?disabled=${state !== 'idle' || !!bonus} @choose=${(event: CustomEvent<string>) => (this.chosen = event.detail)}></fl-chips>
            <button class="lk-btn lk-btn--primary lk-btn--lg" ?disabled=${state !== 'idle'} @click=${this.drop}>${icon(CircleArrowDown)}${this.t('pachinko.launch')}</button>
          </div>
          <div class="lk-hint">${this.t('pachinko.hint')}</div>
        </div>
      `,
    );
  }
}
