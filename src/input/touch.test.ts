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
