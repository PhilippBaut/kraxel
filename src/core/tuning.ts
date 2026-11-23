// Alle Spielgefühl-Werte an einem Ort. px, px/s, Sekunden. Kein Phaser, kein DOM.
import type { KeyValueStore } from './types.ts';

export interface Tuning {
  walkSpeed: number; runSpeed: number; runDelay: number; runRamp: number;
  groundAccel: number; groundDecel: number; skidDecel: number; airAccel: number; airDecel: number;
  jumpHeight: number; runJumpHeight: number; timeToApex: number; jumpCutSpeed: number;
  fallGravityMul: number; apexGravityMul: number; apexThreshold: number; maxFallSpeed: number;
  coyoteTime: number; jumpBuffer: number; cornerCorrection: number;
  wallSlideSpeed: number; wallJumpSpeedX: number; wallJumpSpeedY: number; wallJumpLock: number;
  climbSpeed: number; climbBudget: number; mantleSpeedY: number;
  poundHang: number; poundSpeed: number; poundRecover: number;
  stompBounce: number; stompBounceHeld: number; hurtInvuln: number;
}

export const DEFAULT_TUNING: Readonly<Tuning> = {
  walkSpeed: 96, runSpeed: 152, runDelay: 0.6, runRamp: 0.4,
  groundAccel: 600, groundDecel: 900, skidDecel: 1400, airAccel: 450, airDecel: 200,
  jumpHeight: 64, runJumpHeight: 80, timeToApex: 0.38, jumpCutSpeed: 206,
  fallGravityMul: 1.6, apexGravityMul: 0.5, apexThreshold: 40, maxFallSpeed: 270,
  coyoteTime: 0.1, jumpBuffer: 0.12, cornerCorrection: 4,
  wallSlideSpeed: 60, wallJumpSpeedX: 140, wallJumpSpeedY: 300, wallJumpLock: 0.15,
  climbSpeed: 80, climbBudget: 32, mantleSpeedY: 150,
  poundHang: 0.15, poundSpeed: 420, poundRecover: 0.12,
  stompBounce: 250, stompBounceHeld: 340, hurtInvuln: 1.5,
};

/** Schwerkraft so, dass ein Sprung `jumpHeight` hoch ist und `timeToApex` bis zum Scheitel braucht. */
export function jumpGravity(t: Tuning): number {
  return (2 * t.jumpHeight) / (t.timeToApex * t.timeToApex);
}

/** Absprunggeschwindigkeit (positiv) für die gewünschte Sprunghöhe. */
export function jumpVelocity(t: Tuning, running: boolean): number {
  return Math.sqrt(2 * jumpGravity(t) * (running ? t.runJumpHeight : t.jumpHeight));
}

export const TUNING_KEY = 'kraxel-tuning-v1';

/** `?debug` in der Adresse (z. B. `window.location.search`). */
export function isDebug(search: string): boolean {
  return new URLSearchParams(search).has('debug');
}

/** Veränderbare Kopie der Standardwerte, darüber nur bekannte Schlüssel mit endlichen Zahlen aus dem Speicher. */
export function loadTuning(store: KeyValueStore | null): Tuning {
  const t: Tuning = { ...DEFAULT_TUNING };
  if (!store) return t;
  try {
    const raw = store.getItem(TUNING_KEY);
    if (raw === null) return t;
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return t;
    for (const key of Object.keys(DEFAULT_TUNING) as (keyof Tuning)[]) {
      const v = (data as Record<string, unknown>)[key];
      if (typeof v === 'number' && Number.isFinite(v)) t[key] = v;
    }
  } catch {
    return { ...DEFAULT_TUNING };
  }
  return t;
}

export function saveTuning(store: KeyValueStore | null, t: Tuning): void {
  try {
    store?.setItem(TUNING_KEY, JSON.stringify(t));
  } catch {
    // Speicher voll oder gesperrt: die Werte gelten dann nur für diese Sitzung.
  }
}
