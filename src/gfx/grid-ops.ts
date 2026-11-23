// Raster-Helfer aus dem Grafik-Entwurf, typisiert.
// Ein Raster ist ein Feld aus Palettenbuchstaben, '.' ist durchsichtig.
// Die Zeichenfunktionen malen direkt in das übergebene Raster, `outline` liefert ein neues.
// Läuft auch in Node (Icon-Skript): kein DOM, keine Modulzustände.

export type PixelGrid = string[][];
export type Point = readonly [number, number];

export function grid(w: number, h: number): PixelGrid {
  return Array.from({ length: h }, () => Array<string>(w).fill('.'));
}

export function strs(rows: readonly string[]): PixelGrid {
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => r.padEnd(w, '.').split(''));
}

export function each(g: PixelGrid, fn: (ch: string, x: number, y: number) => void): void {
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[y].length; x++) fn(g[y][x], x, y);
}

function inside(g: PixelGrid, x: number, y: number): boolean {
  return y >= 0 && y < g.length && x >= 0 && x < g[y].length;
}

/** Ellipse um (cx, cy) mit Radien rx, ry; `cond` schränkt die Pixel optional ein. */
export function ell(
  g: PixelGrid, cx: number, cy: number, rx: number, ry: number, ch: string,
  cond?: (x: number, y: number) => boolean,
): void {
  each(g, (_, x, y) => {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy <= 1 && (!cond || cond(x, y))) g[y][x] = ch;
  });
}

/** Kapsel: Strecke (x1,y1)–(x2,y2) mit Radius r. */
export function cap(g: PixelGrid, x1: number, y1: number, x2: number, y2: number, r: number, ch: string): void {
  const vx = x2 - x1, vy = y2 - y1, len = vx * vx + vy * vy || 1;
  each(g, (_, x, y) => {
    const px = x + 0.5, py = y + 0.5;
    const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / len));
    const dx = px - (x1 + vx * t), dy = py - (y1 + vy * t);
    if (dx * dx + dy * dy <= r * r) g[y][x] = ch;
  });
}

/** Gefülltes Rechteck, beide Ecken eingeschlossen. */
export function rect(g: PixelGrid, x1: number, y1: number, x2: number, y2: number, ch: string): void {
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) if (inside(g, x, y)) g[y][x] = ch;
}

export function put(g: PixelGrid, pts: readonly Point[], ch: string): void {
  for (const [x, y] of pts) if (inside(g, x, y)) g[y][x] = ch;
}

/** Bresenham-Linie, malt nur auf leere Pixel. */
export function line(g: PixelGrid, x0: number, y0: number, x1: number, y1: number, ch: string): void {
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) {
    if (inside(g, x0, y0) && g[y0][x0] === '.') g[y0][x0] = ch;
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}

const NEIGHBOURS: readonly Point[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Neues Raster, in dem jedes leere Pixel neben einem Farbpixel zu 'o' wird. */
export function outline(g: PixelGrid): PixelGrid {
  const o = g.map((r) => r.slice());
  each(g, (ch, x, y) => {
    if (ch !== '.') return;
    for (const [dx, dy] of NEIGHBOURS) {
      if (!inside(g, x + dx, y + dy)) continue;
      const c = g[y + dy][x + dx];
      if (c !== '.' && c !== 'o') { o[y][x] = 'o'; break; }
    }
  });
  return o;
}

/** Kopiert alle Nicht-'.'-Pixel von `src` an Position (ox, oy) nach `dst`. */
export function stamp(dst: PixelGrid, src: PixelGrid, ox: number, oy: number): void {
  each(src, (ch, x, y) => { if (ch !== '.' && inside(dst, x + ox, y + oy)) dst[y + oy][x + ox] = ch; });
}

/** Ersetzt Buchstaben laut Tabelle, liefert ein neues Raster. */
export function recolor(g: PixelGrid, map: Readonly<Record<string, string>>): PixelGrid {
  return g.map((r) => r.map((c) => map[c] ?? c));
}

export function flipX(g: PixelGrid): PixelGrid {
  return g.map((r) => r.slice().reverse());
}
