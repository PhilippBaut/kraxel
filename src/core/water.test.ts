import { describe, expect, it } from 'vitest';
import { STEP, TILE } from '../config.ts';
import { inWater } from './collide.ts';
import { stepGame } from './game.ts';
import { spawnItem } from './pickups.ts';
import { DEFAULT_TUNING } from './tuning.ts';
import { Cell } from './types.ts';
import { gameFrom, gridFrom, held, placePlayer, runGame } from './test-helpers.ts';

const body = (x: number, y: number) => ({ x, y, w: 10, h: 14, vx: 0, vy: 0 });
const row = (s: string, w = 16) => s.padEnd(w, '.');

describe('Bachwasser', () => {
  it('W ist nicht fest', () => {
    const g = gridFrom(['W']);
    expect(g.get(0, 0)).toBe(Cell.Water);
    expect(g.isSolid(0, 0)).toBe(false);
  });

  it('nur echte Überlappung zählt, die Kachel darüber nicht', () => {
    const g = gridFrom(['....', '.WW.', '####']); // Wasser in Reihe 1 (y 16 bis 32)
    expect(inWater(body(20, 16 - 14), g)).toBe(false); // Füße genau auf der Wasseroberfläche
    expect(inWater(body(20, 16 - 14 + 0.5), g)).toBe(true); // ein halbes Pixel hinein
    expect(inWater(body(20, 0), g)).toBe(false);
    expect(inWater(body(16 - 10, 20), g)).toBe(false); // genau links vom Wasser
    expect(inWater(body(20, 20), g)).toBe(true);
    expect(inWater(body(32, 20), g)).toBe(true); // rechte Kachel
    expect(inWater(body(48, 20), g)).toBe(false); // rechts daneben
  });

  it('Berührung tötet Kraxel wie eine Grube', () => {
    const rows = [...Array(9).fill(row('')), row('###WWW###'), row('###WWW###')];
    const s = gameFrom(rows);
    placePlayer(s, 2, 8);
    const lives = s.session.lives;
    const events = runGame(s, [[{ right: true }, 60]]);
    expect(events.some((e) => e.type === 'death')).toBe(true);
    expect(s.phase).toBe('dying');
    expect(s.session.lives).toBe(lives - 1);
  });

  it('Enzian und Schonzeit schützen nicht vor Wasser', () => {
    const rows = [...Array(9).fill(row('')), row('###WWW###'), row('###WWW###')];
    const s = gameFrom(rows);
    placePlayer(s, 2, 8);
    s.player.enzian = 5;
    s.player.invuln = 5;
    runGame(s, [[{ right: true }, 60]]);
    expect(s.phase).toBe('dying');
  });

  it('auf einer Plattform über dem Wasser bleibt Kraxel am Leben', () => {
    const rows = [...Array(10).fill(row('')), row('WWWWWWWWWWWWWWWW'), row('WWWWWWWWWWWWWWWW')];
    const s = gameFrom(rows, undefined, ['plattform: 3 10 3 h 6 2 stamm']); // Oberkante auf Höhe der Wasseroberfläche
    placePlayer(s, 4, 6);
    for (let i = 0; i < 300; i++) {
      runGame(s, [[{}, 1]]);
      expect(s.phase, `Schritt ${i}`).toBe('playing');
    }
    expect(s.player.grounded).toBe(true);
    expect(s.player.body.y + s.player.body.h).toBeCloseTo(10 * TILE, 6);
  });

  it('Gegner verschwinden im Wasser, ohne Besiegt-Ereignis', () => {
    const rows = [...Array(9).fill(row('')), row('###WWW#####'), row('###WWW#####')];
    rows[8] = row('.......k');
    const s = gameFrom(rows);
    const events = [];
    for (let i = 0; i < 400; i++) events.push(...stepGame(s, held() as never, DEFAULT_TUNING, { x: 0, w: 512 }, STEP));
    const e = s.enemies[0]!;
    expect(e.alive).toBe(false);
    expect(e.defeatTimer).toBe(0);
    expect(events.some((ev) => ev.type === 'enemyDefeated')).toBe(false);
    expect(s.phase).toBe('playing');
  });

  it('Items verschwinden im Wasser', () => {
    const rows = [...Array(9).fill(row('')), row('WWWWWWWWWWWW####'), row('WWWWWWWWWWWW####')];
    const s = gameFrom(rows);
    placePlayer(s, 14, 8);
    s.pickups.push({ ...spawnItem('helm', 3, 4), emerge: 0 });
    const item = s.pickups[s.pickups.length - 1]!;
    expect(item.taken).toBe(false);
    runGame(s, [[{}, 60]]);
    expect(item.taken).toBe(true);
    expect(s.player.helm).toBe(false);
  });
});
