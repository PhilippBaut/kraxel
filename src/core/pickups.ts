// Kristalle, Edelweiß und Items (Helm, Schleuder, Goldener Enzian) als einsammelbare Körper.
import { TILE } from '../config.ts';
import { moveBody, overlaps } from './collide.ts';
import { addCrystals } from './game.ts';
import { ENZIAN_TIME } from './player.ts';
import type { GameState } from './game.ts';
import type { TileGrid } from './grid.ts';
import type { EntitySpawn } from './level.ts';
import type { Body, GameEvent, ItemKind } from './types.ts';

export type PickupKind = 'crystal' | 'edelweiss' | 'item';
export interface PickupState {
  kind: PickupKind; body: Body; index: number; item: ItemKind | null;
  /** Restzeit des Auftauchens aus der Kiste in s; 0 = fertig. */
  emerge: number; taken: boolean; dir: -1 | 1;
}

const CRYSTAL_W = 10, CRYSTAL_H = 12;
const EDELWEISS_W = 12, EDELWEISS_H = 12;
const ITEM_W = 14, ITEM_H = 14;
const EMERGE_TIME = 0.5;
const ITEM_SPEED = 50;
const ITEM_GRAVITY = 700;
const ITEM_MAX_FALL = 270;
const HELM_BONUS_CRYSTALS = 10;

function centred(cx: number, cy: number, w: number, h: number): Body {
  return { x: cx * TILE + (TILE - w) / 2, y: cy * TILE + (TILE - h) / 2, w, h, vx: 0, vy: 0 };
}

/** Für `crystal` und `edelweiss`. */
export function createPickup(sp: EntitySpawn): PickupState {
  const edel = sp.kind === 'edelweiss';
  return {
    kind: edel ? 'edelweiss' : 'crystal',
    body: edel ? centred(sp.cx, sp.cy, EDELWEISS_W, EDELWEISS_H) : centred(sp.cx, sp.cy, CRYSTAL_W, CRYSTAL_H),
    index: sp.index, item: null, emerge: 0, taken: false, dir: 1,
  };
}

/** Taucht in 0,5 s aus der Kiste (Zelle cx,cy) auf; am Anfang steckt es ganz in der Kiste. */
export function spawnItem(item: ItemKind, cx: number, cy: number): PickupState {
  return {
    kind: 'item', item, index: 0, emerge: EMERGE_TIME, taken: false, dir: 1,
    body: { x: cx * TILE + (TILE - ITEM_W) / 2, y: (cy + 1) * TILE - ITEM_H, w: ITEM_W, h: ITEM_H, vx: 0, vy: 0 },
  };
}

export function stepPickups(list: PickupState[], grid: TileGrid, dt: number): void {
  for (const p of list) {
    if (p.kind !== 'item' || p.taken) continue;
    const b = p.body;
    if (p.emerge > 0) {
      // Ohne Kollision nach oben, genau TILE px in EMERGE_TIME.
      const step = Math.min(dt, p.emerge);
      b.y -= (TILE * step) / EMERGE_TIME;
      p.emerge = Math.max(0, p.emerge - dt);
      continue;
    }
    b.vx = p.dir * ITEM_SPEED;
    b.vy = Math.min(b.vy + ITEM_GRAVITY * dt, ITEM_MAX_FALL);
    const r = moveBody(b, dt, grid);
    if (r.left || r.right) p.dir = r.left ? 1 : -1;
    if (b.y > grid.height * TILE) p.taken = true; // aus dem Level gefallen
  }
}

export function collectPickups(s: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  for (const p of s.pickups) {
    if (p.taken || p.emerge > 0 || !overlaps(s.player.body, p.body)) continue;
    p.taken = true;
    if (p.kind === 'crystal') {
      events.push(...addCrystals(s, 1));
      events.push({ type: 'crystal', x: p.body.x + p.body.w / 2, y: p.body.y + p.body.h / 2, fromCrate: false });
    } else if (p.kind === 'edelweiss') {
      s.session.edelweiss[p.index] = true;
      events.push({ type: 'edelweiss', index: p.index });
    } else if (p.item === 'enzian') {
      s.player.enzian = ENZIAN_TIME;
      events.push({ type: 'powerUp', item: 'enzian' }, { type: 'enzianStart' });
    } else if (p.item === 'sling') {
      if (s.player.special === null) {
        s.player.special = 'sling';
        s.player.helm = true; // die Schleuder schließt den Helmschutz ein
        events.push({ type: 'powerUp', item: 'sling' });
      } else events.push(...addCrystals(s, HELM_BONUS_CRYSTALS));
    } else if (!s.player.helm) {
      s.player.helm = true;
      events.push({ type: 'powerUp', item: 'helm' });
    } else {
      events.push(...addCrystals(s, HELM_BONUS_CRYSTALS));
    }
  }
  return events;
}
