// Bedienoberfläche über dem Spielbild: Steuerfeld hochkant, Steuerkreuz, Sprungknopf und die Info-Leiste mit Pause-Knopf.
import Phaser from 'phaser';
import { formatTime } from '../core/format.ts';
import type { GameState } from '../core/game.ts';
import { canvas2d } from '../gfx/bake.ts';
import { GLYPH_H, textWidth } from '../gfx/font.ts';
import { OutlinedText } from '../gfx/pixel-text.ts';
import { BUTTON_RADII, dpadKey, roundButtonKey } from '../gfx/textures.ts';
import type { Controls } from '../input/controls.ts';
import type { Circle, Layout } from '../view/layout.ts';
import type { PauseScene } from './PauseScene.ts';
import type { PlayScene } from './PlayScene.ts';

/** Ruhiges Punktmuster und Kante oben, wie `drawPortrait` im Entwurf. */
const PANEL_FILL = '#231c37', PANEL_DOT = '#2b2343', EDGE_LIGHT = 0x4a3d6b, EDGE_DARK = 0x120e1f;
const PATTERN_KEY = 'panel-pattern';
const NONE = { left: false, right: false, up: false, down: false };
/** Info-Leiste quer: dunkle, halbtransparente Leiste oben. */
const STRIP = 0x1b1230, STRIP_ALPHA = 0.55;
/** Pause-Symbol: zwei Balken, hochkant in Steuerfeld-Lila, quer halbtransparent weiß (Entwurf). */
const PAUSE_PORTRAIT = 0x6d5f99, PAUSE_LANDSCAPE = 0xffffff, PAUSE_LANDSCAPE_ALPHA = 0.5;
const PAUSE_BAR_W = 2, PAUSE_BAR_GAP = 3;
/** Symbole: Kristall und Edelweiß 7×7, Kopf 8×6. Edelweiß alle 9 px. */
const ICON = 7, HEAD_W = 8, ICON_GAP = 2, GROUP_GAP = 8, EDEL_STEP = 9;

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
  private hud!: {
    strip: Phaser.GameObjects.Graphics; pause: Phaser.GameObjects.Graphics;
    crystal: Phaser.GameObjects.Image; crystals: OutlinedText;
    head: Phaser.GameObjects.Image; lives: OutlinedText;
    edel: Phaser.GameObjects.Image[]; time: OutlinedText;
  };
  /** Rechte Kante der Zeit, sie steht rechtsbündig. */
  private timeRight = 0;

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
    const icon = (key: string) => this.add.image(0, 0, key).setOrigin(0);
    this.hud = {
      strip: this.add.graphics(), pause: this.add.graphics(),
      crystal: icon('iCrystal'), crystals: new OutlinedText(this, 0, 0, ''),
      head: icon('iHead'), lives: new OutlinedText(this, 0, 0, ''),
      edel: [icon('iEdelOff'), icon('iEdelOff'), icon('iEdelOff')], time: new OutlinedText(this, 0, 0, ''),
    };
    this.applyLayout(this.registry.get('layout') as Layout);
    const offTap = this.controls.onTap((x, y) => this.onTap(x, y));
    this.game.events.on('layout', this.applyLayout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offTap();
      this.game.events.off('layout', this.applyLayout, this);
    });
  }

  update(): void {
    const held = this.controls.held(), l = this.layout;
    const show = this.touchDevice || this.controls.touchSeen;
    this.dpad.setVisible(show).setTexture(dpadKey(l.dpad.r, held));
    this.jump.setVisible(show).setTexture(roundButtonKey('jump', l.jump.r, held.jump));
    this.updateHud();
  }

  /** Werte aus dem laufenden Spiel. Beim allerersten Start kann die Spielszene noch fehlen. */
  private updateHud(): void {
    const s = (this.scene.get('play') as PlayScene).state as GameState | undefined;
    if (!s) return;
    const { crystals, lives, edelweiss, time } = s.session, h = this.hud;
    h.crystals.setText('×' + String(crystals).padStart(3, '0'));
    h.lives.setText('×' + lives);
    h.edel.forEach((img, i) => img.setTexture(edelweiss[i] ? 'iEdel' : 'iEdelOff'));
    h.time.setText(formatTime(time, false));
    h.time.x = this.timeRight - h.time.width;
  }

  /** Tipp auf den Pause-Knopf: pausieren, im Pausenmenü weiterspielen. */
  private onTap(x: number, y: number): void {
    const p = this.layout.pause;
    if (x < p.x || x >= p.x + p.w || y < p.y || y >= p.y + p.h) return;
    if (this.scene.isActive('pause')) (this.scene.get('pause') as PauseScene).resume();
    else (this.scene.get('play') as PlayScene).requestPause();
  }

  /** Hochkant in `layout.hud` im Steuerfeld (unter dessen 2 px Kante), quer als Leiste oben. */
  private layoutHud(l: Layout): void {
    const h = this.hud, r = l.hud, portrait = l.orientation === 'portrait';
    const top = portrait ? r.y + 2 : r.y;
    const y = top + Math.floor((r.y + r.h - top - GLYPH_H) / 2);
    h.strip.clear();
    if (!portrait) h.strip.fillStyle(STRIP, STRIP_ALPHA).fillRect(0, 0, l.gameW, r.y + r.h);
    let x = r.x + (portrait ? 6 : 4);
    h.crystal.setPosition(x, y);
    x += ICON + ICON_GAP;
    h.crystals.setPosition(x, y);
    x += textWidth('×000') + GROUP_GAP;
    h.head.setPosition(x, y + 1);
    x += HEAD_W + ICON_GAP;
    h.lives.setPosition(x, y);
    x += textWidth('×00') + GROUP_GAP;
    h.edel.forEach((img, i) => img.setPosition(x + i * EDEL_STEP, y));
    this.timeRight = portrait ? l.pause.x - 6 : r.x + r.w - 4;
    h.time.setPosition(this.timeRight - h.time.width, y);
    const p = l.pause, bx = p.x + Math.floor((p.w - 2 * PAUSE_BAR_W - PAUSE_BAR_GAP) / 2);
    h.pause.clear().fillStyle(portrait ? PAUSE_PORTRAIT : PAUSE_LANDSCAPE, portrait ? 1 : PAUSE_LANDSCAPE_ALPHA);
    h.pause.fillRect(bx, y, PAUSE_BAR_W, GLYPH_H).fillRect(bx + PAUSE_BAR_W + PAUSE_BAR_GAP, y, PAUSE_BAR_W, GLYPH_H);
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
    this.layoutHud(l);
    this.update();
  }
}
