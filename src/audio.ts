import type { InstrumentId } from './types';

let actx: AudioContext | null = null;

export function getCtx(): AudioContext {
  if (!actx) {
    const Ctor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) throw new Error('Web Audio API not supported');
    actx = new Ctor();
  }
  if (actx.state === 'suspended') void actx.resume();
  return actx;
}

// --- Engine primitives: pure, context-parameterized, no module state. ---
// `when` is the absolute scheduling time on the given AudioContext's timeline.

function mkGain(ctx: BaseAudioContext, val: number, dest: AudioNode): GainNode {
  const g = ctx.createGain();
  g.gain.value = val;
  g.connect(dest);
  return g;
}

export function engKick(ctx: BaseAudioContext, when: number) {
  const o = ctx.createOscillator();
  const g = mkGain(ctx, 0, ctx.destination);
  o.connect(g);
  o.frequency.setValueAtTime(180, when);
  o.frequency.exponentialRampToValueAtTime(0.01, when + 0.45);
  g.gain.setValueAtTime(1, when);
  g.gain.exponentialRampToValueAtTime(0.001, when + 0.45);
  o.start(when);
  o.stop(when + 0.5);
}

export function engSnare(ctx: BaseAudioContext, when: number) {
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * 0.18)), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const g = mkGain(ctx, 0.65, ctx.destination);
  s.connect(g);
  g.gain.setValueAtTime(0.65, when);
  g.gain.exponentialRampToValueAtTime(0.001, when + 0.18);
  s.start(when);
}

export function engHihat(ctx: BaseAudioContext, when: number) {
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * 0.06)), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 8000;
  const g = mkGain(ctx, 0.35, ctx.destination);
  s.connect(f);
  f.connect(g);
  g.gain.setValueAtTime(0.35, when);
  g.gain.exponentialRampToValueAtTime(0.001, when + 0.06);
  s.start(when);
}

export function engBass(ctx: BaseAudioContext, when: number, freq = 80) {
  const o = ctx.createOscillator();
  const g = mkGain(ctx, 0, ctx.destination);
  o.type = 'sine';
  o.frequency.value = freq;
  o.connect(g);
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(0.7, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, when + 0.7);
  o.start(when);
  o.stop(when + 0.75);
}

export function engSynth(ctx: BaseAudioContext, when: number, freq = 440, dur = 0.4) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1200;
  f.Q.value = 2;
  o.type = 'sawtooth';
  o.frequency.value = freq;
  o.connect(f);
  f.connect(g);
  g.connect(ctx.destination);
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(0.25, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, when + dur);
  o.start(when);
  o.stop(when + dur + 0.05);
}

export function engPad(ctx: BaseAudioContext, when: number, freq = 220) {
  const o = ctx.createOscillator();
  const g = mkGain(ctx, 0, ctx.destination);
  o.type = 'triangle';
  o.frequency.value = freq;
  o.connect(g);
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(0.2, when + 0.2);
  g.gain.exponentialRampToValueAtTime(0.001, when + 1.2);
  o.start(when);
  o.stop(when + 1.3);
}

export function engKeys(ctx: BaseAudioContext, when: number, freq = 523) {
  const o1 = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const g = mkGain(ctx, 0, ctx.destination);
  o1.type = 'sine';
  o1.frequency.value = freq;
  o2.type = 'sine';
  o2.frequency.value = freq * 2;
  const g2 = mkGain(ctx, 0.15, g);
  o1.connect(g);
  o2.connect(g2);
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(0.4, when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, when + 0.8);
  o1.start(when);
  o1.stop(when + 0.85);
  o2.start(when);
  o2.stop(when + 0.85);
}

// --- Live-context wrapper (original API). ---

export const Audio = {
  kick: (t = 0) => {
    const ctx = getCtx();
    engKick(ctx, ctx.currentTime + t);
  },
  snare: (t = 0) => {
    const ctx = getCtx();
    engSnare(ctx, ctx.currentTime + t);
  },
  hihat: (t = 0) => {
    const ctx = getCtx();
    engHihat(ctx, ctx.currentTime + t);
  },
  bass: (freq = 80, t = 0) => {
    const ctx = getCtx();
    engBass(ctx, ctx.currentTime + t, freq);
  },
  synth: (freq = 440, t = 0, dur = 0.4) => {
    const ctx = getCtx();
    engSynth(ctx, ctx.currentTime + t, freq, dur);
  },
  pad: (freq = 220, t = 0) => {
    const ctx = getCtx();
    engPad(ctx, ctx.currentTime + t, freq);
  },
  keys: (freq = 523, t = 0) => {
    const ctx = getCtx();
    engKeys(ctx, ctx.currentTime + t, freq);
  },
};

// --- Frequency / scale tables (shared by live + offline render). ---

export const BASS_SCALE = [55, 65, 73, 82, 98, 110, 123, 146];
export const SYNTH_SCALE = [261, 294, 329, 349, 392, 440, 494, 523];
export const PAD_SCALE = [110, 123, 146, 165, 196, 220, 261, 294];
export const KEYS_SCALE = [261, 294, 329, 349, 392, 440, 494, 523];
export const FX_SCALE = [880, 988, 1047, 1175, 1319, 1397, 1568, 1760];
export const DRUM_ARC: Array<'kick' | 'snare' | 'hihat'> = [
  'kick',
  'snare',
  'hihat',
  'kick',
  'snare',
  'hihat',
  'kick',
  'snare',
];

// Pad grid schedulers on any ctx. Index = row*4 + col.
export const PAD_ENG: Array<(ctx: BaseAudioContext, when: number) => void> = [
  (c, w) => engKick(c, w),
  (c, w) => engKick(c, w + 0.01),
  (c, w) => engKick(c, w),
  (c, w) => engKick(c, w + 0.02),
  (c, w) => engSnare(c, w),
  (c, w) => engHihat(c, w),
  (c, w) => engSnare(c, w),
  (c, w) => engHihat(c, w),
  (c, w) => engBass(c, w, 55),
  (c, w) => engBass(c, w, 65),
  (c, w) => engBass(c, w, 73),
  (c, w) => engBass(c, w, 82),
  (c, w) => engSynth(c, w, 261),
  (c, w) => engSynth(c, w, 329),
  (c, w) => engSynth(c, w, 392),
  (c, w) => engSynth(c, w, 523),
];

// Live pad fns (unchanged API for PadView).
export const PAD_SOUNDS: Array<() => void> = PAD_ENG.map((fn) => () => {
  const ctx = getCtx();
  fn(ctx, ctx.currentTime);
});

// Arc scales for live play (unchanged API for OrchestraView).
export const SCALES: Record<InstrumentId, Array<() => void>> = {
  drums: DRUM_ARC.map((k) => () => {
    if (k === 'kick') Audio.kick();
    else if (k === 'snare') Audio.snare();
    else Audio.hihat();
  }),
  bass: BASS_SCALE.map((f) => () => Audio.bass(f)),
  synth: SYNTH_SCALE.map((f) => () => Audio.synth(f)),
  pads: PAD_SCALE.map((f) => () => Audio.pad(f)),
  keys: KEYS_SCALE.map((f) => () => Audio.keys(f)),
  fx: FX_SCALE.map((f) => () => Audio.synth(f, 0, 0.12)),
};
