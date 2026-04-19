import { useState } from 'react';

export interface Ripple {
  id: number;
  x: number;
  y: number;
  color: string;
}

export function useRipple(): [Ripple[], (x: number, y: number, color: string) => void] {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const addRipple = (x: number, y: number, color: string) => {
    const id = Date.now() + Math.random();
    setRipples((r) => [...r, { id, x, y, color }]);
    setTimeout(() => setRipples((r) => r.filter((r2) => r2.id !== id)), 600);
  };
  return [ripples, addRipple];
}
