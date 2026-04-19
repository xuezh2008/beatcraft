import type { Recording } from './recorder';

const STORAGE_KEY = 'bc_recordings_v1';
const ACTIVE_KEY = 'bc_active_recording_v1';
const MIX_KEY = 'bc_mix_selection_v1';

export function loadRecordings(): Recording[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidRecording);
  } catch {
    return [];
  }
}

export function saveRecordings(recs: Recording[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recs));
  } catch {
    // Quota or disabled — fail silently; in-memory state still works.
  }
}

export function loadActiveId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function saveActiveId(id: string | null): void {
  if (id === null) localStorage.removeItem(ACTIVE_KEY);
  else localStorage.setItem(ACTIVE_KEY, id);
}

export function loadMixSelection(): string[] {
  try {
    const raw = localStorage.getItem(MIX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveMixSelection(ids: string[]): void {
  try {
    localStorage.setItem(MIX_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export function newId(): string {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function nextName(recs: Recording[]): string {
  const used = new Set(recs.map((r) => r.name));
  for (let i = 1; i < 1000; i++) {
    const candidate = `Recording ${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `Recording ${Date.now()}`;
}

function isValidRecording(x: unknown): x is Recording {
  if (!x || typeof x !== 'object') return false;
  const r = x as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.name !== 'string') return false;
  if (typeof r.createdAt !== 'number' || !Array.isArray(r.events)) return false;
  return r.events.every((e) => {
    if (!e || typeof e !== 'object') return false;
    const ev = e as Record<string, unknown>;
    if (typeof ev.t !== 'number' || typeof ev.instId !== 'string') return false;
    const ref = ev.ref as Record<string, unknown> | undefined;
    if (!ref) return false;
    if (ref.kind === 'arc') {
      return typeof ref.instId === 'string' && typeof ref.noteIdx === 'number';
    }
    if (ref.kind === 'pad') return typeof ref.padIdx === 'number';
    return false;
  });
}
