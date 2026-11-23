// Parallax-Ebenen nach `drawBackground` im Entwurf (Stil A). Nur Browser.
// Ferne Formen, Wolken und Hügel sind 512 px breit und wiederholen sich nahtlos:
// Jede Form-Reihe hat eine ganze Zahl von Elementen pro 512 px, der Zufall hängt
// nur vom Index modulo dieser Zahl ab. Der Himmel ist ein 8 px breiter Streifen.
import { MAX_VIEW_W, VIEW_H } from '../config.ts';
import { type WorldPalette, BASE, DARK, mix } from './palette.ts';
import { bakeGrid, toCanvas, canvas2d, pixCircle } from './bake.ts';
import { buildSprites } from './sprites.ts';

export interface BackgroundLayers {
  sky: HTMLCanvasElement;
  far: HTMLCanvasElement;
  hills: HTMLCanvasElement;
  clouds: HTMLCanvasElement;
}

const W = MAX_VIEW_W;
const H = VIEW_H;
const GY = H - 32; // Horizont wie im Entwurf
const SKY_W = 8;

/** Wolken aus dem Entwurf, x auf 512 px und y auf 192 px Höhe umgerechnet. */
const CLOUDS: readonly (readonly [number, number])[] = [[13, 19], [159, 40], [276, 13], [404, 32]];

function hash(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function wrap(v: number, n: number): number {
  return ((v % n) + n) % n;
}

/** Oberkante je Spalte für x = -1 … W, damit fillCols die Nachbarn kennt. */
function columns(fn: (x: number) => number): number[] {
  const tops: number[] = [];
  for (let x = -1; x <= W; x++) tops.push(fn(x));
  return tops;
}

/** Füllt jede Spalte ab ihrer Oberkante, die Kante bekommt eine eigene Farbe. */
function fillCols(ctx: CanvasRenderingContext2D, bottom: number, tops: number[], fill: string, edge: string): void {
  for (let x = 0; x < W; x++) {
    const t = tops[x + 1];
    if (t >= bottom) continue;
    const nb = Math.max(t, Math.min(bottom, Math.max(tops[x], tops[x + 2])));
    ctx.fillStyle = fill; ctx.fillRect(x, t, 1, bottom - t);
    ctx.fillStyle = edge; ctx.fillRect(x, t, 1, Math.max(1, nb - t));
  }
}

/** Kuppen-Silhouette mit `n` Kuppen pro 512 px. */
function humps(x: number, base: number, n: number, rmin: number, rmax: number, seed: number): number {
  const sp = W / n, i0 = Math.floor(x / sp);
  let top = 1e9;
  for (let i = i0 - 2; i <= i0 + 2; i++) {
    const k = wrap(i, n);
    const r = rmin + hash(k + seed) * (rmax - rmin);
    const c = i * sp + sp * 0.5 + (hash(k * 3 + seed) - 0.5) * sp * 0.4;
    const d = x - c;
    if (Math.abs(d) < r) top = Math.min(top, base - Math.sqrt(r * r - d * d));
  }
  return Math.round(top);
}

function drawSky(w: WorldPalette): HTMLCanvasElement {
  const [c, ctx] = canvas2d(SKY_W, H);
  const [a, b] = w.sky, n = 6, span = H * 0.82;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = mix(a, b, i / (n - 1));
    const y0 = Math.floor((i * span) / n);
    ctx.fillRect(0, y0, SKY_W, i === n - 1 ? H - y0 : Math.ceil(span / n) + 1);
  }
  if (w.shape === 'volcano') {
    for (let y = GY - 30; y < GY; y++) {
      ctx.fillStyle = mix(b, '#ffb04a', ((y - (GY - 30)) / 30) * 0.5);
      ctx.fillRect(0, y, SKY_W, 1);
    }
  }
  return c;
}

function drawPeaks(ctx: CanvasRenderingContext2D, w: WorldPalette, ice: boolean): void {
  const n = ice ? 6 : 5, sp = W / n;
  const slope = ice ? 1.25 : 0.85, hmin = ice ? 44 : 34, hvar = ice ? 26 : 22;
  const tops = columns((x) => {
    let best = GY - 2;
    const i0 = Math.floor(x / sp);
    for (let i = i0 - 1; i <= i0 + 2; i++) {
      const k = wrap(i, n);
      const c = i * sp + sp * 0.5 + (hash(k) - 0.5) * 30, ph = hmin + hash(k + 9) * hvar;
      const h = ph - Math.abs(x - c) * slope;
      if (h > 0) best = Math.min(best, GY - 2 - Math.round(h));
    }
    return best;
  });
  fillCols(ctx, GY, tops, w.far, mix(w.far, DARK, 0.22));
  ctx.fillStyle = w.farHi; // Schnee
  for (let x = 0; x < W; x++) {
    const t = tops[x + 1], h = GY - 2 - t;
    if (h > (ice ? 14 : 22)) ctx.fillRect(x, t, 1, Math.round(h * (ice ? 0.45 : 0.3)) + ((x >> 1) & 1) * 2);
  }
}

function drawMesas(ctx: CanvasRenderingContext2D, w: WorldPalette): void {
  const n = 4, sp = W / n;
  const tops = columns((x) => {
    let best = GY;
    const i0 = Math.floor(x / sp);
    for (let i = i0 - 1; i <= i0 + 2; i++) {
      const k = wrap(i, n);
      const c = i * sp + sp * 0.5, ph = 24 + hash(k + 3) * 20, tw = 12 + hash(k + 7) * 18;
      const d = Math.abs(x - c), h = d < tw ? ph : ph - (d - tw) * 2.4;
      if (h > 0) best = Math.min(best, GY - Math.round(h));
    }
    return best;
  });
  fillCols(ctx, GY, tops, w.far, mix(w.far, DARK, 0.22));
  ctx.fillStyle = w.farHi; // Gesteinsschichten
  for (let x = 0; x < W; x++) for (let y = tops[x + 1] + 4; y < GY; y += 7) ctx.fillRect(x, y, 1, 1 + ((y >> 3) & 1));
}

function drawSwamp(ctx: CanvasRenderingContext2D, w: WorldPalette): void {
  const n = 7, sp = W / n;
  ctx.fillStyle = w.far; // kahle Bäume
  for (let i = -1; i <= n; i++) {
    const bx = Math.round(i * sp + 20), h = Math.round(34 + hash(wrap(i, n)) * 16);
    ctx.fillRect(bx, GY - h, 3, h); ctx.fillRect(bx - 1, GY - 4, 5, 4);
    for (let k = 0; k < 8; k++) {
      ctx.fillRect(bx + 3 + k, GY - h + 14 - k, 1, 1);
      ctx.fillRect(bx - 1 - k, GY - h + 20 - Math.round(k * 0.8), 1, 1);
    }
    for (let k = 0; k < 5; k++) ctx.fillRect(bx + 1 + Math.round(k * 0.6), GY - h - k, 1, 1);
  }
  ctx.globalAlpha = 0.18; ctx.fillStyle = '#ffffff'; // Nebelbänke
  ctx.fillRect(0, GY - 22, W, 6); ctx.fillRect(0, GY - 12, W, 4);
  ctx.globalAlpha = 1;
}

function drawCloudbanks(ctx: CanvasRenderingContext2D, w: WorldPalette): void {
  const tops = columns((x) => humps(x, GY + 10, 8, 22, 38, 40));
  fillCols(ctx, GY, tops, w.far, '#d9e2ff');
  ctx.fillStyle = w.farHi;
  for (let x = 0; x < W; x++) ctx.fillRect(x, Math.max(tops[x + 1] + 6, GY - 8), 1, 8);
}

function drawVolcano(ctx: CanvasRenderingContext2D, w: WorldPalette): void {
  const c = 210;
  const tops = columns((x) => {
    const m = wrap(x - c, W), d = Math.min(m, W - m), h = d < 9 ? 62 : 62 - (d - 9) * 1.05;
    return h > 0 ? GY - Math.round(h) : GY;
  });
  fillCols(ctx, GY, tops, w.far, mix(w.far, DARK, 0.22));
  ctx.fillStyle = w.farHi; // glühender Krater und Lavaströme
  for (let x = c - 8; x <= c + 8; x++) ctx.fillRect(x, GY - 62, 1, 2);
  for (const [ox, len] of [[-4, 16], [3, 26], [6, 10]]) {
    for (let k = 0; k < len; k++) ctx.fillRect(Math.round(c + ox + (ox > 0 ? k : -k) * 0.55), GY - 60 + k, 1, 1);
  }
  ctx.fillStyle = '#8a7480'; // Rauchwolken
  for (let k = 0; k < 4; k++) {
    const ph = k * 0.25;
    ctx.globalAlpha = (1 - ph) * 0.55;
    pixCircle(ctx, c - 2 + Math.sin(k * 2) * 4 + ph * 10, GY - 66 - ph * 44, 3 + ph * 6);
  }
  ctx.globalAlpha = 1;
}

function drawFar(w: WorldPalette): HTMLCanvasElement {
  const [c, ctx] = canvas2d(W, H);
  switch (w.shape) {
    case 'mountains': drawPeaks(ctx, w, false); break;
    case 'icepeaks': drawPeaks(ctx, w, true); break;
    case 'mesas': drawMesas(ctx, w); break;
    case 'swamp': drawSwamp(ctx, w); break;
    case 'cloudbanks': drawCloudbanks(ctx, w); break;
    case 'volcano': drawVolcano(ctx, w); break;
  }
  return c;
}

function drawClouds(w: WorldPalette): HTMLCanvasElement {
  const [c, ctx] = canvas2d(W, H);
  const cloud = toCanvas(bakeGrid(buildSprites().cloud, { ...BASE, Z: w.cl, v: w.cs }));
  if (w.shape === 'volcano') ctx.globalAlpha = 0.7;
  for (const [x, y] of CLOUDS) for (const dx of [0, -W]) ctx.drawImage(cloud, x + dx, y);
  ctx.globalAlpha = 1;
  return c;
}

function drawHills(w: WorldPalette): HTMLCanvasElement {
  const [c, ctx] = canvas2d(W, H);
  const t1 = columns((x) => humps(x, GY + 10, 7, 30, 46, 1));
  fillCols(ctx, H, t1, w.h1, mix(w.hl, w.h1, 0.45));
  ctx.fillStyle = mix(w.h1, '#ffffff', 0.28);
  for (let x = 0; x < W; x++) for (let y = t1[x + 1] + 5; y < GY; y++) if ((x + y * 2) % 16 === 0) ctx.fillRect(x, y, 1, 2);
  // Vordere Kuppen; wo keine liegt, schließt eine flache Wiese die Ebene nach unten ab,
  // damit unten nie Himmel durchscheint (im Spiel liegt der Boden nicht fest am Bildrand).
  const t2 = columns((x) => Math.min(humps(x, GY + 6, 6, 20, 30, 7), GY + 6));
  fillCols(ctx, H, t2, w.h2, w.hl);
  ctx.fillStyle = mix(w.h2, '#ffffff', 0.18);
  for (let x = 0; x < W; x++) for (let y = t2[x + 1] + 4; y < GY; y++) if ((x - y * 2) % 8 === 0) ctx.fillRect(x, y, 1, 1);
  return c;
}

export function buildBackgroundLayers(w: WorldPalette): BackgroundLayers {
  return { sky: drawSky(w), far: drawFar(w), hills: drawHills(w), clouds: drawClouds(w) };
}
