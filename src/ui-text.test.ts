import { describe, it, expect } from 'vitest';
import { missingGlyphs } from './gfx/font.ts';
import { TEXT } from './ui-text.ts';

describe('Texte des Knopf-Editors', () => {
  it('es gibt sie, großgeschrieben, ohne ß', () => {
    expect(TEXT.CONTROLS).toBe('STEUERUNG');
    expect(TEXT.CONTROLS_HINT).toBe('KNOPF ZIEHEN ZUM VERSCHIEBEN');
    expect(TEXT.DEFAULTS).toBe('STANDARD');
    expect(TEXT.DONE).toBe('FERTIG');
    for (const t of [TEXT.CONTROLS, TEXT.CONTROLS_HINT, TEXT.DEFAULTS, TEXT.DONE]) {
      expect(t).toBe(t.toUpperCase());
      expect(t).not.toContain('ß');
    }
  });

  it('die Pixelschrift kann jedes Zeichen, auch - und +', () => {
    const all = [TEXT.CONTROLS, TEXT.CONTROLS_HINT, TEXT.DEFAULTS, TEXT.DONE, '-+'].join('');
    expect(missingGlyphs(all)).toEqual([]);
  });
});
