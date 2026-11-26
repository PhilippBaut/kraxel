// Kiesel: Kraxels Schleuder schießt höchstens zwei in leichtem Bogen.
import { moveBody, overlaps } from './collide.ts';
import { defeat } from './enemies.ts';
import type { GameState } from './game.ts';
import type { Body, GameEvent } from './types.ts';

export interface Pebble { body: Body; age: number }
export const PEBBLE_MAX = 2;
export const PEBBLE_COOLDOWN = 0.2;
export const PEBBLE_SPEED = 180;
export const PEBBLE_LIFT = 60;
export const PEBBLE_GRAVITY = 300;
export const PEBBLE_LIFE = 1.2;
export const PEBBLE_SIZE = 4;

function popEvent(p: Pebble): GameEvent {
  return { type: 'pebblePop', x: p.body.x + p.body.w / 2, y: p.body.y + p.body.h / 2 };
}

/** Schießt einen Kiesel in Blickrichtung, wenn Kraxel die Schleuder trägt, weniger als 2 fliegen und die Abklingzeit um ist. */
export function shoot(s: GameState): GameEvent[] {
  const p = s.player;
  if (p.special !== 'sling' || s.pebbles.length >= PEBBLE_MAX || s.pebbleCooldown > 0) return [];
  const b = p.body;
  s.pebbles.push({
    age: 0,
    body: {
      x: b.x + b.w / 2 - PEBBLE_SIZE / 2, y: b.y + b.h / 2 - PEBBLE_SIZE / 2, w: PEBBLE_SIZE, h: PEBBLE_SIZE,
      vx: p.facing * PEBBLE_SPEED, vy: -PEBBLE_LIFT,
    },
  });
  s.pebbleCooldown = PEBBLE_COOLDOWN;
  return [{ type: 'shoot' }];
}

/** Bewegung, Wände (auch Kisten und Felsblöcke, ohne sie zu treffen), Lebensdauer und Treffer gegen Gegner. */
export function stepPebbles(s: GameState, dt: number): GameEvent[] {
  const events: GameEvent[] = [];
  s.pebbleCooldown = Math.max(0, s.pebbleCooldown - dt);
  const alive: Pebble[] = [];
  for (const p of s.pebbles) {
    const b = p.body;
    p.age += dt;
    b.vy += PEBBLE_GRAVITY * dt;
    const r = moveBody(b, dt, s.grid);
    let gone = r.left || r.right || r.up || r.down || p.age >= PEBBLE_LIFE;
    for (const e of s.enemies) {
      if (!e.alive || !e.active || !overlaps(b, e.body)) continue;
      defeat(e, events);
      gone = true;
      break;
    }
    if (gone) events.push(popEvent(p));
    else alive.push(p);
  }
  s.pebbles = alive;
  return events;
}
