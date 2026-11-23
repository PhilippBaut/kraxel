import { describe, it, expect } from 'vitest';
import { TILE, VIEW_H, PORTRAIT_VIEW_W, MAX_VIEW_W, START_LIVES, CRYSTALS_PER_LIFE } from './config.ts';
describe('config', () => {
  it('hält die Werte aus der Spec', () => {
    expect(TILE).toBe(16);
    expect(VIEW_H / TILE).toBe(12);
    expect(PORTRAIT_VIEW_W / VIEW_H).toBeCloseTo(4 / 3);
    expect(MAX_VIEW_W / TILE).toBe(32);
    expect(START_LIVES).toBe(5);
    expect(CRYSTALS_PER_LIFE).toBe(100);
  });
});
