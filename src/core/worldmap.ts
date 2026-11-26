// Weltkarte: Punkte, Wege, Freischalten, Wegwahl, Route und Tipp-Auswahl. Kein Phaser, kein DOM.
import type { ExitKind, SaveData } from './save.ts';

export type NodeKind = 'hut' | 'level' | 'fortress' | 'teaser';
export type Dir = 'left' | 'right' | 'up' | 'down';
export interface MapNode { id: string; kind: NodeKind; cx: number; cy: number; levelId: string | null; name: string }
/** `cells`: von `from` bis `to` einschließlich, jeder Schritt ein 4er-Nachbar. */
export interface MapPath { from: string; to: string; via: ExitKind | 'always'; cells: ReadonlyArray<readonly [number, number]> }
export interface WorldMap { world: number; width: number; height: number; tiles: readonly string[]; nodes: readonly MapNode[]; paths: readonly MapPath[]; start: string }

type Cell = readonly [number, number];
/** Kantenlänge einer Kachel in Kartenpixeln. */
const TILE = 16;
/** Mindestabstand zwischen Punkten in Kacheln (Chebyshev: max(|dx|, |dy|)). */
const MIN_NODE_GAP = 3;
const DIRS: Record<Dir, Cell> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

const nodeById = (m: WorldMap, id: string): MapNode | undefined => m.nodes.find((n) => n.id === id);
const cellKey = (c: Cell): string => `${c[0]},${c[1]}`;

/**
 * Prüft die Kartendaten und liefert Fehlermeldungen (leer = gültig).
 * Abstand der Punkte: Chebyshev-Abstand in Kacheln, mindestens 3.
 */
export function validateMap(m: WorldMap, levelIds: readonly string[]): string[] {
  const errs: string[] = [];
  if (m.tiles.length !== m.height) errs.push(`tiles hat ${m.tiles.length} Zeilen statt ${m.height}`);
  m.tiles.forEach((row, y) => { if (row.length !== m.width) errs.push(`tiles-Zeile ${y} hat ${row.length} Zeichen statt ${m.width}`); });
  const inside = (c: Cell): boolean => c[0] >= 0 && c[1] >= 0 && c[0] < m.width && c[1] < m.height;

  const ids = new Set<string>();
  for (const n of m.nodes) {
    if (ids.has(n.id)) errs.push(`Punkt ${n.id} doppelt`);
    ids.add(n.id);
    if (!inside([n.cx, n.cy])) errs.push(`Punkt ${n.id} liegt außerhalb der Karte`);
    const needsLevel = n.kind === 'level' || n.kind === 'fortress';
    if (needsLevel && (n.levelId === null || !levelIds.includes(n.levelId))) errs.push(`Punkt ${n.id}: unbekanntes Level ${String(n.levelId)}`);
    if (!needsLevel && n.levelId !== null) errs.push(`Punkt ${n.id}: Art ${n.kind} darf kein Level haben`);
  }
  for (const id of levelIds) if (!m.nodes.some((n) => n.levelId === id)) errs.push(`Level ${id} hat keinen Punkt`);
  if (!ids.has(m.start)) errs.push(`Startpunkt ${m.start} fehlt`);
  for (let i = 0; i < m.nodes.length; i++) {
    for (let j = i + 1; j < m.nodes.length; j++) {
      const a = m.nodes[i], b = m.nodes[j];
      if (Math.max(Math.abs(a.cx - b.cx), Math.abs(a.cy - b.cy)) < MIN_NODE_GAP) errs.push(`Punkte ${a.id} und ${b.id} liegen zu nah beieinander`);
    }
  }

  // Wege: Start/Ziel, Zellenfolge, Überschneidungen
  const owner = new Map<string, number>(); // Zelle → Weg, nur für Nicht-Endpunkte
  m.paths.forEach((p, i) => {
    const label = `Weg ${p.from}→${p.to}`;
    const a = nodeById(m, p.from), b = nodeById(m, p.to);
    if (!a) errs.push(`${label}: Start unbekannt`);
    if (!b) errs.push(`${label}: Ziel unbekannt`);
    if (p.cells.length < 2) { errs.push(`${label}: zu wenige Zellen`); return; }
    const first = p.cells[0], last = p.cells[p.cells.length - 1];
    if (a && (first[0] !== a.cx || first[1] !== a.cy)) errs.push(`${label}: beginnt nicht auf dem Startpunkt`);
    if (b && (last[0] !== b.cx || last[1] !== b.cy)) errs.push(`${label}: endet nicht auf dem Zielpunkt`);
    const seen = new Set<string>();
    p.cells.forEach((c, k) => {
      if (!inside(c)) errs.push(`${label}: Zelle ${cellKey(c)} außerhalb der Karte`);
      if (seen.has(cellKey(c))) errs.push(`${label}: Zelle ${cellKey(c)} wiederholt sich`);
      seen.add(cellKey(c));
      if (k > 0) {
        const prev = p.cells[k - 1];
        if (Math.abs(c[0] - prev[0]) + Math.abs(c[1] - prev[1]) !== 1) errs.push(`${label}: Sprung oder Diagonale bei ${cellKey(prev)} → ${cellKey(c)}`);
      }
      const isEnd = k === 0 || k === p.cells.length - 1;
      const onNode = m.nodes.some((n) => n.cx === c[0] && n.cy === c[1]);
      if (!isEnd && onNode) errs.push(`${label}: läuft über einen fremden Punkt bei ${cellKey(c)}`);
      if (!isEnd) {
        const other = owner.get(cellKey(c));
        if (other !== undefined && other !== i) errs.push(`${label}: kreuzt Weg ${m.paths[other].from}→${m.paths[other].to} bei ${cellKey(c)}`);
        owner.set(cellKey(c), i);
      }
    });
  });
  // Endpunkt-Zelle eines Wegs darf nicht mitten in einem anderen Weg liegen
  m.paths.forEach((p, i) => {
    for (const c of [p.cells[0], p.cells[p.cells.length - 1]]) {
      const other = c && owner.get(cellKey(c));
      if (other !== undefined && other !== i) errs.push(`Weg ${p.from}→${p.to}: Endpunkt ${cellKey(c)} liegt auf Weg ${m.paths[other].from}→${m.paths[other].to}`);
    }
  });
  return errs;
}

/** Ein Weg ist offen, wenn er immer begehbar ist oder der Ausgang des Ausgangs-Levels gelöst ist. */
export function pathOpen(m: WorldMap, p: MapPath, save: SaveData): boolean {
  if (p.via === 'always') return true;
  const levelId = nodeById(m, p.from)?.levelId;
  if (levelId == null) return false;
  return save.levels[levelId]?.exits[p.via] === true;
}

/** Offene Wege in beide Richtungen: Nachbarn eines Punkts samt Weg. */
function openNeighbours(m: WorldMap, id: string, save: SaveData): Array<{ to: string; path: MapPath }> {
  const out: Array<{ to: string; path: MapPath }> = [];
  for (const p of m.paths) {
    if (!pathOpen(m, p, save)) continue;
    if (p.from === id) out.push({ to: p.to, path: p });
    else if (p.to === id) out.push({ to: p.from, path: p });
  }
  return out;
}

/** Ein Punkt ist offen, wenn er vom Startpunkt aus über offene Wege erreichbar ist. */
export function nodeOpen(m: WorldMap, id: string, save: SaveData): boolean {
  const seen = new Set<string>([m.start]);
  const queue = [m.start];
  for (let i = 0; i < queue.length; i++) {
    for (const { to } of openNeighbours(m, queue[i], save)) {
      if (!seen.has(to)) { seen.add(to); queue.push(to); }
    }
  }
  return seen.has(id);
}

/** Wählt den offenen Weg, dessen erster Schritt am besten zur Richtung passt (Skalarprodukt > 0). */
export function pickDirection(m: WorldMap, at: string, dir: Dir, save: SaveData): { to: string; cells: ReadonlyArray<readonly [number, number]> } | null {
  const [dx, dy] = DIRS[dir];
  let best: { to: string; cells: ReadonlyArray<Cell> } | null = null;
  let bestScore = 0;
  for (const { to, path } of openNeighbours(m, at, save)) {
    const cells = path.from === at ? path.cells : [...path.cells].reverse();
    const step: Cell = [cells[1][0] - cells[0][0], cells[1][1] - cells[0][1]];
    const score = step[0] * dx + step[1] * dy;
    if (score > bestScore) { bestScore = score; best = { to, cells }; }
  }
  return best;
}

/** Kürzeste Knotenfolge über offene Wege (Breitensuche), in beide Richtungen begehbar. */
export function route(m: WorldMap, from: string, to: string, save: SaveData): string[] | null {
  const prev = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    if (cur === to) break;
    for (const { to: next } of openNeighbours(m, cur, save)) {
      if (!prev.has(next)) { prev.set(next, cur); queue.push(next); }
    }
  }
  if (!prev.has(to)) return null;
  const out: string[] = [];
  for (let at: string | null = to; at !== null; at = prev.get(at) ?? null) out.unshift(at);
  return out;
}

/** Nächster Punkt zu einem Kartenpixel (Mitte der Kachel), höchstens `radius` Pixel entfernt. */
export function nodeAtPoint(m: WorldMap, x: number, y: number, radius: number): string | null {
  let best: string | null = null;
  let bestD = radius;
  for (const n of m.nodes) {
    const d = Math.hypot(x - (n.cx * TILE + TILE / 2), y - (n.cy * TILE + TILE / 2));
    if (d <= bestD) { bestD = d; best = n.id; }
  }
  return best;
}

/** Wege, die zwischen `before` und `after` neu aufgegangen sind (für die Einzeichen-Animation). */
export function openedBetween(m: WorldMap, before: SaveData, after: SaveData): MapPath[] {
  return m.paths.filter((p) => !pathOpen(m, p, before) && pathOpen(m, p, after));
}

/** Betretbar: offen und Art Level oder Festung. */
export function enterable(m: WorldMap, id: string, save: SaveData): boolean {
  const n = nodeById(m, id);
  return n !== undefined && (n.kind === 'level' || n.kind === 'fortress') && nodeOpen(m, id, save);
}
