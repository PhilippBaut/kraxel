import { describe, expect, it } from 'vitest';
import { PLAYER_H } from './player.ts';
import { stepGame } from './game.ts';
import { InputSampler } from './input-frame.ts';
import { DEFAULT_TUNING } from './tuning.ts';
import { gameFrom, held, runGame } from './test-helpers.ts';

const ROW = (s: string) => gameFrom(['..........', s, '##########']); // s enthält immer ein 'P'

describe('Gegner', () => {
  it('Käfer läuft 30 px/s und dreht an der Wand', () => {
    const s = gameFrom(['..........', '#k......P.', '##########']);
    const e = s.enemies[0]!;
    const x0 = e.body.x;
    runGame(s, [[{}, 30]]);
    expect(e.dir).toBe(1);
    expect(e.body.x).toBeGreaterThanOrEqual(x0 - 16);
  });

  it('Käfer läuft über Kanten, Schnecke dreht um', () => {
    const s = gameFrom(['..........', '..k.....P.', '###.....##', '..........']);
    runGame(s, [[{}, 300]]);
    expect(s.enemies[0]!.alive).toBe(false);
    const s2 = gameFrom(['..........', '..s.....P.', '.###....##', '..........']);
    runGame(s2, [[{}, 240]]);
    expect(s2.enemies[0]!.alive).toBe(true);
    expect(s2.enemies[0]!.body.y + 12).toBe(32);
  });

  it('inaktiv außerhalb des Sichtfensters', () => {
    const s = gameFrom(['P' + '.'.repeat(58) + 'k', '#'.repeat(60)]);
    const x0 = s.enemies[0]!.body.x;
    stepGame(s, new InputSampler().sample(held()), DEFAULT_TUNING, { x: 0, w: 256 }, 1 / 60);
    expect(s.enemies[0]!.body.x).toBe(x0);
    expect(s.enemies[0]!.active).toBe(false);
  });

  it('wird aktiv, sobald das Sichtfenster näher als 32 px kommt, und bleibt aktiv', () => {
    const s = gameFrom(['P' + '.'.repeat(58) + 'k', '#'.repeat(60)]);
    const input = new InputSampler().sample(held());
    stepGame(s, input, DEFAULT_TUNING, { x: 700, w: 256 }, 1 / 60);
    expect(s.enemies[0]!.active).toBe(true);
    const x1 = s.enemies[0]!.body.x;
    stepGame(s, input, DEFAULT_TUNING, { x: 0, w: 256 }, 1 / 60);
    expect(s.enemies[0]!.body.x).toBeLessThan(x1);
  });

  it('Draufspringen besiegt Käfer und federt', () => {
    const s = ROW('.P..k.....');
    const e = s.enemies[0]!;
    s.player.body.x = e.body.x;
    s.player.body.y = e.body.y - PLAYER_H - 2;
    s.player.body.vy = 120;
    s.player.grounded = false;
    const ev = runGame(s, [[{}, 3]]);
    expect(ev.map((x) => x.type)).toEqual(expect.arrayContaining(['stomp', 'enemyDefeated']));
    expect(s.player.body.vy).toBeLessThan(-200);
    expect(e.alive).toBe(false);
    expect(e.defeatTimer).toBeGreaterThan(0);
  });

  it('besiegte Gegner verschwinden nach 0,5 s', () => {
    const s = ROW('.P..k.....');
    const e = s.enemies[0]!;
    s.player.body.x = e.body.x;
    s.player.body.y = e.body.y - PLAYER_H - 2;
    s.player.body.vy = 120;
    runGame(s, [[{}, 40]]);
    expect(e.defeatTimer).toBe(0);
  });

  it('seitlich in den Käfer laufen: ohne Helm Tod, mit Helm Helm weg', () => {
    const s = gameFrom(['..........', '.P..k.....', '##########']);
    s.player.helm = true;
    expect(runGame(s, [[{ right: true }, 40]])).toContainEqual({ type: 'hurt' });
    expect(s.player.helm).toBe(false);
    expect(s.player.invuln).toBeGreaterThan(0);
    expect(s.player.anim).toBe('hurt');
  });

  it('ohne Helm: Schaden tötet Kraxel, genau ein death', () => {
    const s = gameFrom(['..........', '.P..k.....', '##########']);
    const ev = runGame(s, [[{ right: true }, 40]]);
    expect(ev).toContainEqual({ type: 'hurt' });
    expect(ev.filter((e) => e.type === 'death')).toHaveLength(1);
    expect(s.phase).toBe('dying');
    expect(s.player.mode).toBe('dead');
  });

  it('während der Schonzeit richtet ein Gegner nichts an', () => {
    const s = gameFrom(['..........', '.P..k.....', '##########']);
    s.player.helm = true;
    s.player.invuln = 5;
    const ev = runGame(s, [[{ right: true }, 40]]);
    expect(ev).not.toContainEqual({ type: 'hurt' });
    expect(s.player.helm).toBe(true);
  });

  it('Draufspringen auf die Schnecke tut weh', () => {
    const s = ROW('.P..s.....');
    const e = s.enemies[0]!;
    s.player.body.x = e.body.x;
    s.player.body.y = e.body.y - PLAYER_H - 2;
    s.player.body.vy = 120;
    s.player.helm = true;
    expect(runGame(s, [[{}, 3]])).toContainEqual({ type: 'hurt' });
    expect(e.alive).toBe(true);
  });

  it('Stampfen besiegt den Käfer und geht weiter', () => {
    const s = ROW('.P..k.....');
    const e = s.enemies[0]!;
    s.player.body.x = e.body.x;
    s.player.body.y = e.body.y - PLAYER_H - 2;
    s.player.mode = 'pound';
    s.player.body.vy = 300;
    const ev = runGame(s, [[{}, 1]]);
    expect(ev.map((x) => x.type)).toContain('enemyDefeated');
    expect(s.player.body.vy).toBeGreaterThan(0);
  });

  it('Stampfen auf die Schnecke tut weh', () => {
    const s = ROW('.P..s.....');
    const e = s.enemies[0]!;
    s.player.body.x = e.body.x;
    s.player.body.y = e.body.y - PLAYER_H - 2;
    s.player.mode = 'pound';
    s.player.body.vy = 300;
    s.player.helm = true;
    expect(runGame(s, [[{}, 1]])).toContainEqual({ type: 'hurt' });
  });

  it('Kopfstoß gegen den Block unter einem Gegner besiegt ihn', () => {
    const s = gameFrom(['....s.....', '....K.....', '..........', '..........', '....P.....', '##########']);
    expect(runGame(s, [[{ jump: true }, 30]]).map((e) => e.type)).toContain('enemyDefeated');
  });

  it('zwei übereinanderliegende Käfer: ein Sprung besiegt beide ohne Schaden', () => {
    const s = ROW('.P..kk....');
    const [a, b] = s.enemies as [typeof s.enemies[0], typeof s.enemies[0]];
    b.body.x = a.body.x;
    s.player.helm = true;
    s.player.body.x = a.body.x;
    s.player.body.y = a.body.y - PLAYER_H - 2;
    s.player.body.vy = 120;
    s.player.grounded = false;
    const ev = runGame(s, [[{}, 3]]);
    expect(ev).not.toContainEqual({ type: 'hurt' });
    expect(ev.filter((e) => e.type === 'enemyDefeated')).toHaveLength(2);
    expect(s.player.helm).toBe(true);
    expect(s.player.body.vy).toBeLessThan(-200);
  });

  it('zwei Käfer von der Seite ohne Helm: genau ein hurt im Schritt', () => {
    const s = ROW('.P..kk....');
    const [a, b] = s.enemies as [typeof s.enemies[0], typeof s.enemies[0]];
    b.body.x = a.body.x;
    s.player.body.x = a.body.x - 4;
    const ev = runGame(s, [[{}, 1]]);
    expect(ev.filter((e) => e.type === 'hurt')).toHaveLength(1);
  });
});
