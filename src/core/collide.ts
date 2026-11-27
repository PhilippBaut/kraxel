// Kollision eines Körpers mit dem Kachelraster. Erst X, dann Y.
// Körper belegen das halboffene Feld [x, x+w) × [y, y+h): Berührung ist keine Überlappung.
import { Cell } from './types.ts';
import type { Body, Rect } from './types.ts';
import type { TileGrid } from './grid.ts';
import type { PlatformState } from './platforms.ts';

const TILE = 16;
const MAX_STEP = 8;
const NO_PLATFORMS: readonly PlatformState[] = [];
/** So viel Spielraum (px) beim Vergleich von Fußhöhe und Oberkante einer Plattform. */
const TOP_EPS = 1e-6;

export interface MoveResult {
  left: boolean; right: boolean; up: boolean; down: boolean;
  headCells: Array<[number, number]>;
}

/** Erste und letzte Zelle, die das halboffene Intervall [a, b) berührt. */
function span(a: number, b: number): [number, number] {
  return [Math.floor(a / TILE), Math.ceil(b / TILE) - 1];
}

function solidIn(grid: TileGrid, x0: number, y0: number, x1: number, y1: number): boolean {
  const [cx0, cx1] = span(x0, x1);
  const [cy0, cy1] = span(y0, y1);
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) if (grid.isSolid(cx, cy)) return true;
  }
  return false;
}

/** Zellen, die einen Aufwärtsschritt blockieren. Versteckte Kisten nur von unten. */
function ceilingCells(grid: TileGrid, x0: number, y0: number, x1: number, prevTop: number, bottom: number): Array<[number, number]> {
  const [cx0, cx1] = span(x0, x1);
  const [cy0, cy1] = span(y0, bottom);
  const out: Array<[number, number]> = [];
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      if (grid.isSolid(cx, cy) || (grid.get(cx, cy) === Cell.HiddenCrate && prevTop >= (cy + 1) * TILE)) out.push([cx, cy]);
    }
  }
  return out;
}

/** Trägt die Oberseite der Plattform den Körper? Füße höchstens 1 px darüber oder bündig, waagerecht überlappend (Berührung zählt nicht). */
export function platformSupports(body: Rect, p: PlatformState): boolean {
  const bottom = body.y + body.h;
  return bottom <= p.y + TOP_EPS && bottom >= p.y - 1 && body.x < p.x + p.spec.width * TILE && body.x + body.w > p.x;
}

/** Plattform, auf die der Körper in diesem Teilschritt fällt: Füße waren oberhalb der Oberkante und sind jetzt auf oder darunter.
 *  Fährt die Plattform aufwärts, kam sie dem Körper entgegen: dann zählt auch eine Fußhöhe bis eine Fahrstrecke darunter, aber nur, wenn der Körper schon vor der Bewegung dieses Schritts waagerecht über ihr war (`startX`); wer von der Seite kommt, wird nicht hochgezogen. */
function landingPlatform(body: Rect, prevBottom: number, startX: number, list: readonly PlatformState[]): PlatformState | null {
  const bottom = body.y + body.h;
  for (const p of list) {
    if (body.x >= p.x + p.spec.width * TILE || body.x + body.w <= p.x) continue;
    const overHere = startX < p.x + p.spec.width * TILE && startX + body.w > p.x;
    const rise = overHere ? Math.max(0, -p.dy) : 0;
    if (bottom >= p.y - TOP_EPS && prevBottom <= p.y + rise + TOP_EPS) return p;
  }
  return null;
}

function stepCount(d: number): number {
  return Math.max(1, Math.ceil(Math.abs(d) / MAX_STEP));
}

/** `platforms`: bewegte Plattformen, die nur von oben tragen (von unten und von der Seite geht man hindurch). */
export function moveBody(body: Body, dt: number, grid: TileGrid, cornerCorrection = 0, platforms: readonly PlatformState[] = NO_PLATFORMS): MoveResult {
  const res: MoveResult = { left: false, right: false, up: false, down: false, headCells: [] };

  const startX = body.x;
  // X
  const dx = body.vx * dt;
  if (dx !== 0) {
    const n = stepCount(dx);
    const s = dx / n;
    for (let i = 0; i < n; i++) {
      body.x += s;
      if (s > 0 && solidIn(grid, body.x + body.w - 1e-9, body.y, body.x + body.w, body.y + body.h)) {
        body.x = Math.floor((body.x + body.w) / TILE) * TILE - body.w;
        body.vx = 0; res.right = true; break;
      }
      if (s < 0 && solidIn(grid, body.x, body.y, body.x + 1e-9, body.y + body.h)) {
        body.x = (Math.floor(body.x / TILE) + 1) * TILE;
        body.vx = 0; res.left = true; break;
      }
    }
  }

  // Y
  const dy = body.vy * dt;
  if (dy !== 0) {
    const n = stepCount(dy);
    const s = dy / n;
    for (let i = 0; i < n; i++) {
      const prevTop = body.y;
      body.y += s;
      if (s > 0) {
        if (solidIn(grid, body.x, body.y + body.h - 1e-9, body.x + body.w, body.y + body.h)) {
          body.y = Math.floor((body.y + body.h) / TILE) * TILE - body.h;
          body.vy = 0; res.down = true; break;
        }
        const pl = landingPlatform(body, prevTop + body.h, startX, platforms);
        if (pl) {
          body.y = pl.y - body.h;
          body.vy = 0; res.down = true; break;
        }
      } else {
        const hits = ceilingCells(grid, body.x, body.y, body.x + body.w, prevTop, body.y + 1e-9);
        if (hits.length === 0) continue;
        if (cornerCorrection > 0 && correctCorner(body, grid, hits, prevTop, cornerCorrection)) continue;
        const row = hits[0]![1];
        body.y = (row + 1) * TILE;
        body.vy = 0; res.up = true;
        res.headCells = hits.filter(([, cy]) => cy === row);
        break;
      }
    }
  }
  return res;
}

/** Schiebt den Körper seitlich um die Kante, wenn nur ein schmaler Rand die Decke streift. */
function correctCorner(body: Body, grid: TileGrid, hits: Array<[number, number]>, prevTop: number, maxShift: number): boolean {
  const [cxMin, cxMax] = span(body.x, body.x + body.w);
  const blockedLeft = hits.some(([cx]) => cx === cxMin);
  const blockedRight = hits.some(([cx]) => cx === cxMax);
  if (blockedLeft === blockedRight) return false; // beide Seiten (oder keine): kein Randtreffer
  const newX = blockedLeft ? (cxMin + 1) * TILE : cxMax * TILE - body.w;
  if (Math.abs(newX - body.x) > maxShift) return false;
  if (solidIn(grid, newX, body.y, newX + body.w, body.y + body.h)) return false;
  if (ceilingCells(grid, newX, body.y, newX + body.w, prevTop, body.y + 1e-9).length > 0) return false;
  body.x = newX;
  return true;
}

export function isOnGround(body: Body, grid: TileGrid, platforms: readonly PlatformState[] = NO_PLATFORMS): boolean {
  return solidIn(grid, body.x, body.y + body.h, body.x + body.w, body.y + body.h + 1) || platforms.some((p) => platformSupports(body, p));
}

/** Überlappt der Körper (echte Fläche, Berührung zählt nicht) eine Wasserzelle? */
export function inWater(body: Rect, grid: TileGrid): boolean {
  const [cx0, cx1] = span(body.x, body.x + body.w);
  const [cy0, cy1] = span(body.y, body.y + body.h);
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) if (grid.get(cx, cy) === Cell.Water) return true;
  }
  return false;
}

export function wallAt(body: Body, grid: TileGrid, dir: -1 | 1): boolean {
  return dir > 0
    ? solidIn(grid, body.x + body.w, body.y, body.x + body.w + 1, body.y + body.h)
    : solidIn(grid, body.x - 1, body.y, body.x, body.y + body.h);
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
