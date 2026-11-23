import { describe, it, expect } from 'vitest';
import { TileGrid } from '../core/grid.ts';
import { parseLevel } from '../core/level.ts';
import { GROUND_TILES, groundTileIndex, buildGroundTileset } from './tiles.ts';
import { WORLDS } from './palette.ts';

describe('Boden-Autotiling', () => {
  const g = TileGrid.fromLevel(parseLevel('t', 'name: t\nworld: 1\n---\nP.....\n..###.\n..###.'));
  it('Boden mit Luft darüber und links ist topL, darunter fillL', () => {
    expect(GROUND_TILES[groundTileIndex(g, 2, 1)]).toBe('topL');
    expect(GROUND_TILES[groundTileIndex(g, 3, 2)]).toBe('fill');
    expect(GROUND_TILES[groundTileIndex(g, 4, 2)]).toBe('fillR');
    expect(groundTileIndex(g, 0, 0)).toBe(-1);
  });
  it('einzelne Säule ist topLR, am Levelrand gibt es keine Kante', () => {
    const s = TileGrid.fromLevel(parseLevel('t', 'name: t\nworld: 1\n---\n.P.\n.#.\n###'));
    expect(GROUND_TILES[groundTileIndex(s, 1, 1)]).toBe('topLR');
    expect(GROUND_TILES[groundTileIndex(s, 0, 2)]).toBe('top');
  });
  it('Tileset ist 128×16 und Seitenränder sind dunkel', () => {
    const t = buildGroundTileset(WORLDS[0]);
    expect([t.length, t[0].length]).toEqual([16, 128]);
    const col = (x: number) => t.map((r) => r[x]);
    expect(col(1 * 16).every((c) => c === 'o')).toBe(true);        // topL, links
    expect(col(2 * 16 + 15).every((c) => c === 'o')).toBe(true);   // topR, rechts
    expect(col(4 * 16).every((c) => c === 'o')).toBe(false);       // fill, links offen
  });
});
