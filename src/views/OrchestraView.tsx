import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { SCALES } from '../audio';
import { Recorder } from '../recorder';
import type { Layer } from '../types';
import { useRipple } from '../useRipple';
import { Waveform } from './Waveform';

interface Props {
  layers: Layer[];
  onArcTap: (idx: number) => void;
  isPlaying: boolean;
}

const W = 375;
const H = 370;
const CX = W / 2;
const CY = H + 20;
const RADII = [60, 108, 158, 208, 258];
const A1 = (205 * Math.PI) / 180;
const A2 = (335 * Math.PI) / 180;

function arcPath(r: number): string {
  const x1 = CX + r * Math.cos(A1);
  const y1 = CY + r * Math.sin(A1);
  const x2 = CX + r * Math.cos(A2);
  const y2 = CY + r * Math.sin(A2);
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

function noteDotPos(r: number, noteIdx: number) {
  const t = (noteIdx + 0.5) / 8;
  const angle = A1 + (A2 - A1) * t;
  return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
}

function arcNoteIdx(touchX: number, svgRect: DOMRect, r: number): number {
  const lx = CX + r * Math.cos(A1);
  const rx = CX + r * Math.cos(A2);
  const relX = touchX - svgRect.left;
  const t = Math.max(0, Math.min(1, (relX - lx) / (rx - lx)));
  return Math.floor(t * 8);
}

export function OrchestraView({ layers, onArcTap, isPlaying }: Props) {
  const [ripples, addRipple] = useRipple();
  const [activeNote, setActiveNote] = useState<Record<number, number | undefined>>({});
  const svgRef = useRef<SVGSVGElement>(null);
  const pressedArc = useRef<number | null>(null);
  const lastNote = useRef<Record<number, number | undefined>>({});

  const playAt = (i: number, clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const layer = layers[i];
    const rect = svg.getBoundingClientRect();

    if (layer) {
      const scale = SCALES[layer.id] ?? SCALES.synth;
      const ni = Math.max(0, Math.min(7, arcNoteIdx(clientX, rect, RADII[i])));
      if (lastNote.current[i] === ni) return; // debounce within a drag on the same note
      lastNote.current[i] = ni;
      scale[ni]?.();
      Recorder.capture({ kind: 'arc', instId: layer.id, noteIdx: ni });
      setActiveNote((a) => ({ ...a, [i]: ni }));
      setTimeout(() => setActiveNote((a) => ({ ...a, [i]: undefined })), 300);
      addRipple(clientX - rect.left, clientY - rect.top, layer.color);
    } else {
      onArcTap(i);
      addRipple(clientX - rect.left, clientY - rect.top, 'rgba(255,255,255,0.4)');
    }
  };

  const handlePointerDown = (i: number, e: ReactPointerEvent<SVGGElement>) => {
    e.preventDefault();
    (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId);
    pressedArc.current = i;
    lastNote.current[i] = undefined;
    playAt(i, e.clientX, e.clientY);
  };

  const handlePointerMove = (i: number, e: ReactPointerEvent<SVGGElement>) => {
    if (pressedArc.current !== i) return;
    e.preventDefault();
    playAt(i, e.clientX, e.clientY);
  };

  const handlePointerUp = (e: ReactPointerEvent<SVGGElement>) => {
    const g = e.currentTarget as SVGGElement;
    if (g.hasPointerCapture(e.pointerId)) g.releasePointerCapture(e.pointerId);
    pressedArc.current = null;
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: H, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 50% 110%,rgba(180,127,255,0.07) 0%,transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <svg
        ref={svgRef}
        width={W}
        height={H}
        style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', touchAction: 'none' }}
      >
        {RADII.map((r, i) => {
          const layer = layers[i];
          const an = activeNote[i];
          const lx = CX;
          const ly = CY - r - 6;
          const noteDots = layer ? Array(8).fill(0).map((_, ni) => noteDotPos(r, ni)) : [];
          return (
            <g
              key={i}
              style={{ cursor: 'pointer', touchAction: 'none' }}
              onPointerDown={(e) => handlePointerDown(i, e)}
              onPointerMove={(e) => handlePointerMove(i, e)}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {/* Wide invisible hit zone */}
              <path d={arcPath(r)} fill="none" stroke="transparent" strokeWidth={44} />
              {/* Track groove */}
              <path
                d={arcPath(r)}
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={layer ? 30 : 20}
                strokeLinecap="round"
              />
              {/* Layer fill */}
              {layer && (
                <path
                  d={arcPath(r)}
                  fill="none"
                  stroke={layer.color}
                  strokeWidth={24}
                  strokeLinecap="round"
                  opacity={an !== undefined ? 1 : isPlaying ? 0.88 : 0.62}
                  style={{
                    filter: `drop-shadow(0 0 ${an !== undefined ? '20px' : '7px'} ${layer.color})`,
                    transition: 'opacity 0.15s,filter 0.15s',
                  }}
                />
              )}
              {/* Note position dots on filled arc */}
              {layer &&
                noteDots.map((pos, ni) => (
                  <circle
                    key={ni}
                    cx={pos.x}
                    cy={pos.y}
                    r={an === ni ? 5 : 2.5}
                    fill={an === ni ? '#fff' : layer.color}
                    opacity={an === ni ? 1 : 0.35}
                    style={{ transition: 'r 0.1s,opacity 0.1s' }}
                  />
                ))}
              {/* Active note flash */}
              {layer &&
                an !== undefined &&
                (() => {
                  const p = noteDotPos(r, an);
                  return (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={10}
                      fill={layer.color}
                      opacity={0.35}
                      style={{ animation: 'rippleOut 0.3s ease-out forwards' }}
                    />
                  );
                })()}
              {/* Label */}
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                fill={layer ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.18)'}
                fontSize="10.5"
                fontFamily="Nunito"
                fontWeight="800"
                letterSpacing="1.2"
              >
                {layer ? layer.label.toUpperCase() : `+ LAYER ${i + 1}`}
              </text>
            </g>
          );
        })}
        {/* Center conductor */}
        <circle
          cx={CX}
          cy={CY}
          r={20}
          fill="rgba(255,255,255,0.04)"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1}
        />
        <circle cx={CX} cy={CY} r={6} fill="rgba(255,255,255,0.6)" />
        <circle cx={CX} cy={CY} r={3} fill="white" />
      </svg>

      {/* Playing waveform overlays */}
      {isPlaying &&
        layers.map(
          (layer, i) =>
            layer && (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: CX - 36,
                  top: CY - RADII[i] - 20,
                  width: 72,
                  height: 20,
                  pointerEvents: 'none',
                }}
              >
                <Waveform color={layer.color} bars={10} playing />
              </div>
            ),
        )}

      {/* Ripples */}
      {ripples.map((r) => (
        <div
          key={r.id}
          style={{
            position: 'absolute',
            left: r.x - 20,
            top: r.y - 20,
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: `2px solid ${r.color}`,
            pointerEvents: 'none',
            animation: 'rippleOut 0.6s ease-out forwards',
          }}
        />
      ))}

      {/* Hint */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: 0,
          right: 0,
          textAlign: 'center',
          color: 'rgba(255,255,255,0.18)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.8,
          pointerEvents: 'none',
        }}
      >
        SLIDE ALONG ARC TO PLAY NOTES
      </div>
    </div>
  );
}
