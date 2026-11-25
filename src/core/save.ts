// Speicherstand: Bestzeiten, Edelweiß und Stummschaltung. Kein Phaser, kein DOM.
import type { KeyValueStore } from './types.ts';

export const SAVE_KEY = 'kraxel-save-v1';

export interface LevelRecord { bestTime: number | null; edelweiss: [boolean, boolean, boolean]; completed: boolean }
export interface SaveData { version: 1; levels: Record<string, LevelRecord>; muted: boolean }

export function defaultSave(): SaveData {
  return { version: 1, levels: {}, muted: false };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isLevelRecord(v: unknown): v is LevelRecord {
  if (!isRecord(v)) return false;
  const { bestTime, edelweiss, completed } = v;
  const timeOk = bestTime === null || (typeof bestTime === 'number' && Number.isFinite(bestTime));
  const edelweissOk = Array.isArray(edelweiss) && edelweiss.length === 3 && edelweiss.every((e) => typeof e === 'boolean');
  return timeOk && edelweissOk && typeof completed === 'boolean';
}

/** Gespeicherten Stand lesen. Fehlt er, ist er kaputt, hat eine andere Version oder Form, gilt der Standard. */
export function loadSave(store: KeyValueStore | null): SaveData {
  if (!store) return defaultSave();
  try {
    const raw = store.getItem(SAVE_KEY);
    if (raw === null) return defaultSave();
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data) || data.version !== 1) return defaultSave();
    const { levels, muted } = data;
    if (!isRecord(levels) || typeof muted !== 'boolean') return defaultSave();
    const out: Record<string, LevelRecord> = {};
    for (const [id, rec] of Object.entries(levels)) {
      if (!isLevelRecord(rec)) return defaultSave();
      out[id] = { bestTime: rec.bestTime, edelweiss: [rec.edelweiss[0], rec.edelweiss[1], rec.edelweiss[2]], completed: rec.completed };
    }
    return { version: 1, levels: out, muted };
  } catch {
    return defaultSave();
  }
}

/** Speichern wirft nie: ist der Speicher voll oder gesperrt, gilt der Stand nur für diese Sitzung. */
export function writeSave(store: KeyValueStore | null, d: SaveData): void {
  try {
    store?.setItem(SAVE_KEY, JSON.stringify(d));
  } catch {
    // Speicher voll oder gesperrt: nichts weiter zu tun.
  }
}

/** Ergebnis eines Levels einarbeiten. Bestzeit ist das Minimum, Edelweiß wird vereinigt. Die Eingabe bleibt unverändert. */
export function recordResult(
  d: SaveData,
  levelId: string,
  time: number,
  edelweiss: [boolean, boolean, boolean],
): { data: SaveData; newBest: boolean } {
  const prev = d.levels[levelId];
  const prevBest = prev?.bestTime ?? null;
  const newBest = prevBest === null || time < prevBest;
  const merged: LevelRecord = {
    bestTime: newBest ? time : prevBest,
    edelweiss: [
      (prev?.edelweiss[0] ?? false) || edelweiss[0],
      (prev?.edelweiss[1] ?? false) || edelweiss[1],
      (prev?.edelweiss[2] ?? false) || edelweiss[2],
    ],
    completed: true,
  };
  return {
    data: { version: 1, levels: { ...d.levels, [levelId]: merged }, muted: d.muted },
    newBest,
  };
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
