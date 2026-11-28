// Boden-Varianten: Rand dort, wo der Nachbar kein Boden ist. Läuft auch in Node.
import { Cell } from '../core/types.ts';
import type { TileGrid } from '../core/grid.ts';
import { grid, stamp, type PixelGrid } from './grid-ops.ts';
import { buildSprites } from './sprites.ts';
import type { WorldPalette } from './palette.ts';

export const GROUND_TILES = ['top', 'topL', 'topR', 'topLR', 'fill', 'fillL', 'fillR', 'fillLR'] as const;

/** Index in GROUND_TILES für eine Bodenzelle, sonst -1. Außerhalb des Levels zählt als Boden. */
export function groundTileIndex(g: TileGrid, cx: number, cy: number): number {
  if (g.get(cx, cy) !== Cell.Ground) return -1;
  const top = g.get(cx, cy - 1) !== Cell.Ground;
  const l = g.get(cx - 1, cy) !== Cell.Ground;
  const r = g.get(cx + 1, cy) !== Cell.Ground;
  return (top ? 0 : 4) + (l ? 1 : 0) + (r ? 2 : 0);
}

/** Streifen aus acht 16×16-Kacheln in der Reihenfolge von GROUND_TILES. */
export function buildGroundTileset(_w: WorldPalette, style?: 'burg'): PixelGrid {
  const sprites = buildSprites();
  const groundTop = style === 'burg' ? sprites.burgTop : sprites.groundTop;
  const groundFill = style === 'burg' ? sprites.burgFill : sprites.groundFill;
  const out = grid(GROUND_TILES.length * 16, 16);
  GROUND_TILES.forEach((name, i) => {
    const tile = (name.startsWith('top') ? groundTop : groundFill).map((r) => r.slice());
    if (name.includes('L')) for (const row of tile) row[0] = 'o';
    if (name.endsWith('R')) for (const row of tile) row[15] = 'o';
    stamp(out, tile, i * 16, 0);
  });
  return out;
}
