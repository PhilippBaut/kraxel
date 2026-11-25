// Spielzustand und der feste Spielschritt.
import { CRYSTALS_PER_LIFE, START_LIVES, STEP, TILE } from '../config.ts';
import { createEnemy, resolvePlayerEnemies, stepEnemies } from './enemies.ts';
import type { EnemyState } from './enemies.ts';
import { hitCell, primaryCell, stepBlocks } from './blocks.ts';
import { TileGrid } from './grid.ts';
import type { LevelData } from './level.ts';
import { overlaps } from './collide.ts';
import { createPlayer, stepPlayer } from './player.ts';
import type { PlayerState } from './player.ts';
import { collectPickups, createPickup, stepPickups } from './pickups.ts';
import type { PickupState } from './pickups.ts';
import { jumpGravity } from './tuning.ts';
import type { Tuning } from './tuning.ts';
import type { CrateContent, GameEvent, InputFrame } from './types.ts';

export type Phase = 'playing' | 'dying' | 'goal' | 'gameOver';
export interface Session { lives: number; crystals: number; time: number; edelweiss: [boolean, boolean, boolean] }
export interface GameState {
  level: LevelData; grid: TileGrid; crates: Map<number, CrateContent>;
  multi: Map<number, { left: number; timer: number }>;
  player: PlayerState; pickups: PickupState[]; enemies: EnemyState[];
  /** Fußhöhe (Unterkante) des Spielers vor dem letzten Schritt, fürs Draufspringen. */
  playerPrevBottom: number;
  checkpoint: number; phase: Phase; phaseTimer: number; session: Session; startSession: Session;
}
const HURT_ANIM_TIME = 0.3;
/** Das Gipfelkreuz ist 5 Kacheln hoch; so hoch reicht auch die Zielzone. */
export const GOAL_HEIGHT_TILES = 5;
export const DYING_TIME = 1.2;
export const GOAL_TIME = 1.5;
/** Ab dieser Fußhöhe (in Kacheln über der Zellunterkante) gibt es ein Extraleben statt Kristallen. */
const EXTRA_LIFE_HEIGHT = 4.5;
const DEATH_JUMP = 300;
export interface ViewWindow { x: number; w: number }

export function createSession(): Session {
  return { lives: START_LIVES, crystals: 0, time: 0, edelweiss: [false, false, false] };
}

function copySession(s: Session): Session {
  return { ...s, edelweiss: [...s.edelweiss] };
}

/** Edelweiß, das schon gesammelt ist, erscheint nicht wieder. */
function initialPickups(level: LevelData, session: Session): PickupState[] {
  return level.spawns
    .filter((sp) => sp.kind === 'crystal' || (sp.kind === 'edelweiss' && !session.edelweiss[sp.index]))
    .map(createPickup);
}

function initialEnemies(level: LevelData): EnemyState[] {
  return level.spawns.filter((sp) => sp.kind === 'beetle' || sp.kind === 'snail').map(createEnemy);
}

/** `session` wird als laufender Stand benutzt; `startSession` merkt sich eine Kopie vom Levelanfang. */
export function createGame(level: LevelData, session: Session = createSession()): GameState {
  return {
    level, grid: TileGrid.fromLevel(level), crates: new Map(level.crates), multi: new Map(),
    player: createPlayer(level.start.cx, level.start.cy),
    pickups: initialPickups(level, session), enemies: initialEnemies(level),
    playerPrevBottom: 0,
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

/** Kraxel stirbt: Sprung nach oben, dann Fall ohne Kollision. Ein Leben weniger. */
export function killPlayer(s: GameState): GameEvent[] {
  const p = s.player;
  s.phase = 'dying';
  s.phaseTimer = DYING_TIME;
  p.mode = 'dead';
  p.anim = 'dead';
  p.grounded = false;
  p.body.vx = 0;
  p.body.vy = -DEATH_JUMP;
  s.session.lives -= 1;
  return [{ type: 'death' }];
}

/** Raster, Kisten, Gegner und Pickups wie beim Levelstart; Kraxel am letzten Steinmännchen, ohne Helm. `session` bleibt. */
export function respawn(s: GameState): void {
  const { level } = s;
  s.grid = TileGrid.fromLevel(level);
  s.crates = new Map(level.crates);
  s.multi = new Map();
  s.pickups = initialPickups(level, s.session);
  s.enemies = initialEnemies(level);
  const cp = level.spawns.find((sp) => sp.kind === 'checkpoint' && sp.index === s.checkpoint);
  s.player = cp ? createPlayer(cp.cx, cp.cy) : createPlayer(level.start.cx, level.start.cy);
  s.playerPrevBottom = s.player.body.y + s.player.body.h;
  s.phase = 'playing';
  s.phaseTimer = 0;
}

/** Zurück zum Levelanfang: Sitzung vom Start, kein Steinmännchen, Zeit 0. */
export function restartLevel(s: GameState): void {
  s.session = copySession(s.startSession);
  s.session.time = 0;
  s.checkpoint = -1;
  respawn(s);
}

/** Mit Helm: Helm weg und kurze Schonzeit. Ohne Helm: Tod. */
export function damagePlayer(s: GameState, t: Tuning): GameEvent[] {
  const p = s.player;
  if (p.helm) {
    p.helm = false;
    p.invuln = t.hurtInvuln;
    p.hurtTimer = HURT_ANIM_TIME;
    p.anim = 'hurt';
    return [{ type: 'hurt' }];
  }
  return [{ type: 'hurt' }, ...killPlayer(s)];
}

/** Steinmännchen berühren: höherer Index als `checkpoint` wird neuer Neustartpunkt. */
function touchCheckpoints(s: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  for (const sp of s.level.spawns) {
    if (sp.kind !== 'checkpoint' || sp.index <= s.checkpoint) continue;
    if (!overlaps(s.player.body, { x: sp.cx * TILE, y: sp.cy * TILE, w: TILE, h: TILE })) continue;
    s.checkpoint = sp.index;
    events.push({ type: 'checkpoint', index: sp.index });
  }
  return events;
}

/** Zielzone: die Spalte des Z, von der Zellunterkante 5 Kacheln hoch. Höhere Berührung gibt mehr. */
function touchGoal(s: GameState): GameEvent[] {
  const sp = s.level.spawns.find((e) => e.kind === 'goal');
  if (!sp) return [];
  const bottom = (sp.cy + 1) * TILE, b = s.player.body;
  if (!overlaps(b, { x: sp.cx * TILE, y: bottom - GOAL_HEIGHT_TILES * TILE, w: TILE, h: GOAL_HEIGHT_TILES * TILE })) return [];
  const h = (bottom - (b.y + b.h)) / TILE;
  const extraLife = h >= EXTRA_LIFE_HEIGHT;
  const bonusCrystals = extraLife ? 0 : 1 + Math.floor(Math.max(0, h));
  const events: GameEvent[] = [];
  if (extraLife) {
    s.session.lives += 1;
    events.push({ type: 'extraLife' });
  } else events.push(...addCrystals(s, bonusCrystals));
  s.phase = 'goal';
  s.phaseTimer = GOAL_TIME;
  s.player.mode = 'goal';
  s.player.anim = 'cheer';
  s.player.body.vx = 0;
  s.player.body.vy = 0;
  events.push({ type: 'goal', bonusCrystals, extraLife });
  return events;
}

/** Tod: nur der Fall der toten Kraxel läuft. Danach Game Over oder Neustart. */
function stepDying(s: GameState, t: Tuning, dt: number): GameEvent[] {
  const b = s.player.body;
  b.vy = Math.min(b.vy + jumpGravity(t) * t.fallGravityMul * dt, t.maxFallSpeed);
  b.y += b.vy * dt;
  s.phaseTimer -= dt;
  if (s.phaseTimer > 1e-9) return [];
  if (s.session.lives <= 0) {
    s.phase = 'gameOver';
    return [{ type: 'gameOver' }];
  }
  respawn(s);
  return [{ type: 'respawn' }];
}

export function stepGame(s: GameState, input: InputFrame, t: Tuning, view: ViewWindow, dt: number = STEP): GameEvent[] {
  if (s.phase === 'dying') return stepDying(s, t, dt);
  if (s.phase === 'goal') {
    s.player.animTime += dt;
    s.phaseTimer = Math.max(0, s.phaseTimer - dt);
    return [];
  }
  if (s.phase !== 'playing') return [];
  s.playerPrevBottom = s.player.body.y + s.player.body.h;
  const r = stepPlayer(s.player, input, s.grid, t, dt);
  const events = [...r.events];
  const head = primaryCell(s.player.body, r.headCells);
  if (head) events.push(...hitCell(s, head[0], head[1], 'below'));
  const pound = primaryCell(s.player.body, r.poundCells);
  if (pound) events.push(...hitCell(s, pound[0], pound[1], 'above'));
  stepBlocks(s, dt);
  stepPickups(s.pickups, s.grid, dt);
  stepEnemies(s.enemies, s.grid, view, dt);
  events.push(...resolvePlayerEnemies(s, input, t));
  if (s.phase !== 'playing') return events; // gestorben: nichts mehr einsammeln
  events.push(...collectPickups(s));
  s.session.time += dt;
  if (s.player.body.y > s.grid.height * TILE + TILE) return [...events, ...killPlayer(s)];
  events.push(...touchCheckpoints(s));
  events.push(...touchGoal(s));
  return events;
}
