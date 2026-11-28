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
  it('zwei G sind ungültig, eines ist gültig, G ersetzt Z nicht', () => {
    const base = (row: string) => parseLevel('t', `name: x\nworld: 1\n---\n${row}\nP.......\n########`);
    expect(validateLevel(base('G...G'), NONE)).toHaveLength(1);
    expect(validateLevel(base('G...Z'), { requireEdelweiss: false, requireGoal: true })).toEqual([]);
    expect(validateLevel(base('G'), { requireEdelweiss: false, requireGoal: true })).toHaveLength(1);
  });
  it('ein vollständiges Level ist gültig', () => {
    const t = 'name: x\nworld: 1\n---\n.1.2.3.Z\nP.......\n########';
    expect(validateLevel(parseLevel('t', t), BOTH)).toEqual([]);
  });
  it('Übungsplatz ist gültig und hat ein Ziel (für den Ergebnis-Ablauf)', () => {
    expect(validateLevel(parseLevel('uebungsplatz', LEVELS.uebungsplatz), { requireEdelweiss: false, requireGoal: true })).toEqual([]);
  });
  it('Übungsplatz hat Schleuder- und Enzian-Kiste, drei Blätterpolster und Gegner zum Schießen', () => {
    const lv = parseLevel('uebungsplatz', LEVELS.uebungsplatz);
    const rows = LEVELS.uebungsplatz.split('---\n')[1].split('\n');
    const count = (ch: string) => rows.join('').split(ch).length - 1;
    expect(count('J')).toBe(1);
    expect(count('E')).toBe(1);
    expect(count('L')).toBe(3);
    expect(lv.cells.filter((c) => c === Cell.LeafPad).length).toBe(3);
    expect(lv.spawns.filter((s) => s.kind === 'beetle').length).toBeGreaterThanOrEqual(2);
    expect(lv.spawns.filter((s) => s.kind === 'snail').length).toBeGreaterThanOrEqual(2);
    expect(lv.spawns.filter((s) => s.kind === 'goal').length).toBe(1);
  });
  it('Übungsplatz: Schleuder- und Enzian-Kiste liegen vor dem Ziel', () => {
    const lv = parseLevel('uebungsplatz', LEVELS.uebungsplatz);
    const goal = lv.spawns.find((s) => s.kind === 'goal')!;
    const items = [...lv.crates].filter(([, c]) => c.kind === 'item' && c.item !== 'helm').map(([i]) => i % lv.width);
    expect(items.length).toBe(2);
    for (const cx of items) expect(cx).toBeLessThan(goal.cx);
  });
  it('Übungsplatz: zwei Stämme (waagerecht und senkrecht) fahren über dem Bach vor dem Ziel', () => {
    const lv = parseLevel('uebungsplatz', LEVELS.uebungsplatz);
    const goal = lv.spawns.find((s) => s.kind === 'goal')!;
    expect(lv.platforms.map((p) => [p.axis, p.art])).toEqual([['h', 'stamm'], ['v', 'stamm']]);
    for (const p of lv.platforms) expect(p.cx + p.width).toBeLessThan(goal.cx);
    expect([...lv.cells].filter((c) => c === Cell.Water).length).toBeGreaterThanOrEqual(18);
  });
});

describe('Kopfzeile stil', () => {
  it('stil: burg setzt den Burg-Stil, ohne Zeile ist er nicht gesetzt', () => {
    expect(parseLevel('t', 'name: t\nstil: burg\n---\nP.\n##').style).toBe('burg');
    expect(parseLevel('t', 'name: t\n---\nP.\n##').style).toBeUndefined();
  });
  it('unbekannter Stil ist ein Fehler mit Zeilennummer', () => {
    expect(() => parseLevel('t', 'name: t\nstil: eis\n---\nP.\n##')).toThrow(/Zeile 2.*Stil/);
  });
});
