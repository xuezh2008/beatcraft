import { useState } from 'react';
import { downloadBlob, renderRecording, slugify } from '../export';
import { playRef, type Recording } from '../recorder';
import type { InstrumentId } from '../types';
import { Waveform } from './Waveform';

interface Props {
  recordings: Recording[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  mixIds: string[];
  toggleMix: (id: string) => void;
  renameRecording: (id: string, name: string) => void;
  deleteRecording: (id: string) => void;
  muted: Record<InstrumentId, boolean>;
  setMuted: (next: Record<InstrumentId, boolean>) => void;
  isPlaying: boolean;
  isRecording: boolean;
}

const INST_COLOR: Record<InstrumentId, string> = {
  drums: '#FF6B47',
  bass: '#3DD9FF',
  synth: '#B47FFF',
  pads: '#52E89B',
  keys: '#FF7EC7',
  fx: '#FFD447',
};

function eventsDurationSec(rec: Recording): number {
  if (rec.events.length === 0) return 0;
  return (rec.events[rec.events.length - 1].t + 500) / 1000;
}

function instrumentsIn(rec: Recording): InstrumentId[] {
  const seen = new Set<InstrumentId>();
  for (const e of rec.events) seen.add(e.instId);
  return [...seen];
}

export function LooperView({
  recordings,
  activeId,
  setActiveId,
  mixIds,
  toggleMix,
  renameRecording,
  deleteRecording,
  muted,
  setMuted,
  isPlaying,
  isRecording,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const exportRecording = async (rec: Recording) => {
    if (rec.events.length === 0 || exportingId !== null) return;
    setExportingId(rec.id);
    try {
      const blob = await renderRecording(rec);
      downloadBlob(blob, `${slugify(rec.name)}.wav`);
    } catch (err) {
      console.error('Export failed:', err);
      window.alert(`Export failed: ${(err as Error).message}`);
    } finally {
      setExportingId(null);
    }
  };

  const startRename = (rec: Recording) => {
    setEditingId(rec.id);
    setDraft(rec.name);
  };
  const commitRename = () => {
    if (editingId !== null) {
      const trimmed = draft.trim();
      if (trimmed.length > 0) renameRecording(editingId, trimmed);
    }
    setEditingId(null);
  };

  const previewRecording = (rec: Recording) => {
    if (rec.events.length === 0) return;
    setPreviewId(rec.id);
    const offset = rec.events[0].t;
    for (const e of rec.events) {
      window.setTimeout(() => playRef(e.ref), e.t - offset);
    }
    const total = rec.events[rec.events.length - 1].t - offset;
    window.setTimeout(() => setPreviewId((p) => (p === rec.id ? null : p)), total + 50);
  };

  if (recordings.length === 0) {
    return (
      <div style={{ padding: '24px 20px', textAlign: 'center' }}>
        <div
          style={{
            borderRadius: 16,
            border: '1.5px dashed rgba(255,255,255,0.15)',
            padding: '28px 18px',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 10 }}>🎙️</div>
          <div style={{ fontWeight: 900, fontSize: 14, color: '#fff', marginBottom: 6 }}>
            No recordings yet
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
            Hit the red ● below, play something on Orchestra or Pads,
            <br />
            then stop. It'll appear here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 16px 12px', display: 'flex', flexDirection: 'column', gap: 9, overflowY: 'auto', height: '100%' }}>
      {recordings.map((rec) => {
        const isActive = activeId === rec.id;
        const inMix = mixIds.includes(rec.id);
        const isPreviewing = previewId === rec.id;
        const dur = eventsDurationSec(rec);
        const insts = instrumentsIn(rec);
        const accentColor = insts[0] ? INST_COLOR[insts[0]] : '#B47FFF';

        return (
          <div
            key={rec.id}
            style={{
              background: isActive ? `${accentColor}14` : 'rgba(255,255,255,0.03)',
              border: `1.5px solid ${isActive ? accentColor + '55' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 16,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {/* Top row: name + actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                onClick={() => toggleMix(rec.id)}
                title={inMix ? 'Remove from mix' : 'Include in mix'}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  background: inMix ? accentColor : 'transparent',
                  border: `1.5px solid ${inMix ? accentColor : 'rgba(255,255,255,0.25)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  color: '#0D0A1A',
                  fontSize: 13,
                  fontWeight: 900,
                }}
              >
                {inMix ? '✓' : ''}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === rec.id ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    style={{
                      width: '100%',
                      background: 'rgba(0,0,0,0.35)',
                      border: `1px solid ${accentColor}`,
                      borderRadius: 6,
                      color: '#fff',
                      padding: '3px 7px',
                      fontFamily: 'Nunito',
                      fontWeight: 800,
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                ) : (
                  <div
                    onClick={() => setActiveId(rec.id)}
                    onDoubleClick={() => startRename(rec)}
                    style={{
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: 13,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}
                  >
                    {rec.name}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.4)',
                    marginTop: 2,
                  }}
                >
                  {rec.events.length} notes · {dur.toFixed(1)}s
                  {isActive && !isRecording && ' · active'}
                  {isActive && isRecording && ' · overdubbing'}
                </div>
              </div>
              {/* Rename */}
              <div
                onClick={() => startRename(rec)}
                title="Rename"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  color: 'rgba(255,255,255,0.55)',
                  fontSize: 12,
                }}
              >
                ✎
              </div>
              {/* Preview */}
              <div
                onClick={() => previewRecording(rec)}
                title="Preview (one-shot)"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: isPreviewing ? `${accentColor}40` : 'rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderTop: '5px solid transparent',
                    borderBottom: '5px solid transparent',
                    borderLeft: `8px solid ${accentColor}`,
                    marginLeft: 2,
                  }}
                />
              </div>
              {/* Export */}
              <div
                onClick={() => exportRecording(rec)}
                title={rec.events.length === 0 ? 'No notes to export' : 'Download as WAV'}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background:
                    exportingId === rec.id ? `${accentColor}30` : 'rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: rec.events.length === 0 ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                  color: rec.events.length === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.65)',
                  fontSize: 12,
                  fontWeight: 900,
                  opacity: rec.events.length === 0 ? 0.4 : 1,
                }}
              >
                {exportingId === rec.id ? '…' : '⬇'}
              </div>
              {/* Delete */}
              <div
                onClick={() => {
                  if (window.confirm(`Delete "${rec.name}"?`)) deleteRecording(rec.id);
                }}
                title="Delete"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  color: 'rgba(255,127,127,0.7)',
                  fontSize: 15,
                  fontWeight: 900,
                }}
              >
                ×
              </div>
            </div>
            {/* Instrument chips + mute */}
            {insts.length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {insts.map((id) => {
                  const isMuted = !!muted[id];
                  return (
                    <div
                      key={id}
                      onClick={() => setMuted({ ...muted, [id]: !isMuted })}
                      title={isMuted ? `Unmute ${id}` : `Mute ${id}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '3px 9px',
                        borderRadius: 100,
                        background: isMuted ? 'rgba(255,255,255,0.04)' : `${INST_COLOR[id]}18`,
                        border: `1px solid ${isMuted ? 'rgba(255,255,255,0.1)' : INST_COLOR[id] + '40'}`,
                        cursor: 'pointer',
                        opacity: isMuted ? 0.4 : 1,
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: INST_COLOR[id],
                        }}
                      />
                      <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.8)' }}>
                        {id.toUpperCase()}
                        {isMuted && ' (M)'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Waveform */}
            <div style={{ height: 18, opacity: inMix || isActive || isPreviewing ? 1 : 0.35 }}>
              <Waveform
                color={accentColor}
                bars={24}
                playing={(isPlaying && inMix) || isPreviewing}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
