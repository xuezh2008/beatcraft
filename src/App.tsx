import { useEffect, useRef, useState } from 'react';
import { getCtx } from './audio';
import { downloadBlob, renderMix, slugify } from './export';
import { INST } from './instruments';
import { Recorder, startLoop, type Recording } from './recorder';
import {
  loadActiveId,
  loadMixSelection,
  loadRecordings,
  newId,
  nextName,
  saveActiveId,
  saveMixSelection,
  saveRecordings,
} from './recordings';
import type { Instrument, InstrumentId, Layer, ViewId } from './types';
import { OrchestraView } from './views/OrchestraView';
import { PadView } from './views/PadView';
import { LooperView } from './views/LooperView';

const DEFAULTS = { bpm: 120, defaultView: 'A' as ViewId };
const LOGO_ARCS = [
  { r: 13, color: '#FF6B47' },
  { r: 9, color: '#B47FFF' },
  { r: 5.5, color: '#3DD9FF' },
];

function isViewId(v: string | null): v is ViewId {
  return v === 'A' || v === 'B' || v === 'C';
}

export function App() {
  const [view, setView] = useState<ViewId>(() => {
    const stored = localStorage.getItem('bc_web_view');
    return isViewId(stored) ? stored : DEFAULTS.defaultView;
  });
  const [activeInst, setActiveInst] = useState<Instrument>(INST[0]);
  const [layers, setLayers] = useState<Layer[]>([INST[0]]);
  const [isRec, setIsRec] = useState(false);
  const [isPlay, setIsPlay] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const [showInst, setShowInst] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>(() => loadRecordings());
  const [activeId, setActiveIdState] = useState<string | null>(() => loadActiveId());
  const [mixIds, setMixIds] = useState<string[]>(() => loadMixSelection());
  const [recordMode, setRecordMode] = useState<'new' | 'overdub'>('new');
  const [exportingMix, setExportingMix] = useState(false);
  const [muted, setMuted] = useState<Record<InstrumentId, boolean>>(
    {} as Record<InstrumentId, boolean>,
  );
  const bpm = DEFAULTS.bpm;
  const timer = useRef<number | null>(null);
  const loopStops = useRef<Array<() => void>>([]);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  useEffect(() => {
    localStorage.setItem('bc_web_view', view);
  }, [view]);

  useEffect(() => {
    saveRecordings(recordings);
  }, [recordings]);

  useEffect(() => {
    saveActiveId(activeId);
  }, [activeId]);

  useEffect(() => {
    saveMixSelection(mixIds);
  }, [mixIds]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearInterval(timer.current);
      stopAllLoops();
    },
    [],
  );

  const setActiveId = (id: string | null) => setActiveIdState(id);

  const stopAllLoops = () => {
    for (const fn of loopStops.current) fn();
    loopStops.current = [];
  };

  const stopPlayback = () => {
    stopAllLoops();
    setIsPlay(false);
  };

  // Play whichever recordings are in the mix selection; each on its own loop.
  const startMixedPlayback = () => {
    stopAllLoops();
    const toPlay = recordings.filter((r) => mixIds.includes(r.id));
    if (toPlay.length === 0) return false;
    for (const rec of toPlay) {
      const stop = startLoop(rec.events, (id) => !!mutedRef.current[id]);
      loopStops.current.push(stop);
    }
    return true;
  };

  const toggleRec = () => {
    if (isRec) {
      // Stop recording
      const captured = Recorder.stop();
      setIsRec(false);
      if (timer.current !== null) window.clearInterval(timer.current);
      setRecSec(0);
      stopAllLoops();
      setIsPlay(false);
      if (captured.length === 0) return;

      if (recordMode === 'overdub' && activeId !== null) {
        // Merge into active recording; re-sort by time.
        setRecordings((rs) =>
          rs.map((r) => {
            if (r.id !== activeId) return r;
            const merged = [...r.events, ...captured].sort((a, b) => a.t - b.t);
            return { ...r, events: merged };
          }),
        );
      } else {
        // New recording.
        setRecordings((rs) => {
          const rec: Recording = {
            id: newId(),
            name: nextName(rs),
            events: captured,
            createdAt: Date.now(),
          };
          setActiveIdState(rec.id);
          setMixIds((m) => (m.includes(rec.id) ? m : [...m, rec.id]));
          return [...rs, rec];
        });
      }
    } else {
      // Start recording
      getCtx();
      stopAllLoops();
      setIsPlay(false);
      Recorder.start();
      setIsRec(true);
      timer.current = window.setInterval(() => setRecSec((s) => s + 1), 1000);
      // Keep mixed recordings playing under the record (overdub hearing)
      const started = startMixedPlayback();
      if (!started) {
        // No mix selected; nothing to play under.
      }
    }
  };

  const togglePlay = () => {
    if (isPlay) {
      stopPlayback();
    } else {
      if (isRec) return;
      getCtx();
      const ok = startMixedPlayback();
      if (ok) setIsPlay(true);
    }
  };

  const renameRecording = (id: string, name: string) => {
    setRecordings((rs) => rs.map((r) => (r.id === id ? { ...r, name } : r)));
  };

  const deleteRecording = (id: string) => {
    setRecordings((rs) => rs.filter((r) => r.id !== id));
    setMixIds((m) => m.filter((x) => x !== id));
    if (activeId === id) setActiveIdState(null);
  };

  const toggleMix = (id: string) => {
    setMixIds((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  };

  const exportMix = async () => {
    const toExport = recordings.filter((r) => mixIds.includes(r.id) && r.events.length > 0);
    if (toExport.length === 0 || exportingMix) return;
    setExportingMix(true);
    try {
      const blob = await renderMix(toExport);
      const name = toExport.length === 1 ? slugify(toExport[0].name) : `mix-${toExport.length}`;
      downloadBlob(blob, `${name}.wav`);
    } catch (err) {
      console.error('Export failed:', err);
      window.alert(`Export failed: ${(err as Error).message}`);
    } finally {
      setExportingMix(false);
    }
  };

  const addLayerByArc = (idx: number) => {
    const avail = INST.filter((x) => !layers.find((l) => l && l.id === x.id));
    if (avail.length && !layers[idx]) {
      setLayers((ll) => {
        const c = [...ll];
        c[idx] = avail[0];
        return c;
      });
    }
  };

  const addLayer = () => {
    const avail = INST.filter((x) => !layers.find((l) => l && l.id === x.id));
    if (avail.length) setLayers((ll) => [...ll, avail[0]]);
  };

  const mixCount = mixIds.filter((id) => recordings.some((r) => r.id === id)).length;
  const playLabel = isPlay
    ? '■  Stop'
    : mixCount === 0
    ? '▶  (select a recording)'
    : mixCount === 1
    ? '▶  Play'
    : `▶  Play Mix (${mixCount})`;
  const playDisabled = !isPlay && mixCount === 0;

  const recModeDisabled = recordMode === 'overdub' && activeId === null;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#0D0A1A',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient orbs */}
      <div
        style={{
          position: 'absolute',
          left: '10%',
          top: '20%',
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: '#B47FFF',
          opacity: 0.07,
          filter: 'blur(60px)',
          pointerEvents: 'none',
          animation: 'orbDrift 6s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: '5%',
          top: '50%',
          width: 140,
          height: 140,
          borderRadius: '50%',
          background: '#3DD9FF',
          opacity: 0.06,
          filter: 'blur(50px)',
          pointerEvents: 'none',
          animation: 'orbDrift 8s ease-in-out infinite',
          animationDelay: '2s',
        }}
      />

      {/* Header */}
      <div
        style={{
          padding: '14px 16px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="28" height="22" viewBox="0 0 28 22">
            {LOGO_ARCS.map(({ r, color }, i) => {
              const cx = 14;
              const cy = 24;
              const a1 = (205 * Math.PI) / 180;
              const a2 = (335 * Math.PI) / 180;
              const d = `M${(cx + r * Math.cos(a1)).toFixed(1)} ${(cy + r * Math.sin(a1)).toFixed(
                1,
              )} A${r} ${r} 0 0 1 ${(cx + r * Math.cos(a2)).toFixed(1)} ${(cy + r * Math.sin(a2)).toFixed(1)}`;
              return (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
          <span style={{ fontWeight: 900, fontSize: 17, letterSpacing: -0.5 }}>BEATCRAFT</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 8,
              padding: '5px 10px',
              fontSize: 12,
              fontWeight: 800,
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            {bpm} BPM
          </div>
          <div
            onClick={() => setShowInst((s) => !s)}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: showInst ? activeInst.color + '30' : 'rgba(255,255,255,0.07)',
              border: `1.5px solid ${showInst ? activeInst.color + '60' : 'rgba(255,255,255,0.1)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: activeInst.color,
              }}
            />
          </div>
        </div>
      </div>

      {/* Instrument picker drawer */}
      {showInst && (
        <div
          style={{
            background: 'rgba(13,10,26,0.97)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            padding: '12px 16px',
            display: 'flex',
            gap: 8,
            flexShrink: 0,
            flexWrap: 'wrap',
            animation: 'slideUp 0.22s ease',
          }}
        >
          {INST.map((inst) => (
            <div
              key={inst.id}
              onClick={() => {
                setActiveInst(inst);
                setShowInst(false);
              }}
              style={{
                background:
                  activeInst.id === inst.id ? `${inst.color}25` : 'rgba(255,255,255,0.05)',
                border: `1.5px solid ${
                  activeInst.id === inst.id ? inst.color : 'rgba(255,255,255,0.1)'
                }`,
                borderRadius: 100,
                padding: '7px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                transition: 'all 0.2s',
              }}
            >
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: inst.color }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.85)' }}>
                {inst.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* View tabs */}
      <div style={{ padding: '10px 16px 8px', display: 'flex', gap: 6, flexShrink: 0 }}>
        {(
          [
            { id: 'A', label: 'Orchestra' },
            { id: 'B', label: 'Pads' },
            { id: 'C', label: 'Studio' },
          ] as const
        ).map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            style={{
              flex: 1,
              background: view === v.id ? '#fff' : 'rgba(255,255,255,0.06)',
              border: 'none',
              borderRadius: 10,
              padding: '9px 4px',
              color: view === v.id ? '#0D0A1A' : 'rgba(255,255,255,0.4)',
              fontSize: 12,
              fontWeight: 900,
              fontFamily: 'Nunito',
              cursor: 'pointer',
              transition: 'all 0.2s',
              letterSpacing: 0.2,
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Active instrument + layers strip */}
      <div
        style={{
          padding: '4px 16px 8px',
          display: 'flex',
          gap: 7,
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        {layers.filter((l): l is Instrument => Boolean(l)).map((l, i) => (
          <div
            key={i}
            style={{
              background: `${l.color}18`,
              border: `1.5px solid ${l.color}45`,
              borderRadius: 100,
              padding: '3px 11px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: l.color }} />
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 800 }}>
              {l.label}
            </span>
          </div>
        ))}
      </div>

      {/* Main creation view */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {view === 'A' && (
          <OrchestraView layers={layers} onArcTap={addLayerByArc} isPlaying={isPlay} />
        )}
        {view === 'B' && <PadView layers={layers} activeInst={activeInst} />}
        {view === 'C' && (
          <LooperView
            recordings={recordings}
            activeId={activeId}
            setActiveId={setActiveId}
            mixIds={mixIds}
            toggleMix={toggleMix}
            renameRecording={renameRecording}
            deleteRecording={deleteRecording}
            muted={muted}
            setMuted={setMuted}
            isPlaying={isPlay}
            isRecording={isRec}
          />
        )}
      </div>

      {/* Transport bar */}
      <div
        style={{
          padding: '10px 16px 28px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(8,6,18,0.98)',
          flexShrink: 0,
        }}
      >
        {/* Record mode toggle */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginBottom: 10,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <button
            onClick={() => setRecordMode('new')}
            disabled={isRec}
            style={{
              background: recordMode === 'new' ? 'rgba(255,107,71,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1.5px solid ${recordMode === 'new' ? 'rgba(255,107,71,0.5)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 100,
              padding: '4px 11px',
              color: recordMode === 'new' ? '#FF6B47' : 'rgba(255,255,255,0.45)',
              fontSize: 10,
              fontFamily: 'Nunito',
              fontWeight: 900,
              letterSpacing: 0.5,
              cursor: isRec ? 'not-allowed' : 'pointer',
              opacity: isRec ? 0.5 : 1,
            }}
          >
            NEW
          </button>
          <button
            onClick={() => setRecordMode('overdub')}
            disabled={isRec || activeId === null}
            title={activeId === null ? 'Select a recording to overdub onto' : 'Append to active recording'}
            style={{
              background:
                recordMode === 'overdub' && activeId !== null
                  ? 'rgba(180,127,255,0.15)'
                  : 'rgba(255,255,255,0.04)',
              border: `1.5px solid ${
                recordMode === 'overdub' && activeId !== null
                  ? 'rgba(180,127,255,0.5)'
                  : 'rgba(255,255,255,0.08)'
              }`,
              borderRadius: 100,
              padding: '4px 11px',
              color:
                recordMode === 'overdub' && activeId !== null
                  ? '#B47FFF'
                  : 'rgba(255,255,255,0.3)',
              fontSize: 10,
              fontFamily: 'Nunito',
              fontWeight: 900,
              letterSpacing: 0.5,
              cursor: recModeDisabled || isRec ? 'not-allowed' : 'pointer',
              opacity: recModeDisabled || isRec ? 0.5 : 1,
            }}
          >
            OVERDUB
          </button>
          {isRec && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginLeft: 6,
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#FF6B47',
                  animation: 'pulseRec 0.9s infinite',
                }}
              />
              <span style={{ color: '#FF6B47', fontSize: 11, fontWeight: 900 }}>
                {Math.floor(recSec / 60)}:{String(recSec % 60).padStart(2, '0')}
              </span>
            </div>
          )}
          {!isRec && mixCount > 0 && (
            <button
              onClick={exportMix}
              disabled={exportingMix}
              title={
                mixCount === 1
                  ? 'Download the selected recording as WAV'
                  : `Render the ${mixCount}-track mix to WAV`
              }
              style={{
                background: exportingMix ? 'rgba(82,232,155,0.25)' : 'rgba(82,232,155,0.1)',
                border: '1.5px solid rgba(82,232,155,0.4)',
                borderRadius: 100,
                padding: '4px 11px',
                color: '#52E89B',
                fontSize: 10,
                fontFamily: 'Nunito',
                fontWeight: 900,
                letterSpacing: 0.5,
                cursor: exportingMix ? 'wait' : 'pointer',
                marginLeft: 6,
              }}
            >
              {exportingMix ? 'RENDERING…' : `⬇ ${mixCount === 1 ? 'EXPORT' : 'EXPORT MIX'}`}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={addLayer}
            style={{
              width: 50,
              height: 50,
              borderRadius: 14,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.09)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              flexShrink: 0,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 18,
                  height: 2,
                  background: 'rgba(255,255,255,0.45)',
                  borderRadius: 1,
                }}
              />
            ))}
          </button>
          <button
            onClick={togglePlay}
            disabled={playDisabled}
            style={{
              flex: 1,
              height: 50,
              borderRadius: 14,
              background: isPlay
                ? 'rgba(255,107,71,0.12)'
                : mixCount > 0
                ? 'rgba(82,232,155,0.1)'
                : 'rgba(255,255,255,0.04)',
              border: `1.5px solid ${
                isPlay
                  ? 'rgba(255,107,71,0.4)'
                  : mixCount > 0
                  ? 'rgba(82,232,155,0.4)'
                  : 'rgba(255,255,255,0.08)'
              }`,
              cursor: playDisabled ? 'not-allowed' : 'pointer',
              color: isPlay ? '#FF6B47' : mixCount > 0 ? '#52E89B' : 'rgba(255,255,255,0.35)',
              fontFamily: 'Nunito',
              fontWeight: 900,
              fontSize: 13,
              transition: 'all 0.2s',
            }}
          >
            {playLabel}
          </button>
          <button
            onClick={toggleRec}
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: isRec ? '#FF6B47' : 'rgba(255,107,71,0.1)',
              border: `3px solid #FF6B47`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isRec ? '0 0 32px rgba(255,107,71,0.7)' : 'none',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: isRec ? 18 : 24,
                height: isRec ? 18 : 24,
                borderRadius: isRec ? 4 : '50%',
                background: isRec ? '#fff' : '#FF6B47',
                transition: 'all 0.25s',
              }}
            />
          </button>
          <button
            onClick={addLayer}
            style={{
              width: 50,
              height: 50,
              borderRadius: 14,
              background: 'rgba(180,127,255,0.1)',
              border: '1.5px solid rgba(180,127,255,0.3)',
              cursor: 'pointer',
              color: '#B47FFF',
              fontSize: 24,
              fontFamily: 'Nunito',
              fontWeight: 300,
              flexShrink: 0,
            }}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
