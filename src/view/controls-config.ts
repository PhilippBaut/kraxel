// Vom Spieler gesetzte Lage und Größe der Touch-Knöpfe: reine Rechnung und Speicher. Kein Phaser, kein DOM.
import type { KeyValueStore, Rect } from '../core/types.ts';
import type { Circle, Layout } from './layout.ts';

export type ButtonId = 'dpad' | 'jump' | 'action';
export const BUTTON_IDS: readonly ButtonId[] = ['dpad', 'jump', 'action'];

/** Grundradien (gezeichnet / Treffer) je Ansicht; Größe 1,0 des Knopf-Editors. */
export const BASE_RADII: Readonly<Record<'portrait' | 'landscape', Readonly<Record<ButtonId, { r: number; hitR: number }>>>> = {
  portrait: { dpad: { r: 42, hitR: 60 }, jump: { r: 28, hitR: 44 }, action: { r: 16, hitR: 24 } },
  landscape: { dpad: { r: 32, hitR: 60 }, jump: { r: 21, hitR: 38 }, action: { r: 14, hitR: 24 } },
};

/** Lage als Anteil im Bereich (fx, fy in 0..1, bezogen auf den Mittelpunkt) und Größe als Faktor. */
export interface ButtonPlace { fx: number; fy: number; scale: number }
export type OrientationConfig = Record<ButtonId, ButtonPlace>;
/** null = Standard-Anordnung für diese Ansicht. */
export interface ControlsConfig { version: 1; portrait: OrientationConfig | null; landscape: OrientationConfig | null }

export const CONTROLS_KEY = 'kraxel-controls-v1';
export const SCALE_MIN = 0.75, SCALE_MAX = 1.5, SCALE_STEP = 0.125, BUTTON_GAP = 4;
/** Rundungsspielraum beim Prüfen, damit Umrechnen über fx/fy keine Knöpfe knapp verwirft. */
const EPS = 1e-6;

export function defaultControlsConfig(): ControlsConfig {
  return { version: 1, portrait: null, landscape: null };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isPlace(v: unknown): v is ButtonPlace {
  if (!isRecord(v)) return false;
  const { fx, fy, scale } = v;
  return typeof fx === 'number' && Number.isFinite(fx) && fx >= 0 && fx <= 1
    && typeof fy === 'number' && Number.isFinite(fy) && fy >= 0 && fy <= 1
    && typeof scale === 'number' && Number.isFinite(scale) && scale >= SCALE_MIN && scale <= SCALE_MAX;
}

function readOrientation(v: unknown): OrientationConfig | null {
  if (!isRecord(v)) return null;
  const { dpad, jump, action } = v;
  if (!isPlace(dpad) || !isPlace(jump) || !isPlace(action)) return null;
  return {
    dpad: { fx: dpad.fx, fy: dpad.fy, scale: dpad.scale },
    jump: { fx: jump.fx, fy: jump.fy, scale: jump.scale },
    action: { fx: action.fx, fy: action.fy, scale: action.scale },
  };
}

/** Gespeicherte Anordnung lesen. Fehlt sie, ist kaputt oder hat andere Version/Form, gilt der Standard (je Ansicht). */
export function loadControlsConfig(store: KeyValueStore | null): ControlsConfig {
  if (!store) return defaultControlsConfig();
  try {
    const raw = store.getItem(CONTROLS_KEY);
    if (raw === null) return defaultControlsConfig();
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data) || data.version !== 1) return defaultControlsConfig();
    return { version: 1, portrait: readOrientation(data.portrait), landscape: readOrientation(data.landscape) };
  } catch {
    return defaultControlsConfig();
  }
}

/** Speichern wirft nie: ist der Speicher voll oder gesperrt, gilt die Anordnung nur für diese Sitzung. */
export function saveControlsConfig(store: KeyValueStore | null, c: ControlsConfig): void {
  try {
    store?.setItem(CONTROLS_KEY, JSON.stringify(c));
  } catch {
    // Speicher voll oder gesperrt: nichts weiter zu tun.
  }
}

function circleOf(base: Layout, id: ButtonId, p: ButtonPlace): Circle {
  const a = base.controlsArea;
  const b = BASE_RADII[base.orientation][id];
  const r = Math.round(b.r * p.scale);
  return {
    cx: a.x + r + p.fx * (a.w - 2 * r), cy: a.y + r + p.fy * (a.h - 2 * r),
    r, hitR: Math.round(b.hitR * p.scale),
  };
}

function rectHitsCircle(r: Rect, c: Circle): boolean {
  const nx = Math.max(r.x, Math.min(c.cx, r.x + r.w)), ny = Math.max(r.y, Math.min(c.cy, r.y + r.h));
  return Math.hypot(c.cx - nx, c.cy - ny) < c.r;
}

/** Gültig: jeder Kreis ganz im Bereich, Abstand mindestens rA + rB + Lücke, keine Berührung der Pause-Fläche (in beiden Ansichten). */
function isValid(l: Layout): boolean {
  const a = l.controlsArea;
  const cs = BUTTON_IDS.map((id) => l[id]);
  for (const c of cs) {
    if (![c.cx, c.cy, c.r, c.hitR].every(Number.isFinite)) return false;
    if (c.cx - c.r < a.x - EPS || c.cx + c.r > a.x + a.w + EPS || c.cy - c.r < a.y - EPS || c.cy + c.r > a.y + a.h + EPS) return false;
    if (rectHitsCircle(l.pauseHit, c)) return false;
  }
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    const p = cs[i]!, q = cs[j]!;
    if (Math.hypot(p.cx - q.cx, p.cy - q.cy) < p.r + q.r + BUTTON_GAP - EPS) return false;
  }
  return true;
}

/** Anordnung auf das Standard-Layout anwenden. Null oder ungültig: `base` unverändert. */
export function applyControls(base: Layout, o: OrientationConfig | null): Layout {
  if (!o) return base;
  const next: Layout = { ...base, dpad: circleOf(base, 'dpad', o.dpad), jump: circleOf(base, 'jump', o.jump), action: circleOf(base, 'action', o.action) };
  return isValid(next) ? next : base;
}

/** Aktuelle Lage als Anteile im Bereich; Größe als Faktor zum Grundradius. */
export function configFromLayout(l: Layout): OrientationConfig {
  const a = l.controlsArea;
  const one = (id: ButtonId): ButtonPlace => {
    const c = l[id];
    const sx = a.w - 2 * c.r, sy = a.h - 2 * c.r;
    return {
      fx: sx > 0 ? (c.cx - a.x - c.r) / sx : 0.5,
      fy: sy > 0 ? (c.cy - a.y - c.r) / sy : 0.5,
      scale: c.r / BASE_RADII[l.orientation][id].r,
    };
  };
  return { dpad: one('dpad'), jump: one('jump'), action: one('action') };
}

function withCircle(l: Layout, id: ButtonId, c: Circle): Layout {
  return { ...l, [id]: c };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Knopf-Mitte setzen. Wird in den Bereich geklemmt; bei Überlappung oder Pause-Fläche null. */
export function moveButton(l: Layout, id: ButtonId, cx: number, cy: number): Layout | null {
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  const a = l.controlsArea, c = l[id];
  const next = withCircle(l, id, {
    ...c,
    cx: clamp(cx, a.x + c.r, a.x + a.w - c.r),
    cy: clamp(cy, a.y + c.r, a.y + a.h - c.r),
  });
  return isValid(next) ? next : null;
}

/** Größe setzen (auf 0,75 bis 1,5 geklemmt, Mitte bleibt, soweit der Bereich es zulässt). Bei Überlappung null. */
export function resizeButton(l: Layout, id: ButtonId, scale: number): Layout | null {
  if (!Number.isFinite(scale)) return null;
  const a = l.controlsArea, c = l[id], b = BASE_RADII[l.orientation][id];
  const s = clamp(scale, SCALE_MIN, SCALE_MAX);
  const r = Math.round(b.r * s);
  const next = withCircle(l, id, {
    cx: clamp(c.cx, a.x + r, a.x + a.w - r), cy: clamp(c.cy, a.y + r, a.y + a.h - r),
    r, hitR: Math.round(b.hitR * s),
  });
  return isValid(next) ? next : null;
}

/** Welcher Knopf liegt unter dem Punkt (gezeichneter Kreis + 4 px)? Der nächste Mittelpunkt gewinnt. */
export function pickButton(l: Layout, x: number, y: number): ButtonId | null {
  let best: ButtonId | null = null, bestD = Infinity;
  for (const id of BUTTON_IDS) {
    const c = l[id];
    const d = Math.hypot(x - c.cx, y - c.cy);
    if (d <= c.r + 4 && d < bestD) { best = id; bestD = d; }
  }
  return best;
}

/** Anordnung einer Ansicht ersetzen (null = Standard), die andere bleibt. Die Eingabe bleibt unverändert. */
export function withOrientation(c: ControlsConfig, o: 'portrait' | 'landscape', oc: OrientationConfig | null): ControlsConfig {
  return { ...c, [o]: oc };
}
