import { describe, expect, it } from 'vitest';
import { GLYPH_H } from '../gfx/font.ts';
import { computeLayout } from './layout.ts';
import { fitButtonHeight, MIN_BUTTON_H, thumbHeight } from './thumb.ts';

const none = { top: 0, right: 0, bottom: 0, left: 0 };
const css = (w: number, h: number) => computeLayout(w, h, none);

describe('thumbHeight', () => {
  it('etwa 44 CSS-px, wenn Platz ist', () => {
    for (const [w, h] of [[375, 667], [390, 844], [667, 375], [844, 390]] as const) {
      const l = css(w, h);
      const px = thumbHeight(l) * l.scale;
      expect(px).toBeGreaterThanOrEqual(40);
      expect(px).toBeLessThanOrEqual(48);
    }
  });
  it('begrenzt: hochkant höchstens 32, quer höchstens 24, nie unter 15', () => {
    expect(thumbHeight({ scale: 0.5, orientation: 'portrait' })).toBe(32);
    expect(thumbHeight({ scale: 0.5, orientation: 'landscape' })).toBe(24);
    expect(thumbHeight({ scale: 10, orientation: 'portrait' })).toBe(MIN_BUTTON_H);
  });
});

describe('fitButtonHeight', () => {
  const PAD = 10, TITLE_GAP = 8, GAP = 4;
  it('Pausentafel (Titel + 4 Einträge + Ränder) passt bei 375×667 in 192', () => {
    const l = css(375, 667);
    expect(l.view.h).toBe(192);
    const fixed = PAD + GLYPH_H + TITLE_GAP + PAD;
    const h = fitButtonHeight(l, 4, GAP, fixed);
    expect(fixed + 4 * h + 3 * GAP).toBeLessThanOrEqual(l.view.h);
    expect(h).toBe(thumbHeight(l));
  });
  it('schrumpft bei Platzmangel, aber nie unter 15', () => {
    const l = css(375, 667);
    expect(fitButtonHeight(l, 4, GAP, 120)).toBeLessThan(thumbHeight(l));
    expect(fitButtonHeight(l, 4, GAP, 120)).toBeGreaterThanOrEqual(MIN_BUTTON_H);
    expect(fitButtonHeight(l, 4, GAP, 500)).toBe(MIN_BUTTON_H);
  });
  it('Tafeln passen bei 375×667, 390×844, 667×375 und 844×390 ins Spielbild', () => {
    const pauseFixed = PAD + GLYPH_H + TITLE_GAP + PAD;
    // Ergebnis: Überschrift, Zeit, Bestzeit, Rekord, Edelweiß, Kristalle samt Abständen (mit Rekordzeile = höchster Fall).
    const ROW_H = GLYPH_H + 4, BLOCK_GAP = 6;
    const resultFixed = PAD + (5 * ROW_H + ROW_H + 2 * BLOCK_GAP + BLOCK_GAP) + PAD;
    for (const [w, h] of [[375, 667], [390, 844], [667, 375], [844, 390]] as const) {
      const l = css(w, h);
      const hp = fitButtonHeight(l, 4, GAP, pauseFixed), hr = fitButtonHeight(l, 2, GAP, resultFixed);
      expect(pauseFixed + 4 * hp + 3 * GAP, `Pause ${w}×${h}`).toBeLessThanOrEqual(l.view.h);
      expect(resultFixed + 2 * hr + GAP, `Ergebnis ${w}×${h}`).toBeLessThanOrEqual(l.view.h);
    }
  });
});
