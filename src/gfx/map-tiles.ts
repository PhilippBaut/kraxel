// Grafik der Weltkarte: Wiese, Bach, Wege, Punkte, Hütte, Burg, Schild. Eine kleine Almwiese in Stil A.
// Alles Raster aus Palettenbuchstaben wie `sprites.ts`. Läuft auch in Node: nur Raster, kein DOM.
import { type PixelGrid, grid, ell, rect, put, outline, each } from './grid-ops.ts';

/** Kacheln, die die ganze Zelle füllen (kein freier Rand); alle anderen Sprites liegen auf der Wiese. */
export const FULL_TILES: readonly string[] = ['mapGrassA', 'mapGrassB', 'mapWater', 'mapPath'];

export const MAP_SPRITE_NAMES = [
  'mapGrassA', 'mapGrassB', 'mapWater', 'mapPath', 'mapDots',
  'mapTree', 'mapHill', 'mapFlower',
  'mapNodeOpen', 'mapNodeLocked', 'mapNodeDone', 'mapMark', 'mapHut', 'mapFortress', 'mapSign',
] as const;
export type MapSpriteName = (typeof MAP_SPRITE_NAMES)[number];

/** Wiese: Grundgrün mit ein paar Grashalmen, zwei Varianten, damit es nicht wie ein Muster wirkt. */
function grass(tufts: ReadonlyArray<readonly [number, number]>, lights: ReadonlyArray<readonly [number, number]>): PixelGrid {
  const g = grid(16, 16);
  rect(g, 0, 0, 15, 15, 'G');
  for (const [x, y] of tufts) put(g, [[x, y], [x + 1, y], [x, y - 1]], 'g');
  put(g, lights, 'l');
  return g;
}

/** Bach: helles Wasser mit dunkleren Wellen und weißen Glitzerpunkten. */
function water(): PixelGrid {
  const g = grid(16, 16);
  rect(g, 0, 0, 15, 15, 'X');
  for (const [x, y] of [[1, 3], [5, 10], [11, 6], [9, 14], [14, 1]]) put(g, [[x, y], [x + 1, y], [x + 2, y]], 'x');
  put(g, [[4, 5], [12, 11], [8, 1]], 'Z');
  return g;
}

/** Weg: heller Kiesboden mit Steinchen. */
function path(): PixelGrid {
  const g = grid(16, 16);
  rect(g, 0, 0, 15, 15, 'p');
  each(g, (_c, x, y) => { if ((x * 5 + y * 3) % 17 === 0) g[y][x] = 'I'; });
  for (const [x, y] of [[3, 4], [11, 3], [7, 9], [13, 12], [2, 13]]) put(g, [[x, y], [x + 1, y]], 'D');
  return g;
}

/** Gesperrter Weg: ein heller Kiesel mit dunklem Rand mitten in der Zelle. */
function dots(): PixelGrid {
  const g = grid(16, 16);
  rect(g, 7, 7, 8, 8, 'p');
  put(g, [[7, 7]], 'I');
  return outline(g);
}

function tree(): PixelGrid {
  const g = grid(16, 16);
  rect(g, 7, 11, 8, 14, 'k');
  put(g, [[7, 11], [7, 12], [7, 13]], 'K');
  ell(g, 8, 7, 5.5, 5.5, 'g');
  ell(g, 7, 6, 4, 4, 'G');
  put(g, [[5, 4], [6, 3], [7, 3], [5, 5]], 'l');
  return outline(g);
}

function hill(): PixelGrid {
  const g = grid(16, 16);
  ell(g, 8, 14, 6.5, 7, 'G', (_x, y) => y <= 13);
  each(g, (c, x, y) => { if (c === 'G' && x + y * 0.6 > 13) g[y][x] = 'g'; });
  put(g, [[6, 8], [7, 8], [5, 9]], 'l');
  put(g, [[9, 10], [10, 10], [10, 11]], 'M');
  put(g, [[9, 9]], 'm');
  return outline(g);
}

/** Drei kleine Blumen: gelb, rosa, weiß. */
function flower(): PixelGrid {
  const g = grid(16, 16);
  for (const [x, y, c] of [[3, 4, 'Y'], [11, 8, 'R'], [5, 12, 'W']] as const) {
    put(g, [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]], c === 'Y' ? 'W' : c === 'R' ? 'W' : 'Y');
    put(g, [[x, y]], c === 'W' ? 'y' : c);
    put(g, [[x, y + 2]], 'g');
  }
  return g;
}

/** Runder Punkt, Farben je Zustand; `mark` legt ein kleines weißes Kreuz hinein. */
function node(fill: string, shade: string, light: string, mark: boolean): PixelGrid {
  const g = grid(16, 16);
  ell(g, 8, 8, 6, 6, fill);
  each(g, (c, x, y) => { if (c === fill && x + y > 17) g[y][x] = shade; });
  put(g, [[5, 5], [6, 4], [5, 6]], light);
  if (fill === 'w') rect(g, 7, 7, 8, 9, 'L'); // gesperrt: Schlüsselloch
  if (mark) put(g, [[8, 5], [8, 6], [8, 7], [8, 8], [8, 9], [8, 10], [5, 8], [6, 8], [7, 8], [9, 8], [10, 8], [11, 8]], 'W');
  return outline(g);
}

/** Kleines Häkchen-Plättchen (8×8) für geschaffte Burgen. */
function mark(): PixelGrid {
  const g = grid(8, 8);
  ell(g, 4, 4, 3, 3, 'H');
  put(g, [[3, 2], [3, 3], [3, 4], [2, 3], [4, 3]], 'W');
  return outline(g);
}

function hut(): PixelGrid {
  const g = grid(16, 16);
  rect(g, 3, 8, 12, 13, 'I');
  rect(g, 12, 8, 12, 13, 'p');
  for (let y = 2; y <= 7; y++) rect(g, 8 - (y - 2) - 2, y, 7 + (y - 2) + 2, y, 'A');
  for (let y = 2; y <= 7; y++) put(g, [[7 + (y - 2) + 2, y], [6 + (y - 2) + 2, y]], 'a');
  rect(g, 7, 10, 9, 13, 'K');
  put(g, [[9, 12]], 'Y');
  rect(g, 4, 9, 5, 10, 'X');
  return outline(g);
}

/** Wurzelburg: graue Mauer mit Zinnen, zwei Türmchen, Tor, rote Fahne. */
function fortress(): PixelGrid {
  const g = grid(16, 16);
  rect(g, 2, 7, 13, 13, 'M');
  rect(g, 13, 7, 13, 13, 'n'); rect(g, 2, 13, 13, 13, 'n');
  rect(g, 2, 7, 13, 7, 'm');
  for (const x of [2, 6, 10]) rect(g, x, 5, x + 1, 6, 'M');
  rect(g, 2, 3, 4, 6, 'M'); rect(g, 11, 3, 13, 6, 'M'); // Türme
  rect(g, 2, 3, 4, 3, 'm'); rect(g, 11, 3, 13, 3, 'm');
  rect(g, 6, 9, 9, 13, 'L'); put(g, [[7, 8], [8, 8]], 'L');
  rect(g, 6, 12, 9, 13, 'k');
  put(g, [[3, 9], [12, 9]], 'n');
  rect(g, 8, 1, 8, 5, 'j'); rect(g, 9, 1, 11, 2, 'A'); put(g, [[9, 3]], 'a');
  put(g, [[1, 10], [14, 11], [2, 12]], 'g');
  return outline(g);
}

/** Wegweiser mit leerem Holzschild, steht für „Fortsetzung folgt“. */
function sign(): PixelGrid {
  const g = grid(16, 16);
  rect(g, 7, 8, 8, 14, 'J'); rect(g, 8, 8, 8, 14, 'j');
  rect(g, 2, 2, 13, 8, 'C');
  rect(g, 2, 8, 13, 8, 'c'); rect(g, 13, 2, 13, 8, 'c');
  rect(g, 4, 4, 11, 4, 'k'); rect(g, 4, 6, 9, 6, 'k');
  return outline(g);
}

/** Alle Karten-Sprites; jeder Aufruf liefert frische Raster. */
export function buildMapSprites(): Record<MapSpriteName, PixelGrid> {
  return {
    mapGrassA: grass([[2, 5], [9, 11], [13, 3]], [[6, 2], [11, 13], [3, 12]]),
    mapGrassB: grass([[5, 3], [12, 8], [3, 13]], [[9, 5], [1, 9], [13, 14]]),
    mapWater: water(), mapPath: path(), mapDots: dots(),
    mapTree: tree(), mapHill: hill(), mapFlower: flower(),
    mapNodeOpen: node('Q', 'q', 'I', false),
    mapNodeLocked: node('w', 'n', 'v', false),
    mapNodeDone: node('H', 'x', 'h', true),
    mapMark: mark(), mapHut: hut(), mapFortress: fortress(), mapSign: sign(),
  };
}
