// Gegner: Krabbelkäfer und Stachelschnecke.
import { TILE } from '../config.ts';
import { isOnGround, moveBody, overlaps } from './collide.ts';
import { damagePlayer } from './game.ts';
import type { GameState, ViewWindow } from './game.ts';
import type { TileGrid } from './grid.ts';
import type { EntitySpawn } from './level.ts';
import type { Tuning } from './tuning.ts';
import type { Body, GameEvent, InputFrame } from './types.ts';

export type EnemyKind = 'beetle' | 'snail';
export interface EnemyState { kind: EnemyKind; body: Body; dir: -1 | 1; active: boolean; alive: boolean; defeatTimer: number }

export const ENEMY_SPEC: Readonly<Record<EnemyKind, { speed: number; w: number; h: number; stompable: boolean; turnAtEdges: boolean }>> = {
  beetle: { speed: 30, w: 12, h: 12, stompable: true, turnAtEdges: false },
  snail: { speed: 15, w: 14, h: 12, stompable: false, turnAtEdges: true },
};

const GRAVITY = 700;
const MAX_FALL = 270;
const ACTIVATE_MARGIN = 32;
const DEFEAT_TIME = 0.5;
/** So weit dürfen die Füße beim Draufspringen im vorigen Schritt unter der Oberkante des Gegners liegen. */
const STOMP_TOLERANCE = 4;

/** `beetle` oder `snail`; läuft zunächst nach links (zum Spieler). */
export function createEnemy(sp: EntitySpawn): EnemyState {
  const kind: EnemyKind = sp.kind === 'snail' ? 'snail' : 'beetle';
  const { w, h } = ENEMY_SPEC[kind];
  return {
    kind, dir: -1, active: false, alive: true, defeatTimer: 0,
    body: { x: sp.cx * TILE + (TILE - w) / 2, y: (sp.cy + 1) * TILE - h, w, h, vx: 0, vy: 0 },
  };
}

function nearView(b: Body, view: ViewWindow): boolean {
  return b.x + b.w > view.x - ACTIVATE_MARGIN && b.x < view.x + view.w + ACTIVATE_MARGIN;
}

/** Steht vor dem Gegner noch Boden? Geprüft wird unter seiner Vorderkante. */
function groundAhead(e: EnemyState, grid: TileGrid): boolean {
  const b = e.body;
  const x = e.dir > 0 ? b.x + b.w : b.x - 0.01;
  return grid.isSolid(Math.floor(x / TILE), Math.floor((b.y + b.h + 1) / TILE));
}

export function stepEnemies(list: EnemyState[], grid: TileGrid, view: ViewWindow, dt: number): void {
  for (const e of list) {
    if (!e.alive) {
      e.defeatTimer = Math.max(0, e.defeatTimer - dt);
      continue;
    }
    if (!e.active) {
      if (!nearView(e.body, view)) continue;
      e.active = true;
    }
    const b = e.body, spec = ENEMY_SPEC[e.kind];
    if (spec.turnAtEdges && isOnGround(b, grid) && !groundAhead(e, grid)) e.dir = e.dir > 0 ? -1 : 1;
    b.vx = e.dir * spec.speed;
    b.vy = Math.min(b.vy + GRAVITY * dt, MAX_FALL);
    const r = moveBody(b, dt, grid);
    if (r.left || r.right) e.dir = r.left ? 1 : -1;
    if (b.y > grid.height * TILE) e.alive = false; // unter das Level gefallen
  }
}

function defeat(e: EnemyState, events: GameEvent[]): void {
  e.alive = false;
  e.defeatTimer = DEFEAT_TIME;
  events.push({ type: 'enemyDefeated', x: e.body.x + e.body.w / 2, y: e.body.y + e.body.h / 2 });
}

/** Kopfstoß von unten gegen die Zelle: besiegt jeden Gegner, der darauf steht. */
export function defeatEnemiesOn(s: GameState, cx: number, cy: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (const e of s.enemies) {
    const b = e.body;
    if (!e.alive || Math.abs(b.y + b.h - cy * TILE) > 1) continue;
    if (b.x < (cx + 1) * TILE && b.x + b.w > cx * TILE) defeat(e, events);
  }
  return events;
}

/** Berührung zwischen Spieler und Gegnern. Draufspringen nutzt die Fußhöhe aus dem vorigen Schritt. */
export function resolvePlayerEnemies(s: GameState, input: InputFrame, t: Tuning): GameEvent[] {
  const events: GameEvent[] = [];
  const p = s.player, pb = p.body;
  for (const e of s.enemies) {
    if (!e.alive || !overlaps(pb, e.body)) continue;
    const stompable = ENEMY_SPEC[e.kind].stompable;
    if (p.mode === 'pound') {
      if (stompable) defeat(e, events);
      else events.push(...hurt(s, t));
    } else if (pb.vy > 0 && s.playerPrevBottom <= e.body.y + STOMP_TOLERANCE) {
      if (stompable) {
        defeat(e, events);
        events.push({ type: 'stomp', x: e.body.x + e.body.w / 2, y: e.body.y });
        pb.vy = -(input.jump ? t.stompBounceHeld : t.stompBounce);
        p.grounded = false;
        p.jumpRising = false;
      } else events.push(...hurt(s, t));
    } else events.push(...hurt(s, t));
  }
  return events;
}

/** Schaden, außer während der Schonzeit. */
function hurt(s: GameState, t: Tuning): GameEvent[] {
  return s.player.invuln > 0 ? [] : damagePlayer(s, t);
}
