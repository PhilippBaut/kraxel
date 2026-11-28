// Steinschlag: Ein Brocken hängt in der Decke, warnt mit Staub und Rumpeln und fällt dann.
import { TILE } from '../config.ts';
import { moveBody, overlaps } from './collide.ts';
import { damagePlayer } from './game.ts';
import type { GameState } from './game.ts';
import type { EntitySpawn } from './level.ts';
import { DEFAULT_TUNING } from './tuning.ts';
import type { Tuning } from './tuning.ts';
import type { Body, GameEvent } from './types.ts';

/** `idle`: hängt, `warn`: Staub und Rumpeln (`t` zählt die Zeit), `fall`: fällt, `gone`: zerplatzt (bis zum Respawn). */
export interface FallingRock { cx: number; cy: number; state: 'idle' | 'warn' | 'fall' | 'gone'; t: number; body: Body }

/** Kraxel löst aus, wenn seine Mitte waagerecht höchstens so weit (in Kacheln) von der Brockenmitte entfernt ist. */
export const ROCK_TRIGGER_TILES = 1.5;
export const ROCK_WARN_TIME = 0.6;
const ROCK_SIZE = 12;
const GRAVITY = 900;
const MAX_FALL = 270;

/** Ein Brocken je `R`: oben in der Zelle (er hängt an der Decke darüber), waagerecht mittig. */
export function createRocks(spawns: readonly EntitySpawn[]): FallingRock[] {
  return spawns
    .filter((sp) => sp.kind === 'fallingRock')
    .map((sp) => ({
      cx: sp.cx, cy: sp.cy, state: 'idle', t: 0,
      body: { x: sp.cx * TILE + (TILE - ROCK_SIZE) / 2, y: sp.cy * TILE, w: ROCK_SIZE, h: ROCK_SIZE, vx: 0, vy: 0 },
    }));
}

/** Steht Kraxel unter dem Brocken, nah genug, und liegt dazwischen nichts Festes? */
function triggered(s: GameState, r: FallingRock): boolean {
  const pb = s.player.body, rb = r.body;
  if (s.player.mode === 'dead' || pb.y < rb.y + rb.h) return false;
  if (Math.abs(pb.x + pb.w / 2 - (rb.x + rb.w / 2)) > ROCK_TRIGGER_TILES * TILE) return false;
  for (let cy = r.cy + 1; cy <= Math.floor(pb.y / TILE); cy++) if (s.grid.isSolid(r.cx, cy)) return false;
  return true;
}

/** Zelle, in der der Brocken gerade liegt (Mitte des Körpers). */
function breakEvent(r: FallingRock): GameEvent {
  return { type: 'rockBreak', cx: Math.floor((r.body.x + r.body.w / 2) / TILE), cy: Math.floor((r.body.y + r.body.h / 2) / TILE) };
}

/** Ein Schritt für alle Brocken. Der Brocken trifft Kraxel wie ein Gegner (`damagePlayer`, Schonzeit und Enzian zählen) und zerplatzt dabei;
 *  Gegner lässt er unversehrt. */
export function stepRocks(s: GameState, dt: number, t: Tuning = DEFAULT_TUNING): GameEvent[] {
  const events: GameEvent[] = [];
  for (const r of s.rocks) {
    if (r.state === 'gone') continue;
    if (r.state === 'idle') {
      if (!triggered(s, r)) continue;
      r.state = 'warn';
      r.t = 0;
      events.push({ type: 'rockWarn', cx: r.cx, cy: r.cy });
      continue;
    }
    if (r.state === 'warn') {
      r.t += dt;
      if (r.t < ROCK_WARN_TIME - 1e-9) continue;
      r.state = 'fall';
      r.t = 0;
      events.push({ type: 'rockFall', cx: r.cx, cy: r.cy });
      continue;
    }
    const b = r.body;
    r.t += dt;
    b.vy = Math.min(b.vy + GRAVITY * dt, MAX_FALL);
    const m = moveBody(b, dt, s.grid, 0, s.platforms);
    const hit = s.player.mode !== 'dead' && overlaps(b, s.player.body);
    if (hit) {
      if (s.player.invuln <= 0) events.push(...damagePlayer(s, t));
    }
    if (hit || m.down || b.y > s.grid.height * TILE) {
      r.state = 'gone';
      if (b.y <= s.grid.height * TILE) events.push(breakEvent(r));
    }
  }
  return events;
}
