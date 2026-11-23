import { describe, expect, it } from 'vitest';
import { hitCell } from './blocks.ts';
import { addCrystals } from './game.ts';
import { gameFrom, runGame } from './test-helpers.ts';
import { Cell } from './types.ts';

const CRATE = ['..........', '....K.H...', '..........', '..........', '....P.....', '##########'];
const withCell = (ch: string) => CRATE.map((r) => r.replace('K', ch));

describe('Kisten und Felsblöcke', () => {
  it('Kiste mit Kristall: Kopfstoß öffnet sie', () => {
    const s = gameFrom(CRATE);
    const ev = runGame(s, [[{ jump: true }, 30]]);
    expect(s.grid.get(4, 1)).toBe(Cell.CrateUsed);
    expect(s.session.crystals).toBe(1);
    expect(ev.map((e) => e.type)).toEqual(expect.arrayContaining(['crateOpen', 'crystal']));
  });

  it('Mehrfach-Kiste: höchstens 10 Kristalle', () => {
    const s = gameFrom(withCell('M'));
    for (let i = 0; i < 12; i++) hitCell(s, 4, 1, 'below');
    expect(s.session.crystals).toBe(10);
    expect(s.grid.get(4, 1)).toBe(Cell.CrateUsed);
  });

  it('Mehrfach-Kiste: Fenster läuft nach 4 s ab', () => {
    const s = gameFrom(withCell('M'));
    hitCell(s, 4, 1, 'below');
    expect(s.grid.get(4, 1)).toBe(Cell.Crate);
    runGame(s, [[{}, 246]]);
    expect(s.grid.get(4, 1)).toBe(Cell.CrateUsed);
  });

  it('Felsblock: ohne Helm bump, mit Helm zerbrochen, Stampfen bricht immer', () => {
    const s = gameFrom(withCell('B'));
    expect(hitCell(s, 4, 1, 'below')).toEqual([{ type: 'bump', cx: 4, cy: 1 }]);
    expect(s.grid.get(4, 1)).toBe(Cell.Rock);
    s.player.helm = true;
    hitCell(s, 4, 1, 'below');
    expect(s.grid.get(4, 1)).toBe(Cell.Empty);
    const s2 = gameFrom(withCell('B'));
    hitCell(s2, 4, 1, 'above');
    expect(s2.grid.get(4, 1)).toBe(Cell.Empty);
  });

  it('Boden und leere Kiste geben bump, von oben nichts', () => {
    const s = gameFrom(CRATE);
    expect(hitCell(s, 0, 5, 'below')).toEqual([{ type: 'bump', cx: 0, cy: 5 }]);
    expect(hitCell(s, 0, 5, 'above')).toEqual([]);
    hitCell(s, 4, 1, 'below');
    expect(hitCell(s, 4, 1, 'below')).toEqual([{ type: 'bump', cx: 4, cy: 1 }]);
    expect(hitCell(s, 4, 1, 'above')).toEqual([]);
  });

  it('versteckte Kiste wird beim Treffer sichtbar und gibt Kristall', () => {
    const s = gameFrom(withCell('V'));
    runGame(s, [[{ jump: true }, 30]]);
    expect(s.grid.get(4, 1)).toBe(Cell.CrateUsed);
    expect(s.session.crystals).toBe(1);
  });

  it('Stampfen auf eine Kiste öffnet sie', () => {
    const s = gameFrom(CRATE);
    expect(hitCell(s, 4, 1, 'above').map((e) => e.type)).toContain('crateOpen');
  });

  it('100 Kristalle ergeben ein Extraleben', () => {
    const s = gameFrom(CRATE);
    s.session.crystals = 99;
    expect(addCrystals(s, 1)).toContainEqual({ type: 'extraLife' });
    expect([s.session.crystals, s.session.lives]).toEqual([0, 6]);
  });
});
