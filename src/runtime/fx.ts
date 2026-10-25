import { pick, random } from '../engine/random';
import { reducedMotion } from './motion';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'strip' | 'spark' | 'flake';
  gravity: number;
  rotation: number;
  spin: number;
  flip: number;
  flipSpeed: number;
  width: number;
  height: number;
  color: string;
  age: number;
  life: number;
}

interface BurstOptions {
  count?: number;
  colors?: string[];
  speed?: number;
  spread?: number;
  angle?: number;
  type?: Particle['type'];
  gravity?: number;
  life?: number;
}

const GOLD_CONFETTI = ['#f3d488', '#d4a94e', '#fff4d6', '#1f7a45', '#8e1f2a', '#c79a3e'];
export const SPARKS = ['#fff4d6', '#ffe3a0', '#f3d488'];


// Confetti, sparks and scratch dust on one canvas over the room.
export const fx = {
  canvas: null as HTMLCanvasElement | null,
  particles: [] as Particle[],
  // The room's theme dresses the confetti in its colours.
  confetti: undefined as string[] | undefined,
  running: false,
  last: 0,

  attach(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas;
    this.particles = [];
    if (!canvas) return;
    const ratio = Math.min(2, devicePixelRatio);
    canvas.width = innerWidth * ratio;
    canvas.height = innerHeight * ratio;
    canvas.getContext('2d')!.setTransform(ratio, 0, 0, ratio, 0, 0);
  },

  burst(x: number, y: number, { count = 60, colors, speed = 520, spread = Math.PI * 2, angle = -Math.PI / 2, type = 'strip', gravity = 900, life = 1.8 }: BurstOptions = {}) {
    if (!this.canvas || reducedMotion()) return;
    for (let i = 0; i < count; i++) {
      const direction = angle + random(-spread / 2, spread / 2);
      const velocity = speed * random(0.35, 1);
      this.particles.push({
        x, y, type, gravity,
        vx: Math.cos(direction) * velocity,
        vy: Math.sin(direction) * velocity,
        rotation: random(0, Math.PI * 2),
        spin: random(-9, 9),
        flip: random(0, Math.PI * 2),
        flipSpeed: random(6, 14),
        width: type === 'flake' ? random(1.5, 3.5) : random(5, 10),
        height: type === 'flake' ? random(1.5, 3) : random(9, 16),
        color: pick(colors ?? this.confetti ?? GOLD_CONFETTI),
        age: 0,
        life: life * random(0.6, 1),
      });
    }
    if (!this.running) {
      this.running = true;
      this.last = performance.now();
      requestAnimationFrame((time) => this.frame(time));
    }
  },

  fountain(duration: number) {
    const started = performance.now();
    const shoot = () => {
      if (!this.canvas) return;
      this.burst(random(innerWidth * 0.1, innerWidth * 0.9), innerHeight + 10, { count: 14, speed: 1150, spread: 0.5, life: 2.6 });
      if (performance.now() - started < duration) setTimeout(shoot, 90);
    };
    shoot();
  },

  cannons(duration: number) {
    const started = performance.now();
    const fire = () => {
      if (!this.canvas) return;
      this.burst(0, innerHeight, { count: 26, speed: 1350, spread: 0.45, angle: -Math.PI / 3, life: 3.2, gravity: 700 });
      this.burst(innerWidth, innerHeight, { count: 26, speed: 1350, spread: 0.45, angle: (-2 * Math.PI) / 3, life: 3.2, gravity: 700 });
      if (performance.now() - started < duration) setTimeout(fire, 280);
    };
    fire();
  },

  frame(time: number) {
    const canvas = this.canvas;
    if (!canvas) {
      this.running = false;
      return;
    }
    const context = canvas.getContext('2d')!;
    const dt = Math.min(0.05, (time - this.last) / 1000);
    this.last = time;
    context.clearRect(0, 0, innerWidth, innerHeight);
    this.particles = this.particles.filter((particle) => (particle.age += dt) < particle.life && particle.y < innerHeight + 40);
    for (const p of this.particles) {
      const drag = p.type === 'strip' ? 0.985 : 0.97;
      p.vx *= drag;
      p.vy = p.vy * drag + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.spin * dt;
      p.flip += p.flipSpeed * dt;
      context.save();
      context.globalAlpha = 1 - Math.max(0, (p.age - p.life * 0.7) / (p.life * 0.3));
      if (p.type === 'spark') {
        context.globalCompositeOperation = 'lighter';
        context.strokeStyle = p.color;
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(p.x, p.y);
        context.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        context.stroke();
      } else {
        context.translate(p.x, p.y);
        context.rotate(p.rotation);
        context.scale(1, Math.cos(p.flip));
        context.fillStyle = p.color;
        context.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
      }
      context.restore();
    }
    if (this.particles.length) requestAnimationFrame((next) => this.frame(next));
    else {
      this.running = false;
      context.clearRect(0, 0, innerWidth, innerHeight);
    }
  },
};

export function shake(element: Element, force = 1) {
  if (reducedMotion()) return;
  const d = 6 * force;
  element.animate(
    [
      { transform: 'translate(0, 0)' },
      { transform: `translate(${-d}px, ${d * 0.5}px) rotate(-0.4deg)` },
      { transform: `translate(${d * 0.8}px, ${-d * 0.4}px) rotate(0.3deg)` },
      { transform: `translate(${-d * 0.3}px, ${d * 0.2}px)` },
      { transform: 'translate(0, 0)' },
    ],
    { duration: 240, easing: 'linear' },
  );
}

// The engraved rosettes of banknotes: hypotrochoids drawn as polylines.
export function guilloche(cx: number, cy: number, scale = 1, layers = 3): string[] {
  return [
    { R: 210, r: 58, d: 96, turns: 29 },
    { R: 150, r: 42, d: 64, turns: 21 },
    { R: 300, r: 77, d: 130, turns: 77 },
  ]
    .slice(0, layers)
    .map(({ R, r, d, turns }) => {
      const points: string[] = [];
      for (let i = 0; i <= 2400; i++) {
        const t = (i / 2400) * Math.PI * 2 * turns;
        const x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
        const y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
        points.push(`${(cx + x * scale).toFixed(1)},${(cy + y * scale).toFixed(1)}`);
      }
      return points.join(' ');
    });
}
