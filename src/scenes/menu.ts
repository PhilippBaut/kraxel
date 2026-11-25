// Knopfliste für Pause und Ergebnis: per Tipp oder Tastatur (hoch/runter wählt, Sprung bestätigt).
// Weitere Knöpfe kommen einfach als weiterer Eintrag in die Liste.
import Phaser from 'phaser';
import type { Sfx } from '../audio/sfx.ts';
import type { Rect } from '../core/types.ts';
import { textWidth } from '../gfx/font.ts';
import { OutlinedText } from '../gfx/pixel-text.ts';
import type { Controls } from '../input/controls.ts';

export interface MenuItem {
  /** Wird bei jedem Neuzeichnen gelesen, so kann sich die Beschriftung ändern (TON: AN/AUS). */
  label: () => string;
  run: () => void;
}

const BUTTON_H = 15;
const BUTTON_GAP = 4, MIN_W = 88, PAD_X = 8;
/** Farben wie Steuerkreuz und Sprungknopf im Entwurf. */
const EDGE = 0x16112a, FILL = 0x5b4f80, FILL_HI = 0x8478b0, SEL = 0x2ec4b6, SEL_HI = 0xa6f5e9;
/** Steuerfeld-Farben aus dem Entwurf (`drawPortrait`). */
const PANEL_FILL = 0x231c37, PANEL_LIGHT = 0x4a3d6b, PANEL_DARK = 0x120e1f;
/** Abdunkeln mit DARK aus der Palette. */
const DIM = 0x1b1230, DIM_ALPHA = 0.55;

/** Spielbild abdunkeln. */
export function dim(g: Phaser.GameObjects.Graphics, r: Rect): void {
  g.fillStyle(DIM, DIM_ALPHA).fillRect(r.x, r.y, r.w, r.h);
}

/** Tafel mit dunklem Rand, heller Kante oben und dunkler Kante unten. */
export function drawPanel(g: Phaser.GameObjects.Graphics, r: Rect): void {
  g.fillStyle(EDGE).fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
  g.fillStyle(PANEL_FILL).fillRect(r.x, r.y, r.w, r.h);
  g.fillStyle(PANEL_LIGHT).fillRect(r.x, r.y, r.w, 1);
  g.fillStyle(PANEL_DARK).fillRect(r.x, r.y + r.h - 1, r.w, 1);
}

export class Menu {
  private readonly game: Phaser.Game;
  private readonly controls: Controls;
  private readonly sfx: Sfx;
  private readonly items: readonly MenuItem[];
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly labels: OutlinedText[];
  private rects: Rect[] = [];
  private x = 0;
  private y = 0;
  private selected = 0;
  /** Für die Flanke von „hoch“; „runter“ liefert der InputSampler schon als downPressed. */
  private prevUp = false;
  /** Spielzeit (ms), ab der das Menü reagiert. */
  private readonly unlockAt: number;

  /** `lockMs`: so lange nach dem Öffnen nichts auslösen (wer im Ziel noch Sprung hämmert, startet nicht gleich neu). */
  constructor(scene: Phaser.Scene, items: readonly MenuItem[], lockMs = 0) {
    this.game = scene.game;
    this.unlockAt = scene.game.loop.time + lockMs;
    this.controls = scene.registry.get('controls') as Controls;
    this.sfx = scene.registry.get('sfx') as Sfx;
    this.items = items;
    this.gfx = scene.add.graphics();
    this.labels = items.map((it) => new OutlinedText(scene, 0, 0, it.label()));
    const offTap = this.controls.onTap((x, y) => this.tap(x, y));
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, offTap);
    this.swallow(); // Taste oder Finger, die das Menü geöffnet haben, bestätigen nichts.
  }

  get width(): number {
    return Math.max(MIN_W, ...this.items.map((it) => textWidth(it.label()) + 2 * PAD_X));
  }

  get height(): number {
    return this.items.length * BUTTON_H + (this.items.length - 1) * BUTTON_GAP;
  }

  /** Linke obere Ecke der Liste. */
  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.draw();
  }

  /** Einmal pro Bild: Tastatur und Steuerkreuz auswerten. */
  update(): void {
    const f = this.controls.sample();
    const up = f.up && !this.prevUp;
    this.prevUp = f.up;
    if (this.locked) return;
    const n = this.items.length;
    if (up || f.downPressed) {
      this.selected = (this.selected + (up ? n - 1 : 1)) % n;
      this.sfx.play('select');
      this.draw();
    }
    if (f.jumpPressed) this.activate(this.selected);
  }

  private get locked(): boolean {
    return this.game.loop.time < this.unlockAt;
  }

  private tap(x: number, y: number): void {
    if (this.locked) return;
    const i = this.rects.findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
    if (i < 0) return;
    // Liegt der Knopf über einer Steuerzone, hat derselbe Finger gerade „Sprung“ gedrückt: diese Flanke schlucken.
    this.swallow();
    this.selected = i;
    this.activate(i);
  }

  private swallow(): void {
    this.prevUp = this.controls.sample().up;
  }

  /** Klick-Ton nach der Aktion: „TON: AN“ ist so gleich zu hören, „TON: AUS“ bleibt still. */
  private activate(i: number): void {
    this.items[i]!.run();
    this.sfx.play('select');
    this.draw();
  }

  private draw(): void {
    const w = this.width, g = this.gfx;
    g.clear();
    this.rects = this.items.map((it, i) => {
      const r = { x: this.x, y: this.y + i * (BUTTON_H + BUTTON_GAP), w, h: BUTTON_H };
      const sel = i === this.selected;
      g.fillStyle(EDGE).fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
      g.fillStyle(sel ? SEL : FILL).fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle(sel ? SEL_HI : FILL_HI).fillRect(r.x, r.y, r.w, 1);
      const label = this.labels[i]!.setText(it.label());
      label.setPosition(r.x + Math.floor((r.w - label.width) / 2), r.y + 4);
      return r;
    });
  }
}
