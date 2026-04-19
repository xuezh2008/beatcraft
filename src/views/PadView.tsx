import { useState } from 'react';
import { PAD_SOUNDS } from '../audio';
import { Recorder } from '../recorder';
import type { Instrument, Layer } from '../types';

interface Props {
  layers: Layer[];
  activeInst: Instrument;
}

const ROW_LABELS = ['Kick', 'Snare / HH', 'Bass', 'Lead'];

export function PadView({ layers, activeInst }: Props) {
  const [held, setHeld] = useState<Record<number, boolean>>({});
  const colors = [activeInst.color, '#3DD9FF', '#B47FFF', '#52E89B'];

  const down = (i: number) => {
    const play = PAD_SOUNDS[i];
    if (!play) return;
    play();
    Recorder.capture({ kind: 'pad', padIdx: i });
    setHeld((h) => ({ ...h, [i]: true }));
  };
  const up = (i: number) => setHeld((h) => ({ ...h, [i]: false }));

  return (
    <div style={{ padding: '4px 16px 0' }}>
      {/* Layer bar */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
        {Array(5)
          .fill(0)
          .map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 5,
                borderRadius: 100,
                background: layers[i] ? layers[i]!.color : 'rgba(255,255,255,0.08)',
                boxShadow: layers[i] ? `0 0 8px ${layers[i]!.color}60` : 'none',
                transition: 'all 0.3s',
              }}
            />
          ))}
      </div>
      {/* Row labels + grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[0, 1, 2, 3].map((row) => (
          <div key={row} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div
              style={{
                width: 52,
                color: 'rgba(255,255,255,0.3)',
                fontSize: 10,
                fontWeight: 800,
                textAlign: 'right',
                flexShrink: 0,
              }}
            >
              {ROW_LABELS[row]}
            </div>
            <div
              style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: 'repeat(4,1fr)',
                gap: 8,
              }}
            >
              {[0, 1, 2, 3].map((col) => {
                const idx = row * 4 + col;
                const on = held[idx];
                const c = colors[row];
                return (
                  <div
                    key={col}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      down(idx);
                    }}
                    onPointerUp={() => up(idx)}
                    onPointerCancel={() => up(idx)}
                    onPointerLeave={() => up(idx)}
                    style={{
                      aspectRatio: '1',
                      borderRadius: 16,
                      background: on ? `${c}30` : 'rgba(255,255,255,0.05)',
                      border: `2px solid ${on ? c : 'rgba(255,255,255,0.07)'}`,
                      boxShadow: on ? `0 0 20px ${c}55,inset 0 0 14px ${c}18` : 'none',
                      transform: on ? 'scale(0.92)' : 'scale(1)',
                      transition: 'all 0.07s',
                      cursor: 'pointer',
                      touchAction: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {on && (
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: c,
                          boxShadow: `0 0 8px ${c}`,
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          textAlign: 'center',
          marginTop: 12,
          color: 'rgba(255,255,255,0.18)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1,
        }}
      >
        HOLD TO PLAY
      </div>
    </div>
  );
}
