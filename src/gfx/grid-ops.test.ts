import { describe, it, expect } from 'vitest';
import { strs, outline, grid, rect, put } from './grid-ops.ts';

const text = (g: string[][]) => g.map((r) => r.join(''));

describe('grid-ops', () => {
  it('outline umrandet nur leere Nachbarn von Farbpixeln', () => {
    const g = strs(['...', '.X.', '...']);
    expect(outline(g).map((r) => r.join(''))).toEqual(['.o.', 'oXo', '.o.']);
  });

  it('outline lässt das Eingaberaster unverändert', () => {
    const g = strs(['.X.']);
    outline(g);
    expect(text(g)).toEqual(['.X.']);
  });

  it('strs füllt kürzere Zeilen mit "." auf', () => {
    expect(text(strs(['ab', 'c']))).toEqual(['ab', 'c.']);
  });

  it('rect und put zeichnen nur innerhalb des Rasters', () => {
    const g = grid(3, 2);
    rect(g, 1, 0, 5, 0, 'A');
    put(g, [[0, 1], [-1, 0], [9, 9]], 'B');
    expect(text(g)).toEqual(['.AA', 'B..']);
  });
});
