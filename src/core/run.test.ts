import { describe, expect, it } from 'vitest';
import { START_LIVES } from '../config.ts';
import { createGame, respawn, killPlayer } from './game.ts';
import { parseLevel } from './level.ts';
import { newRun, runAfterGameOver, runAfterLevel, sessionFor } from './run.ts';

const L = parseLevel('t', 'name: t\nworld: 1\n---\n.......\nP......\n#######');

describe('Spielrunde', () => {
  it('neue Runde: 5 Leben, 0 Kristalle, kein Helm', () => {
    expect(newRun()).toEqual({ lives: START_LIVES, crystals: 0, helm: false });
  });
  it('sessionFor: Leben und Kristalle aus der Runde, Zeit 0, kein Edelweiß', () => {
    expect(sessionFor({ lives: 3, crystals: 42, helm: true })).toEqual({ lives: 3, crystals: 42, time: 0, edelweiss: [false, false, false] });
  });
  it('Helm aus der Runde: createGame mit helm, nach Tod weg', () => {
    const s = createGame(L, sessionFor({ ...newRun(), helm: true }), { helm: true });
    expect(s.player.helm).toBe(true);
    killPlayer(s);
    respawn(s);
    expect(s.player.helm).toBe(false);
  });
  it('ohne opts kein Helm', () => {
    expect(createGame(L).player.helm).toBe(false);
  });
  it('runAfterLevel übernimmt Leben, Kristalle, Helm', () => {
    const s = createGame(L);
    s.session.lives = 3;
    s.session.crystals = 42;
    s.player.helm = true;
    expect(runAfterLevel(newRun(), s)).toEqual({ lives: 3, crystals: 42, helm: true });
  });
  it('runAfterGameOver ist eine neue Runde', () => {
    expect(runAfterGameOver()).toEqual(newRun());
  });
});
