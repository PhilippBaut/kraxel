import { describe, expect, it } from 'vitest';
import { defaultSave, type LevelRecord, type SaveData } from './save.ts';
import { enterable, nodeAtPoint, nodeOpen, openedBetween, pathOpen, pickDirection, route, validateMap, withoutOpened, type WorldMap } from './worldmap.ts';
import { WORLD1 } from '../maps/world1.ts';

const IDS = ['1-1', '1-2', '1-3', '1-4', '1-F'];

/** Speicherstand mit teilweise angegebenen Level-Einträgen. */
const save = (levels: Record<string, Partial<LevelRecord>>): SaveData => ({
  ...defaultSave(),
  levels: Object.fromEntries(
    Object.entries(levels).map(([id, r]) => [id, { bestTime: null, edelweiss: [false, false, false] as [boolean, boolean, boolean], completed: false, exits: { normal: false, secret: false }, ...r }]),
  ),
});
const done = (...ids: string[]): SaveData => save(Object.fromEntries(ids.map((id) => [id, { completed: true, exits: { normal: true, secret: false } }])));

const node = (id: string) => WORLD1.nodes.find((n) => n.id === id)!;
const px = (id: string): [number, number] => [node(id).cx * 16 + 8, node(id).cy * 16 + 8];

describe('Weltkarte', () => {
  it('WORLD1 ist gültig', () => {
    expect(validateMap(WORLD1, IDS)).toEqual([]);
  });

  it('Validator meldet Wege mit Sprüngen, Punkte zu nah (< 3 Kacheln), unbekannte Level, Wege ohne Start/Ziel', () => {
    const withPath = (i: number, cells: ReadonlyArray<readonly [number, number]>): WorldMap => ({ ...WORLD1, paths: WORLD1.paths.map((p, k) => (k === i ? { ...p, cells } : p)) });
    const hutPath = WORLD1.paths[0];
    const jump = withPath(0, [hutPath.cells[0], hutPath.cells[hutPath.cells.length - 1]]);
    expect(validateMap(jump, IDS).length).toBeGreaterThan(0);
    const diagonal = withPath(0, [[3, 10], [4, 9], [8, 10]]);
    expect(validateMap(diagonal, IDS).length).toBeGreaterThan(0);
    const near: WorldMap = { ...WORLD1, nodes: WORLD1.nodes.map((n) => (n.id === '1-1' ? { ...n, cx: 4, cy: 10 } : n)) };
    expect(validateMap(near, IDS).length).toBeGreaterThan(0);
    expect(validateMap(WORLD1, ['1-1', '1-2', '1-3', '1-4']).length).toBeGreaterThan(0);
    const noTarget: WorldMap = { ...WORLD1, paths: [...WORLD1.paths, { from: '1-1', to: 'gibtsnicht', via: 'normal', cells: [[8, 10], [8, 11]] }] };
    expect(validateMap(noTarget, IDS).length).toBeGreaterThan(0);
    const noStart: WorldMap = { ...WORLD1, start: 'nirgends' };
    expect(validateMap(noStart, IDS).length).toBeGreaterThan(0);
  });

  it('neuer Stand: nur Hütte und 1-1 offen', () => {
    expect(['hut', '1-1'].every((n) => nodeOpen(WORLD1, n, defaultSave()))).toBe(true);
    expect(nodeOpen(WORLD1, '1-2', defaultSave())).toBe(false);
  });

  it('1-1 geschafft → 1-2 offen', () => {
    expect(nodeOpen(WORLD1, '1-2', done('1-1'))).toBe(true);
    expect(nodeOpen(WORLD1, '1-3', done('1-1'))).toBe(false);
  });

  it('geheimer Ausgang von 1-3 zuerst: Festung offen, 1-4 zu', () => {
    const s = save({ '1-1': { exits: { normal: true, secret: false } }, '1-2': { exits: { normal: true, secret: false } }, '1-3': { exits: { normal: false, secret: true } } });
    expect(nodeOpen(WORLD1, '1-F', s)).toBe(true);
    expect(nodeOpen(WORLD1, '1-4', s)).toBe(false);
  });

  it('pathOpen: always ist immer offen, sonst zählt der Ausgang des Ausgangs-Levels', () => {
    expect(pathOpen(WORLD1, WORLD1.paths[0], defaultSave())).toBe(true);
    expect(pathOpen(WORLD1, WORLD1.paths[1], defaultSave())).toBe(false);
    expect(pathOpen(WORLD1, WORLD1.paths[1], done('1-1'))).toBe(true);
  });

  it('pickDirection folgt der Richtung, gesperrte Wege nie, sonst null', () => {
    const both = save({
      '1-1': { exits: { normal: true, secret: false } }, '1-2': { exits: { normal: true, secret: false } },
      '1-3': { exits: { normal: true, secret: true } },
    });
    expect(pickDirection(WORLD1, '1-3', 'left', both)?.to).toBe('1-4');
    expect(pickDirection(WORLD1, '1-3', 'up', both)?.to).toBe('1-F');
    expect(pickDirection(WORLD1, '1-3', 'right', both)?.to).toBe('1-2');
    expect(pickDirection(WORLD1, '1-3', 'down', both)).toBeNull();
    const none = done('1-1', '1-2');
    expect(pickDirection(WORLD1, '1-3', 'left', none)).toBeNull();
    expect(pickDirection(WORLD1, '1-3', 'up', none)).toBeNull();
    expect(pickDirection(WORLD1, '1-3', 'right', none)?.to).toBe('1-2');
    // Wegzellen in Laufrichtung: rückwärts beginnt bei 1-3 und endet bei 1-2
    const back = pickDirection(WORLD1, '1-3', 'right', none)!;
    expect(back.cells[0]).toEqual([node('1-3').cx, node('1-3').cy]);
    expect(back.cells[back.cells.length - 1]).toEqual([node('1-2').cx, node('1-2').cy]);
  });

  it('route läuft nur über offene Wege und auch rückwärts', () => {
    const s = done('1-1', '1-2');
    expect(route(WORLD1, '1-3', 'hut', s)).toEqual(['1-3', '1-2', '1-1', 'hut']);
    expect(route(WORLD1, 'hut', '1-3', s)).toEqual(['hut', '1-1', '1-2', '1-3']);
    expect(route(WORLD1, '1-3', '1-4', s)).toBeNull();
    expect(route(WORLD1, '1-3', '1-3', s)).toEqual(['1-3']);
  });

  it('route nimmt die kürzere Abkürzung, wenn sie offen ist', () => {
    const s = save({ '1-1': { exits: { normal: true, secret: false } }, '1-2': { exits: { normal: true, secret: false } }, '1-3': { exits: { normal: true, secret: true } }, '1-4': { exits: { normal: true, secret: false } } });
    expect(route(WORLD1, '1-3', '1-F', s)).toEqual(['1-3', '1-F']);
  });

  it('nodeAtPoint: nächster Punkt gewinnt, außerhalb radius null', () => {
    const [x1, y1] = px('1-3');
    const [x2, y2] = px('1-2');
    // genau zwischen den Punkten, aber etwas näher an 1-3
    expect(nodeAtPoint(WORLD1, (x1 + x2) / 2 - 2, (y1 + y2) / 2, 100)).toBe('1-3');
    expect(nodeAtPoint(WORLD1, (x1 + x2) / 2 + 2, (y1 + y2) / 2, 100)).toBe('1-2');
    expect(nodeAtPoint(WORLD1, x1 + 3, y1 - 2, 12)).toBe('1-3');
    expect(nodeAtPoint(WORLD1, (x1 + x2) / 2, (y1 + y2) / 2, 12)).toBeNull();
  });

  it('openedBetween liefert genau die neu offenen Wege', () => {
    const opened = openedBetween(WORLD1, defaultSave(), done('1-1'));
    expect(opened.map((p) => `${p.from}→${p.to}`)).toEqual(['1-1→1-2']);
    expect(openedBetween(WORLD1, done('1-1'), done('1-1'))).toEqual([]);
  });

  it('teaser ist nie betretbar, Hütte auch nicht', () => {
    const all = done('1-1', '1-2', '1-3', '1-4', '1-F');
    expect(enterable(WORLD1, 'teaser', all)).toBe(false);
    expect(enterable(WORLD1, 'hut', all)).toBe(false);
    expect(enterable(WORLD1, '1-1', defaultSave())).toBe(true);
    expect(enterable(WORLD1, '1-2', defaultSave())).toBe(false);
    expect(enterable(WORLD1, '1-F', save({ '1-1': { exits: { normal: true, secret: false } }, '1-2': { exits: { normal: true, secret: false } }, '1-3': { exits: { normal: false, secret: true } } }))).toBe(true);
  });

  it('withoutOpened: nach dem ersten von zwei Wegen ist dieser offen samt Ziel, der zweite noch zu', () => {
    const after = save({
      '1-1': { completed: true, exits: { normal: true, secret: false } },
      '1-2': { completed: true, exits: { normal: true, secret: false } },
      '1-3': { completed: true, exits: { normal: true, secret: true } },
    });
    const opened = openedBetween(WORLD1, save({ '1-1': { completed: true, exits: { normal: true, secret: false } }, '1-2': { completed: true, exits: { normal: true, secret: false } }, '1-3': { completed: true } }), after);
    expect(opened.map((p) => p.to).sort()).toEqual(['1-4', '1-F']);
    const [first, second] = opened;
    const before = withoutOpened(WORLD1, after, opened);
    expect(opened.every((p) => !pathOpen(WORLD1, p, before))).toBe(true);
    expect(nodeOpen(WORLD1, '1-4', before) || nodeOpen(WORLD1, '1-F', before)).toBe(false);
    const mid = withoutOpened(WORLD1, after, [second]);
    expect(pathOpen(WORLD1, first, mid)).toBe(true);
    expect(nodeOpen(WORLD1, first.to, mid)).toBe(true);
    expect(pathOpen(WORLD1, second, mid)).toBe(false);
    expect(nodeOpen(WORLD1, second.to, mid)).toBe(false);
    expect(withoutOpened(WORLD1, after, [])).toEqual(after);
  });
});
