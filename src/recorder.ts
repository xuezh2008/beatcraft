import {
  BASS_SCALE,
  DRUM_ARC,
  FX_SCALE,
  KEYS_SCALE,
  PAD_ENG,
  PAD_SCALE,
  PAD_SOUNDS,
  SCALES,
  SYNTH_SCALE,
  engBass,
  engHihat,
  engKeys,
  engKick,
  engPad,
  engSnare,
  engSynth,
} from './audio';
import type { InstrumentId } from './types';

export type NoteRef =
  | { kind: 'arc'; instId: InstrumentId; noteIdx: number }
  | { kind: 'pad'; padIdx: number };

export interface RecEvent {
  t: number;
  instId: InstrumentId;
  ref: NoteRef;
}

export interface Recording {
  id: string;
  name: string;
  events: RecEvent[];
  createdAt: number;
}

export function playRef(ref: NoteRef): void {
  if (ref.kind === 'arc') SCALES[ref.instId]?.[ref.noteIdx]?.();
  else PAD_SOUNDS[ref.padIdx]?.();
}

// Schedule a note on ANY AudioContext (live or OfflineAudioContext) at absolute time `when`.
export function renderRefOn(ctx: BaseAudioContext, ref: NoteRef, when: number): void {
  if (ref.kind === 'pad') {
    PAD_ENG[ref.padIdx]?.(ctx, when);
    return;
  }
  const ni = ref.noteIdx;
  switch (ref.instId) {
    case 'drums': {
      const k = DRUM_ARC[ni];
      if (k === 'kick') engKick(ctx, when);
      else if (k === 'snare') engSnare(ctx, when);
      else if (k === 'hihat') engHihat(ctx, when);
      return;
    }
    case 'bass':
      engBass(ctx, when, BASS_SCALE[ni]);
      return;
    case 'synth':
      engSynth(ctx, when, SYNTH_SCALE[ni]);
      return;
    case 'pads':
      engPad(ctx, when, PAD_SCALE[ni]);
      return;
    case 'keys':
      engKeys(ctx, when, KEYS_SCALE[ni]);
      return;
    case 'fx':
      engSynth(ctx, when, FX_SCALE[ni], 0.12);
      return;
  }
}

export function instIdFromPadRow(padIdx: number): InstrumentId {
  const row = Math.floor(padIdx / 4);
  return (['drums', 'drums', 'bass', 'synth'] as InstrumentId[])[row];
}

let events: RecEvent[] = [];
let startedAt = 0;
let recording = false;

export const Recorder = {
  start() {
    events = [];
    startedAt = performance.now();
    recording = true;
  },
  stop(): RecEvent[] {
    recording = false;
    return [...events];
  },
  isRecording(): boolean {
    return recording;
  },
  capture(ref: NoteRef) {
    if (!recording) return;
    const instId = ref.kind === 'arc' ? ref.instId : instIdFromPadRow(ref.padIdx);
    events.push({ t: performance.now() - startedAt, instId, ref });
  },
};

export function startLoop(
  events: RecEvent[],
  isMuted: (id: InstrumentId) => boolean,
): () => void {
  if (events.length === 0) return () => {};
  const duration = events[events.length - 1].t + 500;
  let stopped = false;
  let handles: number[] = [];

  const scheduleCycle = () => {
    if (stopped) return;
    handles = [];
    for (const e of events) {
      handles.push(
        window.setTimeout(() => {
          if (!isMuted(e.instId)) playRef(e.ref);
        }, e.t),
      );
    }
    handles.push(window.setTimeout(scheduleCycle, duration));
  };
  scheduleCycle();

  return () => {
    stopped = true;
    for (const h of handles) window.clearTimeout(h);
  };
}
