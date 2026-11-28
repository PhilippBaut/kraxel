import { describe, expect, it } from 'vitest';
import { TILE } from '../config.ts';
import { PIT_ALPHA, pitAlphaAt, pitFadeLength } from './pit-shade.ts';

describe('Grubenschatten', () => {
  it('eine 12 Kacheln tiefe Grube ist im gleichen Abstand unter dem Rand so dunkel wie eine 3 Kacheln tiefe', () => {
    for (let below = 0; below <= 3 * TILE; below += 4) {
      expect(pitAlphaAt(12 * TILE, below), `${below} px`).toBeCloseTo(pitAlphaAt(3 * TILE, below), 10);
    }
    expect(pitFadeLength(12 * TILE)).toBe(pitFadeLength(3 * TILE));
  });
  it('wird nach unten dunkler und erreicht in 3-Kacheln-Gruben die volle Deckkraft am Boden', () => {
    expect(pitAlphaAt(3 * TILE, 0)).toBe(0);
    expect(pitAlphaAt(3 * TILE, 3 * TILE)).toBeCloseTo(PIT_ALPHA, 10);
    expect(pitAlphaAt(12 * TILE, 5 * TILE)).toBeCloseTo(PIT_ALPHA, 10);
  });
  it('flache Gruben behalten ihren kürzeren Verlauf', () => {
    expect(pitFadeLength(TILE)).toBeLessThan(pitFadeLength(3 * TILE));
  });
});
