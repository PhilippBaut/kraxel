import { describe, expect, it } from 'vitest';
import { PLAYER_H, PLAYER_W, createPlayer } from './player.ts';
import { gridFrom, runPlayer } from './test-helpers.ts';
import { TILE } from '../config.ts';

// Polster in Reihe 10 (Spalten 4 bis 8), Boden in Reihe 11, links davon Boden auf Höhe des Polsters.
const GRID = gridFrom([
  '..........', '..........', '..........', '..........', '..........',
  '..........', '..........', '..........', '..........', '..........',
  '#...LLLLL.', '##########',
]);
const PAD_TOP = 10 * TILE;

/** Kraxel mittig über Polsterspalte `cx`, `h` px über der Oberkante, ohne Tempo. */
function above(cx: number, h: number) {
  const p = createPlayer(cx, 5);
  p.body.y = PAD_TOP - h - PLAYER_H;
  p.body.x = cx * TILE + (TILE - PLAYER_W) / 2;
  return p;
}
describe('Blätterpolster', () => {
  it('Draufspringen federt ca. 6 Kacheln, mit gehaltenem Sprung ca. 7', () => {
    // Fall aus 4 px Höhe: die Landung löst das Federn aus, danach freier Flug.
    const plain = runPlayer(above(6, 4), GRID, [[{}, 40]]);
    expect(plain.events.filter((e) => e.type === 'bounce').length).toBe(1);
    expect(Math.abs(PAD_TOP - (plain.minY + PLAYER_H) - 96)).toBeLessThanOrEqual(8);
    const held = runPlayer(above(6, 4), GRID, [[{ jump: true }, 40]]);
    expect(held.events.filter((e) => e.type === 'bounce').length).toBe(1);
    expect(Math.abs(PAD_TOP - (held.minY + PLAYER_H) - 112)).toBeLessThanOrEqual(8);
  });

  it('Stampfen auf ein Polster federt hoch (hoher Wert) und beendet das Stampfen', () => {
    const p = above(6, 60);
    const r = runPlayer(p, GRID, [[{ down: true }, 1], [{}, 60]]);
    expect(r.events.some((e) => e.type === 'pound')).toBe(true);
    expect(r.events.filter((e) => e.type === 'bounce').length).toBe(1);
    expect(['pound', 'poundHang', 'poundRecover']).not.toContain(p.mode);
    expect(Math.abs(PAD_TOP - (r.minY + PLAYER_H) - 112)).toBeLessThanOrEqual(8);
  });

  it('seitlich ist das Polster eine Wand, von unten eine Decke', () => {
    // Seitlich: Kraxel läuft am Boden gegen ein einzelnes Polster und bleibt davor stehen.
    const wall = gridFrom(['..........', '..........', '..........', '..........', '.....L....', '##########']);
    const w = createPlayer(1, 4);
    const rs = runPlayer(w, wall, [[{ right: true }, 90]]);
    expect(rs.events.some((e) => e.type === 'bounce')).toBe(false);
    expect(w.body.x + PLAYER_W).toBeLessThanOrEqual(5 * TILE);
    expect(w.body.x + PLAYER_W).toBeGreaterThan(5 * TILE - 2);
    // Von unten: Sprung gegen die Unterseite, Kopf stoppt an der Decke.
    const roof = gridFrom(['..........', '..........', '..........', '....LL....', '..........', '..........', '..........', '..........', '##########']);
    const q = createPlayer(4, 7); q.body.x = 4 * TILE + 3;
    const r = runPlayer(q, roof, [[{ jump: true }, 40]]);
    expect(r.events.some((e) => e.type === 'bounce')).toBe(false);
    expect(r.minY).toBeGreaterThanOrEqual(4 * TILE);
  });

  it('am Rand landen: federt, wenn die Füße auf dem Polster stehen', () => {
    // Regel: federt, sobald mindestens eine Zelle unter den Füßen ein Polster ist (auch wenn die andere Boden ist).
    // Kante: Polster ab Spalte 4. Körper ragt von Spalte 3 (dort ist Reihe 10 leer, Boden liegt erst in Reihe 11) nur 2 px auf das Polster.
    const edge = above(3, 4);
    edge.body.x = 4 * TILE - (PLAYER_W - 2);
    expect(runPlayer(edge, GRID, [[{}, 10]]).events.some((e) => e.type === 'bounce')).toBe(true);
    // Zwei Zellen weiter rechts: nur 1 px Überlappung am rechten Rand des Polsters (Spalte 8, danach leer): ebenfalls Polster.
    const right = above(8, 4);
    right.body.x = 9 * TILE - 1;
    expect(runPlayer(right, GRID, [[{}, 10]]).events.some((e) => e.type === 'bounce')).toBe(true);
    // Kein Polster unter den Füßen: kein Federn.
    const none = above(1, 4);
    expect(runPlayer(none, GRID, [[{}, 10]]).events.some((e) => e.type === 'bounce')).toBe(false);
  });

  it('Boden und Polster nebeneinander auf gleicher Höhe: ein Fuß auf dem Boden, der andere auf dem Polster federt', () => {
    const g = gridFrom([...Array(10).fill('..........'), '##LL......', '##########']);
    const p = createPlayer(1, 5);
    p.body.y = PAD_TOP - 4 - PLAYER_H;
    p.body.x = 2 * TILE - PLAYER_W / 2; // je 5 px über Boden (Spalte 1) und Polster (Spalte 2)
    expect(runPlayer(p, g, [[{}, 10]]).events.filter((e) => e.type === 'bounce').length).toBe(1);
  });
});
