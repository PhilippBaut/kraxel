// Speicherstand: Bestzeiten, Edelweiß, Ausgänge, Stummschaltung und letzter Kartenpunkt. Kein Phaser, kein DOM.
import type { KeyValueStore } from './types.ts';

export const SAVE_KEY = 'kraxel-save-v2';
export const SAVE_KEY_V1 = 'kraxel-save-v1';

export type ExitKind = 'normal' | 'secret';
export interface LevelRecord { bestTime: number | null; edelweiss: [boolean, boolean, boolean]; completed: boolean; exits: { normal: boolean; secret: boolean } }
export interface SaveData { version: 2; levels: Record<string, LevelRecord>; muted: boolean; musicMuted: boolean; lastNode: string | null }

export function defaultSave(): SaveData {
  return { version: 2, levels: {}, muted: false, musicMuted: false, lastNode: null };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Gemeinsame Prüfung von Bestzeit, Edelweiß und `completed` (v1 und v2). */
function baseLevelOk(v: Record<string, unknown>): boolean {
  const { bestTime, edelweiss, completed } = v;
  const timeOk = bestTime === null || (typeof bestTime === 'number' && Number.isFinite(bestTime));
  const edelweissOk = Array.isArray(edelweiss) && edelweiss.length === 3 && edelweiss.every((e) => typeof e === 'boolean');
  return timeOk && edelweissOk && typeof completed === 'boolean';
}

function parseV2(raw: string): SaveData | null {
  const data: unknown = JSON.parse(raw);
  if (!isRecord(data) || data.version !== 2) return null;
  const { levels, muted, musicMuted, lastNode } = data;
  if (!isRecord(levels) || typeof muted !== 'boolean' || typeof musicMuted !== 'boolean') return null;
  if (lastNode !== null && typeof lastNode !== 'string') return null;
  const out: Record<string, LevelRecord> = {};
  for (const [id, rec] of Object.entries(levels)) {
    if (!isRecord(rec) || !baseLevelOk(rec)) return null;
    const exits = rec.exits;
    if (!isRecord(exits) || typeof exits.normal !== 'boolean' || typeof exits.secret !== 'boolean') return null;
    const e = rec.edelweiss as boolean[];
    out[id] = { bestTime: rec.bestTime as number | null, edelweiss: [e[0], e[1], e[2]], completed: rec.completed as boolean, exits: { normal: exits.normal, secret: exits.secret } };
  }
  return { version: 2, levels: out, muted, musicMuted, lastNode };
}

/** Alten v1-Stand übernehmen: ein abgeschlossenes Level zählt als normaler Ausgang. */
function parseV1(raw: string): SaveData | null {
  const data: unknown = JSON.parse(raw);
  if (!isRecord(data) || data.version !== 1) return null;
  const { levels, muted } = data;
  if (!isRecord(levels) || typeof muted !== 'boolean') return null;
  const out: Record<string, LevelRecord> = {};
  for (const [id, rec] of Object.entries(levels)) {
    if (!isRecord(rec) || !baseLevelOk(rec)) return null;
    const e = rec.edelweiss as boolean[];
    const completed = rec.completed as boolean;
    out[id] = { bestTime: rec.bestTime as number | null, edelweiss: [e[0], e[1], e[2]], completed, exits: { normal: completed, secret: false } };
  }
  return { version: 2, levels: out, muted, musicMuted: false, lastNode: null };
}

function tryRead(store: KeyValueStore, key: string, parse: (raw: string) => SaveData | null): SaveData | null {
  try {
    const raw = store.getItem(key);
    return raw === null ? null : parse(raw);
  } catch {
    return null;
  }
}

/** Gespeicherten Stand lesen: v2, sonst v1 übernommen, sonst Standard. Wirft nie. */
export function loadSave(store: KeyValueStore | null): SaveData {
  if (!store) return defaultSave();
  return tryRead(store, SAVE_KEY, parseV2) ?? tryRead(store, SAVE_KEY_V1, parseV1) ?? defaultSave();
}

/** Speichern wirft nie: ist der Speicher voll oder gesperrt, gilt der Stand nur für diese Sitzung. */
export function writeSave(store: KeyValueStore | null, d: SaveData): void {
  try {
    store?.setItem(SAVE_KEY, JSON.stringify(d));
  } catch {
    // Speicher voll oder gesperrt: nichts weiter zu tun.
  }
}

function mergeEdelweiss(prev: LevelRecord | undefined, e: [boolean, boolean, boolean]): [boolean, boolean, boolean] {
  return [(prev?.edelweiss[0] ?? false) || e[0], (prev?.edelweiss[1] ?? false) || e[1], (prev?.edelweiss[2] ?? false) || e[2]];
}

/** Ergebnis eines Levels einarbeiten. Bestzeit ist das Minimum, Edelweiß wird vereinigt. Die Eingabe bleibt unverändert. */
export function recordResult(
  d: SaveData,
  levelId: string,
  time: number,
  edelweiss: [boolean, boolean, boolean],
  exit: ExitKind = 'normal',
): { data: SaveData; newBest: boolean } {
  const prev = d.levels[levelId];
  const prevBest = prev?.bestTime ?? null;
  const newBest = prevBest === null || time < prevBest;
  const merged: LevelRecord = { bestTime: newBest ? time : prevBest, edelweiss: mergeEdelweiss(prev, edelweiss), completed: true, exits: { normal: prev?.exits.normal === true || exit === 'normal', secret: prev?.exits.secret === true || exit === 'secret' } };
  return {
    data: { ...d, levels: { ...d.levels, [levelId]: merged } },
    newBest,
  };
}

/** Nur Edelweiß einarbeiten (Game Over): vereinigt, Bestzeit und `completed` bleiben, wie sie waren. Die Eingabe bleibt unverändert. */
export function recordEdelweiss(d: SaveData, levelId: string, edelweiss: [boolean, boolean, boolean]): SaveData {
  const prev = d.levels[levelId];
  const merged: LevelRecord = { bestTime: prev?.bestTime ?? null, edelweiss: mergeEdelweiss(prev, edelweiss), completed: prev?.completed ?? false, exits: { normal: prev?.exits.normal ?? false, secret: prev?.exits.secret ?? false } };
  return { ...d, levels: { ...d.levels, [levelId]: merged } };
}

/** Letzten Kartenpunkt merken. Die Eingabe bleibt unverändert. */
export function withLastNode(d: SaveData, node: string): SaveData {
  return { ...d, lastNode: node };
}

/**
 * localStorage, oder null wenn es fehlt oder der Zugriff wirft (z. B. privater Modus in Safari).
 * Ohne `document` (Node-Tests) wird localStorage gar nicht angefasst: Node 26 gibt beim Zugriff eine Warnung aus.
 */
export function safeStorage(): KeyValueStore | null {
  if (typeof globalThis.document === 'undefined') return null;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
