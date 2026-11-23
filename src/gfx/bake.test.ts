import { describe, it, expect } from 'vitest';
import { strs } from './grid-ops.ts';
import { bakeGrid } from './bake.ts';

describe('bakeGrid', () => {
  it('bakeGrid setzt Farben und lässt "." transparent', () => {
    const img = bakeGrid(strs(['W.']), { W: '#ffffff' });
    expect([...img.data]).toEqual([255, 255, 255, 255, 0, 0, 0, 0]);
  });

  it('unbekanntes Zeichen wird magenta', () => {
    expect([...bakeGrid(strs(['?']), {}).data.slice(0, 3)]).toEqual([255, 0, 255]);
  });

  it('übernimmt Breite und Höhe des Rasters', () => {
    const img = bakeGrid(strs(['...', '...']), {});
    expect([img.width, img.height, img.data.length]).toEqual([3, 2, 24]);
  });
});
