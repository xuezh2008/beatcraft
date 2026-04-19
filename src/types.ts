export type InstrumentId = 'drums' | 'bass' | 'synth' | 'pads' | 'keys' | 'fx';

export type ViewId = 'A' | 'B' | 'C';

export interface Instrument {
  id: InstrumentId;
  label: string;
  color: string;
  playNote: (i: number) => void;
}

export type Layer = Instrument | undefined;
