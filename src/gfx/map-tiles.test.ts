import { describe, it, expect } from 'vitest';
import { BASE } from './palette.ts';
import { buildMapSprites, FULL_TILES, MAP_SPRITE_NAMES } from './map-tiles.ts';
import { buildSprites } from './sprites.ts';

const M: Record<string, string[][]> = buildMapSprites();

describe('Karten-Grafik', () => {
  it('liefert genau die benannten Sprites', () => {
    expect(Object.keys(M).sort()).toEqual([...MAP_SPRITE_NAMES].sort());
  });

  it('alle Raster sind rechteckig und nutzen nur Zeichen aus BASE', () => {
    for (const [name, g] of Object.entries(M)) {
      expect(new Set(g.map((r) => r.length)).size, name).toBe(1);
      for (const ch of g.flat()) expect(ch === '.' || ch in BASE, `${name}: ${ch}`).toBe(true);
    }
  });

  it('Kacheln und Punkte sind 16×16, die Marke 8×8', () => {
    for (const [name, g] of Object.entries(M)) {
      const size = name === 'mapMark' ? 8 : 16;
      expect([g.length, g[0].length], name).toEqual([size, size]);
    }
  });

  it('volle Kacheln füllen die Zelle, alle anderen lassen den Rand frei (nur Umrandung erlaubt)', () => {
    for (const name of FULL_TILES) expect(M[name].flat().includes('.'), name).toBe(false);
    const bad: string[] = [];
    for (const [name, g] of Object.entries(M)) {
      if (FULL_TILES.includes(name)) continue;
      const h = g.length, w = g[0].length;
      g.forEach((row, y) => row.forEach((c, x) => {
        const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
        if (edge && c !== '.' && c !== 'o') bad.push(`${name} ${x},${y}:${c}`);
      }));
    }
    expect(bad).toEqual([]);
  });

  it('Namen kollidieren nicht mit den Spiel-Sprites', () => {
    const game = buildSprites();
    for (const name of Object.keys(M)) expect(name in game, name).toBe(false);
  });

  it('Punkt offen, gesperrt und geschafft unterscheiden sich, geschafft trägt ein weißes Kreuz', () => {
    const t = (n: string) => M[n].map((r) => r.join(''));
    expect(t('mapNodeOpen')).not.toEqual(t('mapNodeLocked'));
    expect(t('mapNodeDone')).not.toEqual(t('mapNodeOpen'));
    expect(M.mapNodeDone.flat().includes('W')).toBe(true);
    expect(M.mapNodeLocked.flat().includes('W')).toBe(false);
  });
});
