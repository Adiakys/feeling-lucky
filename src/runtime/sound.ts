import { pick, random } from '../engine/random';

export type SoundName = 'tick' | 'reel' | 'stop' | 'whoosh' | 'bounce' | 'chime' | 'win' | 'jackpot' | 'stamp' | 'scratch' | 'lever' | 'ambient' | 'thunder' | 'dealer';

// Every sound is synthesized: no audio files to ship. Off until the player turns it on, which is
// also the gesture the browser wants before it plays anything.
export const sound = {
  enabled: false,
  context: null as AudioContext | null,
  output: null as GainNode | null,
  last: {} as Partial<Record<SoundName, number>>,

  enable(on: boolean) {
    this.enabled = on;
    if (!on) return;
    if (this.context) {
      // The browser may have suspended it while nothing played.
      void this.context.resume();
      return;
    }
    this.context = new AudioContext();
    const compressor = this.context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 4;
    this.output = this.context.createGain();
    this.output.gain.value = 0.7;
    this.output.connect(compressor).connect(this.context.destination);
  },

  partial(frequency: number, start: number, duration: number, amplitude: number) {
    const context = this.context!;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(amplitude, start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.output!);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
    return oscillator;
  },

  noise(start: number, duration: number, amplitude: number, from: number, to = from, q = 1.2) {
    const context = this.context!;
    const length = Math.ceil(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(to, start + duration);
    gain.gain.value = amplitude;
    source.connect(filter).connect(gain).connect(this.output!);
    source.start(start);
  },

  play(name: SoundName, pitch = 1, volume = 1) {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime;
    if (now - (this.last[name] ?? -1) < 0.03) return;
    this.last[name] = now;
    const vary = (value: number) => value * random(0.97, 1.03);
    const arpeggio = (root: number, steps: number[], gap: number, length: number, amplitude: number, ratios = [1, 2.76]) =>
      steps.forEach((step, index) => ratios.forEach((ratio, r) => this.partial(root * 2 ** (step / 12) * ratio, now + index * gap, length, r ? amplitude / 4 : amplitude)));

    switch (name) {
      case 'tick':
        this.partial(vary(2100 * pitch), now, 0.05, 0.18 * volume);
        this.noise(now, 0.03, 0.25 * volume, 5200);
        break;
      case 'reel':
        this.partial(vary(760), now, 0.06, 0.06 * volume);
        break;
      case 'stop':
        this.partial(150, now, 0.22, 0.5 * volume).frequency.exponentialRampToValueAtTime(62, now + 0.18);
        this.partial(620, now, 0.06, 0.12 * volume);
        break;
      case 'whoosh':
        this.noise(now, 0.5, 0.35 * volume, 300, 2600, 0.8);
        break;
      case 'bounce':
        this.partial(vary(2637 * pitch), now, 0.35, 0.12 * volume);
        this.partial(vary(2637 * pitch * 2.76), now, 0.18, 0.04 * volume);
        break;
      case 'chime':
        [1, 2.76, 5.4].forEach((ratio, index) => this.partial(vary(1046 * pitch * ratio), now, 1.4 / (index + 1), (0.16 / (index + 1)) * volume));
        break;
      case 'win':
        arpeggio(523, [0, 4, 7, 12, 16], 0.09, 1.1, 0.12);
        break;
      case 'jackpot':
        arpeggio(392, [0, 4, 7, 12, 16, 19, 24], 0.11, 1.8, 0.13, [1, 2.76, 5.4]);
        this.noise(now, 1.2, 0.2, 400, 6000, 0.6);
        break;
      case 'stamp':
        this.partial(120, now, 0.3, 0.7).frequency.exponentialRampToValueAtTime(48, now + 0.25);
        this.noise(now, 0.08, 0.5, 1800, 600);
        break;
      case 'scratch':
        this.noise(now, 0.06, 0.12 * volume, 3200 * pitch, 2400 * pitch, 2);
        break;
      case 'lever':
        this.noise(now, 0.25, 0.3, 1900, 700, 3);
        this.partial(170, now, 0.2, 0.35);
        break;
      case 'thunder':
        this.noise(now, 0.09, 0.9 * volume, 6000, 1200, 0.7);
        this.noise(now + 0.02, 0.35, 0.35 * volume, 2400, 300, 1.5);
        this.noise(now + 0.05, 1.6, 0.8 * volume, 180, 45, 0.9);
        break;
      // The dealer takes her place: a riffle of the deck and a soft bell.
      case 'dealer':
        for (let index = 0; index < 7; index++) this.noise(now + index * 0.035, 0.03, 0.12 * volume, 4200 - index * 180, 2600, 2.5);
        arpeggio(659, [0, 7], 0.12, 1.2, 0.07, [1, 2.76]);
        break;
      case 'ambient':
        arpeggio(pick([392, 440, 523, 587, 659]) * pick([1, 2]), pick([[0, 4, 7], [0, 7, 12], [0, 4, 7, 12], [12, 7, 4, 0]]), 0.085, 0.7, 0.018, [1]);
        if (Math.random() < 0.4) this.noise(now + 0.3, 0.12, 0.05, 4200, 3000, 3);
        break;
    }
  },
};
