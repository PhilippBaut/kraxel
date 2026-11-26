// Titelbild: Schriftzug KRAXEL über der Graslandschaft, Kraxel läuft durchs Bild, „TIPPEN ZUM STARTEN“ blinkt.
import Phaser from 'phaser';
import type { Sfx } from '../audio/sfx.ts';
import { TILE, VIEW_H } from '../config.ts';
import { WORLDS } from '../gfx/palette.ts';
import { OutlinedText } from '../gfx/pixel-text.ts';
import { GLYPH_H, textWidth } from '../gfx/font.ts';
import type { Controls } from '../input/controls.ts';
import { isShortcut } from '../input/keyboard.ts';
import { START_LEVEL } from '../levels/index.ts';
import { TEXT } from '../ui-text.ts';
import type { Rect } from '../core/types.ts';
import { BUTTON_H, drawButton } from './menu.ts';
import type { Layout } from '../view/layout.ts';

/** Dieselben Ebenen wie im Spiel; die Wolken ziehen. */
const BACKGROUND = [
  { key: 'bg-sky', drift: 0 },
  { key: 'bg-far', drift: 0 },
  { key: 'bg-clouds', drift: 3 },
  { key: 'bg-hills', drift: 0 },
] as const;
/** Horizont der Hintergrund-Ebenen (wie im Entwurf: 32 px über dem unteren Rand). */
const HORIZON = VIEW_H - 32;
const LOGO_SCALE = 3;
/** Gelb aus der Palette (S). */
const LOGO_TINT = 0xffd23f;
const BLINK_MS = 500;
/** Kraxel geht mit 8 Bildern/s (wie `walk` im Spiel) und 40 px/s. */
const WALK_FRAMES = ['kraxel', 'kraxelB'] as const;
const WALK_FPS = 8, WALK_SPEED = 40, KRAXEL_W = 16;
/** Hochkant liegt der Boden bei diesem Anteil der Höhe. */
const PORTRAIT_GROUND = 0.7;
/** Spielraum um den STEUERUNG-Knopf: knapp daneben tippen startet nicht das Spiel. */
const CONTROLS_SLOP_X = 6, CONTROLS_SLOP_Y = 8;

/** iOS im Browser (nicht vom Home-Bildschirm gestartet): dort gibt es Vollbild nur über „Zum Home-Bildschirm“. */
function isIosBrowser(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  if (!ios) return false;
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const mode = (m: string) => typeof window.matchMedia === 'function' && window.matchMedia(`(display-mode: ${m})`).matches;
  return !standalone && !mode('standalone') && !mode('fullscreen');
}

export class TitleScene extends Phaser.Scene {
  private controls!: Controls;
  private sfx!: Sfx;
  private layers: { sprite: Phaser.GameObjects.TileSprite; drift: number }[] = [];
  private groundTop!: Phaser.GameObjects.TileSprite;
  private groundFill!: Phaser.GameObjects.TileSprite;
  private logo!: OutlinedText;
  private tapText!: OutlinedText;
  private hint: OutlinedText[] = [];
  private kraxel!: Phaser.GameObjects.Image;
  private screenW = 0;
  private kraxelX = -KRAXEL_W;
  private starting = false;
  private controlsBtn!: { gfx: Phaser.GameObjects.Graphics; label: OutlinedText; rect: Rect };

  constructor() {
    super('title');
  }

  create(): void {
    this.controls = this.registry.get('controls') as Controls;
    this.sfx = this.registry.get('sfx') as Sfx;
    this.starting = false;
    this.kraxelX = -KRAXEL_W;
    this.cameras.main.setBackgroundColor(WORLDS[0]!.sky[0]); // Himmel über dem Hintergrundband (hochkant)
    this.layers = BACKGROUND.map(({ key, drift }) => ({ sprite: this.add.tileSprite(0, 0, 4, VIEW_H, key).setOrigin(0), drift }));
    this.groundTop = this.add.tileSprite(0, 0, 4, TILE, 'groundTop').setOrigin(0);
    this.groundFill = this.add.tileSprite(0, 0, 4, TILE, 'groundFill').setOrigin(0);
    this.kraxel = this.add.image(0, 0, WALK_FRAMES[0]).setOrigin(0, 1);
    this.logo = new OutlinedText(this, 0, 0, TEXT.TITLE, 'ring').setScale(LOGO_SCALE).setFaceTint(LOGO_TINT);
    this.tapText = new OutlinedText(this, 0, 0, TEXT.TAP_TO_START, 'ring');
    const gfx = this.add.graphics(); // vor dem Text, sonst deckt er ihn zu
    const label = new OutlinedText(this, 0, 0, TEXT.CONTROLS);
    this.controlsBtn = { gfx, label, rect: { x: 0, y: 0, w: 0, h: BUTTON_H } };
    this.hint = isIosBrowser() ? TEXT.IOS_HINT.map((line) => new OutlinedText(this, 0, 0, line, 'ring')) : [];

    this.applyLayout(this.registry.get('layout') as Layout);
    const offTap = this.controls.onTap((x, y) => this.onTap(x, y));
    window.addEventListener('keydown', this.onKey);
    this.game.events.on('layout', this.applyLayout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offTap();
      window.removeEventListener('keydown', this.onKey);
      this.game.events.off('layout', this.applyLayout, this);
    });
  }

  update(time: number, delta: number): void {
    this.tapText.setVisible(Math.floor(time / BLINK_MS) % 2 === 0);
    for (const l of this.layers) l.sprite.tilePositionX = Math.round((-time / 1000) * l.drift);
    this.kraxelX += (WALK_SPEED * delta) / 1000;
    if (this.kraxelX > this.screenW) this.kraxelX = -KRAXEL_W;
    this.kraxel.x = Math.round(this.kraxelX);
    this.kraxel.setTexture(WALK_FRAMES[Math.floor((time / 1000) * WALK_FPS) % WALK_FRAMES.length]!);
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    if (!e.repeat && !isShortcut(e) && this.scene.isActive()) this.startGame();
  };

  /** Tipp auf STEUERUNG öffnet den Editor, jeder andere Tipp startet das Spiel. */
  private onTap(x: number, y: number): void {
    if (!this.scene.isActive() || this.starting) return; // pausiert, solange der Editor offen ist (isActive ist dann false)
    const r = this.controlsBtn.rect;
    if (x >= r.x - CONTROLS_SLOP_X && x < r.x + r.w + CONTROLS_SLOP_X && y >= r.y - CONTROLS_SLOP_Y && y < r.y + r.h + CONTROLS_SLOP_Y) {
      this.sfx.unlock();
      this.sfx.play('select');
      this.controls.sample();
      this.scene.launch('controls', { returnTo: 'title' });
      this.scene.pause(); // bleibt sichtbar (gedimmt) hinter dem Editor
      return;
    }
    this.startGame();
  }

  /** Tipp oder Taste: Ton entsperren, Spiel und Info-Leiste starten. */
  private startGame(): void {
    if (this.starting) return;
    this.starting = true;
    this.sfx.unlock();
    this.sfx.play('select');
    // Der startende Finger bzw. die Taste soll im Spiel nicht als frischer Sprung ankommen.
    this.controls.sample();
    this.scene.start('play', { levelId: START_LEVEL });
    this.scene.launch('ui');
  }

  /** Quer füllt das Band (192 px) den Bildschirm; hochkant liegt es tiefer, darüber Himmel, darunter Erde. */
  private applyLayout(l: Layout): void {
    this.cameras.main.setSize(l.gameW, l.gameH);
    this.screenW = l.gameW;
    const groundY = l.orientation === 'portrait' ? Math.round(l.gameH * PORTRAIT_GROUND) : HORIZON;
    const bandY = groundY - HORIZON;
    for (const { sprite } of this.layers) sprite.setPosition(0, bandY).setSize(l.gameW, VIEW_H);
    this.groundTop.setPosition(0, groundY).setSize(l.gameW, TILE);
    this.groundFill.setPosition(0, groundY + TILE).setSize(l.gameW, Math.max(TILE, l.gameH - groundY - TILE));
    this.kraxel.y = groundY;

    const center = (o: OutlinedText, y: number, scale = 1) => o.setPosition(Math.floor((l.gameW - o.width * scale) / 2), y);
    const logoY = Math.round(groundY * 0.22);
    center(this.logo, logoY, LOGO_SCALE);
    const tapY = logoY + GLYPH_H * LOGO_SCALE + 30;
    center(this.tapText, tapY);
    this.hint.forEach((t, i) => center(t, tapY + 20 + i * (GLYPH_H + 3)));

    // Kleiner Knopf unten, über der Sicherheitskante.
    const b = this.controlsBtn, w = textWidth(TEXT.CONTROLS) + 16;
    b.rect = { x: Math.floor((l.gameW - w) / 2), y: l.controlsArea.y + l.controlsArea.h - BUTTON_H - 4, w, h: BUTTON_H };
    const r = b.rect;
    b.gfx.clear();
    drawButton(b.gfx, r);
    b.label.setPosition(r.x + Math.floor((r.w - b.label.width) / 2), r.y + 4);
  }
}
