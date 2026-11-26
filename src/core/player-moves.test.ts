import { describe, expect, it } from 'vitest';
import { createPlayer, PLAYER_H, PLAYER_W } from './player.ts';
import { FLAT, gridFrom, runPlayer } from './test-helpers.ts';

// Wand rechts ab Spalte 6 (hoch), Boden Reihe 15
const WALL = gridFrom([...Array(15).fill('......#####'), '###########']);

describe('Wand', () => {
  it('Wandrutschen begrenzt das Fallen', () => {
    const p = createPlayer(4, 3); p.body.x = 96 - PLAYER_W; p.grounded = false;
    runPlayer(p, WALL, [[{ right: true }, 40]]);
    expect(p.mode).toBe('wallSlide'); expect(p.body.vy).toBeLessThanOrEqual(60);
  });
  it('Wandsprung stößt weg und sperrt kurz das Zurücksteuern', () => {
    const p = createPlayer(4, 3); p.body.x = 96 - PLAYER_W;
    const r = runPlayer(p, WALL, [[{ right: true }, 30], [{ right: true, jump: true }, 1]]);
    expect(r.events).toContainEqual({ type: 'wallJump' });
    expect(p.body.vx).toBe(-140); expect(p.body.vy).toBeGreaterThanOrEqual(-300); expect(p.body.vy).toBeLessThan(-280);
    runPlayer(p, WALL, [[{ right: true, jump: true }, 5]]); expect(p.body.vx).toBeLessThan(0);
  });
});

describe('Kraxeln', () => {
  it('höchstens climbBudget hoch, dann abrutschen', () => {
    const p = createPlayer(4, 14); p.body.x = 96 - PLAYER_W; const y0 = p.body.y;
    const r = runPlayer(p, WALL, [[{ right: true, up: true }, 90]]);
    expect(y0 - r.minY).toBeGreaterThanOrEqual(30); expect(y0 - r.minY).toBeLessThanOrEqual(34);
  });
  it('Kraft füllt sich erst am Boden wieder', () => {
    const p = createPlayer(4, 14); p.body.x = 96 - PLAYER_W;
    runPlayer(p, WALL, [[{ right: true, up: true }, 40]]); const yMid = p.body.y;
    const r = runPlayer(p, WALL, [[{ right: true }, 2], [{ right: true, up: true }, 20]]);
    expect(r.minY).toBeGreaterThanOrEqual(yMid);
    runPlayer(p, WALL, [[{}, 120]]); expect(p.climbLeft).toBe(32);
  });
  it('über die Wandkante klettern hievt Kraxel hinauf', () => {
    const g = gridFrom(['....................', '....................', '......##############', '......##############', '####################']);
    const p = createPlayer(4, 3); p.body.x = 96 - PLAYER_W;
    runPlayer(p, g, [[{ right: true, up: true }, 60], [{ right: true }, 20]]);
    expect(p.grounded).toBe(true); expect(p.body.y + PLAYER_H).toBe(32);
  });
});

describe('Stampfen', () => {
  it('Innehalten, schneller Fall, poundLand mit Zellen', () => {
    const p = createPlayer(3, 9); runPlayer(p, FLAT, [[{ jump: true }, 20]]);
    const pos = { x: p.body.x, y: p.body.y };
    const r1 = runPlayer(p, FLAT, [[{ down: true }, 1], [{}, 8]]);
    expect(r1.events).toContainEqual({ type: 'pound' });
    expect(p.body.x).toBe(pos.x); expect(p.body.y).toBeCloseTo(pos.y, 5);
    const r2 = runPlayer(p, FLAT, [[{}, 40]]);
    expect(r2.events.some((e) => e.type === 'poundLand')).toBe(true);
    expect(r2.poundCells).toContainEqual([3, 10]);
  });
  it('schräg nach unten (unten + rechts) in der Luft stampft nicht', () => {
    const p = createPlayer(3, 9); runPlayer(p, FLAT, [[{ jump: true }, 20]]);
    const r = runPlayer(p, FLAT, [[{ down: true, right: true }, 3], [{ right: true }, 10]]);
    expect(r.events).not.toContainEqual({ type: 'pound' });
    expect(p.mode).not.toBe('poundHang');
  });
  it('reines Unten in der Luft stampft, auch wenn vorher eine Seite gehalten wurde', () => {
    const p = createPlayer(3, 9); runPlayer(p, FLAT, [[{ jump: true }, 20]]);
    const r = runPlayer(p, FLAT, [[{ right: true }, 2], [{ down: true }, 1]]);
    expect(r.events).toContainEqual({ type: 'pound' });
  });
  it('unten halten und die Seite loslassen löst kein spätes Stampfen aus', () => {
    const p = createPlayer(3, 9); runPlayer(p, FLAT, [[{ jump: true }, 20]]);
    const r = runPlayer(p, FLAT, [[{ down: true, right: true }, 2], [{ down: true }, 4]]);
    expect(r.events).not.toContainEqual({ type: 'pound' });
  });
  it('kein Stampfen am Boden', () => {
    const p = createPlayer(3, 9);
    expect(runPlayer(p, FLAT, [[{ down: true }, 5]]).events).not.toContainEqual({ type: 'pound' });
  });
});

describe('Korrekturen', () => {
  it('Bodensprung an der Wand mit up gehalten ist ein normaler Sprung', () => {
    const p = createPlayer(4, 14); p.body.x = 96 - PLAYER_W;
    runPlayer(p, WALL, [[{}, 3]]); const y0 = p.body.y;
    const r = runPlayer(p, WALL, [[{ right: true, up: true, jump: true }, 1]]);
    expect(r.events).toContainEqual({ type: 'jump' });
    expect(p.mode).toBe('normal'); expect(p.body.vy).toBeLessThan(-200);
    const r2 = runPlayer(p, WALL, [[{ jump: true }, 40]]);
    expect(y0 - Math.min(r.minY, r2.minY)).toBeGreaterThanOrEqual(58);
  });
  it('Kraxeln gegen eine Decke endet nach dem ersten Kopfstoß', () => {
    const p = createPlayer(4, 14); p.body.x = 96 - PLAYER_W;
    // Kisten in Reihe 12 über dem freien Raum links der Wand
    const g2 = gridFrom([...Array(12).fill('......#####'), 'KKKKKK#####', ...Array(2).fill('......#####'), '###########']);
    const r = runPlayer(p, g2, [[{ right: true, up: true }, 30]]);
    expect(r.headCells.length).toBe(1);
    expect(p.mode).not.toBe('climb');
  });
});
