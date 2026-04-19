import { useMemo } from 'react';

interface Props {
  color: string;
  bars?: number;
  playing?: boolean;
}

export function Waveform({ color, bars = 28, playing }: Props) {
  const heights = useMemo(
    () =>
      Array.from(
        { length: bars },
        (_, i) => `${22 + Math.abs(Math.sin(i * 1.4)) * 56 + Math.cos(i * 0.8) * 18}%`,
      ),
    [bars],
  );
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center', height: '100%', width: '100%' }}>
      {heights.map((ht, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            background: color,
            borderRadius: 2,
            height: ht,
            opacity: playing ? 0.75 : 0.25,
            transformOrigin: 'center',
            animation: playing ? `waveBar ${0.38 + (i % 7) * 0.09}s ease-in-out infinite` : 'none',
            animationDelay: `${i * 0.03}s`,
          }}
        />
      ))}
    </div>
  );
}
