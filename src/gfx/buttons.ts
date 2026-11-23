// Steuerkreuz und runde Knöpfe nach `dpad`, `jumpBtn` und `actBtn` im Entwurf. Nur Browser.
// Gedrückte Richtungen und Knöpfe leuchten auf; Transparenz setzt die Szene.
import { BASE, mix } from './palette.ts';
import { bakeGrid, toCanvas, canvas2d, pixCircle } from './bake.ts';
import { buildSprites } from './sprites.ts';

/** Gedrückte Richtungen (strukturell gleich zu `Pick<Held, …>` ab Task 3). */
export interface DirHeld { left: boolean; right: boolean; up: boolean; down: boolean }

type Dir = 'u' | 'd' | 'l' | 'r';

function arrow(ctx: CanvasRenderingContext2D, cx: number, cy: number, dir: Dir, col: string, size: number): void {
  ctx.fillStyle = col;
  for (let i = 0; i < size; i++) {
    const w = i * 2 + 1;
    if (dir === 'u') ctx.fillRect(cx - i, cy - size + 1 + i, w, 1);
    if (dir === 'd') ctx.fillRect(cx - i, cy + size - 1 - i, w, 1);
    if (dir === 'l') ctx.fillRect(cx - size + 1 + i, cy - i, 1, w);
    if (dir === 'r') ctx.fillRect(cx + size - 1 - i, cy - i, 1, w);
  }
}

/** Runder Knopf: dunkler Rand, heller Glanz oben, Füllung unten. */
function pc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string, edge: string, hi: string): void {
  ctx.fillStyle = edge; pixCircle(ctx, cx, cy, r + 1);
  ctx.fillStyle = hi; pixCircle(ctx, cx, cy - 1, r);
  ctx.fillStyle = fill; pixCircle(ctx, cx, cy + 1, r - 1);
}

/** Steuerkreuz mit Armlänge `r`, Größe (2r+2)². */
export function drawDpad(r: number, held: DirHeld): HTMLCanvasElement {
  const arm = r, half = Math.round(r * 0.32), c = arm + 1;
  const [cv, ctx] = canvas2d(arm * 2 + 2, arm * 2 + 2);
  const base = '#5b4f80', edge = '#16112a', hi = '#8478b0', on = '#a99cf0';
  ctx.fillStyle = edge;
  ctx.fillRect(c - arm - 1, c - half - 1, arm * 2 + 2, half * 2 + 2);
  ctx.fillRect(c - half - 1, c - arm - 1, half * 2 + 2, arm * 2 + 2);
  ctx.fillStyle = base;
  ctx.fillRect(c - arm, c - half, arm * 2, half * 2);
  ctx.fillRect(c - half, c - arm, half * 2, arm * 2);
  ctx.fillStyle = hi;
  ctx.fillRect(c - arm, c - half, arm * 2, 1);
  ctx.fillRect(c - half, c - arm, half * 2, 1);
  ctx.fillStyle = on;
  if (held.right) ctx.fillRect(c + half, c - half + 1, arm - half, half * 2 - 1);
  if (held.left) ctx.fillRect(c - arm, c - half + 1, arm - half, half * 2 - 1);
  if (held.up) ctx.fillRect(c - half, c - arm + 1, half * 2, arm - half - 1);
  if (held.down) ctx.fillRect(c - half, c + half, half * 2, arm - half);
  const ac = '#e4ddff', as = Math.max(3, Math.round(half * 0.55));
  arrow(ctx, c + arm - as - 2, c, 'r', ac, as);
  arrow(ctx, c - arm + as + 1, c, 'l', ac, as);
  arrow(ctx, c, c - arm + as + 1, 'u', ac, as);
  arrow(ctx, c, c + arm - as - 2, 'd', ac, as);
  ctx.fillStyle = edge;
  pixCircle(ctx, c, c, Math.max(2, half * 0.45));
  return cv;
}

let slingIcon: HTMLCanvasElement | null = null;

/** Runder Knopf mit Radius `r`, Größe (2r+3)×(2r+4); gedrückt rutscht er 1 px tiefer. */
export function drawRoundButton(r: number, kind: 'jump' | 'action', pressed: boolean): HTMLCanvasElement {
  const c = r + 1, p = pressed ? 1 : 0;
  const [cv, ctx] = canvas2d(r * 2 + 3, r * 2 + 4);
  if (kind === 'jump') {
    pc(ctx, c, c + p, r, pressed ? '#7ff0e4' : BASE.H, '#0f2b2a', pressed ? '#c9fff8' : BASE.h);
    arrow(ctx, c, c + p - 1, 'u', '#ffffff', Math.round(r * 0.5));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(c - 1, c + p - 1, 3, Math.round(r * 0.45));
  } else {
    const fill = pressed ? mix(BASE.A, '#ffffff', 0.3) : BASE.A;
    pc(ctx, c, c + p, r, fill, '#2a0d16', mix(fill, '#ffffff', 0.35));
    slingIcon ??= toCanvas(bakeGrid(buildSprites().sling, BASE));
    ctx.drawImage(slingIcon, c - 8, c + p - 8);
  }
  return cv;
}
