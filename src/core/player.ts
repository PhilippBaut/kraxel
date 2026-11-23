// Kraxels Bewegung. Fester Schritt, keine Phaser-Abhängigkeit.
import { TILE } from '../config.ts';
import { isOnGround, moveBody } from './collide.ts';
import type { TileGrid } from './grid.ts';
import { DEFAULT_TUNING, jumpGravity, jumpVelocity } from './tuning.ts';
import type { Tuning } from './tuning.ts';
import type { Body, GameEvent, InputFrame } from './types.ts';

export type PlayerMode = 'normal' | 'wallSlide' | 'climb' | 'poundHang' | 'pound' | 'poundRecover' | 'dead' | 'goal';
export type PlayerAnim = 'idle' | 'walk' | 'run' | 'skid' | 'jump' | 'fall' | 'wallSlide' | 'climb' | 'pound' | 'hurt' | 'dead' | 'cheer';

export const PLAYER_W = 10;
export const PLAYER_H = 14;
const SKID_MIN_SPEED = 30;

export interface PlayerState {
  body: Body; facing: -1 | 1; mode: PlayerMode; modeTimer: number;
  grounded: boolean; coyote: number; jumpBuffer: number; jumpRising: boolean;
  runTimer: number; speedCap: number;
  wallDir: -1 | 0 | 1; wallLock: number; climbLeft: number;
  helm: boolean; invuln: number; anim: PlayerAnim; animTime: number;
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
    runTimer: 0, speedCap: DEFAULT_TUNING.walkSpeed,
    wallDir: 0, wallLock: 0, climbLeft: DEFAULT_TUNING.climbBudget,
    helm: false, invuln: 0, anim: 'idle', animTime: 0,
  };
}

/** Bewegt `v` um höchstens `delta` auf `target` zu. */
function approach(v: number, target: number, delta: number): number {
  return v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);
}

export function stepPlayer(p: PlayerState, input: InputFrame, grid: TileGrid, t: Tuning, dt: number): PlayerStepResult {
  const events: GameEvent[] = [];
  const b = p.body;
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

  // Zeitfenster für Coyote Time und Sprungpuffer.
  p.coyote = p.grounded ? t.coyoteTime : Math.max(0, p.coyote - dt);
  p.jumpBuffer = input.jumpPressed ? t.jumpBuffer : Math.max(0, p.jumpBuffer - dt);

  // Rennen: ununterbrochen am Boden in eine Richtung halten. Loslassen oder Umdrehen setzt zurück.
  if (p.grounded) {
    if (dir !== 0 && (b.vx === 0 || Math.sign(b.vx) === dir)) p.runTimer += dt;
    else p.runTimer = 0;
    const ramp = Math.min(1, Math.max(0, (p.runTimer - t.runDelay) / t.runRamp));
    p.speedCap = t.walkSpeed + (t.runSpeed - t.walkSpeed) * ramp;
  }

  // Springen.
  if (p.jumpBuffer > 0 && (p.grounded || p.coyote > 0)) {
    b.vy = -jumpVelocity(t, Math.abs(b.vx) > t.walkSpeed + 1);
    p.speedCap = Math.max(t.walkSpeed, Math.abs(b.vx));
    p.jumpRising = true;
    p.grounded = false;
    p.coyote = 0;
    p.jumpBuffer = 0;
    events.push({ type: 'jump' });
  }
  // Sprung abbrechen: kurz getippt heißt kurz gesprungen (auch bei gepuffertem Sprung).
  if (p.jumpRising && !input.jump && b.vy < -t.jumpCutSpeed) b.vy = -t.jumpCutSpeed;

  // Waagerecht.
  if (dir !== 0 && !(p.grounded && b.vx * dir < -SKID_MIN_SPEED)) p.facing = dir > 0 ? 1 : -1;
  let skidding = false;
  if (p.grounded) {
    if (dir === 0) b.vx = approach(b.vx, 0, t.groundDecel * dt);
    else if (b.vx * dir < 0) {
      skidding = Math.abs(b.vx) > SKID_MIN_SPEED;
      b.vx = approach(b.vx, dir * p.speedCap, t.skidDecel * dt);
    } else {
      const accel = Math.abs(b.vx) > p.speedCap ? t.groundDecel : t.groundAccel;
      b.vx = approach(b.vx, dir * p.speedCap, accel * dt);
    }
  } else if (dir === 0) {
    b.vx = approach(b.vx, 0, t.airDecel * dt);
  } else {
    const accel = b.vx * dir > 0 && Math.abs(b.vx) > p.speedCap ? t.airDecel : t.airAccel;
    b.vx = approach(b.vx, dir * p.speedCap, accel * dt);
  }

  // Schwerkraft.
  let g = jumpGravity(t);
  if (Math.abs(b.vy) < t.apexThreshold && input.jump) g *= t.apexGravityMul;
  else if (b.vy > 0) g *= t.fallGravityMul;
  b.vy = Math.min(b.vy + g * dt, t.maxFallSpeed);

  const res = moveBody(b, dt, grid, t.cornerCorrection);

  const wasGrounded = p.grounded;
  p.grounded = b.vy >= 0 && isOnGround(b, grid);
  if (p.grounded && !wasGrounded) events.push({ type: 'land' });
  if (b.vy >= 0) p.jumpRising = false;

  // Animation.
  p.animTime += dt;
  if (!p.grounded) p.anim = b.vy < 0 ? 'jump' : 'fall';
  else if (skidding) p.anim = 'skid';
  else if (Math.abs(b.vx) < 1) p.anim = 'idle';
  else p.anim = Math.abs(b.vx) > t.walkSpeed + 1 ? 'run' : 'walk';

  return { events, headCells: res.headCells, poundCells: [] };
}
