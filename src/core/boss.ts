// Murmelkönig Grummel: der Mittelboss in der Arena. Kein Phaser, kein DOM.
import { TILE } from '../config.ts';
import { moveBody, overlaps } from './collide.ts';
import { damagePlayer } from './game.ts';
import type { GameState } from './game.ts';
import type { EntitySpawn } from './level.ts';
import { DEFAULT_TUNING } from './tuning.ts';
import type { Tuning } from './tuning.ts';
import { Cell } from './types.ts';
import type { Body, GameEvent } from './types.ts';

/** Warten, Eingraben, Hügel (Erdhügel läuft zu Kraxel), Beben an der Stelle, Herausspringen, Benommen (verwundbar), Steinwurf, besiegt. */
export type BossPhase = 'wait' | 'dig' | 'mound' | 'tremble' | 'pop' | 'stunned' | 'throw' | 'defeated';
/** `t`: Zeit in der Phase. `moundX`: Mitte des Hügels (px). `invuln`: Schonzeit nach einem Treffer. `throwsLeft`: noch nicht geworfene Steine. `floorY`: Unterkante des Körpers am Boden. */
export interface BossState { phase: BossPhase; t: number; hits: number; body: Body; moundX: number; invuln: number; throwsLeft: number; rocks: Body[]; floorY: number }

export const BOSS_SIZE = 32;
export const BOSS_HITS = 3;
export const BOSS_WAIT = 1.0;
/** Warten wird je Treffer um so viel kürzer. */
export const BOSS_WAIT_STEP = 0.25;
export const BOSS_DIG_TIME = 0.4;
/** Hügeltempo in Kacheln/s, je Treffer kommt `BOSS_MOUND_STEP` dazu. */
export const BOSS_MOUND_SPEED = 3;
export const BOSS_MOUND_STEP = 0.75;
export const BOSS_MOUND_MAX = 2.5;
export const BOSS_TREMBLE_TIME = 0.5;
/** Sprunghöhe beim Herausspringen in Kacheln. */
export const BOSS_POP_TILES = 3;
export const BOSS_STUN_TIME = 1.2;
export const BOSS_THROW_GAP = 0.4;
export const BOSS_INVULN = 0.8;
const GRAVITY = 900;
const STONE_SIZE = 8;
const STONE_GRAVITY = 600;
/** Flugzeit eines Steins bis zu Kraxels Stelle. */
const STONE_FLIGHT = 0.7;
/** So weit dürfen die Füße beim Draufspringen im vorigen Schritt unter der Oberkante des Murmelkönigs liegen (wie beim Käfer). */
const STOMP_TOLERANCE = 4;
const EPS = 1e-9;

/** `sp.cx, sp.cy`: Zelle unten links des 2×2-Körpers. */
export function createBoss(sp: EntitySpawn): BossState {
  const floorY = (sp.cy + 1) * TILE;
  return {
    phase: 'wait', t: 0, hits: 0, invuln: 0, throwsLeft: 0, rocks: [], floorY,
    body: { x: sp.cx * TILE, y: floorY - BOSS_SIZE, w: BOSS_SIZE, h: BOSS_SIZE, vx: 0, vy: 0 },
    moundX: sp.cx * TILE + BOSS_SIZE / 2,
  };
}

/** Sichtbar und fest im Spiel? Im Hügel, beim Beben und besiegt ist er nicht zu treffen. */
export function bossHittable(b: BossState): boolean {
  return b.phase !== 'mound' && b.phase !== 'tremble' && b.phase !== 'defeated';
}

/** Das Gipfelkreuz nach dem Sieg: mittig auf dem Arenaboden (Spalte x0 + 8, in der Reihe über dem Boden). Sonst null. */
export function summitSpawn(s: GameState): EntitySpawn | null {
  if (!s.boss || !s.arena || s.boss.phase !== 'defeated') return null;
  return { kind: 'goal', cx: s.arena.x0 + 8, cy: s.boss.floorY / TILE - 1, index: 0 };
}

/** Betritt Kraxel die Arena (ganz hinein, also auch seine Mitte zwischen x0 und x1), wird die Zelle Spalte x0 − 1 vom Boden bis zur Decke fest. */
export function stepArena(s: GameState): GameEvent[] {
  const a = s.arena;
  if (!a || a.closed || s.player.mode === 'dead') return [];
  const b = s.player.body;
  if (b.x < a.x0 * TILE || b.x + b.w > (a.x1 + 1) * TILE) return [];
  a.closed = true;
  const floorRow = s.boss ? s.boss.floorY / TILE : s.grid.height - 1;
  for (let cy = 0; cy < floorRow; cy++) if (!s.grid.isSolid(a.x0 - 1, cy)) s.grid.set(a.x0 - 1, cy, Cell.Ground);
  return [{ type: 'arenaClose' }];
}

function hurt(s: GameState, t: Tuning): GameEvent[] {
  return s.player.invuln > 0 ? [] : damagePlayer(s, t);
}

/** Ein Stein im Bogen auf Kraxels Mitte; er braucht `STONE_FLIGHT` Sekunden dorthin. */
function throwStone(s: GameState, b: BossState): void {
  const from = { x: b.body.x + b.body.w / 2, y: b.body.y + 8 };
  const pb = s.player.body;
  const to = { x: pb.x + pb.w / 2, y: pb.y + pb.h / 2 };
  b.rocks.push({
    x: from.x - STONE_SIZE / 2, y: from.y - STONE_SIZE / 2, w: STONE_SIZE, h: STONE_SIZE,
    vx: (to.x - from.x) / STONE_FLIGHT, vy: (to.y - from.y) / STONE_FLIGHT - 0.5 * STONE_GRAVITY * STONE_FLIGHT,
  });
  b.throwsLeft -= 1;
}

/** Steine fliegen, treffen Kraxel wie ein Gegner oder verschwinden an Wand und Boden. */
function stepStones(s: GameState, b: BossState, dt: number, t: Tuning): GameEvent[] {
  const events: GameEvent[] = [];
  b.rocks = b.rocks.filter((r) => {
    r.vy += STONE_GRAVITY * dt;
    const m = moveBody(r, dt, s.grid);
    if (s.player.mode !== 'dead' && overlaps(r, s.player.body)) {
      events.push(...hurt(s, t));
      return false;
    }
    return !(m.left || m.right || m.up || m.down || r.y > s.grid.height * TILE);
  });
  return events;
}

/** Ein Schritt: Phasenfolge, Steine, Berührung mit Kraxel. Läuft erst, wenn die Arenatür zu ist. */
export function stepBoss(s: GameState, dt: number, t: Tuning = DEFAULT_TUNING, jumpHeld = false): GameEvent[] {
  const b = s.boss;
  if (!b || !s.arena?.closed) return [];
  const events: GameEvent[] = [];
  b.invuln = Math.max(0, b.invuln - dt);
  events.push(...stepStones(s, b, dt, t));
  if (s.phase !== 'playing') return events;
  stepPhase(s, b, s.arena, dt, events);
  if (s.phase === 'playing') events.push(...touch(s, b, t, jumpHeld));
  return events;
}

function stepPhase(s: GameState, b: BossState, a: { x0: number; x1: number }, dt: number, events: GameEvent[]): void {
  const body = b.body;
  b.t += dt;
  switch (b.phase) {
    case 'wait':
      if (b.t >= BOSS_WAIT - BOSS_WAIT_STEP * b.hits - EPS) {
        b.phase = 'dig';
        b.t = 0;
        events.push({ type: 'bossDig' });
      }
      break;
    case 'dig':
      if (b.t >= BOSS_DIG_TIME - EPS) {
        b.phase = 'mound';
        b.t = 0;
        b.moundX = body.x + body.w / 2;
      }
      break;
    case 'mound': {
      const lo = a.x0 * TILE + BOSS_SIZE / 2, hi = (a.x1 + 1) * TILE - BOSS_SIZE / 2;
      const pb = s.player.body;
      const target = Math.min(hi, Math.max(lo, pb.x + pb.w / 2));
      const step = (BOSS_MOUND_SPEED + BOSS_MOUND_STEP * b.hits) * TILE * dt;
      const reached = Math.abs(target - b.moundX) <= step;
      b.moundX = reached ? target : b.moundX + Math.sign(target - b.moundX) * step;
      if (reached || b.t >= BOSS_MOUND_MAX - EPS) {
        b.phase = 'tremble';
        b.t = 0;
      }
      break;
    }
    case 'tremble':
      if (b.t >= BOSS_TREMBLE_TIME - EPS) {
        b.phase = 'pop';
        b.t = 0;
        body.x = b.moundX - body.w / 2;
        body.y = b.floorY - body.h;
        body.vy = -Math.sqrt(2 * GRAVITY * BOSS_POP_TILES * TILE);
        events.push({ type: 'bossPop' });
      }
      break;
    case 'pop': {
      body.vy += GRAVITY * dt;
      const m = moveBody(body, dt, s.grid);
      if (m.down) {
        b.phase = 'stunned';
        b.t = 0;
      }
      break;
    }
    case 'stunned':
      if (b.t >= BOSS_STUN_TIME - EPS) {
        b.phase = 'throw';
        b.t = 0;
        b.throwsLeft = b.hits >= 1 ? 2 : 1;
        throwStone(s, b);
        events.push({ type: 'bossThrow' });
      }
      break;
    case 'throw': {
      const total = b.hits >= 1 ? 2 : 1;
      if (b.throwsLeft > 0 && b.t >= BOSS_THROW_GAP * (total - b.throwsLeft) - EPS) {
        throwStone(s, b);
        events.push({ type: 'bossThrow' });
      } else if (b.throwsLeft === 0 && b.t >= BOSS_THROW_GAP * total - EPS) {
        b.phase = 'wait';
        b.t = 0;
      }
      break;
    }
    case 'defeated':
      break;
  }
}

/** Berührung: In Benommen zählt Draufspringen oder Stampfen als Treffer (Stampfregel wie beim Käfer, der Enzian zählt nicht). Sonst kostet sie Kraxel einen Treffer. */
function touch(s: GameState, b: BossState, t: Tuning, jumpHeld: boolean): GameEvent[] {
  const p = s.player, pb = p.body;
  if (!bossHittable(b) || p.mode === 'dead' || !overlaps(pb, b.body)) return [];
  if (b.phase !== 'stunned') return hurt(s, t);
  if (p.enzian > 0) return [];
  const pound = p.mode === 'pound';
  const stomp = pb.vy > 0 && s.playerPrevBottom <= b.body.y + STOMP_TOLERANCE;
  if (!pound && !stomp) return []; // Seitenberührung ist harmlos
  const events: GameEvent[] = [];
  if (!pound) {
    events.push({ type: 'stomp', x: b.body.x + b.body.w / 2, y: b.body.y });
    pb.vy = -(jumpHeld ? t.stompBounceHeld : t.stompBounce);
    p.grounded = false;
    p.jumpRising = false;
  }
  if (b.invuln > 0) return events; // Schonzeit: kein zweiter Treffer
  b.hits += 1;
  b.invuln = BOSS_INVULN;
  events.push({ type: 'bossHit', hits: b.hits });
  if (b.hits >= BOSS_HITS) {
    b.phase = 'defeated';
    b.rocks = [];
    events.push({ type: 'bossDefeated' });
  }
  return events;
}
