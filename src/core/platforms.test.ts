import { describe, expect, it } from 'vitest';
import { STEP, TILE } from '../config.ts';
import { moveBody } from './collide.ts';
import { TileGrid } from './grid.ts';
import { LevelError, parseLevel, validateLevel } from './level.ts';
import type { LevelData } from './level.ts';
import { createPlatforms, standingOn, stepPlatforms } from './platforms.ts';
import type { PlatformSpec } from './platforms.ts';
import { spawnItem } from './pickups.ts';
import { stepGame } from './game.ts';
import { InputSampler } from './input-frame.ts';
import { DEFAULT_TUNING } from './tuning.ts';
import { gameFrom, held, placePlayer, runGame } from './test-helpers.ts';

const NONE = { requireEdelweiss: false, requireGoal: false };
/** Zeile mit leeren Zellen auf feste Breite aufgefüllt. */
const row = (s: string, w = 30) => s.padEnd(w, '.');
/** Reihe 0–7 leer, 8 Plattformhöhe, 9–10 leer, 11 Boden. */
const field = (rows: Record<number, string> = {}, floor = '#'.repeat(30)) =>
  Array.from({ length: 12 }, (_, i) => (i === 11 ? floor : row(rows[i] ?? '')));

/** Boden aus Wasser mit festem Stück links, darauf steht Kraxel (`P` in Reihe 10), damit er nicht ins Wasser fällt und das Level neu startet. */
const WATER = '####' + 'W'.repeat(26);
const safe = (rows: string[]) => rows.map((r, i) => (i === 10 ? 'P' + r.slice(1) : r));

const spec = (o: Partial<PlatformSpec> = {}): PlatformSpec => ({ cx: 2, cy: 5, width: 2, axis: 'h', travel: 4, speed: 2, art: 'stamm', ...o });
const text = (head: string, rows: string[] = ['P.........', '..........', '##########']) =>
  `name: t\nworld: 1\n${head}\n---\n${rows.join('\n')}`;
const problems = (head: string, rows?: string[]) => validateLevel(parseLevel('t', text(head, rows)), NONE);

describe('Kopfzeile plattform', () => {
  it('wird gelesen, auch mehrere und mit Kommazahlen und negativem Weg', () => {
    const l = parseLevel('t', text('plattform: 2 1 3 h 6 2 stamm\nplattform: 8 0 2 v -1 1.5 stein', ['..........', '....P.....', '##########']));
    expect(l.platforms).toEqual([
      { cx: 2, cy: 1, width: 3, axis: 'h', travel: 6, speed: 2, art: 'stamm' },
      { cx: 8, cy: 0, width: 2, axis: 'v', travel: -1, speed: 1.5, art: 'stein' },
    ]);
  });
  it('ohne Zeile ist die Liste leer', () => {
    expect(parseLevel('t', 'name: x\nworld: 1\n---\nP').platforms).toEqual([]);
  });
  it('unlesbare Zeilen werfen LevelError mit Zeilennummer', () => {
    for (const bad of ['plattform: 2 1 3 h 6 2', 'plattform: a 1 3 h 6 2 stamm', 'plattform: 2 1 3 x 6 2 stamm', 'plattform: 2 1 3 h 6 2 holz']) {
      expect(() => parseLevel('t', text(bad)), bad).toThrowError(LevelError);
    }
    try { parseLevel('t', text('plattform: 2 1 3 h 6 2 holz')); } catch (e) { expect((e as LevelError).line).toBe(3); }
  });
  it('meldet Breite außerhalb 2–4, Weg 0 und Tempo ≤ 0', () => {
    const rows = ['..........', '..........', 'P.........', '##########'];
    for (const bad of ['plattform: 2 1 1 h 3 2 stamm', 'plattform: 2 1 5 h 3 2 stamm', 'plattform: 2 1 3 h 0 2 stamm', 'plattform: 2 1 3 h 3 0 stamm']) {
      expect(problems(bad, rows).some((p) => p.includes('Plattform')), bad).toBe(true);
    }
    expect(problems('plattform: 2 1 2 h 3 2 stamm', rows)).toEqual([]);
    expect(problems('plattform: 2 1 4 h 3 2 stein', rows)).toEqual([]);
  });
  it('meldet Wege durch feste Zellen und aus dem Level heraus', () => {
    const rows = ['..........', '.........B', 'P.........', '##########'];
    expect(problems('plattform: 1 1 2 h 7 2 stamm', rows).some((p) => p.includes('Plattform'))).toBe(true); // Fels bei 9,1
    expect(problems('plattform: 1 1 2 h 6 2 stamm', rows)).toEqual([]); // endet vor dem Fels
    expect(problems('plattform: 1 1 2 h 20 2 stamm', rows).some((p) => p.includes('Plattform'))).toBe(true); // rechts raus
    expect(problems('plattform: 1 1 2 h -3 2 stamm', rows).some((p) => p.includes('Plattform'))).toBe(true); // links raus
    expect(problems('plattform: 1 1 2 v 2 2 stamm', rows).some((p) => p.includes('Plattform'))).toBe(true); // in den Boden
    expect(problems('plattform: 1 1 2 v -2 2 stamm', rows).some((p) => p.includes('Plattform'))).toBe(true); // über das Level hinaus
  });
  it('Plattform im Boden und Laufzeitwerte ohne gültige Achse oder Art werden gemeldet', () => {
    const l = parseLevel('t', text('plattform: 1 1 2 h 3 2 stamm', ['..........', '..........', 'P.........', '##########']));
    const bad: LevelData = { ...l, platforms: [{ ...l.platforms[0]!, axis: 'x' as never }, { ...l.platforms[0]!, art: 'holz' as never }] };
    expect(validateLevel(bad, NONE).filter((p) => p.includes('Plattform'))).toHaveLength(2);
  });
  it('Käfer und Schnecke dürfen auf dem Startplatz einer Plattform stehen', () => {
    expect(problems('plattform: 3 2 3 h 3 1 stein', ['..........', '...k......', '..........', 'P.........', '##########'])).toEqual([]);
    expect(problems('plattform: 4 2 3 h 3 1 stein', ['..........', '...k......', '..........', 'P.........', '##########']).some((p) => p.includes('Boden'))).toBe(true);
  });
});

describe('Freiraum über dem Fahrweg', () => {
  const rows = (extra: Record<number, string> = {}) =>
    ['..........', '..........', '..........', '..........', 'P.........', '##########'].map((r, i) => extra[i] ?? r);
  const clear = (head: string, extra?: Record<number, string>) => problems(head, rows(extra)).filter((p) => p.includes('Plattform'));
  it('senkrecht: eine feste Zelle über der höchsten Lage wird gemeldet', () => {
    const head = 'plattform: 3 3 2 v -1 1 stamm'; // höchste Lage Reihe 2, Fahrer braucht Reihe 0 und 1
    expect(clear(head)).toEqual([]);
    expect(clear(head, { 1: '...B......' })).toHaveLength(1);
    expect(clear(head, { 0: '....B.....' })).toHaveLength(1);
    expect(clear(head, { 1: '.....B....' })).toHaveLength(1); // Fels neben dem Schacht ohne festen Grund darunter: klemmt den überhängenden Fahrer
  });
  it('senkrecht: ein Absatz neben dem Schacht mitten im Weg wird gemeldet (links wie rechts)', () => {
    const head = 'plattform: 3 3 2 v -3 1 stamm'; // Lagen Reihe 0 bis 3, der Fahrer überhängt Spalte 2 und 5
    const base = ['..........', '..........', '..........', '..........', 'P.........', '##########'];
    const q = (extra: Record<number, string>) => problems(head, base.map((r, i) => extra[i] ?? r)).filter((p) => p.includes('Plattform'));
    expect(q({ 1: '..B.......' })).toHaveLength(1); // Vorsprung links, darunter Luft
    expect(q({ 1: '.....B....' })).toHaveLength(1); // Vorsprung rechts, darunter Luft
    expect(q({ 1: 'B....B....' })).toHaveLength(1);
  });
  it('senkrecht: eine glatte Wand neben dem Schacht, die bis zum Boden reicht, wird angenommen', () => {
    const head = 'plattform: 3 3 2 v -3 1 stamm';
    const wall = ['.....B....', '.....B....', '.....B....', '.....B....', 'P....B....', '##########'];
    expect(problems(head, wall).filter((p) => p.includes('Plattform'))).toEqual([]);
    const left = ['..B.......', '..B.......', '..B.......', '..B.......', 'P.B.......', '##########'];
    expect(problems(head, left).filter((p) => p.includes('Plattform'))).toEqual([]);
  });
  it('waagerecht: eine feste Zelle über irgendeiner Lage des Wegs wird gemeldet', () => {
    const head = 'plattform: 1 3 2 h 4 1 stein'; // Spalten 1 bis 6
    expect(clear(head)).toEqual([]);
    expect(clear(head, { 2: '.....B....' })).toHaveLength(1);
    expect(clear(head, { 1: '......B...' })).toHaveLength(1);
    expect(clear(head, { 2: '.......B..' })).toEqual([]); // hinter dem Wegende
  });
});

describe('stepPlatforms', () => {
  it('pendelt deterministisch zwischen Start und Start+Weg', () => {
    const [pl] = createPlatforms([spec()]); // 4 Kacheln, 2 Kacheln/s: 2 s je Weg = 120 Schritte
    expect([pl!.x, pl!.y, pl!.dir]).toEqual([32, 80, 1]);
    for (let i = 0; i < 60; i++) stepPlatforms([pl!], STEP);
    expect(pl!.x).toBeCloseTo(32 + 32, 0);
    for (let i = 0; i < 60; i++) stepPlatforms([pl!], STEP);
    expect(pl!.x).toBeCloseTo(32 + 64, 0);
    for (let i = 0; i < 120; i++) stepPlatforms([pl!], STEP);
    expect(pl!.x).toBeCloseTo(32, 0);
    expect(pl!.y).toBe(80);
  });
  it('dx und dy sind die Bewegung im letzten Schritt, ganze Pixel, Summe ergibt die Strecke', () => {
    const [pl] = createPlatforms([spec({ axis: 'v', travel: -2, speed: 1.5 })]);
    let sum = 0;
    for (let i = 0; i < 80; i++) {
      stepPlatforms([pl!], STEP);
      expect(Number.isInteger(pl!.dy)).toBe(true);
      expect(pl!.dx).toBe(0);
      sum += pl!.dy;
    }
    expect(sum).toBe(pl!.y - 80);
    expect(pl!.y).toBeLessThan(80); // negativer Weg: nach oben
    expect(pl!.y).toBeGreaterThanOrEqual(80 - 2 * TILE);
  });
  it('zwei Läufe liefern denselben Zustand, die Plattform verlässt den Weg nie', () => {
    const a = createPlatforms([spec({ speed: 3.3 })]), b = createPlatforms([spec({ speed: 3.3 })]);
    for (let i = 0; i < 1000; i++) {
      stepPlatforms(a, STEP); stepPlatforms(b, STEP);
      expect(a[0]!.x).toBeGreaterThanOrEqual(32);
      expect(a[0]!.x).toBeLessThanOrEqual(32 + 64);
    }
    expect(a).toEqual(b);
  });
});

describe('standingOn', () => {
  it('Füße auf der Oberkante und waagerecht überlappend', () => {
    const list = createPlatforms([spec()]); // x 32..64, Oberkante y 80
    const body = (x: number, bottom: number) => ({ x, y: bottom - 14, w: 10, h: 14, vx: 0, vy: 0 });
    expect(standingOn(body(40, 80), list)).toBe(list[0]);
    expect(standingOn(body(24, 80), list)).toBe(list[0]); // 24..34 überlappt 32..34
    expect(standingOn(body(22, 80), list)).toBeNull(); // 22..32 berührt nur die Kante
    expect(standingOn(body(64, 80), list)).toBeNull(); // rechts daneben, Berührung zählt nicht
    expect(standingOn(body(40, 70), list)).toBeNull(); // in der Luft
    expect(standingOn(body(40, 90), list)).toBeNull(); // schon darin
  });
});

describe('Kraxel auf Plattformen', () => {
  const head = ['plattform: 4 8 3 h 8 2 stamm'];

  it('landet von oben und fährt waagerecht mit', () => {
    const s = gameFrom(field(), undefined, head);
    placePlayer(s, 5, 5);
    const events = runGame(s, [[{}, 60]]);
    const pl = s.platforms[0]!;
    expect(events.some((e) => e.type === 'land')).toBe(true);
    expect(s.player.grounded).toBe(true);
    expect(s.player.body.y + s.player.body.h).toBeCloseTo(pl.y, 6);
    const x0 = s.player.body.x, px0 = pl.x;
    runGame(s, [[{}, 30]]);
    expect(pl.x - px0).toBeGreaterThan(8);
    expect(s.player.body.x - x0).toBeCloseTo(pl.x - px0, 6);
    expect(s.player.grounded).toBe(true);
    expect(s.player.anim).toBe('idle');
  });

  it('von unten hindurchspringen und oben stabil landen, auch bei abwärts fahrender Plattform', () => {
    const s = gameFrom(field(), undefined, ['plattform: 4 8 4 v 1 1 stein']); // y 128 bis 144, Boden bei 176
    placePlayer(s, 5, 10);
    runGame(s, [[{}, 3]]);
    expect(s.player.grounded).toBe(true);
    runGame(s, [[{ jump: true }, 40]]); // Scheitel 64 px über dem Boden, die Plattform liegt darin
    let landed = -1;
    for (let i = 0; i < 160; i++) {
      runGame(s, [[{}, 1]]);
      if (landed < 0 && s.player.grounded) landed = i;
      if (landed >= 0) {
        expect(s.player.grounded, `Schritt ${i}`).toBe(true);
        expect(s.player.body.y + s.player.body.h).toBeCloseTo(s.platforms[0]!.y, 6);
      }
    }
    expect(landed).toBeGreaterThanOrEqual(0);
    expect(s.player.body.y + s.player.body.h).toBeLessThan(176); // auf der Plattform, nicht am Boden
  });

  it('von unten mit dem Kopf an der Plattform bleibt er nicht hängen', () => {
    const s = gameFrom(field(), undefined, ['plattform: 4 9 3 h 0.5 1 stein']);
    placePlayer(s, 5, 10);
    runGame(s, [[{}, 3], [{ jump: true }, 10]]); // der Kopf (ab 162) fährt durch die Plattform (144 bis 160)
    expect(s.player.body.vy).toBeLessThan(0); // steigt, nichts hat ihn gestoppt
    expect(s.player.body.y + s.player.body.h).toBeLessThan(11 * TILE - 20);
  });

  it('von der Seite hindurchgehen: ein Körper neben der Plattform läuft hindurch', () => {
    const s = gameFrom(field({}, '#'.repeat(30)), undefined, ['plattform: 6 10 2 h 0.5 1 stamm']); // y 160..176, Boden 176
    placePlayer(s, 3, 10);
    runGame(s, [[{}, 3], [{ right: true }, 60]]);
    expect(s.player.body.x).toBeGreaterThan(6 * TILE + 32); // rechts hinter der Plattform
  });

  it('Plattform fährt an einer Wand vorbei: Kraxel wird nicht hineingeschoben', () => {
    const s = gameFrom(field({ 7: '.........B' }), undefined, ['plattform: 2 8 3 h 8 3 stamm']); // Fels bei 9,7 über dem Weg
    placePlayer(s, 3, 6);
    runGame(s, [[{}, 40]]);
    expect(s.player.grounded).toBe(true);
    let reach = 0;
    for (let i = 0; i < 200; i++) {
      runGame(s, [[{}, 1]]);
      reach = Math.max(reach, s.platforms[0]!.x + 48);
      expect(s.player.body.x + s.player.body.w).toBeLessThanOrEqual(9 * TILE + 1e-6); // nie in der Wandzelle
    }
    expect(reach).toBeGreaterThan(9 * TILE + 16); // die Plattform ist an der Wand vorbeigefahren
  });

  it('Springen und Rennen von der Plattform wie vom Boden', () => {
    const s = gameFrom(field(), undefined, ['plattform: 4 8 4 h 0 1 stamm']); // steht still: Werte wie vom Boden
    placePlayer(s, 5, 6);
    runGame(s, [[{}, 40]]);
    expect(s.player.grounded).toBe(true);
    const ev = runGame(s, [[{ jump: true }, 1]]);
    expect(ev.some((e) => e.type === 'jump')).toBe(true);
    expect(s.player.body.vy).toBeLessThan(0);
    runGame(s, [[{}, 80]]);
    expect(s.player.grounded).toBe(true);
    // Rennen: nach der Anlaufzeit schneller als Gehen
    const t = DEFAULT_TUNING;
    runGame(s, [[{ right: true }, 20]]);
    expect(s.player.grounded).toBe(true);
    expect(s.player.body.vx).toBeGreaterThan(0);
    expect(s.player.body.vx).toBeLessThanOrEqual(t.walkSpeed + 1e-9);
  });

  it('Coyote-Zeit gilt beim Verlassen der Plattform', () => {
    const s = gameFrom(field(), undefined, ['plattform: 4 8 3 h 0 1 stamm']);
    placePlayer(s, 5, 6);
    runGame(s, [[{}, 40]]);
    let n = 0;
    while (s.player.grounded && n++ < 200) runGame(s, [[{ right: true }, 1]]); // über die rechte Kante
    expect(s.player.grounded).toBe(false);
    expect(s.player.body.y + s.player.body.h - s.platforms[0]!.y).toBeLessThan(1); // nur der erste Fallschritt
    const ev = runGame(s, [[{ jump: true, right: true }, 1]]);
    expect(ev.some((e) => e.type === 'jump')).toBe(true);
  });

  it('Stampfen landet auf der Plattform wie auf dem Boden', () => {
    const s = gameFrom(field(), undefined, ['plattform: 4 8 4 h 2 1 stamm']);
    placePlayer(s, 5, 3);
    const sampler = new InputSampler();
    const events = [];
    for (let i = 0; i < 90; i++) {
      events.push(...stepGame(s, sampler.sample(held(i === 0 ? { down: true } : {})), DEFAULT_TUNING, { x: 0, w: 512 }, STEP));
    }
    expect(events.some((e) => e.type === 'pound')).toBe(true);
    expect(events.some((e) => e.type === 'poundLand')).toBe(true);
    expect(s.player.mode).toBe('normal');
    expect(s.player.grounded).toBe(true);
    expect(s.player.body.y + s.player.body.h).toBeCloseTo(s.platforms[0]!.y, 6);
    expect(s.phase).toBe('playing');
  });

  it('Neustart setzt die Plattformen auf den Anfang zurück', () => {
    const s = gameFrom(field(), undefined, head);
    runGame(s, [[{}, 90]]);
    expect(s.platforms[0]!.x).toBeGreaterThan(64);
    s.player.body.y = 12 * TILE + 100; // in die Grube
    let respawned = false;
    for (let i = 0; i < 200 && !respawned; i++) respawned = runGame(s, [[{}, 1]]).some((e) => e.type === 'respawn');
    expect(respawned).toBe(true);
    expect(s.platforms[0]!.x).toBe(64);
    expect(s.platforms[0]!.dir).toBe(1);
  });
});

describe('Gegner und Items auf Plattformen', () => {
  it('Schnecke fährt mit und dreht an der Plattformkante um', () => {
    const rows = safe(field({ 7: '.....s' }, WATER));
    const s = gameFrom(rows, undefined, ['plattform: 5 8 2 h 4 1 stamm']);
    const e = s.enemies[0]!;
    let flips = 0, last = e.dir;
    for (let i = 0; i < 900; i++) {
      runGame(s, [[{}, 1]]);
      if (e.dir !== last) { flips++; last = e.dir; }
      expect(e.alive, `Schritt ${i}`).toBe(true);
      expect(standingOn(e.body, s.platforms), `Schritt ${i}`).toBe(s.platforms[0]); // fällt nie vom Stamm
    }
    expect(flips).toBeGreaterThanOrEqual(2); // dreht an beiden Kanten um (Weg 32 px bei Tempo 15)
  });

  it('Käfer auf der Plattform bewegt sich mit ihr, solange er darauf steht', () => {
    const rows = safe(field({ 7: '......k' }, WATER));
    const s = gameFrom(rows, undefined, ['plattform: 6 8 4 v 2 1 stamm']);
    s.enemies[0]!.dir = 1;
    for (let i = 0; i < 40; i++) runGame(s, [[{}, 1]]);
    const e = s.enemies[0]!;
    expect(e.alive).toBe(true);
    expect(s.platforms[0]!.y).toBeGreaterThan(128);
    expect(e.body.y + e.body.h).toBeCloseTo(s.platforms[0]!.y, 6);
  });

  it('Item fährt mit', () => {
    const rows = safe(field({}, WATER));
    const s = gameFrom(rows, undefined, ['plattform: 6 8 4 v 2 1 stamm']);
    const item = { ...spawnItem('helm', 6, 7), emerge: 0 };
    s.pickups.push(item);
    for (let i = 0; i < 45; i++) runGame(s, [[{}, 1]]);
    expect(item.taken).toBe(false);
    expect(s.platforms[0]!.y).toBeGreaterThan(128);
    expect(item.body.y + item.body.h).toBeCloseTo(s.platforms[0]!.y, 6);
  });
});

describe('Landen auf aufwärts fahrender Plattform', () => {
  const rising = () => {
    const [pl] = createPlatforms([spec({ axis: 'v', travel: -3, speed: 1 })]);
    pl!.dy = -2; // fährt dem Körper entgegen
    return pl!;
  };
  it('wer von der Seite kommt, wird nicht auf die Oberkante hochgezogen', () => {
    const pl = rising(); // x 32..64, Oberkante y 80
    const body = { x: pl.x - 10, y: pl.y + 1 - 14, w: 10, h: 14, vx: 300, vy: 60 }; // Füße 1 px unter der Oberkante, schiebt sich in 1/60 s über sie
    const r = moveBody(body, STEP, new TileGrid(10, 10), 0, [pl]);
    expect(r.down).toBe(false);
    expect(body.y + body.h).toBeGreaterThan(pl.y + 1);
  });
  it('wer schon darüber steht, wird vom entgegenkommenden Rand getragen', () => {
    const pl = rising();
    const body = { x: pl.x + 5, y: pl.y + 1 - 14, w: 10, h: 14, vx: 0, vy: 60 };
    const r = moveBody(body, STEP, new TileGrid(10, 10), 0, [pl]);
    expect(r.down).toBe(true);
    expect(body.y + body.h).toBe(pl.y);
  });
});
