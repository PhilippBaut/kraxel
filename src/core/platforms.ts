// Bewegte Plattformen (Baumstämme und Steinplatten): Pendelbahn und Mitfahren.
// Nur die Oberseite trägt; von unten und von der Seite geht man hindurch.
import { TILE } from '../config.ts';
import { moveBody, platformSupports } from './collide.ts';
import type { TileGrid } from './grid.ts';
import type { Body } from './types.ts';

export interface PlatformSpec { cx: number; cy: number; width: number; axis: 'h' | 'v'; travel: number; speed: number; art: 'stamm' | 'stein' }
/** `x`/`y`: linke obere Ecke in ganzen Pixeln. `dx`/`dy`: Bewegung im letzten Schritt. `dir` 1: unterwegs zum Ende (Start + Weg), -1: zurück.
 *  `phase`: genaue Strecke ab dem Start in px (0 bis |Weg|·16); `x`/`y` runden sie, damit Fahrer und Bild nicht um Bruchteile gegeneinander wackeln. */
export interface PlatformState { spec: PlatformSpec; x: number; y: number; dir: 1 | -1; dx: number; dy: number; phase: number }

export function createPlatforms(specs: readonly PlatformSpec[]): PlatformState[] {
  return specs.map((spec) => ({ spec, x: spec.cx * TILE, y: spec.cy * TILE, dir: 1, dx: 0, dy: 0, phase: 0 }));
}

/** Ein Schritt: Pendeln zwischen Start und Start + Weg, am Ende kehrt die Plattform um (Rest der Strecke zählt zurück). */
export function stepPlatforms(list: PlatformState[], dt: number): void {
  for (const p of list) {
    const { spec } = p;
    const length = Math.abs(spec.travel) * TILE;
    if (length > 0) {
      let left = spec.speed * TILE * dt;
      while (left > 1e-9) {
        const room = p.dir > 0 ? length - p.phase : p.phase;
        const move = Math.min(left, room);
        left -= move;
        if (move < room) {
          p.phase += p.dir * move;
        } else {
          p.phase = p.dir > 0 ? length : 0; // Ende erreicht: genau darauf und umkehren
          p.dir = p.dir > 0 ? -1 : 1;
        }
      }
    }
    const along = Math.round(p.phase) * Math.sign(spec.travel);
    const x = spec.cx * TILE + (spec.axis === 'h' ? along : 0);
    const y = spec.cy * TILE + (spec.axis === 'v' ? along : 0);
    p.dx = x - p.x;
    p.dy = y - p.y;
    p.x = x;
    p.y = y;
  }
}

/** Plattform unter den Füßen: Füße auf der Oberkante (höchstens 1 px darüber), waagerecht überlappend. */
export function standingOn(body: Body, list: readonly PlatformState[]): PlatformState | null {
  return list.find((p) => platformSupports(body, p)) ?? null;
}

/** Plattform, die an dieser Stelle trägt: `x` liegt über ihr und ihre Oberkante auf Höhe `bottom` (±1 px). Für Gegner, die an Kanten umdrehen. */
export function platformTopAt(x: number, bottom: number, list: readonly PlatformState[]): PlatformState | null {
  return list.find((p) => x >= p.x && x < p.x + p.spec.width * TILE && Math.abs(bottom - p.y) <= 1) ?? null;
}

/** Schiebt den Körper um die Bewegung der Plattform. Wände und Decken blocken (über `moveBody`), Geschwindigkeit und Rest bleiben. */
export function carryBody(body: Body, p: PlatformState, grid: TileGrid): void {
  if (p.dx === 0 && p.dy === 0) return;
  const probe: Body = { x: body.x, y: body.y, w: body.w, h: body.h, vx: p.dx, vy: p.dy };
  moveBody(probe, 1, grid);
  body.x = probe.x;
  body.y = probe.y;
}
