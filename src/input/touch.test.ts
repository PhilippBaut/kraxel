import { describe, expect, it } from 'vitest';
import { computeLayout } from '../view/layout.ts';
import { PointerBook, resolveTouch, zoneAt, type TouchPoint, type Zone } from './touch.ts';

const L = computeLayout(844, 390, { top: 0, right: 0, bottom: 0, left: 0 });
const at = (dx: number, dy: number, zone: Zone = 'dpad', id = 1): TouchPoint => ({ id, x: L.dpad.cx + dx, y: L.dpad.cy + dy, zone });

describe('resolveTouch', () => {
  it('Sektoren des Steuerkreuzes', () => {
    expect(resolveTouch([at(20, 0)], L)).toMatchObject({ right: true, left: false, up: false, down: false });
    expect(resolveTouch([at(15, -15)], L)).toMatchObject({ right: true, up: true });
    expect(resolveTouch([at(0, 20)], L)).toMatchObject({ down: true, right: false });
    expect(resolveTouch([at(2, 1)], L)).toMatchObject({ left: false, right: false, up: false, down: false });
  });
  it('Finger außerhalb des Steuerkreuzes behält die Richtung', () => {
    expect(resolveTouch([at(200, 0)], L).right).toBe(true);
  });
  it('Steuerkreuz und Sprung gleichzeitig', () => {
    const j: TouchPoint = { id: 2, x: L.jump.cx, y: L.jump.cy, zone: 'jump' };
    expect(resolveTouch([at(-20, 0), j], L)).toMatchObject({ left: true, jump: true });
  });
  it('zweiter Steuerkreuz-Finger wird ignoriert', () => {
    expect(resolveTouch([at(20, 0, 'dpad', 1), at(-20, 0, 'dpad', 2)], L)).toMatchObject({ right: true, left: false });
  });
  it('Aktionsfinger setzt action', () => {
    const a: TouchPoint = { id: 3, x: L.action.cx, y: L.action.cy, zone: 'action' };
    expect(resolveTouch([a], L).action).toBe(true);
  });
});

describe('zoneAt', () => {
  it('Aktion-Zone nur wenn sichtbar', () => {
    expect(zoneAt(L.action.cx, L.action.cy, L, false)).not.toBe('action');
    expect(zoneAt(L.action.cx, L.action.cy, L, true)).toBe('action');
  });
  it('findet Steuerkreuz und Sprung, sonst nichts', () => {
    expect(zoneAt(L.dpad.cx, L.dpad.cy, L, false)).toBe('dpad');
    expect(zoneAt(L.jump.cx, L.jump.cy, L, false)).toBe('jump');
    expect(zoneAt(L.view.w / 2, 10, L, false)).toBeNull();
  });
  const P = computeLayout(390, 844, { top: 47, right: 0, bottom: 34, left: 0 });
  const inRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  it('hochkant zählt jeder Punkt im Steuerfeld außer Info-Zeile und Pause-Fläche', () => {
    const p = P.panel!;
    for (let y = p.y; y < p.y + p.h; y += 2) {
      for (let x = 0; x < p.w; x += 2) {
        if (inRect(x, y, P.hud) || inRect(x, y, P.pauseHit)) continue;
        expect(zoneAt(x, y, P, false), `${x},${y}`).not.toBeNull();
      }
    }
    expect(zoneAt(P.pause.x + 8, P.pause.y + 6, P, false)).toBeNull();
    expect(zoneAt(128, P.view.y + 96, P, false)).toBeNull();
  });
  it('hochkant ist die ganze Info-Zeile keine Steuerzone, ein Fehltipp neben Pause springt nicht', () => {
    for (let y = P.hud.y; y < P.hud.y + P.hud.h; y++) for (let x = 0; x < P.hud.w; x++) expect(zoneAt(x, y, P, true), `${x},${y}`).toBeNull();
    // Pause-Fläche selbst: ebenfalls keine Zone, auch die Ränder darunter.
    for (let y = P.pauseHit.y; y < P.pauseHit.y + P.pauseHit.h; y++) for (let x = P.pauseHit.x; x < P.pauseHit.x + P.pauseHit.w; x++) expect(zoneAt(x, y, P, true)).toBeNull();
  });
  it('hochkant gewinnt der nächste Knopfrand', () => {
    const mid = (P.dpad.cx + P.dpad.r + P.jump.cx - P.jump.r) / 2, y = (P.dpad.cy + P.jump.cy) / 2;
    expect(zoneAt(mid + 3, y, P, false)).toBe('jump');
    expect(zoneAt(mid - 3, y, P, false)).toBe('dpad');
  });
  it('hochkant mit sichtbarem Aktionsknopf: in den gezeichneten Kreisen von Sprung und Steuerkreuz nie action, im Aktionskreis action', () => {
    const inCircle = (x: number, y: number, c: { cx: number; cy: number; r: number }) => Math.hypot(x - c.cx, y - c.cy) <= c.r;
    for (const c of [P.jump, P.dpad]) {
      for (let y = c.cy - c.r; y <= c.cy + c.r; y++) {
        for (let x = c.cx - c.r; x <= c.cx + c.r; x++) {
          if (!inCircle(x, y, c) || inCircle(x, y, P.action)) continue;
          expect(zoneAt(x, y, P, true), `${x},${y}`).not.toBe('action');
        }
      }
    }
    expect(zoneAt(P.action.cx, P.action.cy, P, true)).toBe('action');
    expect(zoneAt(P.action.cx + P.action.r - 2, P.action.cy, P, true)).toBe('action');
  });
  it('quer: Trefferfläche bis hitR', () => {
    expect(zoneAt(L.jump.cx, L.jump.cy - L.jump.hitR + 1, L, false)).toBe('jump');
    expect(zoneAt(L.jump.cx, L.jump.cy - L.jump.hitR - 1, L, false)).toBeNull();
    expect(zoneAt(L.dpad.cx, L.dpad.cy - L.dpad.hitR + 1, L, false)).toBe('dpad');
  });
});

describe('PointerBook', () => {
  it('reset vergisst alle Finger', () => {
    const b = new PointerBook();
    b.down(1, 10, 10, 'dpad');
    b.down(2, 20, 20, 'jump');
    b.reset();
    expect(b.points()).toEqual([]);
  });
  it('Zone bleibt beim Verschieben', () => {
    const b = new PointerBook();
    b.down(1, 10, 10, 'jump');
    b.move(1, 300, 300);
    expect(b.points()[0]).toEqual({ id: 1, x: 300, y: 300, zone: 'jump' });
  });
  it('up entfernt den Finger', () => {
    const b = new PointerBook();
    b.down(1, 1, 1, 'dpad');
    b.up(1);
    expect(b.points()).toEqual([]);
  });
});
