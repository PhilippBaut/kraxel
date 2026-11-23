// Spielzustand und der feste Spielschritt.
import { CRYSTALS_PER_LIFE, START_LIVES, STEP, TILE } from '../config.ts';
import { hitCell, primaryCell, stepBlocks } from './blocks.ts';
import { TileGrid } from './grid.ts';
import type { LevelData } from './level.ts';
import { createPlayer, stepPlayer } from './player.ts';
import type { PlayerState } from './player.ts';
import { collectPickups, createPickup, stepPickups } from './pickups.ts';
import type { PickupState } from './pickups.ts';
import type { Tuning } from './tuning.ts';
import type { CrateContent, GameEvent, InputFrame } from './types.ts';

export type Phase = 'playing' | 'dying' | 'goal' | 'gameOver';
export interface Session { lives: number; crystals: number; time: number; edelweiss: [boolean, boolean, boolean] }
export interface GameState {
  level: LevelData; grid: TileGrid; crates: Map<number, CrateContent>;
  multi: Map<number, { left: number; timer: number }>;
  player: PlayerState; pickups: PickupState[];
  checkpoint: number; phase: Phase; phaseTimer: number; session: Session; startSession: Session;
}
export interface ViewWindow { x: number; w: number }

export function createSession(): Session {
  return { lives: START_LIVES, crystals: 0, time: 0, edelweiss: [false, false, false] };
}

function copySession(s: Session): Session {
  return { ...s, edelweiss: [...s.edelweiss] };
}

/** `session` wird als laufender Stand benutzt; `startSession` merkt sich eine Kopie vom Levelanfang. */
export function createGame(level: LevelData, session: Session = createSession()): GameState {
  return {
    level, grid: TileGrid.fromLevel(level), crates: new Map(level.crates), multi: new Map(),
    player: createPlayer(level.start.cx, level.start.cy),
    pickups: level.spawns.filter((sp) => sp.kind === 'crystal' || sp.kind === 'edelweiss').map(createPickup),
    checkpoint: -1, phase: 'playing', phaseTimer: 0, session, startSession: copySession(session),
  };
}

/** 100 Kristalle ergeben ein Extraleben. */
export function addCrystals(s: GameState, n: number): GameEvent[] {
  const events: GameEvent[] = [];
  s.session.crystals += n;
  while (s.session.crystals >= CRYSTALS_PER_LIFE) {
    s.session.crystals -= CRYSTALS_PER_LIFE;
    s.session.lives += 1;
    events.push({ type: 'extraLife' });
  }
  return events;
}

/** Vorläufig (Task 13 ersetzt das durch Tod und Leben): Wer unter das Level fällt, kommt zurück an den Start. */
function provisionalPitRespawn(s: GameState): void {
  if (s.player.body.y <= s.level.height * TILE) return;
  const helm = s.player.helm;
  s.player = createPlayer(s.level.start.cx, s.level.start.cy);
  s.player.helm = helm;
}

export function stepGame(s: GameState, input: InputFrame, t: Tuning, _view: ViewWindow, dt: number = STEP): GameEvent[] {
  if (s.phase !== 'playing') return [];
  const r = stepPlayer(s.player, input, s.grid, t, dt);
  const events = [...r.events];
  const head = primaryCell(s.player.body, r.headCells);
  if (head) events.push(...hitCell(s, head[0], head[1], 'below'));
  const pound = primaryCell(s.player.body, r.poundCells);
  if (pound) events.push(...hitCell(s, pound[0], pound[1], 'above'));
  stepBlocks(s, dt);
  stepPickups(s.pickups, s.grid, dt);
  events.push(...collectPickups(s));
  s.session.time += dt;
  provisionalPitRespawn(s);
  return events;
}
