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

describe('Arena-Sperre', () => {
  // Arena: Kacheln 20..35 (16 breit), Boden bei Zeile 20 (Unterkante 320 px).
  const lock = { x0: 20 * 16, x1: 36 * 16, floorY: 20 * 16 };
  const centre = (w: number) => (lock.x0 + lock.x1) / 2 - w / 2;
  const feetY = (h: number) => lock.floorY - 0.7 * h;

  for (const w of [256, 416]) {
    it(`steht bei Breite ${w} fest mittig auf der Arena, egal wo Kraxel läuft und springt`, () => {
      const v = { w, h: 192 };
      const p = createPlayer(24, 19);
      p.grounded = true;
      const c = createCamera(p, v, level);
      for (let i = 0; i < 180; i++) stepCamera(c, p, v, level, 1 / 60, lock);
      expect(c.x).toBeCloseTo(centre(w), 1);
      expect(c.y).toBeCloseTo(feetY(v.h), 1);
      const x0 = c.x, y0 = c.y;
      for (let i = 0; i < 120; i++) {
        p.body.x = (21 + (i % 14)) * 16;
        p.body.vx = i % 2 ? 96 : -96;
        p.facing = i % 2 ? 1 : -1;
        p.grounded = i % 3 === 0;
        p.body.y = 19 * 16 - (i % 5) * 12;
        stepCamera(c, p, v, level, 1 / 60, lock);
        expect(c.x).toBeCloseTo(x0, 6);
        expect(c.y).toBeCloseTo(y0, 6);
      }
    });

    it(`folgt bei Breite ${w} wieder frei, wenn die Arena offen ist`, () => {
      const v = { w, h: 192 };
      const p = createPlayer(24, 19);
      p.grounded = true;
      const c = createCamera(p, v, level);
      for (let i = 0; i < 60; i++) stepCamera(c, p, v, level, 1 / 60, lock);
      p.body.x = 40 * 16;
      for (let i = 0; i < 5; i++) stepCamera(c, p, v, level, 1 / 60, null);
      expect(c.x).toBeCloseTo(p.body.x + PLAYER_W / 2 - w / 2 + c.look, 6);
      expect(c.x).not.toBeCloseTo(centre(w), 0);
    });
  }

  it('gleitet nach dem Schließen sanft zur Mitte statt zu springen', () => {
    const p = createPlayer(22, 19);
    p.grounded = true;
    const c = createCamera(p, view, level);
    stepCamera(c, p, view, level, 1 / 60, null);
    const before = c.x;
    stepCamera(c, p, view, level, 1 / 60, lock);
    expect(Math.abs(c.x - before)).toBeLessThan(Math.abs(centre(256) - before));
  });

  it('die Sperre bleibt im Level (kein Blick über den Rand)', () => {
    const edge = { x0: 84 * 16, x1: 100 * 16, floorY: 20 * 16 };
    const v = { w: 416, h: 192 };
    const p = createPlayer(90, 19);
    p.grounded = true;
    const c = createCamera(p, v, level);
    for (let i = 0; i < 180; i++) stepCamera(c, p, v, level, 1 / 60, edge);
    expect(c.x).toBe(1600 - 416);
  });
});
