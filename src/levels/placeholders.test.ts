// Platzhalter-Level 1-2, 1-3, 1-4 und 1-F: gültig, kurz, beim Gipfelkreuz endbar; 1-3 hat eine Abkürzung.
import { describe, expect, it } from 'vitest';
import { TILE } from '../config.ts';
import { createGame } from '../core/game.ts';
import { parseLevel, validateLevel } from '../core/level.ts';
import { placePlayer, runGame } from '../core/test-helpers.ts';
import type { GameEvent } from '../core/types.ts';
import { Cell } from '../core/types.ts';
import { LEVELS } from './index.ts';

const IDS = ['1-2', '1-3', '1-4', '1-F'];

describe('Platzhalter-Level', () => {
  for (const id of IDS) {
    it(`${id} ist gültig, kurz und trägt BAUSTELLE im Namen`, () => {
      const l = parseLevel(id, LEVELS[id]);
      expect(validateLevel(l, { requireEdelweiss: false, requireGoal: true })).toEqual([]);
      expect(l.world).toBe(1);
      expect(l.width).toBeGreaterThanOrEqual(40);
      expect(l.width).toBeLessThanOrEqual(60);
      expect(l.height).toBeGreaterThanOrEqual(12);
      expect(l.height).toBeLessThanOrEqual(14);
      expect(l.name).toMatch(/\(BAUSTELLE\)$/);
    });
  }

  it('1-2, 1-4 und 1-F haben kein geheimes Gipfelkreuz', () => {
    for (const id of ['1-2', '1-4', '1-F']) {
      expect(parseLevel(id, LEVELS[id]).spawns.some((s) => s.kind === 'secretGoal')).toBe(false);
    }
  });

  /** Läuft nach rechts und springt in festem Takt, solange das Level nicht beendet ist. */
  const dauerlauf = (s: ReturnType<typeof createGame>) => {
    const events: GameEvent[] = [];
    for (let i = 0; i < 40 && s.phase !== 'goal'; i++) events.push(...runGame(s, [[{ right: true, jump: true }, 30]]));
    return events;
  };

  describe('1-2 bringt Schleuder, Enzian und Polster zum Ausprobieren', () => {
    const l = parseLevel('1-2', LEVELS['1-2']);
    const crate = (item: string) => [...l.crates].map(([i, c]) => ({ c, cx: i % l.width, cy: Math.floor(i / l.width) }))
      .filter((x) => x.c.kind === 'item' && x.c.item === item);
    const pads = () => { const r: number[] = []; for (let cx = 0; cx < l.width; cx++) for (let cy = 0; cy < l.height; cy++) if (l.cells[cy * l.width + cx] === Cell.LeafPad) r.push(cx); return r; };

    it('enthält erst eine Helm-Kiste, später eine Schleuder-Kiste, eine Enzian-Kiste bei Gegnern und zwei Polster', () => {
      const h = crate('helm'), j = crate('sling'), e = crate('enzian');
      expect([h.length, j.length, e.length]).toEqual([1, 1, 1]);
      expect(h[0]!.cx).toBeLessThan(j[0]!.cx);
      expect(pads().length).toBe(2);
      const gegner = l.spawns.filter((x) => x.kind === 'beetle' || x.kind === 'snail');
      expect(gegner.length).toBeGreaterThanOrEqual(2);
      expect(gegner.some((x) => Math.abs(x.cx - e[0]!.cx) <= 6)).toBe(true);
    });

    /** Stößt die Kiste an, wartet bis das Item draußen ist und legt es auf Kraxel. */
    const nimm = (s: ReturnType<typeof createGame>, cx: number, cy: number) => {
      placePlayer(s, cx, cy + 2);
      runGame(s, [[{ jump: true }, 30], [{}, 45]]);
      const item = s.pickups.find((p) => p.kind === 'item' && !p.taken)!;
      item.body.x = s.player.body.x;
      item.body.y = s.player.body.y;
      runGame(s, [[{}, 1]]);
    };

    it('Helm-Kiste gibt den Helm, danach gibt die Schleuder-Kiste die Schleuder, die Enzian-Kiste den Enzian', () => {
      const s = createGame(l);
      const h = crate('helm')[0]!, j = crate('sling')[0]!, e = crate('enzian')[0]!;
      nimm(s, h.cx, h.cy);
      expect([s.player.helm, s.player.special]).toEqual([true, null]);
      nimm(s, j.cx, j.cy);
      expect(s.player.special).toBe('sling');
      nimm(s, e.cx, e.cy);
      expect(s.player.enzian).toBeGreaterThan(0);
      expect(s.player.special).toBe('sling');
    });

    it('das erste Polster federt Kraxel auf den Aussichtsplatz mit Kristallen', () => {
      const s = createGame(l);
      const pad = Math.min(...pads());
      placePlayer(s, pad, 9); // knapp über dem Polster, fällt hinein
      const ev: GameEvent[] = [];
      for (let i = 0; i < 20 && !ev.some((e) => e.type === 'bounce'); i++) ev.push(...runGame(s, [[{}, 1]]));
      expect(ev.some((e) => e.type === 'bounce')).toBe(true);
      const ledgeTop = [...Array(l.height).keys()].find((cy) => l.cells[cy * l.width + pad + 4] === Cell.Ground)!;
      expect(ledgeTop).toBeLessThan(8);
      let oben = false;
      for (let i = 0; i < 90; i++) {
        runGame(s, [[{ right: true }, 1]]);
        if (s.player.grounded && Math.abs(s.player.body.y + s.player.body.h - ledgeTop * TILE) < 1) oben = true;
      }
      expect(oben).toBe(true);
    });
  });

  it('Dauerlauf mit Sprüngen erreicht in 1-2, 1-4 und 1-F das normale Ziel', () => {
    for (const id of ['1-2', '1-4', '1-F']) {
      const ev = dauerlauf(createGame(parseLevel(id, LEVELS[id])));
      expect([id, ev.find((e) => e.type === 'goal')]).toEqual([id, expect.objectContaining({ exit: 'normal' })]);
    }
  });

  it('1-3: Dauerlauf mit Sprüngen nach rechts erreicht das normale Ziel Z, nicht das geheime G', () => {
    const l = parseLevel('1-3', LEVELS['1-3']);
    const s = createGame(l);
    const ev = dauerlauf(s);
    expect(ev.find((e) => e.type === 'goal')).toMatchObject({ exit: 'normal' });
  });

  it('1-3: Ein bewusster Abstecher (nach links, Stufe, Plattform) führt zum G und meldet secret', () => {
    const l = parseLevel('1-3', LEVELS['1-3']);
    const g = l.spawns.find((e) => e.kind === 'secretGoal')!;
    const s = createGame(l);
    const ev: GameEvent[] = [];
    for (let i = 0; i < 30 && s.phase !== 'goal'; i++) ev.push(...runGame(s, [[{ left: true }, 20], [{ left: true, jump: true }, 24]]));
    expect(ev.find((e) => e.type === 'goal')).toMatchObject({ exit: 'secret' });
    expect(Math.abs(s.player.body.x / TILE - g.cx)).toBeLessThan(2);
    expect(s.session.lives).toBe(5);
  });

  it('1-3: Am Boden geht es unter dem Seitenweg hindurch zum normalen Ziel', () => {
    const l = parseLevel('1-3', LEVELS['1-3']);
    const s = createGame(l);
    placePlayer(s, 21, 10);
    const ev: GameEvent[] = [];
    for (let i = 0; i < 20 && s.phase !== 'goal'; i++) ev.push(...runGame(s, [[{ right: true }, 20], [{ right: true, jump: true }, 24]]));
    expect(ev.find((e) => e.type === 'goal')).toMatchObject({ exit: 'normal' });
  });
});
