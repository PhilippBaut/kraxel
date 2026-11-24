// Bedienoberfläche über dem Spielbild. Phase A: Steuerfeld hochkant, Steuerkreuz und Sprungknopf.
import Phaser from 'phaser';
import { canvas2d } from '../gfx/bake.ts';
import { BUTTON_RADII, dpadKey, roundButtonKey } from '../gfx/textures.ts';
import type { Controls } from '../input/controls.ts';
import type { Circle, Layout } from '../view/layout.ts';

/** Ruhiges Punktmuster und Kante oben, wie `drawPortrait` im Entwurf. */
const PANEL_FILL = '#231c37', PANEL_DOT = '#2b2343', EDGE_LIGHT = 0x4a3d6b, EDGE_DARK = 0x120e1f;
const PATTERN_KEY = 'panel-pattern';
const NONE = { left: false, right: false, up: false, down: false };

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

/** Linke obere Ecke einer Knopf-Textur, deren Mitte bei r+1 liegt (Steuerkreuz und runde Knöpfe). */
function placeButton(img: Phaser.GameObjects.Image, c: Circle, alpha: number): void {
  img.setPosition(c.cx - c.r - 1, c.cy - c.r - 1).setAlpha(alpha);
}

export class UiScene extends Phaser.Scene {
  private controls!: Controls;
  private layout!: Layout;
  private panel!: Phaser.GameObjects.TileSprite;
  private panelEdge!: Phaser.GameObjects.Graphics;
  private dpad!: Phaser.GameObjects.Image;
  private jump!: Phaser.GameObjects.Image;
  /** Ohne Touch bleiben die Knöpfe verborgen, bis der erste Finger den Bildschirm berührt. */
  private readonly touchDevice = navigator.maxTouchPoints > 0;

  constructor() {
    super('ui');
  }

  create(): void {
    this.controls = this.registry.get('controls') as Controls;
    if (!this.textures.exists(PATTERN_KEY)) this.textures.addCanvas(PATTERN_KEY, panelPattern());
    this.panel = this.add.tileSprite(0, 0, 4, 8, PATTERN_KEY).setOrigin(0);
    this.panelEdge = this.add.graphics();
    this.dpad = this.add.image(0, 0, dpadKey(BUTTON_RADII.dpad[0], NONE)).setOrigin(0);
    this.jump = this.add.image(0, 0, roundButtonKey('jump', BUTTON_RADII.jump[0], false)).setOrigin(0);
    this.applyLayout(this.registry.get('layout') as Layout);
    this.game.events.on('layout', this.applyLayout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off('layout', this.applyLayout, this));
  }

  update(): void {
    const held = this.controls.held(), l = this.layout;
    const show = this.touchDevice || this.controls.touchSeen;
    this.dpad.setVisible(show).setTexture(dpadKey(l.dpad.r, held));
    this.jump.setVisible(show).setTexture(roundButtonKey('jump', l.jump.r, held.jump));
  }

  private applyLayout(l: Layout): void {
    this.layout = l;
    this.cameras.main.setSize(l.gameW, l.gameH);
    const p = l.panel;
    this.panel.setVisible(p !== null);
    this.panelEdge.clear();
    if (p) {
      this.panel.setPosition(p.x, p.y).setSize(p.w, p.h);
      this.panelEdge.fillStyle(EDGE_LIGHT).fillRect(p.x, p.y, p.w, 1);
      this.panelEdge.fillStyle(EDGE_DARK).fillRect(p.x, p.y + 1, p.w, 1);
    }
    const alpha = l.orientation === 'portrait' ? 1 : l.controlsAlpha;
    placeButton(this.dpad, l.dpad, alpha);
    placeButton(this.jump, l.jump, alpha);
    this.update();
  }
}
