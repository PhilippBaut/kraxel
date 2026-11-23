// Level-Text lesen und prüfen.
import { Cell } from './types.ts';
import type { CrateContent } from './types.ts';
import { TileGrid } from './grid.ts';

export type SpawnKind = 'crystal' | 'edelweiss' | 'beetle' | 'snail' | 'checkpoint' | 'goal';
export interface EntitySpawn { kind: SpawnKind; cx: number; cy: number; index: number }
export interface LevelData {
  id: string; name: string; world: number; width: number; height: number;
  cells: Uint8Array; crates: Map<number, CrateContent>; spawns: EntitySpawn[]; start: { cx: number; cy: number };
  /** Wie viele `P` im Text standen; `validateLevel` verlangt genau eines. */
  startCount: number;
}

export class LevelError extends Error {
  line: number;
  constructor(message: string, line: number) {
    super(`Zeile ${line}: ${message}`);
    this.name = 'LevelError';
    this.line = line;
  }
}

const CELL_CHARS: Record<string, Cell> = {
  '#': Cell.Ground, B: Cell.Rock, K: Cell.Crate, M: Cell.Crate, H: Cell.Crate, V: Cell.HiddenCrate,
};
const CRATE_CHARS: Record<string, CrateContent> = {
  K: { kind: 'crystal' }, M: { kind: 'multi' }, H: { kind: 'item', item: 'helm' }, V: { kind: 'crystal' },
};
const SPAWN_CHARS: Record<string, { kind: SpawnKind; index: number }> = {
  c: { kind: 'crystal', index: 0 }, '1': { kind: 'edelweiss', index: 0 }, '2': { kind: 'edelweiss', index: 1 },
  '3': { kind: 'edelweiss', index: 2 }, k: { kind: 'beetle', index: 0 }, s: { kind: 'snail', index: 0 },
  S: { kind: 'checkpoint', index: 0 }, Z: { kind: 'goal', index: 0 },
};

export function parseLevel(id: string, text: string): LevelData {
  const lines = text.replace(/\r/g, '').split('\n');
  const sep = lines.indexOf('---');
  if (sep < 0) throw new LevelError('Trennzeile --- fehlt', lines.length);
  let name = id, world = 1;
  for (let i = 0; i < sep; i++) {
    const m = /^(\w+):\s*(.*)$/.exec(lines[i]);
    if (!m) {
      if (lines[i].trim()) throw new LevelError('Kopfzeile nicht lesbar', i + 1);
      continue;
    }
    if (m[1] === 'name') name = m[2].trim();
    else if (m[1] === 'world') {
      world = Number(m[2]);
      if (!Number.isInteger(world) || world < 1) throw new LevelError('world muss eine ganze Zahl ab 1 sein', i + 1);
    } else throw new LevelError(`Unbekannte Kopfzeile "${m[1]}"`, i + 1);
  }
  const rows = lines.slice(sep + 1);
  while (rows.length && rows[rows.length - 1].trim() === '') rows.pop();
  const width = Math.max(0, ...rows.map((r) => r.length)), height = rows.length;
  const cells = new Uint8Array(width * height);
  const crates = new Map<number, CrateContent>();
  const spawns: EntitySpawn[] = [];
  let start = { cx: 0, cy: 0 };
  let startCount = 0;

  rows.forEach((row, cy) => {
    for (let cx = 0; cx < row.length; cx++) {
      const ch = row[cx];
      if (ch === '.') continue;
      const cell = CELL_CHARS[ch];
      const spawn = SPAWN_CHARS[ch];
      if (cell !== undefined) {
        cells[cy * width + cx] = cell;
        const content = CRATE_CHARS[ch];
        if (content) crates.set(cy * width + cx, content);
      } else if (ch === 'P') {
        if (startCount++ === 0) start = { cx, cy };
      } else if (spawn) {
        spawns.push({ ...spawn, cx, cy });
      } else {
        throw new LevelError(`Unbekanntes Zeichen "${ch}"`, sep + 2 + cy);
      }
    }
  });

  // Steinmännchen zählen von links nach rechts.
  spawns.filter((s) => s.kind === 'checkpoint').sort((a, b) => a.cx - b.cx).forEach((s, i) => { s.index = i; });
  return { id, name, world, width, height, cells, crates, spawns, start, startCount };
}

export function validateLevel(l: LevelData, o: { requireEdelweiss: boolean; requireGoal: boolean }): string[] {
  const problems: string[] = [];
  const g = new TileGrid(l.width, l.height, l.cells);

  if (l.startCount !== 1) problems.push(`Der Start P muss genau einmal vorkommen, gefunden: ${l.startCount}.`);

  const goals = l.spawns.filter((s) => s.kind === 'goal').length;
  if (o.requireGoal && goals !== 1) problems.push(`Das Gipfelkreuz Z muss genau einmal vorkommen, gefunden: ${goals}.`);

  const edel = l.spawns.filter((s) => s.kind === 'edelweiss');
  for (let i = 0; i < 3; i++) {
    const n = edel.filter((s) => s.index === i).length;
    if (o.requireEdelweiss && n === 0) problems.push(`Edelweiss ${i + 1} fehlt.`);
    if (n > 1) problems.push(`Edelweiss ${i + 1} kommt ${n}-mal vor.`);
  }

  if (l.startCount > 0 && g.isSolid(l.start.cx, l.start.cy)) problems.push('Der Start liegt in einer festen Zelle.');
  for (const s of l.spawns) {
    if (g.isSolid(s.cx, s.cy)) problems.push(`${s.kind} bei ${s.cx},${s.cy} liegt in einer festen Zelle.`);
    if ((s.kind === 'beetle' || s.kind === 'snail') && !g.isSolid(s.cx, s.cy + 1)) {
      problems.push(`${s.kind} bei ${s.cx},${s.cy} hat keinen festen Boden darunter.`);
    }
  }
  return problems;
}
