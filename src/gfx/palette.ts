// Farben aus dem Grafik-Entwurf (Stil A). Läuft auch in Node.

export const DARK = '#1b1230';

export const BASE: Readonly<Record<string, string>> = Object.freeze({
  o: DARK, H: '#2ec4b6', h: '#a6f5e9', S: '#ffd23f', s: '#e3a51d', P: '#fffaf0', B: '#ffb36b', b: '#e5874a',
  W: '#ffffff', E: '#1b1230', R: '#ff7b9c', K: '#8a5a3b', k: '#5e3a24', F: '#5a3a2a',
  G: '#5fd35a', g: '#33a852', l: '#b6f27a', D: '#c27c45', d: '#8f5530', p: '#e3a56f',
  C: '#c98a4b', c: '#8c5a2b', M: '#b8c2d6', Y: '#ffd23f', y: '#e09a1b', Z: '#ffffff',
  X: '#5ee7ff', x: '#2a9fd6', V: '#ffffff', v: '#c9d3e6', A: '#e8465a', a: '#a8253e', L: '#4b3a66',
  T: '#c9e86a', t: '#8fbf3c', U: '#ff9a3c', u: '#c4621f', I: '#fff3d6', Q: '#ffcf33', q: '#d99a12',
  J: '#a8693a', j: '#6e4122', m: '#e6ecf5', n: '#6b7a99', O: '#ff6a2a', w: '#9aa6bd',
  /** Tiefes Bachwasser. */
  N: '#1f6fb0',
});

export type TileLetter = 'G' | 'g' | 'l' | 'D' | 'd' | 'p';

export interface WorldPalette {
  name: string;
  sky: [string, string];
  far: string;
  farHi: string;
  shape: 'mountains' | 'icepeaks' | 'mesas' | 'swamp' | 'cloudbanks' | 'volcano';
  h1: string;
  h2: string;
  hl: string;
  cl: string;
  cs: string;
  tiles: Record<TileLetter, string>;
  pit?: 'ice' | 'sand' | 'poison' | 'sky' | 'lava';
}

export const WORLDS: readonly WorldPalette[] = [
  { name: '1 · Graslandschaft', sky: ['#4aa3ff', '#c4ecff'], far: '#8fb0e0', farHi: '#ffffff', shape: 'mountains', h1: '#86e08f', h2: '#4cc25a', hl: '#2f8f45', cl: '#ffffff', cs: '#d2e8ff', tiles: { G: '#5fd35a', g: '#33a852', l: '#b6f27a', D: '#c27c45', d: '#8f5530', p: '#e3a56f' } },
  { name: '2 · Eislandschaft', sky: ['#6aa8ff', '#eaf7ff'], far: '#a9c4ee', farHi: '#ffffff', shape: 'icepeaks', h1: '#e8f4ff', h2: '#c0def8', hl: '#7fb0dd', cl: '#ffffff', cs: '#d6e8fa', tiles: { G: '#ffffff', g: '#cfe3f7', l: '#ffffff', D: '#8fd3f5', d: '#4f9fd0', p: '#d8f4ff' }, pit: 'ice' },
  { name: '3 · Wüste', sky: ['#ff9a55', '#ffe6ae'], far: '#de9257', farHi: '#f3be86', shape: 'mesas', h1: '#f4c983', h2: '#e8ab62', hl: '#b9763b', cl: '#fff4dc', cs: '#f6d2a2', tiles: { G: '#ffdc8f', g: '#efb65b', l: '#fff1c6', D: '#e0974f', d: '#b26631', p: '#f4c088' }, pit: 'sand' },
  { name: '4 · Sumpf', sky: ['#4b6b5f', '#bccd9a'], far: '#43604e', farHi: '#5b7a63', shape: 'swamp', h1: '#5e8a52', h2: '#3f6e3e', hl: '#28472a', cl: '#d7e3c4', cs: '#aebf98', tiles: { G: '#82b240', g: '#56802b', l: '#b4d96c', D: '#6b4f3a', d: '#47331f', p: '#8e6e51' }, pit: 'poison' },
  { name: '5 · Wolkenwelt', sky: ['#80bdff', '#ffd6ea'], far: '#ffffff', farHi: '#ffe6f3', shape: 'cloudbanks', h1: '#ffffff', h2: '#eaf0ff', hl: '#b9c6ee', cl: '#ffffff', cs: '#e2e6fb', tiles: { G: '#ffffff', g: '#dfe7ff', l: '#ffffff', D: '#f0f4ff', d: '#c5d2f3', p: '#ffffff' }, pit: 'sky' },
  { name: '6 · Vulkan', sky: ['#2b1328', '#d9473a'], far: '#2a1622', farHi: '#ff7a2e', shape: 'volcano', h1: '#4a2a30', h2: '#2f1a20', hl: '#170c10', cl: '#6b4b55', cs: '#4a3038', tiles: { G: '#5a4a52', g: '#3b2f36', l: '#7d6c74', D: '#3a2d33', d: '#22191d', p: '#ff6a2a' }, pit: 'lava' },
];

export function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(c: readonly number[]): string {
  return '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

/** Mischt zwei Farben, t = 0 ergibt a, t = 1 ergibt b. */
export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
}
