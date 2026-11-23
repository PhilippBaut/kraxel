// Raster → RGBA-Pixel → Canvas. `bakeGrid` läuft auch in Node (Icon-Skript),
// `toCanvas` und die Canvas-Helfer brauchen das DOM erst beim Aufruf.
import type { PixelGrid } from './grid-ops.ts';
import { hexToRgb } from './palette.ts';

export interface RGBAImage { width: number; height: number; data: Uint8ClampedArray }

const MISSING = '#ff00ff';

/** '.' bleibt durchsichtig, Buchstaben ohne Palettenfarbe werden magenta. */
export function bakeGrid(g: PixelGrid, pal: Readonly<Record<string, string>>): RGBAImage {
  const height = g.length, width = height ? g[0].length : 0;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ch = g[y][x];
      if (ch === '.') continue;
      const [r, gr, b] = hexToRgb(pal[ch] ?? MISSING);
      const i = (y * width + x) * 4;
      data[i] = r; data[i + 1] = gr; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

export function toCanvas(img: RGBAImage): HTMLCanvasElement {
  const [c, ctx] = canvas2d(img.width, img.height);
  const im = ctx.createImageData(img.width, img.height);
  im.data.set(img.data);
  ctx.putImageData(im, 0, 0);
  return c;
}

// ---- Canvas-Helfer für Hintergrund und Knöpfe (nur Browser)

export function canvas2d(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Gefüllter Kreis aus ganzen Pixeln, wie `pixCircle` im Entwurf. */
export function pixCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  cx = Math.round(cx); cy = Math.round(cy);
  const R = Math.round(r);
  for (let y = -R; y <= R; y++) {
    if (r * r < y * y) continue;
    const hw = Math.floor(Math.sqrt(r * r - y * y));
    ctx.fillRect(cx - hw, cy + y, hw * 2 + 1, 1);
  }
}
