import { describe, it, expect } from 'vitest';
import { parseLevel, validateLevel, levelHasEdelweiss, LevelError } from './level.ts';
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

describe('levelHasEdelweiss', () => {
  it('ist wahr für 1-1 bis 1-4 und falsch für die Festung 1-F (sie hat keine Edelweiß)', () => {
    for (const id of ['1-1', '1-2', '1-3', '1-4']) expect(levelHasEdelweiss(parseLevel(id, LEVELS[id])), id).toBe(true);
    expect(levelHasEdelweiss(parseLevel('1-F', LEVELS['1-F']))).toBe(false);
  });
});

describe('Arena und Steinschlag: strengere Prüfung', () => {
  /** Arena Spalte 2 bis 17, Tür in Spalte 1, Boden in Reihe 11, rechte Mauer in Spalte 18. P links der Arena, Murmelkönig X in Spalte 14. */
  const ROWS = [
    '####################',
    ...Array(9).fill('#.................##'),
    '#P............X...##',
    '####################',
  ];
  const text = (rows: string[], header = ['arena: 2 17']) => ['name: t', 'world: 1', ...header, '---', ...rows].join('\n');
  const check = (rows: string[]) => validateLevel(parseLevel('t', text(rows)), { requireEdelweiss: false, requireGoal: true });
  const set = (rows: string[], cy: number, cx: number, ch: string) => rows.map((r, i) => (i === cy ? r.slice(0, cx) + ch + r.slice(cx + 1) : r));

  it('das Ausgangslevel ist gültig', () => {
    expect(check(ROWS)).toEqual([]);
  });
  it('Arenaboden: ein Loch im Boden unter der Arena wird gemeldet', () => {
    const p = check(set(ROWS, 11, 5, '.')).join('|');
    expect(p).toMatch(/Arenaboden/);
    expect(p).toMatch(/Spalte 5/);
  });
  it('Arenaboden: eine Stufe im Boden (feste Zelle in der Bodenreihe darüber) wird gemeldet', () => {
    expect(check(set(ROWS, 10, 8, '#')).join('|')).toMatch(/Arenaboden|Platz/);
  });
  it('Arenaboden: ein tieferer Boden an einer Spalte wird gemeldet', () => {
    const rows = set(set(ROWS, 11, 9, '.'), 12, 9, '#'); // Boden liegt dort eine Reihe tiefer (Reihe 12 ist Levelboden)
    expect(check(rows).join('|')).toMatch(/Arenaboden/);
  });
  it('rechte Wand: Spalte x1 + 1 muss bis zur Kopffreiheit fest sein', () => {
    const p = check(set(ROWS, 8, 18, '.')).join('|');
    expect(p).toMatch(/rechte Wand|Mauer/i);
    expect(p).toMatch(/Reihe 8/);
  });
  it('rechte Wand: fehlt sie ganz, wird sie gemeldet', () => {
    const rows = ROWS.map((r) => r.slice(0, 18) + '..');
    expect(check(rows).join('|')).toMatch(/rechte Wand|Mauer/i);
  });
  it('Start und Steinmännchen müssen links der Arena liegen', () => {
    expect(check(set(ROWS, 10, 1, '.').map((r, i) => (i === 10 ? r.slice(0, 5) + 'P' + r.slice(6) : r))).join('|')).toMatch(/Start P.*links/);
    expect(check(set(ROWS, 10, 5, 'S')).join('|')).toMatch(/links/);
    const spät = check(set(ROWS, 10, 9, 'S')).join('|');
    expect(spät).toMatch(/Steinmännchen S bei 9,10/);
  });
  it('Steinmännchen links der Arena sind in Ordnung', () => {
    // Spalte 1 liegt links der Arena (Tür); wer dort steht, ist vor der Arena.
    const rows = ROWS.map((r, i) => (i === 10 ? '#S' + r.slice(2) : r));
    expect(validateLevel(parseLevel('t', ['name: t', 'world: 1', 'arena: 2 17', '---', ...rows.map((r, i) => (i === 9 ? 'P' + r.slice(1) : r))].join('\n')), { requireEdelweiss: false, requireGoal: true })).toEqual([]);
  });
  it('Brocken R: ohne feste Decke direkt darüber wird er gemeldet, in Reihe 0 und unter fester Zelle nicht', () => {
    const lose = set(ROWS, 5, 8, 'R'); // Reihe 4 darüber ist leer
    expect(check(lose).join('|')).toMatch(/Brocken R bei 8,5/);
    const haengt = set(set(ROWS, 4, 8, '#'), 5, 8, 'R');
    expect(check(haengt).join('|')).not.toMatch(/Brocken/);
    const oben = ROWS.map((r, i) => (i === 0 ? r : r)); // Reihe 0 ist Decke; ein R in Reihe 0 braucht keine
    expect(check(set(oben, 0, 8, 'R')).join('|')).not.toMatch(/Brocken/);
  });
});
