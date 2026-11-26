import { describe, expect, it } from 'vitest';
import { killPlayer, respawn, restartLevel } from './game.ts';
import type { GameState } from './game.ts';
import { TILE } from '../config.ts';
import { PEBBLE_MAX, PEBBLE_SPEED } from './pebbles.ts';
import { createEnemy } from './enemies.ts';
import { Cell } from './types.ts';
import { gameFrom, runGame } from './test-helpers.ts';

const FIELD = ['....................', '....................', '....................', '....................', '....................', '..P.................', '####################'];
const armed = (rows: string[] = FIELD): GameState => {
  const s = gameFrom(rows);
  s.player.helm = true;
  s.player.special = 'sling';
  return s;
};
const types = (ev: Array<{ type: string }>) => ev.map((e) => e.type);

/** Flacher Boden, 70 Kacheln breit: Kraxel steht in Spalte 2. */
const FLAT_ROWS = [...Array(5).fill('.'.repeat(70)), '..P' + '.'.repeat(67), '#'.repeat(70)];

/** Schießt einmal und fliegt den Kiesel ab; liefert die x-Mitte des Kiesels im letzten Schritt vor dem Verschwinden, dazu Kraxels Vorderkante beim Schuss. */
function schussWeite(s: GameState, vor: Parameters<typeof runGame>[1]): { ende: number; front: number; alter: number; tempo: number } {
  runGame(s, vor);
  const front = s.player.body.x + s.player.body.w;
  runGame(s, [[{ action: true, right: s.player.facing > 0 }, 1]]);
  const p = s.pebbles[0]!;
  const tempo = s.player.body.vx;
  let ende = p.body.x + p.body.w / 2;
  for (let i = 0; i < 100 && s.pebbles.length > 0; i++) {
    ende = p.body.x + p.body.w / 2;
    runGame(s, [[{}, 1]]);
  }
  return { ende, front, alter: p.age, tempo };
}

describe('Kiesel', () => {
  it('ohne Schleuder kein Kiesel', () => {
    const s = gameFrom(FIELD);
    const ev = runGame(s, [[{ action: true }, 1], [{}, 5]]);
    expect(s.pebbles.length).toBe(0);
    expect(types(ev)).not.toContain('shoot');
  });

  it('Dauerfeuer: höchstens 2 gleichzeitig, Abklingzeit 0,2 s', () => {
    const s = armed();
    let max = 0, shots = 0;
    for (let i = 0; i < 30; i++) {
      const ev = runGame(s, [[{ action: i % 2 === 0 }, 1]]);
      shots += ev.filter((e) => e.type === 'shoot').length;
      max = Math.max(max, s.pebbles.length);
    }
    expect(max).toBeLessThanOrEqual(PEBBLE_MAX);
    expect(max).toBe(2);
    // Abklingzeit: kein zweiter Schuss vor 0,2 s (10 Schritte), kurz danach einer
    const c = armed();
    const shotsIn = (ev: Array<{ type: string }>) => ev.filter((e) => e.type === 'shoot').length;
    expect(shotsIn(runGame(c, [[{ action: true }, 1]]))).toBe(1);
    expect(shotsIn(runGame(c, [[{}, 9], [{ action: true }, 1]]))).toBe(0);
    expect(shotsIn(runGame(c, [[{}, 3], [{ action: true }, 1]]))).toBe(1);
    expect(shots).toBeGreaterThan(1);
  });

  it('Kiesel fliegt in Blickrichtung mit leichtem Bogen', () => {
    const s = armed(['..P' + '.'.repeat(37), ...Array(30).fill('.'.repeat(40)), '#'.repeat(40)]);
    runGame(s, [[{ action: true }, 1]]);
    const p = s.pebbles[0]!;
    const x0 = p.body.x, y0 = p.body.y;
    runGame(s, [[{}, 30]]); // 0,5 s
    expect(s.pebbles[0]).toBe(p);
    expect(p.body.x - x0).toBeGreaterThan(85);
    expect(p.body.x - x0).toBeLessThan(95);
    // 35 px/s nach oben, 100 px/s² Schwerkraft: Scheitel bei 0,35 s, nach 0,5 s noch über der Starthöhe
    expect(p.body.y).toBeLessThan(y0);
    runGame(s, [[{}, 33]]); // 1,05 s: deutlich tiefer als der Start
    expect(p.body.y).toBeGreaterThan(y0 + 10);
  });

  it('Wand direkt vor Kraxel: Kiesel zerplatzt sofort', () => {
    const rows = [...FIELD];
    rows[5] = '..P#................';
    const s = armed(rows);
    const ev = runGame(s, [[{ action: true }, 1], [{}, 3]]);
    expect(types(ev)).toContain('pebblePop');
    expect(s.pebbles.length).toBe(0);
  });

  it('Kiesel besiegt Käfer und Schnecke, öffnet keine Kiste, zerschlägt keinen Felsblock', () => {
    for (const kind of ['beetle', 'snail'] as const) {
      const s = armed();
      const e = createEnemy({ kind, cx: 7, cy: 5, index: 0 });
      e.active = true;
      s.enemies.push(e);
      const ev = runGame(s, [[{ action: true }, 1], [{}, 40]]);
      expect(e.alive).toBe(false);
      expect(types(ev)).toContain('enemyDefeated');
      expect(s.pebbles.length).toBe(0);
    }

    const r = armed();
    r.grid.set(6, 5, Cell.Rock);
    r.grid.set(8, 5, Cell.Crate);
    r.crates.set(5 * r.grid.width + 8, { kind: 'crystal' });
    const ev = runGame(r, [[{ action: true }, 1], [{}, 30]]);
    expect(r.grid.get(6, 5)).toBe(Cell.Rock);
    expect(types(ev)).not.toContain('rockBreak');
    expect(types(ev)).toContain('pebblePop');
    const r2 = armed();
    r2.grid.set(8, 5, Cell.Crate);
    r2.crates.set(5 * r2.grid.width + 8, { kind: 'crystal' });
    const ev2 = runGame(r2, [[{ action: true }, 1], [{}, 40]]);
    expect(r2.grid.get(8, 5)).toBe(Cell.Crate);
    expect(types(ev2)).not.toContain('crateOpen');
  });

  it('Kiesel verschwindet nach 1,2 s', () => {
    // hoher Raum, damit der Kiesel in 1,2 s nicht auf den Boden trifft
    const s = armed(['..P' + '.'.repeat(37), ...Array(30).fill('.'.repeat(40)), '#'.repeat(40)]);
    runGame(s, [[{ action: true }, 1]]);
    expect(s.pebbles.length).toBe(1);
    runGame(s, [[{}, 60]]);
    expect(s.pebbles.length).toBe(1);
    runGame(s, [[{}, 15]]);
    expect(s.pebbles.length).toBe(0);
  });

  it('Tod, Respawn und Neustart räumen Kiesel weg', () => {
    const feuer = (s: GameState) => {
      s.player.special = 'sling';
      s.pebbleCooldown = 0;
      runGame(s, [[{ action: true }, 1]]);
      expect(s.pebbles.length).toBeGreaterThan(0);
    };
    const a = armed();
    feuer(a);
    killPlayer(a);
    expect(a.pebbles.length).toBe(0);
    const b = armed();
    feuer(b);
    respawn(b);
    expect(b.pebbles.length).toBe(0);
    const c = armed();
    feuer(c);
    restartLevel(c);
    expect(c.pebbles.length).toBe(0);
    expect(c.pebbleCooldown).toBe(0);
  });

  it('stehend geschossen fliegt der Kiesel flach: mindestens 8 Kacheln weit, bevor er am Boden zerplatzt oder abläuft', () => {
    const s = armed(FLAT_ROWS);
    const r = schussWeite(s, [[{}, 5]]);
    expect(r.ende - r.front).toBeGreaterThanOrEqual(8 * TILE);
    expect(r.alter).toBeGreaterThan(0.8);
  });

  it('im Lauf geschossen landet der Kiesel mindestens 6 Kacheln vor Kraxels Vorderkante', () => {
    const s = armed(FLAT_ROWS);
    const r = schussWeite(s, [[{ right: true }, 40]]);
    expect(r.tempo).toBeGreaterThan(100);
    expect(r.ende - r.front).toBeGreaterThanOrEqual(6 * TILE);
  });

  it('Kraxels Vorwärtstempo kommt zum Kiesel, Rückwärtstempo nicht', () => {
    const a = armed(FLAT_ROWS);
    runGame(a, [[{ right: true }, 40]]);
    const vx = a.player.body.vx;
    runGame(a, [[{ action: true, right: true }, 1]]);
    expect(a.pebbles[0]!.body.vx).toBeGreaterThan(PEBBLE_SPEED + vx - 20);
    const b = armed(FLAT_ROWS);
    b.player.body.x = 30 * TILE;
    runGame(b, [[{ right: true }, 40]]);
    b.player.facing = -1; // läuft noch nach rechts, schaut aber nach links
    runGame(b, [[{ action: true }, 1]]);
    expect(b.pebbles[0]!.body.vx).toBeCloseTo(-PEBBLE_SPEED, 0);
  });

  it('an der Wand (Rutschen oder Klettern) schießt Kraxel von der Wand weg', () => {
    const rows = ['.......###', '.......###', '.......###', '.......###', '.......###', '.......###', '.......###', '.......###', '.......###', '.......###', '..P....###', '##########'];
    for (const modus of ['wallSlide', 'climb'] as const) {
      const s = armed(rows);
      const hold = modus === 'climb' ? { right: true, up: true } : { right: true };
      runGame(s, [[{ right: true }, 60], [modus === 'climb' ? hold : { right: true, jump: true }, 1]]);
      for (let i = 0; i < 120 && s.player.mode !== modus; i++) runGame(s, [[hold, 1]]);
      expect(s.player.mode).toBe(modus);
      expect(s.player.wallDir).toBe(1);
      runGame(s, [[{ ...hold, action: true }, 1]]);
      expect(s.pebbles.length).toBe(1);
      expect(s.pebbles[0]!.body.vx).toBeLessThan(0);
    }
  });

  it('stehend trifft der Kiesel einen Käfer am Boden in jeder Entfernung von 2 bis 8 Kacheln', () => {
    for (let d = 2; d <= 8; d++) {
      const s = armed(FLAT_ROWS);
      const e = createEnemy({ kind: 'beetle', cx: 2 + d, cy: 5, index: 0 });
      e.active = true;
      e.body.vx = 0;
      s.enemies.push(e);
      const ev = runGame(s, [[{ action: true }, 1], [{}, 60]]);
      expect([d, e.alive]).toEqual([d, false]);
      expect(types(ev)).toContain('enemyDefeated');
    }
  });
});
