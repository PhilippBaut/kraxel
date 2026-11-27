// Platzhalter-Level 1-F: gültig, kurz, beim Gipfelkreuz endbar, ohne geheimes Gipfelkreuz. (1-2 bis 1-4 sind echt: level-1-2.test.ts, level-1-3.test.ts, level-1-4.test.ts)
import { describe, expect, it } from 'vitest';
import { createGame } from '../core/game.ts';
import { parseLevel, validateLevel } from '../core/level.ts';
import { runGame } from '../core/test-helpers.ts';
import type { GameEvent } from '../core/types.ts';
import { LEVELS } from './index.ts';

const IDS = ['1-F'];

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

  it('1-F hat kein geheimes Gipfelkreuz', () => {
    for (const id of IDS) {
      expect(parseLevel(id, LEVELS[id]).spawns.some((s) => s.kind === 'secretGoal')).toBe(false);
    }
  });

  /** Läuft nach rechts und springt in festem Takt, solange das Level nicht beendet ist. */
  const dauerlauf = (s: ReturnType<typeof createGame>) => {
    const events: GameEvent[] = [];
    for (let i = 0; i < 40 && s.phase !== 'goal'; i++) events.push(...runGame(s, [[{ right: true, jump: true }, 30]]));
    return events;
  };

  it('Dauerlauf mit Sprüngen erreicht in 1-F das normale Ziel', () => {
    for (const id of IDS) {
      const ev = dauerlauf(createGame(parseLevel(id, LEVELS[id])));
      expect([id, ev.find((e) => e.type === 'goal')]).toEqual([id, expect.objectContaining({ exit: 'normal' })]);
    }
  });
});
