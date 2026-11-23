// Nur für Tests: baut ein Raster aus Textzeilen.
import { Cell } from './types.ts';
import { TileGrid } from './grid.ts';

/** `#` Ground, `B` Rock, `K` Crate, `U` CrateUsed, `V` HiddenCrate, alles andere leer. */
export function gridFrom(rows: string[]): TileGrid {
  const width = Math.max(...rows.map((r) => r.length));
  const g = new TileGrid(width, rows.length);
  const map: Record<string, Cell> = {
    '#': Cell.Ground, B: Cell.Rock, K: Cell.Crate, U: Cell.CrateUsed, V: Cell.HiddenCrate,
  };
  rows.forEach((row, cy) => {
    for (let cx = 0; cx < row.length; cx++) g.set(cx, cy, map[row[cx]!] ?? Cell.Empty);
  });
  return g;
}
