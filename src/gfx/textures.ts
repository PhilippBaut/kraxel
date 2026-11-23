// Backt alle Grafiken in Phaser-Texturen.
import type Phaser from 'phaser';
import { buildSprites } from './sprites.ts';
import { bakeGrid, toCanvas, canvas2d } from './bake.ts';
import { BASE, DARK, WORLDS } from './palette.ts';
import { buildBackgroundLayers } from './background.ts';
import { drawDpad, drawRoundButton, type DirHeld } from './buttons.ts';
import { ADVANCE, FONT5, GLYPH_H, GLYPH_W } from './font.ts';

/** Knopfgrößen hochkant und quer (Radien wie im Layout, Task 8). */
export const BUTTON_RADII = { dpad: [36, 28], jump: [24, 18], action: [14, 12] } as const;

const GROUND_TILES = new Set(['groundTop', 'groundFill']);
const DIRS = ['left', 'right', 'up', 'down'] as const;

export function dpadKey(r: number, held: DirHeld): string {
  return `dpad-${r}-` + DIRS.map((d) => (held[d] ? d[0] : '')).join('');
}

export function roundButtonKey(kind: 'jump' | 'action', r: number, pressed: boolean): string {
  return `${kind}-${r}${pressed ? '-on' : ''}`;
}

/** Ersetzt eine vorhandene Textur, damit ein Weltwechsel die Paletten tauschen kann. */
function addCanvas(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): Phaser.Textures.CanvasTexture {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, canvas);
  if (!tex) throw new Error(`Textur ${key} ließ sich nicht anlegen`);
  return tex;
}

function addFont(scene: Phaser.Scene, key: string, color: string): void {
  const chars = Object.keys(FONT5);
  const [canvas, ctx] = canvas2d(chars.length * ADVANCE, GLYPH_H);
  ctx.fillStyle = color;
  chars.forEach((ch, i) => FONT5[ch].forEach((row, y) => {
    for (let x = 0; x < GLYPH_W; x++) if (row[x] === '#') ctx.fillRect(i * ADVANCE + x, y, 1, 1);
  }));
  const tex = addCanvas(scene, key, canvas);
  chars.forEach((ch, i) => tex.add(ch, 0, i * ADVANCE, 0, GLYPH_W, GLYPH_H));
}

/** `world` zählt ab 1 (Graslandschaft). */
export function registerTextures(scene: Phaser.Scene, world: number): void {
  const w = WORLDS[world - 1];
  if (!w) throw new Error(`Unbekannte Welt ${world}`);
  const tilePal = { ...BASE, ...w.tiles };
  for (const [name, g] of Object.entries(buildSprites())) {
    addCanvas(scene, name, toCanvas(bakeGrid(g, GROUND_TILES.has(name) ? tilePal : BASE)));
  }
  const bg = buildBackgroundLayers(w);
  addCanvas(scene, 'bg-sky', bg.sky);
  addCanvas(scene, 'bg-far', bg.far);
  addCanvas(scene, 'bg-hills', bg.hills);
  addCanvas(scene, 'bg-clouds', bg.clouds);
  addFont(scene, 'font-white', '#ffffff');
  addFont(scene, 'font-dark', DARK);
  for (const r of BUTTON_RADII.dpad) {
    for (let mask = 0; mask < 16; mask++) {
      const held: DirHeld = { left: !!(mask & 1), right: !!(mask & 2), up: !!(mask & 4), down: !!(mask & 8) };
      addCanvas(scene, dpadKey(r, held), drawDpad(r, held));
    }
  }
  for (const kind of ['jump', 'action'] as const) {
    for (const r of BUTTON_RADII[kind]) {
      for (const pressed of [false, true]) addCanvas(scene, roundButtonKey(kind, r, pressed), drawRoundButton(r, kind, pressed));
    }
  }
}
