import { describe, expect, it } from 'vitest';
import { STEP } from '../config.ts';
import { createGame, killPlayer, respawn, restartLevel } from './game.ts';
import type { GameState } from './game.ts';
import { parseLevel } from './level.ts';
import { ENZIAN_TIME } from './player.ts';
import { newRun, runAfterLevel, sessionFor } from './run.ts';
import { gameFrom, runGame } from './test-helpers.ts';

const CRATE = ['..........', '....J.....', '..........', '..........', '....P.....', '##########'];
const withCrate = (ch: string) => CRATE.map((r) => r.replace('J', ch));

/** Stößt die Kiste von unten an, wartet bis das Item draußen ist und legt es auf Kraxel. */
function openAndCollect(s: GameState) {
  const ev = runGame(s, [[{ jump: true }, 30], [{}, 45]]);
  const item = s.pickups.find((p) => p.kind === 'item')!;
  item.body.x = s.player.body.x;
  item.body.y = s.player.body.y;
  return [...ev, ...runGame(s, [[{}, 1]])];
}

describe('Spezial-Item und Enzian', () => {
  it('J ohne Helm gibt Helm, mit Helm Schleuder, mit Schleuder +10 Kristalle', () => {
    const a = gameFrom(withCrate('J'));
    openAndCollect(a);
    expect(a.player.helm).toBe(true);
    expect(a.player.special).toBe(null);

    const b = gameFrom(withCrate('J'));
    b.player.helm = true;
    openAndCollect(b);
    expect(b.player.special).toBe('sling');

    const c = gameFrom(withCrate('J'));
    c.player.helm = true;
    c.player.special = 'sling';
    openAndCollect(c);
    expect(c.session.crystals).toBe(10);
  });

  it('E gibt immer den Enzian', () => {
    const s = gameFrom(withCrate('E'));
    const ev = openAndCollect(s);
    expect(s.player.helm).toBe(false);
    expect(s.player.enzian).toBeGreaterThan(0);
    expect(s.player.enzian).toBeLessThanOrEqual(ENZIAN_TIME);
    expect(ev.map((e) => e.type)).toEqual(expect.arrayContaining(['powerUp', 'enzianStart']));
  });

  it('Schleuder aufnehmen setzt auch den Helm', () => {
    const s = gameFrom(['....P.....', '##########']);
    expect(s.player.helm).toBe(false);
    s.pickups.push({ kind: 'item', item: 'sling', index: 0, emerge: 0, taken: false, dir: 1,
      body: { ...s.player.body, vx: 0, vy: 0 } });
    runGame(s, [[{}, 1]]);
    expect(s.player.special).toBe('sling');
    expect(s.player.helm).toBe(true);
  });

  it('Treffer-Reihenfolge: Schleuder, dann Helm, dann Tod', () => {
    // Käfer läuft von rechts auf stehenden Kraxel zu; Schonzeit zwischen den Treffern abwarten.
    const s = gameFrom(['..........', '..........', '.P......k.', '##########']);
    s.player.helm = true;
    s.player.special = 'sling';
    const hits: string[] = [];
    for (let round = 0; round < 3; round++) {
      s.enemies.forEach((e) => { e.alive = true; e.active = true; e.body.x = s.player.body.x + 4; e.body.y = s.player.body.y; });
      const ev = runGame(s, [[{}, 2]]);
      hits.push(`${s.player.special ?? '-'}/${s.player.helm ? 'H' : '-'}/${ev.some((e) => e.type === 'death') ? 'tot' : 'lebt'}`);
      if (s.phase !== 'playing') break;
      runGame(s, [[{}, 100]]); // Schonzeit (1,5 s) läuft ab
    }
    expect(hits).toEqual(['-/H/lebt', '-/-/lebt', '-/-/tot']);
  });

  it('Enzian: kein Schaden, Gegner bei Berührung besiegt, nach 8 s vorbei', () => {
    const s = gameFrom(['..........', '..........', '.P......k.', '##########']);
    s.player.enzian = ENZIAN_TIME;
    const e = s.enemies[0]!;
    e.active = true;
    e.body.x = s.player.body.x + 4;
    e.body.y = s.player.body.y;
    const ev = runGame(s, [[{}, 2]]);
    expect(ev.map((x) => x.type)).toContain('enemyDefeated');
    expect(ev.map((x) => x.type)).not.toContain('hurt');
    expect(e.alive).toBe(false);
    expect(s.phase).toBe('playing');
    const ev2 = runGame(s, [[{}, Math.ceil(ENZIAN_TIME / STEP)]]);
    expect(s.player.enzian).toBe(0);
    expect(ev2.map((x) => x.type)).toContain('enzianEnd');
  });

  it('Enzian endet im Gegner: Schonzeit statt Sofort-Treffer', () => {
    const s = gameFrom(['..........', '..........', '.P......k.', '##########']);
    s.player.enzian = STEP * 1.5; // läuft im zweiten Schritt ab
    const e = s.enemies[0]!;
    e.active = true;
    e.body.x = s.player.body.x + 4;
    e.body.y = s.player.body.y;
    e.body.vx = 0;
    // Gegner bleibt stehen: keine Berührung im ersten Schritt zählen, daher lebendig halten
    e.alive = true;
    const ev: string[] = [];
    for (let i = 0; i < 3; i++) {
      e.alive = true;
      e.body.x = s.player.body.x + 4;
      ev.push(...runGame(s, [[{}, 1]]).map((x) => x.type));
    }
    expect(s.player.enzian).toBe(0);
    expect(s.player.invuln).toBeGreaterThan(0);
    expect(ev).toContain('enzianEnd');
    expect(ev).not.toContain('hurt');
    expect(s.phase).toBe('playing');
  });

  it('Runde trägt Schleuder ins nächste Level, Tod nimmt sie', () => {
    const L = parseLevel('t', 'name: t\nworld: 1\n---\n.......\nP......\n#######');
    const a = createGame(L);
    a.player.helm = true;
    a.player.special = 'sling';
    const run = runAfterLevel(newRun(), a);
    expect(run.special).toBe('sling');
    const b = createGame(L, sessionFor(run), { helm: run.helm, special: run.special });
    expect(b.player.special).toBe('sling');
    expect(b.player.helm).toBe(true);
    killPlayer(b);
    respawn(b);
    expect(b.player.special).toBe(null);
    restartLevel(b);
    expect(b.player.special).toBe('sling');
  });
});
