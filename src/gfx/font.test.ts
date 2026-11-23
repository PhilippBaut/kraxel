import { describe, it, expect } from 'vitest';
import { TEXT } from '../ui-text.ts';
import { FONT5, FONT3_DIGITS, GLYPH_W, GLYPH_H, ADVANCE, textWidth, missingGlyphs } from './font.ts';

describe('font', () => {
  it('jeder Text aus ui-text hat Glyphen', () => {
    const all = Object.values(TEXT).flat().join('') + '0123456789:.×';
    expect(missingGlyphs(all)).toEqual([]);
  });

  it('textWidth = 6 px pro Zeichen minus 1', () => {
    expect(textWidth('ABC')).toBe(17);
    expect(textWidth('')).toBe(0);
  });

  it('jede Glyphe hat 7 Zeilen zu 5 Zeichen aus # und .', () => {
    expect([GLYPH_W, GLYPH_H, ADVANCE]).toEqual([5, 7, 6]);
    for (const [ch, rows] of Object.entries(FONT5)) {
      expect(rows.length, ch).toBe(7);
      for (const r of rows) expect(r, ch).toMatch(/^[#.]{5}$/);
    }
    for (const ch of 'AZÄÖÜ09.,:!?-+/\'()×→ ') expect(FONT5[ch], ch).toBeDefined();
  });

  it('missingGlyphs meldet jedes fehlende Zeichen einmal', () => {
    expect(missingGlyphs('AbcbA')).toEqual(['b', 'c']);
  });

  it('FONT3_DIGITS sind 3×5-Ziffern aus dem Entwurf', () => {
    expect(FONT3_DIGITS['1']).toBe('010110010010111');
    for (const d of '0123456789') expect(FONT3_DIGITS[d]).toMatch(/^[01]{15}$/);
  });
});
