import { describe, expect, it } from 'vitest';
import { restartLevel } from './game.ts';
import { createPlayer } from './player.ts';
import { gameFrom, placePlayer, runGame } from './test-helpers.ts';
import { Cell } from './types.ts';

const PIT = ['............', '.P....S.....', '####..####..', '............'];

describe('Leben, Tod, Ziel', () => {
  it('Sturz in die Grube: Tod, ein Leben weniger, Neustart am Start', () => {
    const s = gameFrom(PIT);
    const ev = runGame(s, [[{ right: true }, 40], [{}, 90]]);
    expect(ev).toContainEqual({ type: 'death' });
    expect(ev).toContainEqual({ type: 'respawn' });
    expect(s.session.lives).toBe(4);
    expect(s.player.body.x).toBe(createPlayer(1, 1).body.x);
  });
  it('Steinmännchen wird Neustartpunkt', () => {
    const s = gameFrom(PIT);
    s.player.body.x = 6 * 16 + 3;
    const ev = runGame(s, [[{}, 2]]);
    expect(ev).toContainEqual({ type: 'checkpoint', index: 0 });
    s.player.body.y = 999;
    runGame(s, [[{}, 90]]);
    expect(s.player.body.x).toBe(createPlayer(6, 1).body.x);
  });
  it('letztes Leben verloren: Game Over', () => {
    const s = gameFrom(PIT);
    s.session.lives = 1;
    s.player.body.y = 999;
    expect(runGame(s, [[{}, 90]])).toContainEqual({ type: 'gameOver' });
    expect(s.phase).toBe('gameOver');
  });
  it('Edelweiß bleibt nach Tod gesammelt, Kristalle erscheinen neu', () => {
    const s = gameFrom(['............', '.P1c........', '############']);
    runGame(s, [[{ right: true }, 30]]);
    expect(s.session.edelweiss[0]).toBe(true);
    s.player.body.y = 999;
    runGame(s, [[{}, 90]]);
    expect(s.pickups.some((p) => p.kind === 'edelweiss')).toBe(false);
    expect(s.pickups.some((p) => p.kind === 'crystal' && !p.taken)).toBe(true);
  });
  it('Gipfelkreuz unten: 1 Bonus-Kristall, Zeit steht', () => {
    const s = gameFrom(['............', '.P...Z......', '############']);
    const ev = runGame(s, [[{ right: true }, 60]]);
    expect(ev).toContainEqual({ type: 'goal', bonusCrystals: 1, extraLife: false });
    const t = s.session.time;
    runGame(s, [[{}, 30]]);
    expect(s.session.time).toBe(t);
  });
  it('Gipfelkreuz berührt mit Schonzeit: Kraxel blinkt im Jubel nicht unsichtbar', () => {
    const s = gameFrom(['............', '.P...Z......', '############']);
    s.player.invuln = 1.5;
    runGame(s, [[{ right: true }, 60]]);
    expect(s.phase).toBe('goal');
    expect(s.player.invuln).toBe(0);
    runGame(s, [[{}, 20]]);
    expect(s.player.invuln).toBe(0);
  });
  it('Gipfelkreuz ganz oben: Extraleben', () => {
    const s = gameFrom([...Array(6).fill('............'), '.P...Z......', '############']);
    s.player.body.x = 5 * 16 - 8;
    s.player.body.y = 22;
    s.player.grounded = false; // Füße bei 36, Zellunterkante 112 → h = 4,75
    expect(runGame(s, [[{ right: true }, 4]])).toContainEqual({ type: 'goal', bonusCrystals: 0, extraLife: true });
  });
  it('Ziel oben: Kraxel landet, jubelt, Zeit steht', () => {
    const s = gameFrom([...Array(6).fill('............'), '.P...Z......', '############']);
    s.player.body.x = 5 * 16 - 8;
    s.player.body.y = 22;
    s.player.grounded = false;
    runGame(s, [[{ right: true }, 4]]);
    const t = s.session.time;
    runGame(s, [[{ left: true }, 90]]);
    expect([s.player.grounded, s.player.mode, s.player.anim, s.session.time]).toEqual([true, 'goal', 'cheer', t]);
  });
  it('Level neu starten setzt Sitzung auf den Levelstart zurück', () => {
    const s = gameFrom(['......', '.Pc...', '######']);
    runGame(s, [[{ right: true }, 30]]);
    restartLevel(s);
    expect([s.session.crystals, s.session.time]).toEqual([0, 0]);
  });
  it('ein Tod erzeugt genau ein death-Ereignis', () => {
    const s = gameFrom(PIT);
    s.player.body.y = 999;
    const ev = runGame(s, [[{}, 200]]);
    expect(ev.filter((e) => e.type === 'death')).toHaveLength(1);
  });
});

describe('Stampfen auf Felsblöcke und Kisten', () => {
  const POUND = [[{}, 2], [{ jump: true }, 12], [{ down: true }, 1], [{}, 60]] as Parameters<typeof runGame>[1];
  const ROOF = ['............', '............', '............', '...BB.......', '............', '............', '############'];

  it('Stampfen über zwei Felsblöcken bricht beide, Kraxel fällt durch', () => {
    const s = gameFrom(ROOF);
    placePlayer(s, 3, 2);
    s.player.body.x = 4 * 16 - 5; // je 5 px über Zelle 3 und 4
    const ev = runGame(s, POUND);
    expect(ev.filter((e) => e.type === 'rockBreak')).toHaveLength(2);
    expect(s.grid.get(3, 3)).toBe(Cell.Empty);
    expect(s.grid.get(4, 3)).toBe(Cell.Empty);
    expect(s.player.body.y + s.player.body.h).toBe(6 * 16); // unten am Boden, nicht oben auf dem Dach
  });
  it('Stampfen auf einen einzelnen Felsblock mit Boden darunter: bricht, Kraxel landet am Boden', () => {
    const s = gameFrom(ROOF.map((r) => r.replace('BB', 'B.')));
    placePlayer(s, 3, 2);
    const ev = runGame(s, POUND);
    expect(ev.filter((e) => e.type === 'rockBreak')).toHaveLength(1);
    expect(s.player.body.y + s.player.body.h).toBe(6 * 16);
    expect(s.player.grounded).toBe(true);
  });
  it('Stampfen auf festen Boden landet ganz normal und lässt Kraxel stehen', () => {
    const s = gameFrom(ROOF);
    placePlayer(s, 8, 5);
    const ev = runGame(s, [[{}, 2], [{ jump: true }, 12], [{ down: true }, 1], [{}, 40]]);
    expect(ev.some((e) => e.type === 'poundLand')).toBe(true);
    expect(ev.some((e) => e.type === 'rockBreak')).toBe(false);
    expect(s.player.grounded).toBe(true);
    expect(s.player.body.y + s.player.body.h).toBe(6 * 16);
  });
  it('Stampfen über zwei Kisten öffnet genau eine', () => {
    const s = gameFrom(ROOF.map((r) => r.replace('BB', 'KK')));
    placePlayer(s, 3, 2);
    s.player.body.x = 4 * 16 - 5;
    const ev = runGame(s, [[{}, 2], [{ jump: true }, 12], [{ down: true }, 1], [{}, 30]]);
    expect(ev.filter((e) => e.type === 'crateOpen')).toHaveLength(1);
    expect([s.grid.get(3, 3), s.grid.get(4, 3)].filter((c) => c === Cell.CrateUsed)).toHaveLength(1);
  });
});
