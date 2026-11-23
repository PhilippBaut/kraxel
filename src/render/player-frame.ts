// Welches Kraxel-Bild gerade zu sehen ist. Ohne Phaser, damit es in Node testbar bleibt.
import type { PlayerAnim, PlayerState } from '../core/player.ts';
import { helmName, type SpriteName } from '../gfx/sprites.ts';

type Frames = { frames: readonly SpriteName[]; fps: number };

const ANIMS: Record<PlayerAnim, Frames> = {
  idle: { frames: ['kraxel'], fps: 0 },
  walk: { frames: ['kraxel', 'kraxelB'], fps: 8 },
  run: { frames: ['kraxelRun1', 'kraxelRun2'], fps: 12 },
  skid: { frames: ['kraxelSkid'], fps: 0 },
  jump: { frames: ['kraxelJ'], fps: 0 },
  fall: { frames: ['kraxelFall'], fps: 0 },
  wallSlide: { frames: ['kraxelWall'], fps: 0 },
  climb: { frames: ['kraxelClimb1', 'kraxelClimb2'], fps: 6 },
  pound: { frames: ['kraxelPound'], fps: 0 },
  hurt: { frames: ['kraxelHurt'], fps: 0 },
  dead: { frames: ['kraxelDead'], fps: 0 },
  cheer: { frames: ['kraxelCheer'], fps: 0 },
};

/** Texturname inklusive Helm-Variante; `time` in Sekunden. */
export function playerFrame(p: PlayerState, time: number): string {
  const a = ANIMS[p.anim];
  const frame = a.frames[Math.floor(time * a.fps) % a.frames.length]!;
  return p.helm ? helmName(frame) : frame;
}

/**
 * Die Bilder schauen nach rechts. An der Wand zählt die Wandseite: `kraxelWall` zeigt die
 * Wand ungespiegelt rechts, so klebt Kraxel auch dann an der Wand, wenn `facing` abweicht.
 */
export function playerFlipX(p: PlayerState): boolean {
  if ((p.anim === 'wallSlide' || p.anim === 'climb') && p.wallDir !== 0) return p.wallDir < 0;
  return p.facing < 0;
}
