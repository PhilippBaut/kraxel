import { describe, expect, it } from 'vitest';
import { isOnGround, moveBody, overlaps, wallAt } from './collide.ts';
import type { MoveResult } from './collide.ts';
import { gridFrom } from './test-helpers.ts';
import type { Body } from './types.ts';

const b = (x: number, y: number, vx = 0, vy = 0): Body => ({ x, y, w: 10, h: 14, vx, vy });

describe('moveBody', () => {
  it('landet bündig auf dem Boden', () => {
    const g = gridFrom(['....', '....', '####']); const body = b(3, 16, 0, 300);
    const r = moveBody(body, 1 / 60, g);
    expect(r.down).toBe(true); expect(body.y).toBe(32 - 14); expect(body.vy).toBe(0);
  });
  it('Wand stoppt seitlich', () => {
    const g = gridFrom(['..#', '..#', '###']); const body = b(18, 18, 300, 0);
    expect(moveBody(body, 1 / 60, g).right).toBe(true); expect(body.x).toBe(32 - 10);
  });
  it('linker Levelrand blockiert', () => {
    const g = gridFrom(['....', '####']); const body = b(1, 2, -300, 0);
    moveBody(body, 1 / 60, g); expect(body.x).toBe(0);
  });
  it('schnelles Fallen tunnelt nicht durch eine Kachel', () => {
    const g = gridFrom(['....', '....', '....', '####', '....']); const body = b(3, 0, 0, 1200);
    for (let i = 0; i < 10; i++) moveBody(body, 1 / 60, g);
    expect(body.y + body.h).toBe(48);
  });
  it('Kopfstoß meldet Zelle', () => {
    const g = gridFrom(['.K..', '....', '....', '####']); const body = b(18, 20, 0, -300);
    let hit: MoveResult | undefined;
    for (let i = 0; i < 10 && !hit?.up; i++) hit = moveBody(body, 1 / 60, g);
    expect(hit!.headCells).toEqual([[1, 0]]);
  });
  it('versteckte Kiste: seitlich und von oben durchlässig, von unten fest', () => {
    const g = gridFrom(['....', '.V..', '....', '####']);
    const side = b(4, 16, 300, 0); moveBody(side, 1 / 60, g); expect(side.x).toBe(9);
    const fall = b(18, 0, 0, 200); for (let i = 0; i < 20; i++) moveBody(fall, 1 / 60, g);
    expect(fall.y + fall.h).toBe(48);
    const up = b(18, 34, 0, -300); let r: MoveResult | undefined;
    for (let i = 0; i < 10 && !r?.up; i++) r = moveBody(up, 1 / 60, g);
    expect(r!.headCells).toEqual([[1, 1]]);
  });
  it('Kantenkorrektur bei 3 px, Kopfstoß bei 6 px', () => {
    const g = gridFrom(['.....K....', '..........', '..........', '##########']);
    const a = b(96 - 3, 20, 0, -300);
    for (let i = 0; i < 8; i++) moveBody(a, 1 / 60, g, 4);
    expect(a.x).toBe(96); expect(a.y).toBeLessThan(16);
    const c = b(96 - 6, 20, 0, -300); let rc: MoveResult | undefined;
    for (let i = 0; i < 8 && !rc?.up; i++) rc = moveBody(c, 1 / 60, g, 4);
    expect(rc!.headCells).toEqual([[5, 0]]);
  });
});

describe('Abfragen', () => {
  const g = gridFrom(['..#', '..#', '###']);
  it('isOnGround: Körper auf der Kante steht, einen Pixel darüber nicht', () => {
    expect(isOnGround(b(3, 18), g)).toBe(true);
    expect(isOnGround(b(3, 17), g)).toBe(false);
  });
  it('wallAt prüft einen Pixel seitlich', () => {
    expect(wallAt(b(22, 18), g, 1)).toBe(true);
    expect(wallAt(b(21, 18), g, 1)).toBe(false);
    expect(wallAt(b(0, 18), g, -1)).toBe(true);
    expect(wallAt(b(1, 18), g, -1)).toBe(false);
  });
  it('overlaps: Berührung ist keine Überlappung', () => {
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 5, h: 5 })).toBe(true);
  });
});
