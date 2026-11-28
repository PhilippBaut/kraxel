// Spielzustand und der feste Spielschritt.
import { CRYSTALS_PER_LIFE, START_LIVES, STEP, TILE } from '../config.ts';
import { createEnemy, resolvePlayerEnemies, stepEnemies } from './enemies.ts';
import type { EnemyState } from './enemies.ts';
import { hitCell, primaryCell, stepBlocks } from './blocks.ts';
import { TileGrid } from './grid.ts';
import type { EntitySpawn, LevelData } from './level.ts';
import type { ExitKind } from './save.ts';
import { inWater, isOnGround, moveBody, overlaps } from './collide.ts';
import { carryBody, createPlatforms, standingOn, stepPlatforms } from './platforms.ts';
import type { PlatformState } from './platforms.ts';
import { createPlayer, stepPlayer } from './player.ts';
import type { PlayerState } from './player.ts';
import { collectPickups, createPickup, stepPickups } from './pickups.ts';
import type { PickupState } from './pickups.ts';
import { shoot, stepPebbles } from './pebbles.ts';
import { createRocks, stepRocks } from './rockfall.ts';
import type { FallingRock } from './rockfall.ts';
import type { Pebble } from './pebbles.ts';
import { jumpGravity } from './tuning.ts';
import type { Tuning } from './tuning.ts';
import { Cell } from './types.ts';
import type { Body, CrateContent, GameEvent, InputFrame, SpecialItem } from './types.ts';

export type Phase = 'playing' | 'dying' | 'goal' | 'gameOver';
export interface Session { lives: number; crystals: number; time: number; edelweiss: [boolean, boolean, boolean] }
export interface GameState {
  level: LevelData; grid: TileGrid; crates: Map<number, CrateContent>;
  multi: Map<number, { left: number; timer: number }>;
  player: PlayerState; pickups: PickupState[]; enemies: EnemyState[];
  /** Bewegte Plattformen; ihre Lage ändert sich in jedem Schritt (`stepPlatforms`). */
  platforms: PlatformState[];
  /** Fußhöhe (Unterkante) des Spielers vor dem letzten Schritt, fürs Draufspringen. */
  playerPrevBottom: number;
  checkpoint: number; phase: Phase; phaseTimer: number; session: Session; startSession: Session;
  /** Ob Kraxel mit Helm ins Level kam; `restartLevel` stellt das wieder her. */
  startHelm: boolean;
  /** Spezial-Item beim Levelstart; `restartLevel` stellt es wieder her. */
  startSpecial: SpecialItem | null;
  /** Fliegende Kiesel der Schleuder und die Abklingzeit bis zum nächsten Schuss. */
  pebbles: Pebble[]; pebbleCooldown: number;
  /** Brocken an der Decke (Steinschlag). */
  rocks: FallingRock[];
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

/** `session` wird als laufender Stand benutzt; `startSession` merkt sich eine Kopie vom Levelanfang.
 *  `opts.helm`: Kraxel startet mit Helm (aus der Spielrunde). */
export function createGame(level: LevelData, session: Session = createSession(), opts: { helm?: boolean; special?: SpecialItem | null } = {}): GameState {
  const state: GameState = {
    level, grid: TileGrid.fromLevel(level), crates: new Map(level.crates), multi: new Map(),
    player: createPlayer(level.start.cx, level.start.cy),
    pickups: initialPickups(level, session), enemies: initialEnemies(level), platforms: createPlatforms(level.platforms),
    playerPrevBottom: 0, pebbles: [], pebbleCooldown: 0, rocks: createRocks(level.spawns),
    checkpoint: -1, phase: 'playing', phaseTimer: 0, session, startSession: copySession(session),
    startHelm: opts.helm === true || (opts.special ?? null) !== null, startSpecial: opts.special ?? null,
  };
  state.player.helm = state.startHelm;
  state.player.special = state.startSpecial;
  return state;
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
  s.pebbles = [];
  s.pebbleCooldown = 0;
  return [{ type: 'death' }];
}

/** Raster, Kisten, Gegner und Pickups wie beim Levelstart; Kraxel am letzten Steinmännchen, ohne Helm und Spezial-Item (`restartLevel` stellt beide vom Levelbeginn wieder her). `session` bleibt. */
export function respawn(s: GameState): void {
  const { level } = s;
  s.grid = TileGrid.fromLevel(level);
  s.crates = new Map(level.crates);
  s.multi = new Map();
  s.pickups = initialPickups(level, s.session);
  s.enemies = initialEnemies(level);
  s.platforms = createPlatforms(level.platforms);
  s.rocks = createRocks(level.spawns);
  s.pebbles = [];
  s.pebbleCooldown = 0;
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
  s.player.helm = s.startHelm;
  s.player.special = s.startSpecial;
}

/** Reihenfolge: Enzian (kein Schaden), Spezial-Item weg, Helm weg (jeweils mit Schonzeit), sonst Tod. */
export function damagePlayer(s: GameState, t: Tuning): GameEvent[] {
  const p = s.player;
  if (p.enzian > 0) return [];
  if (p.special !== null || p.helm) {
    if (p.special !== null) p.special = null;
    else p.helm = false;
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

/** Zielzone: die Spalte von Z oder G, von der Zellunterkante 5 Kacheln hoch. Höhere Berührung gibt mehr.
 *  Wer zuerst berührt wird, beendet das Level; Z meldet `normal`, G `secret`. */
function touchGoal(s: GameState): GameEvent[] {
  for (const sp of s.level.spawns) {
    if (sp.kind !== 'goal' && sp.kind !== 'secretGoal') continue;
    const events = touchGoalAt(s, sp, sp.kind === 'secretGoal' ? 'secret' : 'normal');
    if (events.length) return events;
  }
  return [];
}

function touchGoalAt(s: GameState, sp: EntitySpawn, exit: ExitKind): GameEvent[] {
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
  s.player.invuln = 0; // stepGoal zählt invuln nicht herunter, die Schonzeit-Blinkerei würde Kraxel unsichtbar lassen
  s.player.anim = 'cheer';
  s.player.body.vx = 0;
  s.player.body.vy = 0;
  events.push({ type: 'goal', bonusCrystals, extraLife, exit });
  return events;
}

/** Ziel: Kraxel bekommt keine Eingabe, fällt aber mit Schwerkraft und Kollision bis zum Boden und jubelt. */
function stepGoal(s: GameState, t: Tuning, dt: number): void {
  const p = s.player, b = p.body;
  p.animTime += dt;
  s.phaseTimer = Math.max(0, s.phaseTimer - dt);
  b.vx = 0;
  b.vy = Math.min(b.vy + jumpGravity(t) * t.fallGravityMul * dt, t.maxFallSpeed);
  moveBody(b, dt, s.grid, 0, s.platforms);
  p.grounded = isOnGround(b, s.grid, s.platforms);
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

/** Stampf-Landung: jeder Felsblock unter dem Körper bricht, von den Kisten (und allem anderen) nur die Hauptzelle.
 *  Bleibt danach nichts Festes unter den Füßen, fällt Kraxel weiter statt in der Luft zu stehen. */
function hitPoundCells(s: GameState, cells: Array<[number, number]>): GameEvent[] {
  if (cells.length === 0) return [];
  const events: GameEvent[] = [];
  const rocks = cells.filter(([cx, cy]) => s.grid.get(cx, cy) === Cell.Rock);
  const others = cells.filter(([cx, cy]) => s.grid.get(cx, cy) !== Cell.Rock);
  for (const [cx, cy] of rocks) events.push(...hitCell(s, cx, cy, 'above'));
  const main = primaryCell(s.player.body, others);
  if (main) events.push(...hitCell(s, main[0], main[1], 'above'));
  const p = s.player;
  if (p.mode === 'poundRecover' && !isOnGround(p.body, s.grid, s.platforms)) {
    p.mode = 'pound';
    p.grounded = false;
  }
  return events;
}

/** Enzian läuft ab: danach gilt die normale Schonzeit, damit ein Gegner unter Kraxel nicht sofort trifft. */
function stepEnzian(s: GameState, t: Tuning, dt: number): GameEvent[] {
  const p = s.player;
  if (p.enzian <= 0) return [];
  p.enzian = Math.max(0, p.enzian - dt);
  if (p.enzian > 1e-9) return [];
  p.enzian = 0;
  p.invuln = Math.max(p.invuln, t.hurtInvuln);
  return [{ type: 'enzianEnd' }];
}

/** Plattformen fahren einen Schritt und nehmen mit, was vorher darauf stand: Kraxel, Gegner, Items. Das Mitnehmen läuft über `moveBody`, Wände und Decken blocken also. */
function stepPlatformsAndRiders(s: GameState, dt: number): void {
  if (s.platforms.length === 0) return;
  const p = s.player;
  const bodies: Body[] = [];
  if (p.body.vy >= 0 && p.mode !== 'dead' && p.mode !== 'goal') bodies.push(p.body);
  for (const e of s.enemies) if (e.alive) bodies.push(e.body);
  for (const it of s.pickups) if (it.kind === 'item' && !it.taken && it.emerge <= 0) bodies.push(it.body);
  const riding = bodies.map((b) => standingOn(b, s.platforms)); // mit der Lage vor der Fahrt
  stepPlatforms(s.platforms, dt);
  bodies.forEach((b, i) => {
    const pl = riding[i];
    if (pl) carryBody(b, pl, s.grid);
  });
}

export function stepGame(s: GameState, input: InputFrame, t: Tuning, view: ViewWindow, dt: number = STEP): GameEvent[] {
  if (s.phase === 'dying') return stepDying(s, t, dt);
  if (s.phase === 'goal') {
    stepGoal(s, t, dt);
    return [];
  }
  if (s.phase !== 'playing') return [];
  stepPlatformsAndRiders(s, dt);
  s.playerPrevBottom = s.player.body.y + s.player.body.h;
  const r = stepPlayer(s.player, input, s.grid, t, dt, s.platforms);
  const events = [...r.events];
  const head = primaryCell(s.player.body, r.headCells);
  if (head) events.push(...hitCell(s, head[0], head[1], 'below'));
  events.push(...hitPoundCells(s, r.poundCells));
  stepBlocks(s, dt);
  events.push(...stepEnzian(s, t, dt));
  stepPickups(s.pickups, s.grid, dt, s.platforms);
  stepEnemies(s.enemies, s.grid, view, dt, s.platforms);
  if (input.actionPressed) events.push(...shoot(s));
  events.push(...stepPebbles(s, dt));
  events.push(...resolvePlayerEnemies(s, input, t));
  if (s.phase === 'playing') events.push(...stepRocks(s, dt, t));
  if (s.phase !== 'playing') return events; // gestorben: nichts mehr einsammeln
  if (inWater(s.player.body, s.grid)) return [...events, ...killPlayer(s)]; // Bach: tödlich wie eine Grube, Enzian und Schonzeit helfen nicht
  events.push(...collectPickups(s));
  s.session.time += dt;
  if (s.player.body.y > s.grid.height * TILE + TILE) return [...events, ...killPlayer(s)];
  events.push(...touchCheckpoints(s));
  events.push(...touchGoal(s));
  return events;
}
