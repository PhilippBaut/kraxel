// Level-Text lesen und prüfen.
import { Cell } from './types.ts';
import type { CrateContent } from './types.ts';
import { TileGrid } from './grid.ts';
import type { PlatformSpec } from './platforms.ts';

export type SpawnKind = 'crystal' | 'edelweiss' | 'beetle' | 'snail' | 'checkpoint' | 'goal' | 'secretGoal' | 'fallingRock';
export interface EntitySpawn { kind: SpawnKind; cx: number; cy: number; index: number }
export interface LevelData {
  id: string; name: string; world: number; width: number; height: number;
  cells: Uint8Array; crates: Map<number, CrateContent>; spawns: EntitySpawn[]; start: { cx: number; cy: number };
  /** Bewegte Plattformen aus den Kopfzeilen `plattform:`. */
  platforms: PlatformSpec[];
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
  '#': Cell.Ground, B: Cell.Rock, K: Cell.Crate, M: Cell.Crate, H: Cell.Crate, J: Cell.Crate, E: Cell.Crate, V: Cell.HiddenCrate,
  /** L: Blätterpolster, fest wie Boden, federt von oben. */
  L: Cell.LeafPad,
  /** W: Bachwasser, nicht fest; Berührung tötet. */
  W: Cell.Water,
};
const CRATE_CHARS: Record<string, CrateContent> = {
  K: { kind: 'crystal' }, M: { kind: 'multi' }, H: { kind: 'item', item: 'helm' },
  /** J: Helm, wenn Kraxel keinen trägt (entscheidet `openCrate`), sonst Schleuder. */
  J: { kind: 'item', item: 'sling' }, E: { kind: 'item', item: 'enzian' }, V: { kind: 'crystal' },
};
const SPAWN_CHARS: Record<string, { kind: SpawnKind; index: number }> = {
  c: { kind: 'crystal', index: 0 }, '1': { kind: 'edelweiss', index: 0 }, '2': { kind: 'edelweiss', index: 1 },
  '3': { kind: 'edelweiss', index: 2 }, k: { kind: 'beetle', index: 0 }, s: { kind: 'snail', index: 0 },
  S: { kind: 'checkpoint', index: 0 }, Z: { kind: 'goal', index: 0 },
  G: { kind: 'secretGoal', index: 0 },
  /** R: Brocken an der Decke; die Zelle selbst bleibt leer. */
  R: { kind: 'fallingRock', index: 0 },
};

/** `cx cy breite achse weg tempo art`, z. B. `4 12 3 h 6 2 stamm`. Zahlen wie `1.5` und negativer Weg sind erlaubt; Breite, Weg und Tempo prüft `validateLevel`. */
function parsePlatform(value: string, line: number): PlatformSpec {
  const f = value.trim().split(/\s+/);
  if (f.length !== 7) throw new LevelError('plattform braucht: cx cy breite achse weg tempo art', line);
  const [cx, cy, width, axis, travel, speed, art] = f;
  const num = (v: string, what: string): number => {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new LevelError(`plattform: ${what} "${v}" ist keine Zahl`, line);
    return n;
  };
  if (axis !== 'h' && axis !== 'v') throw new LevelError(`plattform: Achse "${axis}" muss h oder v sein`, line);
  if (art !== 'stamm' && art !== 'stein') throw new LevelError(`plattform: Art "${art}" muss stamm oder stein sein`, line);
  return { cx: num(cx, 'cx'), cy: num(cy, 'cy'), width: num(width, 'Breite'), axis, travel: num(travel, 'Weg'), speed: num(speed, 'Tempo'), art };
}

export function parseLevel(id: string, text: string): LevelData {
  const lines = text.replace(/\r/g, '').split('\n');
  const sep = lines.indexOf('---');
  if (sep < 0) throw new LevelError('Trennzeile --- fehlt', lines.length);
  let name = id, world = 1;
  const platforms: PlatformSpec[] = [];
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
    } else if (m[1] === 'plattform') platforms.push(parsePlatform(m[2], i + 1));
    else throw new LevelError(`Unbekannte Kopfzeile "${m[1]}"`, i + 1);
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
  return { id, name, world, width, height, cells, crates, spawns, start, platforms, startCount };
}

export function validateLevel(l: LevelData, o: { requireEdelweiss: boolean; requireGoal: boolean }): string[] {
  const problems: string[] = [];
  const g = new TileGrid(l.width, l.height, l.cells);

  if (l.startCount !== 1) problems.push(`Der Start P muss genau einmal vorkommen, gefunden: ${l.startCount}.`);

  const goals = l.spawns.filter((s) => s.kind === 'goal').length;
  if (o.requireGoal && goals !== 1) problems.push(`Das Gipfelkreuz Z muss genau einmal vorkommen, gefunden: ${goals}.`);

  const secrets = l.spawns.filter((s) => s.kind === 'secretGoal').length;
  if (secrets > 1) problems.push(`Das geheime Gipfelkreuz G darf höchstens einmal vorkommen, gefunden: ${secrets}.`);

  const edel = l.spawns.filter((s) => s.kind === 'edelweiss');
  for (let i = 0; i < 3; i++) {
    const n = edel.filter((s) => s.index === i).length;
    if (o.requireEdelweiss && n === 0) problems.push(`Edelweiss ${i + 1} fehlt.`);
    if (n > 1) problems.push(`Edelweiss ${i + 1} kommt ${n}-mal vor.`);
  }

  if (l.startCount > 0 && g.isSolid(l.start.cx, l.start.cy)) problems.push('Der Start liegt in einer festen Zelle.');
  for (const s of l.spawns) {
    if (g.isSolid(s.cx, s.cy)) problems.push(`${s.kind} bei ${s.cx},${s.cy} liegt in einer festen Zelle.`);
    if ((s.kind === 'beetle' || s.kind === 'snail') && !g.isSolid(s.cx, s.cy + 1) && !startsOnPlatform(l, s)) {
      problems.push(`${s.kind} bei ${s.cx},${s.cy} hat keinen festen Boden darunter.`);
    }
  }
  l.platforms.forEach((p, i) => problems.push(...platformProblems(l, g, p, i + 1)));
  return problems;
}

/** Steht die Figur auf dem Startplatz einer Plattform (Plattform liegt in der Zelle darunter)? */
function startsOnPlatform(l: LevelData, s: EntitySpawn): boolean {
  return l.platforms.some((p) => p.cy === s.cy + 1 && s.cx >= p.cx && s.cx < p.cx + p.width);
}

/** So viele Kacheln über der Oberkante der Plattform müssen frei sein (Kraxel ist 14 px hoch, dazu Luft zum Springen). */
const RIDER_CLEARANCE = 2;

/** Breite 2–4, Achse und Art, Weg und Tempo; der ganze Fahrweg liegt im Level und schneidet keine feste Zelle (nichts wird zerquetscht). */
function platformProblems(l: LevelData, g: TileGrid, p: PlatformSpec, n: number): string[] {
  const out: string[] = [];
  const name = `Plattform ${n} (${p.cx},${p.cy})`;
  if (!Number.isInteger(p.cx) || !Number.isInteger(p.cy)) out.push(`${name}: Position muss aus ganzen Kacheln bestehen.`);
  if (!Number.isInteger(p.width) || p.width < 2 || p.width > 4) out.push(`${name}: Breite ${p.width} liegt nicht in 2 bis 4.`);
  if (p.axis !== 'h' && p.axis !== 'v') out.push(`${name}: Achse "${String(p.axis)}" muss h oder v sein.`);
  if (p.art !== 'stamm' && p.art !== 'stein') out.push(`${name}: Art "${String(p.art)}" muss stamm oder stein sein.`);
  if (!(p.travel !== 0 && Number.isFinite(p.travel))) out.push(`${name}: Der Weg darf nicht 0 sein.`);
  if (!(p.speed > 0 && Number.isFinite(p.speed))) out.push(`${name}: Das Tempo muss größer als 0 sein.`);
  if (out.length > 0) return out;
  // Überstrichene Zellen: Start und Ende, dazwischen alles.
  const horizontal = p.axis === 'h';
  const lo = Math.min(0, p.travel), hi = Math.max(0, p.travel);
  const x0 = p.cx + (horizontal ? Math.floor(lo) : 0), x1 = p.cx + p.width - 1 + (horizontal ? Math.ceil(hi) : 0);
  const y0 = p.cy + (horizontal ? 0 : Math.floor(lo)), y1 = p.cy + (horizontal ? 0 : Math.ceil(hi));
  if (x0 < 0 || x1 >= l.width || y0 < 0 || y1 >= l.height) {
    out.push(`${name}: Der Fahrweg liegt nicht ganz im Level.`);
    return out;
  }
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      if (g.isSolid(cx, cy) || g.get(cx, cy) === Cell.HiddenCrate) {
        out.push(`${name}: Der Fahrweg schneidet die feste Zelle ${cx},${cy}.`);
        return out;
      }
    }
  }
  // Freiraum für den Fahrer: über jeder Lage der Plattform muss Platz für Kraxel sein (2 Kacheln über der Oberkante, Spalten der Plattform
  // über dem ganzen Weg). Sonst klemmt die Decke den Fahrer, während die Plattform weiterfährt, und er fällt hindurch.
  for (let cy = Math.max(0, y0 - RIDER_CLEARANCE); cy < y0; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      if (g.isSolid(cx, cy) || g.get(cx, cy) === Cell.HiddenCrate) {
        out.push(`${name}: Über dem Fahrweg fehlt Platz für den Fahrer (feste Zelle ${cx},${cy}).`);
        return out;
      }
    }
  }
  // Senkrechte Plattform: Der Fahrer überhängt die Plattform seitlich. Ein fester Vorsprung oder eine versteckte Kiste daneben, unter der
  // Luft ist, schiebt ihn beim Vorbeifahren zur Seite und er fällt durch. Eine Wand, die bis zum Boden durchgeht, ist dagegen harmlos.
  if (!horizontal) {
    const solidAt = (cx: number, cy: number) => cx < 0 || cx >= l.width || g.isSolid(cx, cy); // außerhalb zählt als Boden
    for (const cx of [x0 - 1, x1 + 1]) {
      for (let cy = Math.max(0, y0 - 1); cy <= y1 - 2; cy++) {
        const blocks = solidAt(cx, cy) || (cx >= 0 && cx < l.width && g.get(cx, cy) === Cell.HiddenCrate);
        if (blocks && !solidAt(cx, cy + 1)) {
          out.push(`${name}: Neben dem Fahrweg klemmt die Zelle ${cx},${cy} den überhängenden Fahrer.`);
          return out;
        }
      }
    }
  }
  return out;
}
