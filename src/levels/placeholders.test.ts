// Platzhalter-Level 1-3, 1-4 und 1-F: gültig, kurz, beim Gipfelkreuz endbar; 1-3 hat eine Abkürzung. (1-2 ist echt: level-1-2.test.ts)
import { describe, expect, it } from 'vitest';
import { TILE } from '../config.ts';
import { createGame } from '../core/game.ts';
import { parseLevel, validateLevel } from '../core/level.ts';
import { placePlayer, runGame } from '../core/test-helpers.ts';
import type { GameEvent } from '../core/types.ts';
import { LEVELS } from './index.ts';

const IDS = ['1-3', '1-4', '1-F'];

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

  it('1-4 und 1-F haben kein geheimes Gipfelkreuz', () => {
    for (const id of ['1-4', '1-F']) {
      expect(parseLevel(id, LEVELS[id]).spawns.some((s) => s.kind === 'secretGoal')).toBe(false);
    }
  });

  /** Läuft nach rechts und springt in festem Takt, solange das Level nicht beendet ist. */
  const dauerlauf = (s: ReturnType<typeof createGame>) => {
    const events: GameEvent[] = [];
    for (let i = 0; i < 40 && s.phase !== 'goal'; i++) events.push(...runGame(s, [[{ right: true, jump: true }, 30]]));
    return events;
  };

  it('Dauerlauf mit Sprüngen erreicht in 1-4 und 1-F das normale Ziel', () => {
    for (const id of ['1-4', '1-F']) {
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
