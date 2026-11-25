// Level 1-1 „Sonnige Almwiese“: Pflicht-Bausteine, die drei Edelweiß, Gruben und die Lehrstellen.
// Alle Wege laufen über echte Eingabe-Skripte (runGame), nichts wird zum Ziel teleportiert.
import { describe, expect, it } from 'vitest';
import { STEP, TILE, VIEW_H } from '../config.ts';
import { createCamera, stepCamera } from '../core/camera.ts';
import { createGame } from '../core/game.ts';
import type { GameState } from '../core/game.ts';
import { parseLevel, validateLevel } from '../core/level.ts';
import type { LevelData } from '../core/level.ts';
import { placePlayer, runGame } from '../core/test-helpers.ts';
import type { Script } from '../core/test-helpers.ts';
import { Cell } from '../core/types.ts';
import type { GameEvent } from '../core/types.ts';
import { LEVELS, START_LEVEL } from './index.ts';

const L = parseLevel('1-1', LEVELS['1-1']);

// Stellen aus 1-1.txt als (Spalte, Reihe). Die Boden-Oberkante ist Reihe 19, Kraxel steht dort in Reihe 18.
const E1_ROCK = { cx: 34, cy: 16 };        // Felsblock unter Edelweiß 1, darüber noch einer in Reihe 14
const STEP_BEFORE_E1 = { cx: 30, cy: 16 }; // Absatz vor dem Felsblock-Klotz
const SHAFT_ENTRY = { cx: 77, cy: 18 };    // vor der linken Schachtwand
const PLATEAU = { cx: 86, cy: 10 };        // linker Rand der Hochfläche über dem Schacht
const PLATEAU_FEET = 11;
const CLIMB_FOOT = { cx: 110, cy: 18 };    // vor der Kletterwand
const TOWER_FEET = 14;                     // Oberkante der Kletterwand und der Höhlendecke
const TOWER_ROCK = { cx: 116, cy: 14 };    // Felsblock in der Höhlendecke
const HIDDEN = { cx: 187, cy: 16 };        // versteckte Kiste unter dem Vorsprung mit Edelweiß 3

const feetRow = (s: GameState) => (s.player.body.y + s.player.body.h) / TILE;
const solidCell = (l: LevelData, cx: number, cy: number) => {
  const c = l.cells[cy * l.width + cx];
  return c === Cell.Ground || c === Cell.Rock || c === Cell.Crate || c === Cell.CrateUsed;
};
/** Ohne Gegner: für Wege, bei denen es nur um Sprünge geht (Gegner stünden in runGame außerhalb des Fensters still). */
const calm = (l: LevelData = L) => {
  const s = createGame(l);
  s.enemies = [];
  return s;
};

describe('Level 1-1: Aufbau', () => {
  it('ist gültig und hat die Pflicht-Bausteine', () => {
    expect(validateLevel(L, { requireEdelweiss: true, requireGoal: true })).toEqual([]);
    expect(L.name).toBe('Sonnige Almwiese');
    expect(L.width).toBeGreaterThanOrEqual(180); expect(L.width).toBeLessThanOrEqual(220);
    expect(L.height).toBeGreaterThanOrEqual(18); expect(L.height).toBeLessThanOrEqual(24);
    const kinds = [...L.crates.values()].map((c) => c.kind);
    expect(kinds.filter((k) => k === 'item').length).toBe(1); expect(kinds).toContain('multi');
    expect([...L.cells].includes(Cell.HiddenCrate)).toBe(true);
    expect([...L.cells].filter((c) => c === Cell.Rock).length).toBeGreaterThanOrEqual(6);
    expect(L.spawns.filter((s) => s.kind === 'checkpoint').length).toBe(1);
    const crystalCrates = [...L.crates].filter(([i, c]) => c.kind === 'crystal' && L.cells[i] === Cell.Crate);
    expect(crystalCrates.length).toBeGreaterThanOrEqual(4);
    const count = (k: string) => L.spawns.filter((s) => s.kind === k).length;
    expect(count('crystal')).toBeGreaterThanOrEqual(30);
    expect(count('beetle')).toBeGreaterThanOrEqual(6);
    expect(count('snail')).toBeGreaterThanOrEqual(3);
  });

  it('Steinmännchen etwa in der Mitte, Gipfelkreuz am Ende', () => {
    const cp = L.spawns.find((s) => s.kind === 'checkpoint')!;
    const goal = L.spawns.find((s) => s.kind === 'goal')!;
    expect(cp.cx / L.width).toBeGreaterThan(0.4); expect(cp.cx / L.width).toBeLessThan(0.65);
    expect(goal.cx).toBeGreaterThan(L.width - 10);
  });

  it('das Titelbild startet Level 1-1', () => {
    expect(START_LEVEL).toBe('1-1');
  });
});

describe('Level 1-1: Edelweiß', () => {
  const underE1: Script = [[{}, 2], [{ jump: true }, 20], [{}, 40], [{ jump: true }, 30], [{}, 40]];

  it('Edelweiß 1 ist mit Helm erreichbar', () => {
    const s = calm();
    placePlayer(s, E1_ROCK.cx, 18);
    s.player.helm = true;
    const ev = runGame(s, underE1);
    expect(ev).toContainEqual({ type: 'rockBreak', ...E1_ROCK });
    expect(s.session.edelweiss[0]).toBe(true);
  });

  it('Edelweiß 1 ist auch per Stampfen von oben erreichbar', () => {
    const s = calm();
    placePlayer(s, STEP_BEFORE_E1.cx, STEP_BEFORE_E1.cy);
    const ev = runGame(s, [
      [{}, 2], [{ right: true, jump: true }, 14], [{ jump: true }, 16], [{}, 20], [{ right: true }, 20], [{}, 20], // auf den Klotz
      [{ jump: true }, 10], [{ down: true }, 1], [{}, 50], // oberen Felsblock zerstampfen, Edelweiß nehmen
      [{ jump: true }, 8], [{ down: true }, 1], [{}, 50], // unteren Felsblock zerstampfen
    ]);
    expect(ev).toContainEqual({ type: 'rockBreak', cx: E1_ROCK.cx, cy: 14 });
    expect(s.session.edelweiss[0]).toBe(true);
    expect(feetRow(s)).toBe(19);
  });

  it('Edelweiß 1 bleibt ohne Helm hinter dem Felsblock', () => {
    const s = calm();
    placePlayer(s, E1_ROCK.cx, 18);
    const ev = runGame(s, underE1);
    expect(ev).toContainEqual({ type: 'bump', ...E1_ROCK });
    expect(s.session.edelweiss[0]).toBe(false);
  });

  it('Edelweiß 2 ist per Kraxeln erreichbar', () => {
    // Vom Rand der Hochfläche über den Schacht an die linke Wand springen und hinaufkraxeln.
    const s = calm();
    placePlayer(s, PLATEAU.cx, PLATEAU.cy);
    const ev = runGame(s, [[{}, 2], [{ left: true }, 2], [{ left: true, up: true, jump: true }, 61]]);
    expect(ev).toContainEqual({ type: 'edelweiss', index: 1 });
    expect(s.session.edelweiss[1]).toBe(true);
  });

  it('Edelweiß 2 ist ohne Kraxeln nicht erreichbar', () => {
    for (let cx = PLATEAU.cx; cx <= PLATEAU.cx + 7; cx++) {
      for (let run = 0; run <= 60; run += 4) {
        const s = calm();
        placePlayer(s, cx, PLATEAU.cy);
        runGame(s, [[{}, 2], [{ left: true }, run], [{ left: true, jump: true }, 60], [{ left: true }, 30]]);
        expect(s.session.edelweiss[1]).toBe(false);
      }
    }
  });

  it('Edelweiß 3 ist über den versteckten Weg erreichbar', () => {
    const s = calm();
    placePlayer(s, HIDDEN.cx, 18);
    const ev = runGame(s, [
      [{}, 2], [{ jump: true }, 8], [{}, 40], // versteckte Kiste von unten aufdecken
      [{ left: true }, 10], [{}, 20], [{ right: true, jump: true }, 16], [{ jump: true }, 24], [{}, 30], // auf die Kiste
      [{ right: true, jump: true }, 14], [{ right: true, up: true, jump: true }, 40], [{ right: true }, 30], // an den Vorsprung, hinaufkraxeln
    ]);
    expect(ev).toContainEqual({ type: 'crateOpen', ...HIDDEN });
    expect(s.session.edelweiss[2]).toBe(true);
  });

  it('Edelweiß 3 ist ohne die versteckte Kiste nicht erreichbar', () => {
    const without = parseLevel('1-1', LEVELS['1-1'].replace('V', '.'));
    for (let cx = HIDDEN.cx - 6; cx <= HIDDEN.cx + 9; cx++) {
      for (const dir of [{ right: true }, { left: true }]) {
        for (let run = 0; run <= 72; run += 6) {
          for (const hold of [1, 20, 40]) {
            for (const upAfter of [-1, 0, 12, 24]) {
              const s = calm(without);
              placePlayer(s, cx, 18);
              const script: Script = upAfter < 0
                ? [[{}, 2], [dir, run], [{ ...dir, jump: true }, hold], [dir, 60]]
                : [[{}, 2], [dir, run], [{ ...dir, jump: true }, Math.min(hold, upAfter)], [{ ...dir, up: true, jump: hold > upAfter }, 50], [dir, 30]];
              runGame(s, script);
              expect(s.session.edelweiss[2]).toBe(false);
            }
          }
        }
      }
    }
  });
});

describe('Level 1-1: Kamera', () => {
  const levelPx = { w: L.width * TILE, h: L.height * TILE };
  /** Steht Kraxel an (cx, cy), liegt die Zelle (tx, ty) ganz im Bild und unter der Info-Leiste (quer 12 px)? */
  function inView(cx: number, cy: number, tx: number, ty: number, w: number): boolean {
    const s = calm();
    placePlayer(s, cx, cy);
    runGame(s, [[{}, 5]]);
    const view = { w, h: VIEW_H };
    const c = createCamera(s.player, view, levelPx);
    for (let i = 0; i < 120; i++) stepCamera(c, s.player, view, levelPx, STEP);
    const x = tx * TILE, y = ty * TILE;
    return x >= c.x && x + TILE <= c.x + w && y >= c.y + 12 && y + TILE <= c.y + VIEW_H;
  }
  const at = (i: number) => L.spawns.find((s) => s.kind === 'edelweiss' && s.index === i)!;

  it('zeigt Edelweiß 2 von der Hochfläche aus, hochkant und quer', () => {
    for (const w of [256, 416]) expect(inView(PLATEAU.cx + 2, PLATEAU.cy, at(1).cx, at(1).cy, w)).toBe(true);
  });

  it('zeigt Edelweiß 3 vom Boden unter dem Vorsprung, hochkant und quer', () => {
    for (const w of [256, 416]) expect(inView(at(2).cx, 18, at(2).cx, at(2).cy, w)).toBe(true);
  });
});

describe('Level 1-1: Gruben', () => {
  /** Lücken in der untersten Reihe als Spaltenbereiche. */
  function pits(l: LevelData): Array<{ from: number; to: number }> {
    const out: Array<{ from: number; to: number }> = [];
    for (let cx = 0; cx < l.width; cx++) {
      if (solidCell(l, cx, l.height - 1)) continue;
      const last = out[out.length - 1];
      if (last && last.to === cx - 1) last.to = cx;
      else out.push({ from: cx, to: cx });
    }
    return out;
  }
  /** Oberkante der festen Säule, die in Spalte cx am Levelboden beginnt. */
  function surface(l: LevelData, cx: number): number {
    let cy = l.height - 1;
    while (cy > 0 && solidCell(l, cx, cy - 1)) cy--;
    return cy;
  }

  it('hat Gruben von 2 bis 6 Kacheln, die breiteste nur mit Anlauf', () => {
    const widths = pits(L).map((p) => p.to - p.from + 1);
    expect(widths.length).toBeGreaterThanOrEqual(6);
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...widths)).toBeLessThanOrEqual(6);
  });

  it('jede Grube ist mit Renntempo überspringbar', () => {
    for (const pit of pits(L)) {
      // Anlauf: bis zu 8 Kacheln auf gleicher Höhe vor der Kante.
      const top = surface(L, pit.from - 1);
      let start = pit.from - 1;
      while (start > pit.from - 8 && surface(L, start - 1) === top && !solidCell(L, start - 1, top - 1) && !solidCell(L, start - 1, top - 2)) start--;
      const s = calm();
      placePlayer(s, start, top - 1);
      const ev: GameEvent[] = runGame(s, [[{}, 2]]);
      // Rechts halten, abspringen an der Kante, rechts halten bis zur Landung.
      for (let n = 0; n < 300 && s.player.body.x + s.player.body.w < pit.from * TILE - 2; n++) ev.push(...runGame(s, [[{ right: true }, 1]]));
      ev.push(...runGame(s, [[{ right: true, jump: true }, 40]]));
      for (let n = 0; n < 200 && !s.player.grounded && s.phase === 'playing'; n++) ev.push(...runGame(s, [[{ right: true }, 1]]));
      expect(ev.filter((e) => e.type === 'death'), `Grube ${pit.from}-${pit.to}`).toEqual([]);
      expect(s.player.grounded, `Grube ${pit.from}-${pit.to}`).toBe(true);
      expect(s.player.body.x + s.player.body.w / 2, `Grube ${pit.from}-${pit.to}`).toBeGreaterThan((pit.to + 1) * TILE);
    }
  });

  it('kein Gegner steht direkt an einer Landestelle', () => {
    for (const pit of pits(L)) {
      const ground = surface(L, pit.to + 1);
      const close = L.spawns.filter((e) => (e.kind === 'beetle' || e.kind === 'snail') && e.cx > pit.to && e.cx <= pit.to + 3 && e.cy >= ground - 2);
      expect(close, `Grube ${pit.from}-${pit.to}`).toEqual([]);
    }
  });
});

describe('Level 1-1: Lehrstellen auf dem Hauptweg', () => {
  it('Wandschacht: mit zwei Wandsprüngen auf die Hochfläche', () => {
    const s = calm();
    placePlayer(s, SHAFT_ENTRY.cx, SHAFT_ENTRY.cy);
    const ev = runGame(s, [
      [{}, 2], [{ right: true }, 71], // unter der linken Wand hindurch in den Schacht
      [{ right: true, jump: true }, 29], [{ right: true }, 1], [{ right: true, jump: true }, 1], // Wandsprung von rechts
      [{ left: true, jump: true }, 23], [{ left: true }, 1], [{ left: true, jump: true }, 1], // Wandsprung von links
      [{ right: true, jump: true }, 41], [{}, 20],
    ]);
    expect(ev.filter((e) => e.type === 'wallJump').length).toBe(2);
    expect([s.player.grounded, feetRow(s)]).toEqual([true, PLATEAU_FEET]);
  });

  it('Wandschacht: ohne Wandsprung geht es nicht hinauf', () => {
    for (let run = 0; run <= 84; run += 6) {
      for (let hold = 1; hold <= 40; hold += 3) {
        const s = calm();
        placePlayer(s, SHAFT_ENTRY.cx - 1, SHAFT_ENTRY.cy);
        runGame(s, [[{}, 2], [{ right: true }, run], [{ right: true, jump: true }, hold], [{ right: true, up: true, jump: true }, 60], [{}, 180]]);
        expect(feetRow(s)).toBeCloseTo(19, 6); // wieder unten im Schacht
        expect(s.player.grounded).toBe(true);
      }
    }
  });

  it('Kletterwand: mit Kraxeln hinauf', () => {
    const s = calm();
    placePlayer(s, CLIMB_FOOT.cx, CLIMB_FOOT.cy);
    runGame(s, [[{}, 2], [{ right: true, jump: true }, 22], [{ right: true, up: true, jump: true }, 40], [{ right: true }, 20]]);
    expect([s.player.grounded, feetRow(s)]).toEqual([true, TOWER_FEET]);
  });

  it('Kletterwand: ohne Kraxeln nicht, auch nicht mit Anlauf', () => {
    for (let cx = CLIMB_FOOT.cx - 9; cx <= CLIMB_FOOT.cx; cx += 3) {
      for (let run = 0; run <= 84; run += 6) {
        for (let hold = 1; hold <= 40; hold += 3) {
          const s = calm();
          placePlayer(s, cx, CLIMB_FOOT.cy);
          runGame(s, [[{}, 2], [{ right: true }, run], [{ right: true, jump: true }, hold], [{ right: true }, 60], [{}, 60]]);
          expect(feetRow(s)).toBeCloseTo(19, 6); // noch unten vor der Wand
          expect(s.player.grounded).toBe(true);
        }
      }
    }
  });

  it('Höhlendecke: Stampfen öffnet den Weg zum Steinmännchen', () => {
    const s = calm();
    placePlayer(s, TOWER_ROCK.cx, TOWER_ROCK.cy - 1);
    const ev = runGame(s, [[{}, 2], [{ jump: true }, 12], [{ down: true }, 1], [{}, 60], [{ right: true }, 100]]);
    expect(ev).toContainEqual({ type: 'rockBreak', ...TOWER_ROCK });
    expect(ev).toContainEqual({ type: 'checkpoint', index: 0 });
  });

  it('Felsnadel: oben gibt es keinen Weg vorbei', () => {
    for (const cx of [113, 115, 119, 120]) {
      for (const dir of [{ right: true }, { left: true }]) {
        for (let run = 0; run <= 84; run += 12) {
          for (const hold of [10, 25, 40]) {
            const s = calm();
            placePlayer(s, cx, TOWER_FEET - 1);
            runGame(s, [[{}, 2], [dir, run], [{ ...dir, jump: true }, hold], [{ ...dir, up: true, jump: true }, 50], [dir, 30]]);
            expect(s.player.body.x).toBeLessThan(121 * TILE);
          }
        }
      }
    }
  });
});
