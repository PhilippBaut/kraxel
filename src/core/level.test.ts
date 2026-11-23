import { describe, it, expect } from 'vitest';
import { parseLevel, validateLevel, LevelError } from './level.ts';
import { Cell } from './types.ts';
import { LEVELS } from '../levels/index.ts';

const TXT = 'name: Test\nworld: 1\n---\n..K.H.\n.P..1S\n######';
const BOTH = { requireEdelweiss: true, requireGoal: true };
const NONE = { requireEdelweiss: false, requireGoal: false };

describe('parseLevel', () => {
  it('liest Raster, Kisten, Spawns und Start', () => {
    const l = parseLevel('t', TXT);
    expect([l.width, l.height, l.name, l.world]).toEqual([6, 3, 'Test', 1]);
    expect(l.cells[2]).toBe(Cell.Crate);
    expect(l.crates.get(4)).toEqual({ kind: 'item', item: 'helm' });
    expect(l.start).toEqual({ cx: 1, cy: 1 });
    expect(l.spawns).toContainEqual({ kind: 'edelweiss', cx: 4, cy: 1, index: 0 });
    expect(l.spawns).toContainEqual({ kind: 'checkpoint', cx: 5, cy: 1, index: 0 });
  });
  it('unbekanntes Zeichen wirft LevelError mit Zeilennummer', () => {
    expect(() => parseLevel('t', 'name: x\nworld: 1\n---\n..\n.?')).toThrowError(LevelError);
    try { parseLevel('t', 'name: x\nworld: 1\n---\n..\n.?'); } catch (e) { expect((e as LevelError).line).toBe(5); }
  });
  it('füllt kürzere Zeilen mit leeren Zellen auf', () => {
    const l = parseLevel('t', 'name: x\nworld: 1\n---\nP\n####');
    expect([l.width, l.height]).toEqual([4, 2]);
    expect(l.cells[1]).toBe(Cell.Empty);
  });
  it('nummeriert Steinmännchen von links und kennt versteckte Kisten', () => {
    const l = parseLevel('t', 'name: x\nworld: 1\n---\nS..V.S\nP.....');
    expect(l.spawns.map((s) => [s.cx, s.index])).toEqual([[0, 0], [5, 1]]);
    expect(l.cells[3]).toBe(Cell.HiddenCrate);
    expect(l.crates.get(3)).toEqual({ kind: 'crystal' });
  });
});

describe('validateLevel', () => {
  it('meldet fehlendes Ziel und Edelweiß', () => {
    const p = validateLevel(parseLevel('t', TXT), BOTH);
    expect(p.length).toBeGreaterThanOrEqual(2);
  });
  it('meldet fehlenden und doppelten Start', () => {
    expect(validateLevel(parseLevel('t', 'name: x\nworld: 1\n---\n..\n##'), NONE)).toHaveLength(1);
    expect(validateLevel(parseLevel('t', 'name: x\nworld: 1\n---\nP.P\n###'), NONE)).toHaveLength(1);
  });
  it('meldet doppeltes Edelweiß', () => {
    expect(validateLevel(parseLevel('t', 'name: x\nworld: 1\n---\nP1..1\n#####'), NONE)).toHaveLength(1);
  });
  it('meldet Gegner ohne Boden darunter', () => {
    expect(validateLevel(parseLevel('t', 'name: x\nworld: 1\n---\nP.k\n##.'), NONE)).toHaveLength(1);
    expect(validateLevel(parseLevel('t', 'name: x\nworld: 1\n---\nP.k\n###'), NONE)).toEqual([]);
  });
  it('ein vollständiges Level ist gültig', () => {
    const t = 'name: x\nworld: 1\n---\n.1.2.3.Z\nP.......\n########';
    expect(validateLevel(parseLevel('t', t), BOTH)).toEqual([]);
  });
  it('Übungsplatz ist gültig', () => {
    expect(validateLevel(parseLevel('uebungsplatz', LEVELS.uebungsplatz), NONE)).toEqual([]);
  });
});
