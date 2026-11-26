// Karte der Graswelt: eine kleine Almwiese mit Bach, 16 x 12 Kacheln (256 x 192 px bei 16 px Kacheln).
// Kachelzeichen (nur Deko, Wege und Punkte zeichnet die Karten-Szene aus `nodes` und `paths`):
//   .  Wiese      ~  Bach      T  Baum      ^  Hügel      f  Blumen
// Unten links liegt die Hütte, oben die Wurzelburg, darüber am Rand der Platzhalter.
// Die Abkürzung 1-3 → 1-F läuft nördlich am Bach entlang, getrennt vom Weg über 1-4.
import type { WorldMap } from '../core/worldmap.ts';

/** Zellen einer geraden Strecke, Endpunkte eingeschlossen. */
function line(x0: number, y0: number, x1: number, y1: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
  for (let x = x0, y = y0; ; x += sx, y += sy) {
    out.push([x, y]);
    if (x === x1 && y === y1) return out;
  }
}
/** Streckenzug aus geraden Teilstücken, Knickpunkte nur einmal. */
function walk(...pts: Array<[number, number]>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 1; i < pts.length; i++) out.push(...line(...pts[i - 1], ...pts[i]).slice(i === 1 ? 0 : 1));
  return out;
}

export const WORLD1: WorldMap = {
  world: 1,
  width: 16,
  height: 12,
  tiles: [
    '^^^^^T^^^^.^^T^^',
    'T^..T..f.T.fT.^T',
    '.T.fT.......f.T.',
    '..T........f.T..',
    'Tf.....T.....T.^',
    '^T..........f.T.',
    'T.f..f.~~~~~~~~~',
    '^.f..........^T.',
    'T..f.T.......f.T',
    '..T..^T......T.f',
    'f.T..........T.^',
    '^^T..f.T..f..T^^',
  ],
  nodes: [
    { id: 'hut', kind: 'hut', cx: 3, cy: 10, levelId: null, name: 'HÜTTE' },
    { id: '1-1', kind: 'level', cx: 8, cy: 10, levelId: '1-1', name: 'SONNIGE ALMWIESE' },
    { id: '1-2', kind: 'level', cx: 12, cy: 7, levelId: '1-2', name: 'BLUMENHANG' },
    { id: '1-3', kind: 'level', cx: 6, cy: 7, levelId: '1-3', name: 'BACHGRUND' },
    { id: '1-4', kind: 'level', cx: 3, cy: 3, levelId: '1-4', name: 'GRATWANDERUNG' },
    { id: '1-F', kind: 'fortress', cx: 10, cy: 3, levelId: '1-F', name: 'WURZELBURG' },
    { id: 'teaser', kind: 'teaser', cx: 10, cy: 0, levelId: null, name: 'FORTSETZUNG FOLGT' },
  ],
  paths: [
    { from: 'hut', to: '1-1', via: 'always', cells: walk([3, 10], [8, 10]) },
    { from: '1-1', to: '1-2', via: 'normal', cells: walk([8, 10], [12, 10], [12, 7]) },
    { from: '1-2', to: '1-3', via: 'normal', cells: walk([12, 7], [6, 7]) },
    { from: '1-3', to: '1-4', via: 'normal', cells: walk([6, 7], [3, 7], [3, 3]) },
    { from: '1-4', to: '1-F', via: 'normal', cells: walk([3, 3], [10, 3]) },
    { from: '1-3', to: '1-F', via: 'secret', cells: walk([6, 7], [6, 5], [10, 5], [10, 3]) },
    { from: '1-F', to: 'teaser', via: 'normal', cells: walk([10, 3], [10, 0]) },
  ],
  start: 'hut',
};
