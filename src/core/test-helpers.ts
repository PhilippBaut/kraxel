// Nur für Tests: baut ein Raster aus Textzeilen.
import { Cell } from './types.ts';
import type { GameEvent, Held } from './types.ts';
import { STEP, TILE } from '../config.ts';
import { TileGrid } from './grid.ts';
import { emptyHeld, InputSampler } from './input-frame.ts';
import { createGame, stepGame } from './game.ts';
import type { GameState, Session } from './game.ts';
import { parseLevel } from './level.ts';
import { stepPlayer } from './player.ts';
import type { PlayerState } from './player.ts';
import { DEFAULT_TUNING } from './tuning.ts';
import type { Tuning } from './tuning.ts';

/** `#` Ground, `B` Rock, `K` Crate, `U` CrateUsed, `V` HiddenCrate, alles andere leer. */
export function gridFrom(rows: string[]): TileGrid {
  const width = Math.max(...rows.map((r) => r.length));
  const g = new TileGrid(width, rows.length);
  const map: Record<string, Cell> = {
    '#': Cell.Ground, B: Cell.Rock, K: Cell.Crate, U: Cell.CrateUsed, V: Cell.HiddenCrate,
  };
  rows.forEach((row, cy) => {
    for (let cx = 0; cx < row.length; cx++) g.set(cx, cy, map[row[cx]!] ?? Cell.Empty);
  });
  return g;
}

/** Flacher Boden in Reihe 10, 40 Spalten breit. */
export const FLAT = gridFrom([...Array(10).fill('.'.repeat(40)), '#'.repeat(40)]);

export function held(p: Partial<Held> = {}): Held {
  return { ...emptyHeld(), ...p };
}

/** Eingabe und Anzahl Schritte. */
export type Script = Array<[Partial<Held>, number]>;

export function runPlayer(p: PlayerState, grid: TileGrid, script: Script, t: Tuning = DEFAULT_TUNING) {
  const sampler = new InputSampler();
  const events: GameEvent[] = [];
  const headCells: Array<[number, number]> = [];
  const poundCells: Array<[number, number]> = [];
  let minY = p.body.y;
  let maxVy = p.body.vy;
  for (const [input, steps] of script) {
    for (let i = 0; i < steps; i++) {
      const r = stepPlayer(p, sampler.sample(held(input)), grid, t, STEP);
      events.push(...r.events);
      headCells.push(...r.headCells);
      poundCells.push(...r.poundCells);
      minY = Math.min(minY, p.body.y);
      maxVy = Math.max(maxVy, p.body.vy);
    }
  }
  return { events, headCells, poundCells, minY, maxVy };
}

/** Baut ein Spiel aus Textzeilen (Kopfzeilen werden davor gesetzt). */
export function gameFrom(rows: string[], session?: Session): GameState {
  return createGame(parseLevel('test', `name: test\nworld: 1\n---\n${rows.join('\n')}`), session);
}

/** Setzt Kraxel mit den Füßen auf die Unterkante der Zelle, waagerecht mittig, ohne Tempo. Helm und übriger Zustand bleiben, `grounded` erkennt der nächste Schritt. */
export function placePlayer(s: GameState, cx: number, cy: number): void {
  const p = s.player, b = p.body;
  b.x = cx * TILE + (TILE - b.w) / 2;
  b.y = (cy + 1) * TILE - b.h;
  b.vx = 0;
  b.vy = 0;
  p.mode = 'normal';
  p.grounded = false;
  s.playerPrevBottom = b.y + b.h;
}

/** Lässt das Spiel mit festem Schritt laufen und sammelt alle Ereignisse. */
export function runGame(s: GameState, script: Script, t: Tuning = DEFAULT_TUNING): GameEvent[] {
  const sampler = new InputSampler();
  const events: GameEvent[] = [];
  for (const [input, steps] of script) {
    for (let i = 0; i < steps; i++) {
      events.push(...stepGame(s, sampler.sample(held(input)), t, { x: 0, w: 512 }, STEP));
    }
  }
  return events;
}
