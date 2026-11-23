import { describe, expect, it } from 'vitest';
import { createPlayer } from './player.ts';
import { gridFrom, runPlayer } from './test-helpers.ts';
import type { GameEvent } from './types.ts';

// Boden: Reihe 10, Kraxel startet bei Zelle (3, 9)
const FLAT = gridFrom([...Array(10).fill('.'.repeat(40)), '#'.repeat(40)]);
const start = () => createPlayer(3, 9);

describe('Laufen', () => {
  it('Gehtempo nach 0,3 s', () => { const p = start(); runPlayer(p, FLAT, [[{ right: true }, 18]]); expect(p.body.vx).toBeCloseTo(96, 0); });
  it('Renntempo erst nach runDelay + runRamp', () => {
    const p = start(); runPlayer(p, FLAT, [[{ right: true }, 30]]); expect(p.body.vx).toBeLessThanOrEqual(96.5);
    runPlayer(p, FLAT, [[{ right: true }, 42]]); expect(p.body.vx).toBeCloseTo(152, 0);
  });
  it('Loslassen bremst in 0,2 s auf 0', () => { const p = start(); runPlayer(p, FLAT, [[{ right: true }, 18], [{}, 12]]); expect(p.body.vx).toBe(0); });
  it('Umdrehen aus vollem Lauf zeigt skid', () => { const p = start(); runPlayer(p, FLAT, [[{ right: true }, 72], [{ left: true }, 2]]); expect(p.anim).toBe('skid'); });
});

describe('Springen', () => {
  it('voller Sprung aus dem Stand: ca. 4 Kacheln', () => {
    const p = start(); const y0 = p.body.y; const r = runPlayer(p, FLAT, [[{ jump: true }, 60]]);
    expect(y0 - r.minY).toBeGreaterThanOrEqual(58); expect(y0 - r.minY).toBeLessThanOrEqual(70);
    expect(r.events).toContainEqual({ type: 'jump' });
  });
  it('Sprung mit Renntempo: ca. 5 Kacheln', () => {
    const p = start(); runPlayer(p, FLAT, [[{ right: true }, 72]]); const y0 = p.body.y;
    const r = runPlayer(p, FLAT, [[{ right: true, jump: true }, 60]]);
    expect(y0 - r.minY).toBeGreaterThanOrEqual(74); expect(y0 - r.minY).toBeLessThanOrEqual(86);
  });
  it('kurz getippt: 1,3 bis 2,2 Kacheln', () => {
    const p = start(); const y0 = p.body.y; const r = runPlayer(p, FLAT, [[{ jump: true }, 1], [{}, 60]]);
    expect(y0 - r.minY).toBeGreaterThanOrEqual(21); expect(y0 - r.minY).toBeLessThanOrEqual(35);
  });
});

// Kante: Boden nur bis Spalte 5, danach Abgrund
const LEDGE = gridFrom([...Array(10).fill('.'.repeat(40)), '######' + '.'.repeat(34), '.'.repeat(40)]);
function walkOffThenJump(wait: number): GameEvent[] {
  const p = createPlayer(3, 9); let n = 0;
  runPlayer(p, LEDGE, [[{}, 1]]); // grounded wird erst im ersten Schritt erkannt
  while (p.grounded && n++ < 120) runPlayer(p, LEDGE, [[{ right: true }, 1]]);
  return runPlayer(p, LEDGE, [[{ right: true }, wait], [{ right: true, jump: true }, 1]]).events;
}

describe('Zeitfenster', () => {
  it('Coyote: nach 5 Schritten geht Springen, nach 8 nicht', () => {
    expect(walkOffThenJump(4)).toContainEqual({ type: 'jump' });
    expect(walkOffThenJump(8)).not.toContainEqual({ type: 'jump' });
  });
  it('Sprungpuffer: 6 Schritte vor der Landung ja, 10 nicht', () => {
    const landStep = (() => { const p = createPlayer(3, 2); let i = 0; while (!p.grounded) { runPlayer(p, FLAT, [[{}, 1]]); i++; } return i; })();
    const tryAt = (before: number) => {
      const p = createPlayer(3, 2);
      return runPlayer(p, FLAT, [[{}, landStep - before], [{ jump: true }, 1], [{}, before + 2]]).events;
    };
    expect(tryAt(6)).toContainEqual({ type: 'jump' });
    expect(tryAt(10)).not.toContainEqual({ type: 'jump' });
  });
});

describe('Fallen und Decke', () => {
  it('Fallen ist auf maxFallSpeed begrenzt', () => {
    const deep = gridFrom([...Array(30).fill('.'.repeat(8)), '#'.repeat(8)]);
    expect(runPlayer(createPlayer(3, 0), deep, [[{}, 120]]).maxVy).toBeLessThanOrEqual(270);
  });
  it('Kopfstoß unter Kiste meldet headCells', () => {
    const g = gridFrom(['..........', '...K......', '..........', '..........', '..........', '##########']);
    const p = createPlayer(3, 4); expect(runPlayer(p, g, [[{ jump: true }, 30]]).headCells).toContainEqual([3, 1]);
  });
});
