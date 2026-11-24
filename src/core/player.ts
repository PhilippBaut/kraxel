// Kraxels Bewegung. Fester Schritt, keine Phaser-Abhängigkeit.
import { TILE } from '../config.ts';
import { isOnGround, moveBody, wallAt } from './collide.ts';
import type { TileGrid } from './grid.ts';
import { DEFAULT_TUNING, jumpGravity, jumpVelocity } from './tuning.ts';
import type { Tuning } from './tuning.ts';
import type { Body, GameEvent, InputFrame } from './types.ts';

export type PlayerMode = 'normal' | 'wallSlide' | 'climb' | 'poundHang' | 'pound' | 'poundRecover' | 'dead' | 'goal';
export type PlayerAnim = 'idle' | 'walk' | 'run' | 'skid' | 'jump' | 'fall' | 'wallSlide' | 'climb' | 'pound' | 'hurt' | 'dead' | 'cheer';

export const PLAYER_W = 10;
export const PLAYER_H = 14;
const SKID_MIN_SPEED = 30;
const MANTLE_SPEED_X = 60;
const WALL_LOCK_ACCEL_MUL = 0.3;

export interface PlayerState {
  body: Body; facing: -1 | 1; mode: PlayerMode; modeTimer: number;
  grounded: boolean; coyote: number; jumpBuffer: number; jumpRising: boolean;
  runTimer: number; runDir: -1 | 0 | 1; speedCap: number;
  wallDir: -1 | 0 | 1; wallLock: number; climbLeft: number;
  helm: boolean; invuln: number; anim: PlayerAnim; animTime: number;
  /** Restzeit der Schmerz-Haltung in s (`anim = 'hurt'`). */
  hurtTimer: number;
}

export interface PlayerStepResult {
  events: GameEvent[];
  headCells: Array<[number, number]>;
  poundCells: Array<[number, number]>;
}

/** Füße auf der Unterkante der Zelle, waagerecht mittig. `grounded` wird im ersten Schritt erkannt. */
export function createPlayer(cx: number, cy: number): PlayerState {
  return {
    body: { x: cx * TILE + (TILE - PLAYER_W) / 2, y: (cy + 1) * TILE - PLAYER_H, w: PLAYER_W, h: PLAYER_H, vx: 0, vy: 0 },
    facing: 1, mode: 'normal', modeTimer: 0,
    grounded: false, coyote: 0, jumpBuffer: 0, jumpRising: false,
    runTimer: 0, runDir: 0, speedCap: DEFAULT_TUNING.walkSpeed,
    wallDir: 0, wallLock: 0, climbLeft: DEFAULT_TUNING.climbBudget,
    helm: false, invuln: 0, anim: 'idle', animTime: 0, hurtTimer: 0,
  };
}

/** Bewegt `v` um höchstens `delta` auf `target` zu. */
function approach(v: number, target: number, delta: number): number {
  return v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);
}

export function stepPlayer(p: PlayerState, input: InputFrame, grid: TileGrid, t: Tuning, dt: number): PlayerStepResult {
  const events: GameEvent[] = [];
  const poundCells: Array<[number, number]> = [];
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  p.animTime += dt;
  p.invuln = Math.max(0, p.invuln - dt);
  p.hurtTimer = Math.max(0, p.hurtTimer - dt);
  p.jumpBuffer = input.jumpPressed ? t.jumpBuffer : Math.max(0, p.jumpBuffer - dt);

  let headCells: Array<[number, number]> = [];
  switch (p.mode) {
    case 'poundHang': stepPoundHang(p, grid, t, dt, events, poundCells); break;
    case 'pound': stepPound(p, grid, t, dt, events, poundCells); break;
    case 'poundRecover':
      if (!stepPoundRecover(p, dt)) break;
      headCells = stepFree(p, input, dir, grid, t, dt, events);
      break;
    case 'dead': case 'goal': break;
    default: headCells = stepFree(p, input, dir, grid, t, dt, events);
  }
  if (p.hurtTimer > 0 && p.mode !== 'dead') p.anim = 'hurt';
  return { events, headCells, poundCells };
}

/** normal, wallSlide und climb: alles, was Kraxel nicht in einer Stampf-Phase ist. */
function stepFree(p: PlayerState, input: InputFrame, dir: number, grid: TileGrid, t: Tuning, dt: number, events: GameEvent[]): Array<[number, number]> {
  const b = p.body;
  p.coyote = p.grounded ? t.coyoteTime : Math.max(0, p.coyote - dt);
  p.wallLock = Math.max(0, p.wallLock - dt);
  if (p.grounded) {
    p.climbLeft = t.climbBudget;
    updateRun(p, dir, t, dt);
  }

  // Modus für diesen Schritt bestimmen: Kraxeln vor Wandrutschen vor normal.
  const prevMode = p.mode;
  const climbDir = dir !== 0 ? dir : p.facing;
  if (input.up && p.climbLeft > 0 && wallAt(b, grid, climbDir as -1 | 1)) {
    p.mode = 'climb';
    p.wallDir = climbDir as -1 | 1;
  } else {
    const leftClimb = prevMode === 'climb';
    if (leftClimb && b.vy < 0) b.vy = 0;
    if (!p.grounded && dir !== 0 && (b.vy > 0 || leftClimb) && wallAt(b, grid, dir as -1 | 1)) {
      p.mode = 'wallSlide';
      p.wallDir = dir as -1 | 1;
    } else {
      p.mode = 'normal';
      if (p.wallLock <= 0) p.wallDir = 0;
    }
  }

  // Stampfen: nur frei in der Luft. Der Wechsel passiert vor der Bewegung.
  if (p.mode === 'normal' && !p.grounded && input.downPressed && !isOnGround(b, grid)) {
    startPound(p, t, events);
    return [];
  }

  // Springen: Boden vor Wand.
  let overrideVx = false;
  if (tryJump(p, t, events)) p.mode = 'normal'; // Bodensprung hat Vorrang vor Kraxeln
  else if (p.jumpBuffer > 0 && (p.mode === 'wallSlide' || p.mode === 'climb')) {
    wallJump(p, t, events);
    overrideVx = true;
  }
  if (p.jumpRising && !input.jump && b.vy < -t.jumpCutSpeed) b.vy = -t.jumpCutSpeed;

  // Kraxeln: am Rand der Wand hochhieven, sonst mit festem Tempo steigen.
  let skidding = false;
  if (p.mode === 'climb') {
    if (wallCellFreeAtMid(p, grid)) {
      b.vy = -t.mantleSpeedY;
      b.vx = p.wallDir * MANTLE_SPEED_X;
      p.facing = p.wallDir as -1 | 1;
      p.mode = 'normal';
    } else {
      b.vx = 0;
      b.vy = -Math.min(t.climbSpeed, p.climbLeft / dt);
      p.facing = p.wallDir as -1 | 1;
    }
  }
  if (p.mode !== 'climb') {
    if (!overrideVx) skidding = moveHorizontal(p, dir, t, dt);
    applyGravity(p, input, t, dt);
    if (p.mode === 'wallSlide') b.vy = Math.min(b.vy, t.wallSlideSpeed);
  }

  const y0 = b.y;
  const res = moveBody(b, dt, grid, t.cornerCorrection);
  if (p.mode === 'climb') {
    p.climbLeft = Math.max(0, p.climbLeft - (y0 - b.y));
    if (p.climbLeft < 1e-6) p.climbLeft = 0;
    if (res.up) { // Decke über dem Kletterweg: Kraft weg, Klettern endet (vy ist nach dem Stoß 0)
      p.climbLeft = 0;
      p.mode = 'normal';
    }
  }

  const wasGrounded = p.grounded;
  p.grounded = b.vy >= 0 && isOnGround(b, grid);
  if (p.grounded && !wasGrounded) events.push({ type: 'land' });
  if (b.vy >= 0) p.jumpRising = false;
  if (p.grounded && p.mode === 'wallSlide') p.mode = 'normal';

  // Animation.
  if (p.mode === 'climb') p.anim = 'climb';
  else if (p.mode === 'wallSlide') p.anim = 'wallSlide';
  else if (!p.grounded) p.anim = b.vy < 0 ? 'jump' : 'fall';
  else if (skidding) p.anim = 'skid';
  else if (Math.abs(b.vx) < 1) p.anim = 'idle';
  else p.anim = Math.abs(b.vx) > t.walkSpeed + 1 ? 'run' : 'walk';

  return res.headCells;
}

/** Rennen: ununterbrochen am Boden in eine Richtung halten. Loslassen oder Umdrehen setzt zurück. */
function updateRun(p: PlayerState, dir: number, t: Tuning, dt: number): void {
  const vx = p.body.vx;
  if (dir !== p.runDir) p.runTimer = 0;
  p.runDir = dir as -1 | 0 | 1;
  if (dir !== 0 && (vx === 0 || Math.sign(vx) === dir)) p.runTimer += dt;
  else p.runTimer = 0;
  const ramp = Math.min(1, Math.max(0, (p.runTimer - t.runDelay) / t.runRamp));
  p.speedCap = t.walkSpeed + (t.runSpeed - t.walkSpeed) * ramp;
}

function tryJump(p: PlayerState, t: Tuning, events: GameEvent[]): boolean {
  if (p.jumpBuffer <= 0 || !(p.grounded || p.coyote > 0)) return false;
  const b = p.body;
  b.vy = -jumpVelocity(t, Math.abs(b.vx) > t.walkSpeed + 1);
  p.speedCap = Math.max(t.walkSpeed, Math.abs(b.vx));
  p.jumpRising = true;
  p.grounded = false;
  p.coyote = 0;
  p.jumpBuffer = 0;
  events.push({ type: 'jump' });
  return true;
}

/** Stößt von der Wand ab. Die Werte überschreiben die Beschleunigung dieses Schritts. */
function wallJump(p: PlayerState, t: Tuning, events: GameEvent[]): void {
  const b = p.body;
  const away = -p.wallDir as -1 | 1;
  b.vx = away * t.wallJumpSpeedX;
  b.vy = -t.wallJumpSpeedY;
  p.facing = away;
  p.wallLock = t.wallJumpLock;
  p.mode = 'normal';
  p.jumpRising = true;
  p.jumpBuffer = 0;
  p.speedCap = Math.max(t.walkSpeed, t.wallJumpSpeedX);
  events.push({ type: 'wallJump' });
}

/** Steuerung nach links/rechts. Gibt zurück, ob Kraxel gerade bremsend umdreht. */
function moveHorizontal(p: PlayerState, dir: number, t: Tuning, dt: number): boolean {
  const b = p.body;
  const locked = p.wallLock > 0 && dir === p.wallDir; // kurz nach dem Wandsprung kaum zur alten Wand zurück
  if (dir !== 0 && !locked && !(p.grounded && b.vx * dir < -SKID_MIN_SPEED)) p.facing = dir > 0 ? 1 : -1;
  if (p.grounded) {
    if (dir === 0) b.vx = approach(b.vx, 0, t.groundDecel * dt);
    else if (b.vx * dir < 0) {
      const skidding = Math.abs(b.vx) > SKID_MIN_SPEED;
      b.vx = approach(b.vx, dir * p.speedCap, t.skidDecel * dt);
      return skidding;
    } else {
      const accel = Math.abs(b.vx) > p.speedCap ? t.groundDecel : t.groundAccel;
      b.vx = approach(b.vx, dir * p.speedCap, accel * dt);
    }
  } else if (dir === 0) {
    b.vx = approach(b.vx, 0, t.airDecel * dt);
  } else {
    let accel = b.vx * dir > 0 && Math.abs(b.vx) > p.speedCap ? t.airDecel : t.airAccel;
    if (locked) accel *= WALL_LOCK_ACCEL_MUL;
    b.vx = approach(b.vx, dir * p.speedCap, accel * dt);
  }
  return false;
}

function applyGravity(p: PlayerState, input: InputFrame, t: Tuning, dt: number): void {
  const b = p.body;
  let g = jumpGravity(t);
  if (Math.abs(b.vy) < t.apexThreshold && input.jump) g *= t.apexGravityMul;
  else if (b.vy > 0) g *= t.fallGravityMul;
  b.vy = Math.min(b.vy + g * dt, t.maxFallSpeed);
}

/** Ist die Wandzelle auf Höhe der Körpermitte frei, ist die Wand zu Ende. */
function wallCellFreeAtMid(p: PlayerState, grid: TileGrid): boolean {
  const b = p.body;
  const px = p.wallDir > 0 ? b.x + b.w + 0.5 : b.x - 0.5;
  return !grid.isSolid(Math.floor(px / TILE), Math.floor((b.y + b.h / 2) / TILE));
}

function startPound(p: PlayerState, t: Tuning, events: GameEvent[]): void {
  p.mode = 'poundHang';
  p.modeTimer = t.poundHang;
  p.body.vx = 0;
  p.body.vy = 0;
  p.jumpRising = false;
  p.anim = 'pound';
  events.push({ type: 'pound' });
}

/** Innehalten in der Luft. Danach geht es ohne Pause in den Fall über. */
function stepPoundHang(p: PlayerState, grid: TileGrid, t: Tuning, dt: number, events: GameEvent[], poundCells: Array<[number, number]>): void {
  p.modeTimer -= dt;
  p.anim = 'pound';
  if (p.modeTimer > 1e-9) return;
  p.mode = 'pound';
  stepPound(p, grid, t, dt, events, poundCells);
}

/** Schneller Fall ohne Begrenzung und ohne Seitensteuerung bis zur Landung. */
function stepPound(p: PlayerState, grid: TileGrid, t: Tuning, dt: number, events: GameEvent[], poundCells: Array<[number, number]>): void {
  const b = p.body;
  b.vx = 0;
  b.vy = t.poundSpeed;
  p.anim = 'pound';
  const res = moveBody(b, dt, grid, 0);
  if (!res.down) return;
  const row = Math.round((b.y + b.h) / TILE);
  for (let cx = Math.floor(b.x / TILE); cx <= Math.floor((b.x + b.w - 1e-9) / TILE); cx++) {
    if (grid.isSolid(cx, row)) poundCells.push([cx, row]);
  }
  events.push({ type: 'poundLand', x: b.x + b.w / 2, y: b.y + b.h });
  p.mode = 'poundRecover';
  p.modeTimer = t.poundRecover;
  p.grounded = true;
  p.climbLeft = t.climbBudget;
}

/** Kurze Erholung am Boden. Gibt true zurück, wenn sie in diesem Schritt endet. */
function stepPoundRecover(p: PlayerState, dt: number): boolean {
  p.modeTimer -= dt;
  p.body.vx = 0;
  p.body.vy = 0;
  p.anim = 'pound';
  if (p.modeTimer > 1e-9) return false;
  p.mode = 'normal';
  return true;
}
