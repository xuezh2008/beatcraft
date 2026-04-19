import { Audio } from './audio';
import type { Instrument } from './types';

export const INST: Instrument[] = [
  { id: 'drums', label: 'Drums', color: '#FF6B47', playNote: (i) => [Audio.kick, Audio.snare, Audio.hihat, Audio.kick][i % 4]() },
  { id: 'bass', label: 'Bass', color: '#3DD9FF', playNote: (i) => Audio.bass([55, 65, 73, 82, 98, 110][i % 6]) },
  { id: 'synth', label: 'Synth', color: '#B47FFF', playNote: (i) => Audio.synth([261, 294, 329, 349, 392, 440, 494, 523][i % 8]) },
  { id: 'pads', label: 'Pads', color: '#52E89B', playNote: (i) => Audio.pad([110, 130, 146, 165, 196, 220][i % 6]) },
  { id: 'keys', label: 'Keys', color: '#FF7EC7', playNote: (i) => Audio.keys([261, 294, 329, 349, 392, 440, 494, 523][i % 8]) },
  { id: 'fx', label: 'FX', color: '#FFD447', playNote: (i) => Audio.synth([880, 1046, 1318, 1568][i % 4], 0, 0.15) },
];
