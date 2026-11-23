import { describe, expect, it } from 'vitest';
import { createCamera, stepCamera } from './camera.ts';
import { createPlayer, PLAYER_H, PLAYER_W } from './player.ts';

const view = { w: 256, h: 192 }, level = { w: 1600, h: 384 };

describe('Kamera', () => {
  it('bleibt am linken Levelrand', () => {
    const p = createPlayer(1, 22);
    const c = createCamera(p, view, level);
    stepCamera(c, p, view, level, 1 / 60);
    expect(c.x).toBe(0);
  });

  it('wackelt beim Sprung von flachem Boden nicht senkrecht', () => {
    const p = createPlayer(20, 22);
    p.grounded = true;
    const c = createCamera(p, view, level);
    for (let i = 0; i < 120; i++) stepCamera(c, p, view, level, 1 / 60);
    const y0 = c.y;
    p.grounded = false;
    p.body.y -= 50;
    stepCamera(c, p, view, level, 1 / 60);
    expect(c.y).toBe(y0);
  });

  it('wackelt auch mitten im Level nicht beim Sprung', () => {
    const tall = { w: 1600, h: 1600 };
    const p = createPlayer(20, 50);
    p.grounded = true;
    const c = createCamera(p, view, tall);
    for (let i = 0; i < 120; i++) stepCamera(c, p, view, tall, 1 / 60);
    const y0 = c.y;
    p.grounded = false;
    for (let i = 0; i < 20; i++) {
      p.body.y -= 3;
      stepCamera(c, p, view, tall, 1 / 60);
      expect(c.y).toBeCloseTo(y0, 6);
    }
  });

  it('zieht nach, wenn Kraxel tiefer fällt als der Bildrand', () => {
    const p = createPlayer(20, 10);
    const c = createCamera(p, view, level);
    p.grounded = false;
    p.body.y = c.y + 190;
    stepCamera(c, p, view, level, 1 / 60);
    expect(p.body.y + PLAYER_H - c.y).toBeLessThanOrEqual(192 - 24 + 0.001);
  });

  it('harte Grenze oben: der Kopf bleibt 32 px unter dem Bildrand', () => {
    const tall = { w: 1600, h: 1600 };
    const p = createPlayer(20, 50);
    const c = createCamera(p, view, tall);
    p.body.y = c.y + 10;
    stepCamera(c, p, view, tall, 1 / 60);
    expect(p.body.y - c.y).toBeCloseTo(32, 6);
    expect(c.targetY).toBeCloseTo(c.y, 6);
  });

  it('gleitet nach der Landung auf neuer Höhe sanft nach', () => {
    const tall = { w: 1600, h: 1600 };
    const p = createPlayer(20, 50);
    p.grounded = true;
    const c = createCamera(p, view, tall);
    const y0 = c.y;
    p.body.y -= 48; // drei Kacheln höher gelandet
    stepCamera(c, p, view, tall, 1 / 60);
    expect(c.y).toBeLessThan(y0);
    expect(c.y).toBeGreaterThan(y0 - 48);
    for (let i = 0; i < 180; i++) stepCamera(c, p, view, tall, 1 / 60);
    expect(c.y).toBeCloseTo(y0 - 48, 1);
  });

  it('schaut in Laufrichtung voraus', () => {
    const p = createPlayer(40, 22);
    p.body.vx = 96;
    p.facing = 1;
    const c = createCamera(p, view, level);
    for (let i = 0; i < 60; i++) stepCamera(c, p, view, level, 1 / 60);
    expect(c.x).toBeCloseTo(p.body.x + PLAYER_W / 2 + 32 - 128, 0);
  });

  it('Vorausschau bleibt im Stand und dreht mit 90 px/s', () => {
    const p = createPlayer(40, 22);
    p.body.vx = 96;
    const c = createCamera(p, view, level);
    for (let i = 0; i < 60; i++) stepCamera(c, p, view, level, 1 / 60);
    p.body.vx = 0;
    stepCamera(c, p, view, level, 1 / 60);
    expect(c.look).toBeCloseTo(32, 6);
    p.body.vx = -96;
    p.facing = -1;
    for (let i = 0; i < 30; i++) stepCamera(c, p, view, level, 1 / 60);
    expect(c.look).toBeCloseTo(32 - 45, 6);
  });

  it('bleibt bei 0, wenn das Level kleiner als das Bild ist', () => {
    const small = { w: 160, h: 128 };
    const p = createPlayer(5, 6);
    const c = createCamera(p, view, small);
    stepCamera(c, p, view, small, 1 / 60);
    expect(c.x).toBe(0);
    expect(c.y).toBe(0);
  });

  it('bleibt am rechten und unteren Levelrand', () => {
    const p = createPlayer(99, 23);
    p.grounded = true;
    const c = createCamera(p, view, level);
    stepCamera(c, p, view, level, 1 / 60);
    expect(c.x).toBe(1600 - 256);
    expect(c.y).toBe(384 - 192);
  });
});
