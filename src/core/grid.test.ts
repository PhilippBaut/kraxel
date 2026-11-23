import { describe, it, expect } from 'vitest';
import { TileGrid } from './grid.ts';
import { Cell } from './types.ts';

describe('TileGrid', () => {
  it('außerhalb links/rechts ist Boden, oben/unten leer', () => {
    const g = new TileGrid(4, 3);
    expect(g.get(-1, 1)).toBe(Cell.Ground); expect(g.get(4, 1)).toBe(Cell.Ground);
    expect(g.get(1, -1)).toBe(Cell.Empty); expect(g.get(1, 3)).toBe(Cell.Empty);
  });
  it('versteckte Kiste ist nicht fest', () => {
    const g = new TileGrid(2, 2); g.set(0, 0, Cell.HiddenCrate);
    expect(g.isSolid(0, 0)).toBe(false);
  });
  it('Boden, Fels und Kisten sind fest', () => {
    const g = new TileGrid(5, 1);
    [Cell.Ground, Cell.Rock, Cell.Crate, Cell.CrateUsed].forEach((c, i) => g.set(i, 0, c));
    expect([0, 1, 2, 3, 4].map((x) => g.isSolid(x, 0))).toEqual([true, true, true, true, false]);
  });
});
