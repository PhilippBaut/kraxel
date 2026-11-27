import { describe, it, expect } from 'vitest';
import { BASE } from './palette.ts';
import { buildSprites, KRAXEL_FRAMES, helmName, platformSprite } from './sprites.ts';

const S = buildSprites();
const text = (name: string) => S[name].map((r) => r.join(''));

describe('sprites', () => {
  it('alle Sprites sind rechteckig und nutzen nur Zeichen aus BASE', () => {
    for (const [name, g] of Object.entries(S)) {
      expect(new Set(g.map((r) => r.length)).size, name).toBe(1);
      for (const ch of g.flat()) expect(ch === '.' || ch in BASE, `${name}: ${ch}`).toBe(true);
    }
  });

  it('Kraxel-Bilder sind 16×16 und haben eine Helm-Variante', () => {
    for (const f of KRAXEL_FRAMES) {
      expect([S[f].length, S[f][0].length]).toEqual([16, 16]);
      expect([S[helmName(f)].length, S[helmName(f)][0].length]).toEqual([16, 16]);
    }
    expect(KRAXEL_FRAMES).toContain('kraxelPound');
  });

  it('Umrandung wird nirgends am Rand abgeschnitten (kein Farbpixel am Rasterrand)', () => {
    const TILES = new Set(['groundTop', 'groundFill', 'waterTop1', 'waterTop2', 'water']); // Kacheln füllen die Zelle bis zum Rand
    const bad: string[] = [];
    for (const [name, g] of Object.entries(S)) {
      if (TILES.has(name)) continue;
      const h = g.length, w = g[0].length;
      g.forEach((row, y) => row.forEach((c, x) => {
        const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
        if (edge && c !== '.' && c !== 'o') bad.push(`${name} ${x},${y}:${c}`);
      }));
    }
    expect(bad).toEqual([]);
  });

  it('Gipfelkreuz ist 5 Kacheln hoch', () => {
    expect(S.cross.length).toBe(80);
  });

  it('KRAXEL_FRAMES enthält genau alle kraxel*-Bilder ohne Helm', () => {
    const all = Object.keys(S).filter((n) => n.startsWith('kraxel') && !n.endsWith('Helm'));
    expect([...KRAXEL_FRAMES].sort()).toEqual(all.sort());
    expect(helmName('kraxelJ')).toBe('kraxelJHelm');
  });

  it('kraxel steht genau wie im Entwurf', () => {
    expect(text('kraxel')).toEqual([
      '......oo........',
      '.....oPPo.......',
      '.....oPPoooo....',
      '.....oHhhHHo....',
      '....oHhHHHHHo...',
      '...oSSSSSSSSSo..',
      '...ossssssssso..',
      '.oooBBBBWWBWWo..',
      '.oKoBBBBWEBWEo..',
      '.oKoBBBBWEBWEo..',
      '.oKoBBBRBBEBRo..',
      '.okoBBBBBBBBBo..',
      '.okobBBBBBBBbo..',
      '.oooobbbbbbbo...',
      '...oFFFoooFFFo..',
      '...ooooo.ooooo..',
    ]);
    expect(text('kraxelB').slice(14)).toEqual(['....oFFFoFFFo...', '....ooooooooo...']);
    expect(text('kraxelJ').slice(14)).toEqual(['..oFFFo..oFFFo..', '..ooooo..ooooo..']);
  });

  it('Helm-Varianten tragen den Helm statt der Mütze', () => {
    for (const f of KRAXEL_FRAMES) {
      const helm = S[helmName(f)].flat();
      expect(helm.some((c) => c === 'P' || c === 'H' || c === 'h'), f).toBe(false);
      expect(helm.includes('Q'), f).toBe(true);
      expect(S[f].flat().includes('H'), f).toBe(true);
    }
  });

  it('cairnFlag ist das Steinmännchen mit Fahne', () => {
    expect([S.cairn.length, S.cairn[0].length]).toEqual([16, 16]);
    S.cairn.forEach((row, y) =>
      row.forEach((c, x) => {
        if (c !== '.' && c !== 'o') expect(S.cairnFlag[y][x], `${x},${y}`).toBe(c);
      }),
    );
    expect([S.debris.length, S.debris[0].length]).toEqual([8, 8]);
  });

  it('Kiesel, Blätterpolster und Schleuder-Symbol haben die richtige Größe', () => {
    const dim = (n: string) => [S[n].length, S[n][0].length];
    expect(dim('pebble')).toEqual([4, 4]); // wie PEBBLE_SIZE im Kern
    expect(dim('leafPad')).toEqual([16, 16]);
    expect(dim('iSling')).toEqual([7, 7]);
    expect(dim('sling')).toEqual([16, 16]);
    expect(dim('enzian')).toEqual([16, 16]);
  });

  it('Items sehen verschieden aus: Helm, Schleuder und Enzian', () => {
    const t = (n: string) => text(n).join('\n');
    expect(new Set([t('helm'), t('sling'), t('enzian')]).size).toBe(3);
  });

  it('Blätterpolster füllt die Zelle bis auf die Ecken und hat keine Bodenfarben', () => {
    const rows = text('leafPad');
    for (let i = 1; i < 15; i++) {
      expect(rows[0][i], `oben ${i}`).toBe('o');
      expect(rows[15][i], `unten ${i}`).toBe('o');
      expect(rows[i][0], `links ${i}`).toBe('o');
      expect(rows[i][15], `rechts ${i}`).toBe('o');
    }
    expect(rows.join('')).not.toMatch(/[Dd]/); // Erde gehört dem Boden
  });
});

describe('Plattformen und Wasser', () => {
  const dim = (n: string) => [S[n].length, S[n][0].length];
  it('Stämme und Steinplatten sind 16 hoch und 2, 3 oder 4 Kacheln breit', () => {
    expect([dim('log'), dim('log3'), dim('log4')]).toEqual([[16, 32], [16, 48], [16, 64]]);
    expect([dim('stoneSlab'), dim('stoneSlab3'), dim('stoneSlab4')]).toEqual([[16, 32], [16, 48], [16, 64]]);
    for (const [art, w] of [['stamm', 2], ['stamm', 3], ['stamm', 4], ['stein', 2], ['stein', 3], ['stein', 4]] as const) {
      expect(S[platformSprite(art, w)][0].length).toBe(w * 16);
    }
  });
  it('die Oberkante trägt: oben eine durchgehende Umrandung', () => {
    for (const n of ['log', 'log4', 'stoneSlab', 'stoneSlab4']) {
      const top = text(n)[0];
      expect(top.slice(3, -3), n).toBe('o'.repeat(top.length - 6));
    }
  });
  it('Wasserkacheln sind 16×16, die Oberfläche hat zwei verschiedene Bilder und liegt an der Oberkante', () => {
    for (const n of ['waterTop1', 'waterTop2', 'water']) expect(dim(n)).toEqual([16, 16]);
    expect(text('waterTop1').join()).not.toBe(text('waterTop2').join());
    expect(text('waterTop1')[0]).toContain('Z'); // Schaumkamm in der obersten Reihe
    expect(text('water').join('')).not.toContain('.'); // Tiefe ist undurchsichtig
  });
});
