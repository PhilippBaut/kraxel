// Treffer auf Kisten und Felsblöcke.
import { TILE } from '../config.ts';
import type { GameState } from './game.ts';
import { addCrystals } from './game.ts';
import { spawnItem } from './pickups.ts';
import { Cell } from './types.ts';
import type { Body, GameEvent } from './types.ts';

const MULTI_MAX = 10;
const MULTI_WINDOW = 4;

/** Die Zelle unter der Körpermitte, sonst die mit der größten waagerechten Überlappung. */
export function primaryCell(body: Body, cells: Array<[number, number]>): [number, number] | null {
  if (cells.length === 0) return null;
  const mid = Math.floor((body.x + body.w / 2) / TILE);
  const under = cells.find(([cx]) => cx === mid);
  if (under) return under;
  let best = cells[0]!;
  let bestOverlap = -Infinity;
  for (const c of cells) {
    const o = Math.min(body.x + body.w, (c[0] + 1) * TILE) - Math.max(body.x, c[0] * TILE);
    if (o > bestOverlap) { best = c; bestOverlap = o; }
  }
  return best;
}

function crystalFromCrate(s: GameState, cx: number, cy: number, events: GameEvent[]): void {
  events.push(...addCrystals(s, 1));
  events.push({ type: 'crystal', x: cx * TILE + TILE / 2, y: cy * TILE, fromCrate: true });
}

function openCrate(s: GameState, cx: number, cy: number): GameEvent[] {
  const key = s.grid.index(cx, cy);
  const content = s.crates.get(key) ?? { kind: 'crystal' as const };
  const events: GameEvent[] = [];
  if (content.kind === 'multi') {
    let m = s.multi.get(key);
    if (!m) { m = { left: MULTI_MAX, timer: MULTI_WINDOW }; s.multi.set(key, m); }
    events.push({ type: 'crateOpen', cx, cy });
    crystalFromCrate(s, cx, cy, events);
    if (--m.left <= 0) closeMulti(s, cx, cy);
    return events;
  }
  s.grid.set(cx, cy, Cell.CrateUsed);
  events.push({ type: 'crateOpen', cx, cy });
  if (content.kind === 'crystal') crystalFromCrate(s, cx, cy, events);
  else {
    s.pickups.push(spawnItem(content.item, cx, cy));
    events.push({ type: 'itemSpawn', item: content.item, cx, cy });
  }
  return events;
}

function closeMulti(s: GameState, cx: number, cy: number): void {
  s.grid.set(cx, cy, Cell.CrateUsed);
  s.multi.delete(s.grid.index(cx, cy));
}

export function hitCell(s: GameState, cx: number, cy: number, from: 'below' | 'above'): GameEvent[] {
  const cell = s.grid.get(cx, cy);
  if (cell === Cell.Crate || cell === Cell.HiddenCrate) return openCrate(s, cx, cy);
  if (cell === Cell.Rock) {
    if (from === 'above' || s.player.helm) {
      s.grid.set(cx, cy, Cell.Empty);
      return [{ type: 'rockBreak', cx, cy }];
    }
    return [{ type: 'bump', cx, cy }];
  }
  if (from === 'below' && (cell === Cell.Ground || cell === Cell.CrateUsed)) return [{ type: 'bump', cx, cy }];
  return [];
}

/** Lässt Mehrfach-Fenster ablaufen. */
export function stepBlocks(s: GameState, dt: number): void {
  for (const [key, m] of s.multi) {
    m.timer -= dt;
    if (m.timer <= 0) closeMulti(s, key % s.grid.width, Math.floor(key / s.grid.width));
  }
}
