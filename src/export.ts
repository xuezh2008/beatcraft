import { renderRefOn, type Recording } from './recorder';

const SAMPLE_RATE = 44100;
const TAIL_SEC = 2.0;

type OACtor = typeof OfflineAudioContext;

function getOfflineCtor(): OACtor {
  const Ctor =
    window.OfflineAudioContext ??
    (window as typeof window & { webkitOfflineAudioContext?: OACtor }).webkitOfflineAudioContext;
  if (!Ctor) throw new Error('OfflineAudioContext not supported in this browser');
  return Ctor;
}

export interface TimedNote {
  t: number; // seconds on the offline timeline
  ref: Recording['events'][number]['ref'];
}

function collectNotes(events: Recording['events']): TimedNote[] {
  if (events.length === 0) return [];
  const base = events[0].t;
  return events.map((e) => ({ t: (e.t - base) / 1000, ref: e.ref }));
}

async function renderNotesToBuffer(notes: TimedNote[]): Promise<AudioBuffer> {
  if (notes.length === 0) throw new Error('Nothing to render');
  const lastT = notes.reduce((m, n) => (n.t > m ? n.t : m), 0);
  const durSec = lastT + TAIL_SEC;
  const frames = Math.max(1, Math.ceil(durSec * SAMPLE_RATE));
  const Ctor = getOfflineCtor();
  const ctx = new Ctor(2, frames, SAMPLE_RATE);
  for (const n of notes) renderRefOn(ctx, n.ref, n.t);
  return await ctx.startRendering();
}

export async function renderRecording(rec: Recording): Promise<Blob> {
  const notes = collectNotes(rec.events);
  const buf = await renderNotesToBuffer(notes);
  return encodeWav(buf);
}

export async function renderMix(recordings: Recording[]): Promise<Blob> {
  const notes: TimedNote[] = [];
  for (const rec of recordings) notes.push(...collectNotes(rec.events));
  notes.sort((a, b) => a.t - b.t);
  const buf = await renderNotesToBuffer(notes);
  return encodeWav(buf);
}

export function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const bufferSize = 44 + dataSize;
  const ab = new ArrayBuffer(bufferSize);
  const view = new DataView(ab);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([ab], { type: 'audio/wav' });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'recording'
  );
}
