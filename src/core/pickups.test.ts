import { describe, expect, it } from 'vitest';
import { hitCell } from './blocks.ts';
import { collectPickups } from './pickups.ts';
import { gameFrom, runGame } from './test-helpers.ts';

const CRATE = ['..........', '....K.H...', '..........', '..........', '....P.....', '##########'];

describe('Kristalle, Edelweiß und Items', () => {
  it('Item-Kiste ohne Helm gibt Helm, Einsammeln setzt helm', () => {
    const s = gameFrom(CRATE);
    const ev = hitCell(s, 6, 1, 'below');
    expect(ev).toContainEqual({ type: 'itemSpawn', item: 'helm', cx: 6, cy: 1 });
    const item = s.pickups.find((p) => p.kind === 'item')!;
    runGame(s, [[{}, 31]]);
    s.player.body.x = item.body.x;
    s.player.body.y = item.body.y;
    expect(collectPickups(s)).toContainEqual({ type: 'powerUp', item: 'helm' });
    expect(s.player.helm).toBe(true);
  });

  it('Helm mit Helm einsammeln gibt 10 Kristalle', () => {
    const s = gameFrom(CRATE);
    s.player.helm = true;
    hitCell(s, 6, 1, 'below');
    runGame(s, [[{}, 31]]);
    const item = s.pickups.find((p) => p.kind === 'item')!;
    s.player.body.x = item.body.x;
    s.player.body.y = item.body.y;
    collectPickups(s);
    expect(s.session.crystals).toBe(10);
  });

  it('Item taucht in 0,5 s 16 px aus der Kiste auf und läuft dann nach rechts', () => {
    const s = gameFrom(['......', '..H...', '......', '......', 'P.....', '######']);
    hitCell(s, 2, 1, 'below');
    const item = s.pickups[0]!;
    const y0 = item.body.y;
    runGame(s, [[{}, 15]]);
    expect(item.body.y).toBeCloseTo(y0 - 8, 1);
    runGame(s, [[{}, 16]]);
    expect(item.body.y + item.body.h).toBeCloseTo(16, 1); // steht auf der Kiste
    const x0 = item.body.x;
    runGame(s, [[{}, 10]]);
    expect(item.body.x).toBeGreaterThan(x0 + 5);
  });

  it('Kristall im Level einsammeln', () => {
    const s = gameFrom(['......', '.Pc...', '######']);
    runGame(s, [[{ right: true }, 30]]);
    expect(s.session.crystals).toBe(1);
  });

  it('Edelweiß setzt das Flag und wird nur einmal gezählt', () => {
    const s = gameFrom(['......', '.P2...', '######']);
    const ev = runGame(s, [[{ right: true }, 30]]);
    expect(s.session.edelweiss).toEqual([false, true, false]);
    expect(ev.filter((e) => e.type === 'edelweiss')).toEqual([{ type: 'edelweiss', index: 1 }]);
  });
});
