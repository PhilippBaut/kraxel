import { describe, expect, it } from 'vitest';
import { createPlayer } from '../core/player.ts';
import { playerFlipX, playerFrame } from './player-frame.ts';

describe('playerFrame', () => {
  it('wählt Bild nach anim und Helm', () => {
    const p = createPlayer(1, 1);
    p.anim = 'pound';
    expect(playerFrame(p, 0)).toBe('kraxelPound');
    p.helm = true;
    expect(playerFrame(p, 0)).toBe('kraxelPoundHelm');
    p.anim = 'walk';
    p.helm = false;
    expect(['kraxel', 'kraxelB']).toContain(playerFrame(p, 0.1));
  });

  it('feste Bilder für Stehen, Sprung, Fall, Bremsen, Wand, Treffer, Tod, Jubel', () => {
    const p = createPlayer(1, 1);
    const cases = [
      ['idle', 'kraxel'], ['jump', 'kraxelJ'], ['fall', 'kraxelFall'], ['skid', 'kraxelSkid'],
      ['wallSlide', 'kraxelWall'], ['hurt', 'kraxelHurt'], ['dead', 'kraxelDead'], ['cheer', 'kraxelCheer'],
    ] as const;
    for (const [anim, frame] of cases) {
      p.anim = anim;
      expect(playerFrame(p, 0.37)).toBe(frame);
    }
  });

  it('Gehen wechselt 8-mal pro Sekunde', () => {
    const p = createPlayer(1, 1);
    p.anim = 'walk';
    expect(playerFrame(p, 0.01)).toBe('kraxel');
    expect(playerFrame(p, 0.124)).toBe('kraxel');
    expect(playerFrame(p, 0.126)).toBe('kraxelB');
    expect(playerFrame(p, 0.251)).toBe('kraxel');
  });

  it('Rennen wechselt 12-mal pro Sekunde', () => {
    const p = createPlayer(1, 1);
    p.anim = 'run';
    expect(playerFrame(p, 0.01)).toBe('kraxelRun1');
    expect(playerFrame(p, 0.082)).toBe('kraxelRun1');
    expect(playerFrame(p, 0.09)).toBe('kraxelRun2');
    expect(playerFrame(p, 0.17)).toBe('kraxelRun1');
  });

  it('Kraxeln wechselt 6-mal pro Sekunde, mit Helm', () => {
    const p = createPlayer(1, 1);
    p.anim = 'climb';
    p.helm = true;
    expect(playerFrame(p, 0.01)).toBe('kraxelClimb1Helm');
    expect(playerFrame(p, 0.165)).toBe('kraxelClimb1Helm');
    expect(playerFrame(p, 0.17)).toBe('kraxelClimb2Helm');
  });
});

describe('playerFlipX', () => {
  it('spiegelt nach Blickrichtung', () => {
    const p = createPlayer(1, 1);
    p.anim = 'walk';
    p.facing = 1;
    expect(playerFlipX(p)).toBe(false);
    p.facing = -1;
    expect(playerFlipX(p)).toBe(true);
  });

  it('an der Wand zählt die Wandseite, nicht die Blickrichtung', () => {
    const p = createPlayer(1, 1);
    for (const anim of ['wallSlide', 'climb'] as const) {
      p.anim = anim;
      p.wallDir = 1;
      p.facing = -1;
      expect(playerFlipX(p)).toBe(false);
      p.wallDir = -1;
      p.facing = 1;
      expect(playerFlipX(p)).toBe(true);
    }
  });
});
