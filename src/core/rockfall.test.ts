import { describe, expect, it } from 'vitest';
import { STEP, TILE } from '../config.ts';
import { respawn, killPlayer } from './game.ts';
import type { GameState } from './game.ts';
import { createRocks, ROCK_TRIGGER_TILES, ROCK_WARN_TIME, stepRocks } from './rockfall.ts';
import { gameFrom, placePlayer, runGame } from './test-helpers.ts';

/** Decke in Reihe 0, der Brocken R hängt in Reihe 1 (Spalte 8), Boden in Reihe 10. Kraxel steht links am Rand. */
const ROWS = [
  '####################',
  '........R...........',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '####################',
];
const ROCK = { cx: 8, cy: 1 };

function level(): GameState {
  const s = gameFrom(ROWS);
  placePlayer(s, 1, 9);
  return s;
}
const types = (ev: Array<{ type: string }>) => ev.map((e) => e.type);
const warnSteps = Math.round(ROCK_WARN_TIME / STEP);

describe('Steinschlag: Aufbau', () => {
  it('R erzeugt einen ruhenden Brocken in der Zelle, die Zelle bleibt leer', () => {
    const s = level();
    expect(s.rocks).toHaveLength(1);
    expect(s.rocks[0]).toMatchObject({ cx: ROCK.cx, cy: ROCK.cy, state: 'idle', t: 0 });
    expect(s.grid.isSolid(ROCK.cx, ROCK.cy)).toBe(false);
    expect(createRocks(s.level.spawns)).toHaveLength(1);
  });
  it('der Brocken hängt oben in seiner Zelle', () => {
    const b = level().rocks[0]!.body;
    expect(b.y).toBe(ROCK.cy * TILE);
    expect(b.x + b.w / 2).toBe(ROCK.cx * TILE + TILE / 2);
  });
});

describe('Steinschlag: Auslöser und Vorwarnung', () => {
  it('weit weg passiert nichts', () => {
    const s = level();
    const ev = runGame(s, [[{}, 60]]);
    expect(s.rocks[0]!.state).toBe('idle');
    expect(types(ev)).not.toContain('rockWarn');
  });
  it('innerhalb von 1,5 Kacheln darunter beginnt die Warnung, mit Ereignis', () => {
    const s = level();
    placePlayer(s, ROCK.cx + 1, 9); // eine Kachel daneben
    const ev = runGame(s, [[{}, 1]]);
    expect(ev).toContainEqual({ type: 'rockWarn', cx: ROCK.cx, cy: ROCK.cy });
    expect(s.rocks[0]!.state).toBe('warn');
  });
  it('Grenze: 1,4 Kacheln löst aus, 1,6 Kacheln nicht', () => {
    const rockMid = ROCK.cx * TILE + TILE / 2;
    for (const [dist, warn] of [[ROCK_TRIGGER_TILES - 0.1, true], [ROCK_TRIGGER_TILES + 0.1, false]] as const) {
      const s = level();
      s.player.body.x = rockMid + dist * TILE - s.player.body.w / 2;
      s.player.body.y = 10 * TILE - s.player.body.h;
      runGame(s, [[{}, 1]]);
      expect(s.rocks[0]!.state === 'warn', `Abstand ${dist}`).toBe(warn);
    }
  });
  it('wer über dem Brocken steht, löst nichts aus', () => {
    const s = gameFrom([
      '####################', '....................', '....................', '........R...........', '....................', '....................',
      '####################',
    ]);
    placePlayer(s, 8, 1);
    runGame(s, [[{}, 5]]);
    expect(s.rocks[0]!.state).toBe('idle');
  });
  it('eine feste Zelle zwischen Kraxel und Brocken löst nichts aus', () => {
    const s = gameFrom([
      '####################', '........R...........', '........#...........', '....................', '....................',
      '####################',
    ]);
    placePlayer(s, 8, 4);
    runGame(s, [[{}, 5]]);
    expect(s.rocks[0]!.state).toBe('idle');
  });
  it('0,6 s Warnung, dann fällt er: rockFall erst nach der Warnzeit', () => {
    const s = level();
    placePlayer(s, ROCK.cx, 9);
    const ev = runGame(s, [[{}, warnSteps - 2]]);
    expect(types(ev)).toContain('rockWarn');
    expect(types(ev)).not.toContain('rockFall');
    expect(s.rocks[0]!.state).toBe('warn');
    const ev2 = runGame(s, [[{}, 3]]);
    expect(ev2).toContainEqual({ type: 'rockFall', cx: ROCK.cx, cy: ROCK.cy });
    expect(s.rocks[0]!.state).toBe('fall');
  });
  it('während der Warnung bewegt sich der Brocken nicht', () => {
    const s = level();
    placePlayer(s, ROCK.cx, 9);
    runGame(s, [[{}, warnSteps - 3]]);
    expect(s.rocks[0]!.body.y).toBe(ROCK.cy * TILE);
  });
});

describe('Steinschlag: Fall', () => {
  it('Treffer wie ein Gegner: ohne Helm ein Leben weniger, der Brocken zerplatzt', () => {
    const s = level();
    placePlayer(s, ROCK.cx, 9);
    const lives = s.session.lives;
    const ev = runGame(s, [[{}, 120]]);
    expect(types(ev)).toContain('hurt');
    expect(types(ev)).toContain('death');
    expect(s.session.lives).toBe(lives - 1);
    expect(types(ev)).toContain('rockBreak');
    expect(s.rocks[0]!.state).toBe('gone');
  });
  it('mit Helm nimmt der Treffer nur den Helm (wie damagePlayer)', () => {
    const s = level();
    s.player.helm = true;
    placePlayer(s, ROCK.cx, 9);
    const ev = runGame(s, [[{}, 120]]);
    expect(types(ev)).toContain('hurt');
    expect(types(ev)).not.toContain('death');
    expect(s.player.helm).toBe(false);
    expect(s.player.invuln).toBeGreaterThan(0);
  });
  it('mit Enzian gibt es keinen Schaden', () => {
    const s = level();
    s.player.enzian = 5;
    placePlayer(s, ROCK.cx, 9);
    const ev = runGame(s, [[{}, 120]]);
    expect(types(ev)).not.toContain('hurt');
    expect(s.phase).toBe('playing');
  });
  it('wer sich nach der Warnung wegbewegt, wird nicht getroffen', () => {
    const s = level();
    placePlayer(s, ROCK.cx, 9);
    runGame(s, [[{}, warnSteps + 2]]); // Brocken fällt
    expect(s.rocks[0]!.state).toBe('fall');
    const ev = runGame(s, [[{ right: true }, 120]]);
    expect(types(ev)).not.toContain('hurt');
    expect(s.session.lives).toBe(5);
    expect(s.rocks[0]!.state).toBe('gone');
  });
  it('der Brocken zerplatzt am Boden, rockBreak liegt in der Zelle über dem Boden', () => {
    const s = level();
    placePlayer(s, ROCK.cx + 4, 9); // 4 Kacheln daneben: kein Auslöser, wir starten von Hand
    s.rocks[0]!.state = 'fall';
    const ev = runGame(s, [[{}, 120]]);
    expect(ev).toContainEqual({ type: 'rockBreak', cx: ROCK.cx, cy: 9 });
    expect(s.rocks[0]!.state).toBe('gone');
  });
  it('der Brocken zerplatzt auf einer Plattform', () => {
    const s = gameFrom([
      '####################', '........R...........', '....................', '....................', '....................', '....................',
      '####################',
    ], undefined, ['plattform: 7 4 3 h 1 0.0001 stamm']);
    placePlayer(s, 1, 5);
    s.rocks[0]!.state = 'fall';
    const ev = runGame(s, [[{}, 90]]);
    expect(ev.filter((e) => e.type === 'rockBreak')).toHaveLength(1);
    expect(ev.find((e) => e.type === 'rockBreak')).toMatchObject({ cy: 3 });
  });
  it('Gegner unter dem Brocken bleiben unversehrt', () => {
    const s = gameFrom([
      '####################', '........R...........', '....................', '....................', '....................', '....................',
      '........s...........', '####################',
    ]);
    placePlayer(s, 1, 6);
    s.rocks[0]!.state = 'fall';
    const ev = runGame(s, [[{}, 90]]);
    expect(types(ev)).not.toContain('enemyDefeated');
    expect(s.enemies[0]!.alive).toBe(true);
    expect(s.rocks[0]!.state).toBe('gone');
  });
  it('stepRocks läuft nur einmal je Brocken zu Ende: danach keine Ereignisse mehr', () => {
    const s = level();
    placePlayer(s, ROCK.cx, 9);
    runGame(s, [[{}, 120]]);
    expect(stepRocks(s, STEP)).toEqual([]);
  });
});

describe('Steinschlag: Zurücksetzen', () => {
  it('nach Tod und Respawn hängt der Brocken wieder an der Decke', () => {
    const s = level();
    placePlayer(s, ROCK.cx, 9);
    runGame(s, [[{}, 60]]);
    expect(s.rocks[0]!.state).not.toBe('idle');
    killPlayer(s);
    respawn(s);
    expect(s.rocks[0]).toMatchObject({ state: 'idle', t: 0 });
    expect(s.rocks[0]!.body.y).toBe(ROCK.cy * TILE);
    expect(s.rocks[0]!.body.vy).toBe(0);
  });
});

describe('Steinschlag: Anbindung', () => {
  it('Übungsplatz enthält einen Brocken mit Decke darüber', async () => {
    const { LEVELS } = await import('../levels/index.ts');
    const { parseLevel } = await import('./level.ts');
    const lv = parseLevel('uebungsplatz', LEVELS.uebungsplatz);
    const r = lv.spawns.find((sp) => sp.kind === 'fallingRock')!;
    expect(r).toBeDefined();
    expect(lv.cells[(r.cy - 1) * lv.width + r.cx]).not.toBe(0);
  });
  it('rockWarn rumpelt, rockBreak nutzt den vorhandenen Klang', async () => {
    const { soundsForEvents } = await import('../audio/sfx.ts');
    expect(soundsForEvents([{ type: 'rockWarn', cx: 1, cy: 1 }])).toEqual(['rumble']);
    expect(soundsForEvents([{ type: 'rockBreak', cx: 1, cy: 1 }])).toEqual(['rockBreak']);
  });
});
