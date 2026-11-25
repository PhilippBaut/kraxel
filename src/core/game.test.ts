import { describe, expect, it } from 'vitest';
import { restartLevel } from './game.ts';
import { createPlayer } from './player.ts';
import { gameFrom, runGame } from './test-helpers.ts';

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
  it('Gipfelkreuz ganz oben: Extraleben', () => {
    const s = gameFrom([...Array(6).fill('............'), '.P...Z......', '############']);
    s.player.body.x = 5 * 16 - 8;
    s.player.body.y = 22;
    s.player.grounded = false; // Füße bei 36, Zellunterkante 112 → h = 4,75
    expect(runGame(s, [[{ right: true }, 4]])).toContainEqual({ type: 'goal', bonusCrystals: 0, extraLife: true });
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
