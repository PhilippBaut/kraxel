// Kamera: schaut in Laufrichtung voraus, folgt senkrecht ruhig und bleibt im Level.
import type { PlayerState } from './player.ts';

export interface CameraState { x: number; y: number; look: number; targetY: number }
interface Size { w: number; h: number }
/** Arena-Sperre (px): Spaltenbereich x0 bis x1 (rechte Kante) und Unterkante des Arenabodens. */
export interface CameraLock { x0: number; x1: number; floorY: number }

const LOOK_AHEAD = 32;
const LOOK_SPEED = 90;
const LOOK_MIN_VX = 10;
/** Am Boden stehen die Füße bei 70 % der Bildhöhe. */
const FEET_AT = 0.7;
const FOLLOW_RATE = 6;
const TOP_MARGIN = 32;
const BOTTOM_MARGIN = 24;
/** So schnell gleitet die Kamera beim Schließen der Arena in ihre feste Lage. */
const LOCK_RATE = 8;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function feet(p: PlayerState): number {
  return p.body.y + p.body.h;
}

/** Kommt der Kopf dem oberen oder die Füße dem unteren Rand zu nahe, rückt die Kamera sofort nach. */
function keepInBand(c: CameraState, p: PlayerState, h: number): void {
  if (p.body.y - c.y < TOP_MARGIN) c.y = c.targetY = p.body.y - TOP_MARGIN;
  else if (feet(p) - c.y > h - BOTTOM_MARGIN) c.y = c.targetY = feet(p) - (h - BOTTOM_MARGIN);
}

function clampToLevel(c: CameraState, view: Size, level: Size): void {
  const maxX = Math.max(0, level.w - view.w), maxY = Math.max(0, level.h - view.h);
  c.x = clamp(c.x, 0, maxX);
  c.y = clamp(c.y, 0, maxY);
  c.targetY = clamp(c.targetY, 0, maxY);
}

export function createCamera(p: PlayerState, view: Size, levelPx: Size): CameraState {
  const y = feet(p) - FEET_AT * view.h;
  const c: CameraState = { x: p.body.x + p.body.w / 2 - view.w / 2, y, look: 0, targetY: y };
  keepInBand(c, p, view.h);
  clampToLevel(c, view, levelPx);
  return c;
}

/**
 * Ein Kamerabild. Mit `lock` (Arena geschlossen) steht die Kamera mittig auf der Arena und mit dem Boden auf der
 * üblichen Fußlinie; sie gleitet dorthin und folgt Kraxel nicht mehr. Ohne `lock` läuft sie frei.
 */
export function stepCamera(c: CameraState, p: PlayerState, view: Size, levelPx: Size, dt: number, lock: CameraLock | null = null): void {
  if (lock) {
    const k = 1 - Math.exp(-LOCK_RATE * dt);
    const tx = (lock.x0 + lock.x1) / 2 - view.w / 2, ty = lock.floorY - FEET_AT * view.h;
    c.x += (tx - c.x) * k;
    c.y += (ty - c.y) * k;
    c.targetY = ty;
    c.look = 0;
    clampToLevel(c, view, levelPx);
    return;
  }
  if (Math.abs(p.body.vx) > LOOK_MIN_VX) {
    const target = p.facing * LOOK_AHEAD, d = LOOK_SPEED * dt;
    c.look = c.look < target ? Math.min(c.look + d, target) : Math.max(c.look - d, target);
  }
  c.x = p.body.x + p.body.w / 2 + c.look - view.w / 2;

  if (p.grounded) c.targetY = feet(p) - FEET_AT * view.h;
  c.y += (c.targetY - c.y) * (1 - Math.exp(-FOLLOW_RATE * dt));
  keepInBand(c, p, view.h);
  clampToLevel(c, view, levelPx);
}
