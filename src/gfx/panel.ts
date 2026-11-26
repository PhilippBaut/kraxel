// Steuerfeld-Muster (Punktraster) und Kanten, wie `drawPortrait` im Entwurf. Geteilt von Info-Leiste und Knopf-Editor.
import type Phaser from 'phaser';
import type { Rect } from '../core/types.ts';
import { canvas2d } from './bake.ts';

const PANEL_FILL = '#231c37', PANEL_DOT = '#2b2343', EDGE_LIGHT = 0x4a3d6b, EDGE_DARK = 0x120e1f;
export const PATTERN_KEY = 'panel-pattern';

/** 4×8-Kachel: Punkte alle 4 px, jede zweite Reihe um 2 px versetzt. */
function panelPattern(): HTMLCanvasElement {
  const [c, ctx] = canvas2d(4, 8);
  ctx.fillStyle = PANEL_FILL;
  ctx.fillRect(0, 0, 4, 8);
  ctx.fillStyle = PANEL_DOT;
  ctx.fillRect(0, 2, 1, 1);
  ctx.fillRect(2, 6, 1, 1);
  return c;
}

export function ensurePanelPattern(scene: Phaser.Scene): void {
  if (!scene.textures.exists(PATTERN_KEY)) scene.textures.addCanvas(PATTERN_KEY, panelPattern());
}

/** Helle Kante oben, dunkle darunter. */
export function drawPanelEdge(g: Phaser.GameObjects.Graphics, p: Rect): void {
  g.fillStyle(EDGE_LIGHT).fillRect(p.x, p.y, p.w, 1);
  g.fillStyle(EDGE_DARK).fillRect(p.x, p.y + 1, p.w, 1);
}
