import { describe, expect, it } from 'vitest';
import type { Rect } from '../core/types.ts';
import { computeLayout, type Circle } from './layout.ts';

const none = { top: 0, right: 0, bottom: 0, left: 0 };
const inside = (c: Circle, r: Rect) => c.cx - c.r >= r.x && c.cx + c.r <= r.x + r.w && c.cy - c.r >= r.y && c.cy + c.r <= r.y + r.h;
const apart = (a: Circle, b: Circle) => Math.hypot(a.cx - b.cx, a.cy - b.cy) >= a.hitR + b.hitR;

describe('computeLayout', () => {
  it('iPhone hochkant: 4:3-Spielbild oben, Steuerfeld darunter', () => {
    const l = computeLayout(390, 844, { top: 47, right: 0, bottom: 34, left: 0 });
    expect(l.orientation).toBe('portrait');
    expect([l.gameW, l.gameH]).toEqual([256, 554]);
    expect(l.view).toEqual({ x: 0, y: 31, w: 256, h: 192 });
    expect(l.panel).toEqual({ x: 0, y: 223, w: 256, h: 331 });
    for (const c of [l.dpad, l.jump]) expect(inside(c, l.panel!)).toBe(true);
    expect(apart(l.dpad, l.jump) && apart(l.dpad, l.action) && apart(l.jump, l.action)).toBe(true);
    expect(l.jump.cy + l.jump.r).toBeLessThanOrEqual(l.gameH - Math.ceil(34 / l.scale));
  });
  it('iPhone quer: 192 hoch, Knöpfe in der Safe Area', () => {
    const l = computeLayout(844, 390, { top: 0, right: 47, bottom: 21, left: 47 });
    expect([l.orientation, l.gameH, l.gameW]).toEqual(['landscape', 192, 416]);
    expect(l.panel).toBeNull();
    expect(l.dpad.cx - l.dpad.r).toBeGreaterThanOrEqual(24);
    expect(l.jump.cx + l.jump.r).toBeLessThanOrEqual(416 - 24);
    expect(apart(l.jump, l.action)).toBe(true);
  });
  it('sehr breiter Bildschirm: höchstens 32 Kacheln', () => {
    expect(computeLayout(3440, 1080, none).gameW).toBe(512);
  });
  it('iPad hochkant hat ein Steuerfeld', () => {
    expect(computeLayout(768, 1024, none).panel!.h).toBeGreaterThanOrEqual(140);
  });
  it('zu kurzes Hochkant-Fenster nutzt Quer-Regeln', () => {
    const l = computeLayout(400, 500, none);
    expect(l.panel).toBeNull();
    expect(l.gameH).toBe(192);
  });
  it('Knöpfe einen Ticken größer (Handy-Test 24.11.2026)', () => {
    const p = computeLayout(390, 844, { top: 47, right: 0, bottom: 34, left: 0 });
    const q = computeLayout(844, 390, { top: 0, right: 47, bottom: 21, left: 47 });
    expect([p.dpad.r, p.jump.r, p.action.r]).toEqual([42, 28, 16]);
    expect([q.dpad.r, q.jump.r, q.action.r]).toEqual([32, 21, 14]);
  });
  it.each([
    [375, 667, { top: 20, right: 0, bottom: 0, left: 0 }], [390, 844, { top: 47, right: 0, bottom: 34, left: 0 }], [430, 932, { top: 59, right: 0, bottom: 34, left: 0 }],
    [667, 375, { top: 0, right: 0, bottom: 0, left: 0 }], [844, 390, { top: 0, right: 47, bottom: 21, left: 47 }], [932, 430, { top: 0, right: 59, bottom: 21, left: 59 }],
  ])('Knöpfe passen auf %ix%i', (w, h, ins) => {
    const l = computeLayout(w, h, ins);
    const safe = { x: Math.ceil(ins.left / l.scale), y: Math.ceil(ins.top / l.scale), w: l.gameW - Math.ceil(ins.left / l.scale) - Math.ceil(ins.right / l.scale), h: l.gameH - Math.ceil(ins.top / l.scale) - Math.ceil(ins.bottom / l.scale) };
    for (const c of [l.dpad, l.jump, l.action]) expect(inside(c, l.panel ? { ...l.panel, y: l.hud.y + l.hud.h, h: l.panel.h - l.hud.h } : safe)).toBe(true);
    expect(apart(l.dpad, l.jump) && apart(l.dpad, l.action) && apart(l.jump, l.action)).toBe(true);
  });
  it.each([
    [375, 667, { top: 20, right: 0, bottom: 0, left: 0 }], [390, 844, { top: 47, right: 0, bottom: 34, left: 0 }], [430, 932, { top: 59, right: 0, bottom: 34, left: 0 }],
  ])('hochkant liegt der Aktionsknopf über dem Sprungknopf (%ix%i, Wunsch nach Handy-Test 27.11.2026)', (w, h, ins) => {
    const l = computeLayout(w, h, ins);
    expect(l.action.cx).toBe(l.jump.cx);
    expect(l.action.cy + l.action.r).toBeLessThan(l.jump.cy - l.jump.r);
  });
  it('sehr niedriges Steuerfeld: Aktionsknopf bleibt links neben dem Sprungknopf und passt', () => {
    // 400×527 ergibt ein Steuerfeld von 145 px, knapp über der Mindesthöhe von 140.
    const l = computeLayout(400, 527, { top: 0, right: 0, bottom: 0, left: 0 });
    expect(l.orientation).toBe('portrait');
    expect(l.action.cx).toBeLessThan(l.jump.cx);
    for (const c of [l.dpad, l.jump, l.action]) expect(inside(c, l.controlsArea)).toBe(true);
    expect(apart(l.dpad, l.action) && apart(l.jump, l.action)).toBe(true);
  });
});

describe('Pause-Trefferfläche', () => {
  const rectHitsCircle = (r: Rect, c: Circle) => {
    const nx = Math.max(r.x, Math.min(c.cx, r.x + r.w)), ny = Math.max(r.y, Math.min(c.cy, r.y + r.h));
    return Math.hypot(c.cx - nx, c.cy - ny) < c.r;
  };
  it.each([
    [375, 667, { top: 20, right: 0, bottom: 0, left: 0 }], [390, 844, { top: 47, right: 0, bottom: 34, left: 0 }], [430, 932, { top: 59, right: 0, bottom: 34, left: 0 }],
    [667, 375, { top: 0, right: 0, bottom: 0, left: 0 }], [844, 390, { top: 0, right: 47, bottom: 21, left: 47 }], [932, 430, { top: 0, right: 59, bottom: 21, left: 59 }],
  ])('ist mindestens 30×24, sichtbar innen und liegt in der Safe Area auf %ix%i', (w, h, ins) => {
    const l = computeLayout(w, h, ins);
    const a = l.pauseHit, v = l.pause;
    expect(a.w).toBeGreaterThanOrEqual(30);
    expect(a.h).toBeGreaterThanOrEqual(24);
    // Das sichtbare Zeichen liegt ganz in der Trefferfläche.
    expect(v.x >= a.x && v.x + v.w <= a.x + a.w && v.y >= a.y && v.y + v.h <= a.y + a.h).toBe(true);
    const sx = Math.ceil(ins.left / l.scale), sy = Math.ceil(ins.top / l.scale);
    const sw = l.gameW - sx - Math.ceil(ins.right / l.scale), sh = l.gameH - sy - Math.ceil(ins.bottom / l.scale);
    expect(a.x >= sx && a.x + a.w <= sx + sw && a.y >= sy && a.y + a.h <= sy + sh).toBe(true);
    // Sie verdeckt keinen Knopf.
    for (const c of [l.dpad, l.jump, l.action]) expect(rectHitsCircle(a, c)).toBe(false);
  });
});

describe('controlsArea', () => {
  it('hochkant beginnt unter der Info-Zeile, quer 12 px unter der Oberkante', () => {
    const p = computeLayout(390, 844, { top: 47, right: 0, bottom: 34, left: 0 });
    expect(p.controlsArea.y).toBe(p.hud.y + p.hud.h);
    const q = computeLayout(844, 390, { top: 20, right: 47, bottom: 21, left: 47 });
    expect(q.controlsArea.y).toBe(Math.ceil(20 / q.scale) + 12);
  });
  it.each([
    [375, 667, { top: 20, right: 0, bottom: 0, left: 0 }], [390, 844, { top: 47, right: 0, bottom: 34, left: 0 }], [430, 932, { top: 59, right: 0, bottom: 34, left: 0 }],
    [667, 375, { top: 0, right: 0, bottom: 0, left: 0 }], [844, 390, { top: 0, right: 47, bottom: 21, left: 47 }], [932, 430, { top: 0, right: 59, bottom: 21, left: 59 }],
  ])('liegt in der Safe Area auf %ix%i', (w, h, ins) => {
    const l = computeLayout(w, h, ins);
    const a = l.controlsArea;
    const sx = Math.ceil(ins.left / l.scale), sy = Math.ceil(ins.top / l.scale);
    expect(a.x).toBeGreaterThanOrEqual(sx);
    expect(a.y).toBeGreaterThanOrEqual(sy);
    expect(a.x + a.w).toBeLessThanOrEqual(l.gameW - Math.ceil(ins.right / l.scale));
    expect(a.y + a.h).toBeLessThanOrEqual(l.gameH - Math.ceil(ins.bottom / l.scale));
    expect(a.w).toBeGreaterThan(0);
    expect(a.h).toBeGreaterThan(0);
  });
});
