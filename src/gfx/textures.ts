// Backt alle Grafiken in Phaser-Texturen.
import type Phaser from 'phaser';
import { buildSprites } from './sprites.ts';
import { buildMapSprites } from './map-tiles.ts';
import { bakeGrid, toCanvas, canvas2d } from './bake.ts';
import { BASE, BURG, DARK, WORLDS } from './palette.ts';
import { buildGroundTileset } from './tiles.ts';
import { buildBackgroundLayers } from './background.ts';
import { drawDpad, drawRoundButton, type DirHeld } from './buttons.ts';
import { ADVANCE, FONT5, GLYPH_H, GLYPH_W } from './font.ts';
import { BASE_RADII, BUTTON_IDS, type ButtonId } from '../view/controls-config.ts';

/** Grundradien hochkant und quer, abgeleitet aus den Layout-Grundradien. */
export const BUTTON_RADII = {
  dpad: [BASE_RADII.portrait.dpad.r, BASE_RADII.landscape.dpad.r],
  jump: [BASE_RADII.portrait.jump.r, BASE_RADII.landscape.jump.r],
  action: [BASE_RADII.portrait.action.r, BASE_RADII.landscape.action.r],
} as const;

const GROUND_TILES = new Set(['groundTop', 'groundFill']);
const BURG_TILES = new Set(['burgTop', 'burgFill']);
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
    addCanvas(scene, name, toCanvas(bakeGrid(g, GROUND_TILES.has(name) ? tilePal : BURG_TILES.has(name) ? { ...BASE, ...BURG.tiles } : BASE)));
  }
  for (const [name, g] of Object.entries(buildMapSprites())) addCanvas(scene, name, toCanvas(bakeGrid(g, BASE)));
  addCanvas(scene, `tiles-w${world}`, toCanvas(bakeGrid(buildGroundTileset(w), tilePal)));
  const bg = buildBackgroundLayers(w);
  addCanvas(scene, 'bg-sky', bg.sky);
  addCanvas(scene, 'bg-far', bg.far);
  addCanvas(scene, 'bg-hills', bg.hills);
  addCanvas(scene, 'bg-clouds', bg.clouds);
  // Burg-Stil (`stil: burg`): eigene Steinkacheln und Burg-Hintergrund unter anderen Schlüsseln.
  addCanvas(scene, 'tiles-burg', toCanvas(bakeGrid(buildGroundTileset(BURG, 'burg'), { ...BASE, ...BURG.tiles })));
  const burg = buildBackgroundLayers(BURG);
  addCanvas(scene, 'bg-burg-sky', burg.sky);
  addCanvas(scene, 'bg-burg-far', burg.far);
  addCanvas(scene, 'bg-burg-hills', burg.hills);
  addCanvas(scene, 'bg-burg-clouds', burg.clouds);
  addFont(scene, 'font-white', '#ffffff');
  addFont(scene, 'font-dark', DARK);
  for (const kind of BUTTON_IDS) for (const r of BUTTON_RADII[kind]) ensureButtonTextures(scene, kind, r);
}

function heldOfMask(mask: number): DirHeld {
  return { left: !!(mask & 1), right: !!(mask & 2), up: !!(mask & 4), down: !!(mask & 8) };
}

/** Alle Schlüssel eines Knopfs für einen Radius: Steuerkreuz 16 Varianten, runde Knöpfe ruhend und gedrückt. */
export function buttonTextureKeys(kind: ButtonId, r: number): string[] {
  if (kind === 'dpad') return Array.from({ length: 16 }, (_, mask) => dpadKey(r, heldOfMask(mask)));
  return [roundButtonKey(kind, r, false), roundButtonKey(kind, r, true)];
}

/** Backt fehlende Knopf-Texturen für diesen Radius, vorhandene bleiben. */
export function ensureButtonTextures(scene: Phaser.Scene, kind: ButtonId, r: number): void {
  if (kind === 'dpad') {
    for (let mask = 0; mask < 16; mask++) {
      const held = heldOfMask(mask), key = dpadKey(r, held);
      if (!scene.textures.exists(key)) addCanvas(scene, key, drawDpad(r, held));
    }
    return;
  }
  for (const pressed of [false, true]) {
    const key = roundButtonKey(kind, r, pressed);
    if (!scene.textures.exists(key)) addCanvas(scene, key, drawRoundButton(r, kind, pressed));
  }
}
