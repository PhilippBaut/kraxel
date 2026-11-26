// Galerie zum Prüfen aller Grafiken (`?galerie`): jedes Sprite doppelt groß mit Namen,
// Kraxel mit Mütze und Helm, Knöpfe, Schriftprobe und Hintergrund mit Bodenkacheln.
import Phaser from 'phaser';
import { buildSprites, KRAXEL_FRAMES, helmName } from '../gfx/sprites.ts';
import { PixelText } from '../gfx/pixel-text.ts';
import { FONT5, GLYPH_H, textWidth } from '../gfx/font.ts';
import { DARK } from '../gfx/palette.ts';
import { BUTTON_RADII, dpadKey, roundButtonKey } from '../gfx/textures.ts';
import { GROUND_TILES } from '../gfx/tiles.ts';
import { MAX_VIEW_W, VIEW_H } from '../config.ts';
import { TEXT } from '../ui-text.ts';

const W = MAX_VIEW_W;
const PAD = 4;
const NONE = { left: false, right: false, up: false, down: false };

export class GalleryScene extends Phaser.Scene {
  constructor() {
    super('gallery');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#8fd0ff');
    let y = PAD;
    y = this.kraxelTable(y) + 8;
    y = this.spriteFlow(y) + 8;
    y = this.buttons(y) + 8;
    y = this.tileset(y) + 8;
    y = this.fontSample(y) + 8;
    y = this.background(y) + PAD;
    this.scale.setGameSize(W, y);
  }

  private image(x: number, y: number, key: string, scale = 1): Phaser.GameObjects.Image {
    return this.add.image(x, y, key).setOrigin(0).setScale(scale);
  }

  /** Alle Kraxel-Bilder: oben mit Mütze, darunter die Helm-Variante; Namen versetzt. */
  private kraxelTable(y: number): number {
    const cell = 36;
    KRAXEL_FRAMES.forEach((f, i) => {
      const x = PAD + i * cell;
      const label = f === 'kraxel' ? 'KRAXEL' : f.slice('kraxel'.length).toUpperCase();
      this.image(x + 2, y, f, 2);
      new PixelText(this, x + Math.floor((cell - textWidth(label)) / 2), y + 34 + (i % 2) * 9, label, 'dark');
      this.image(x + 2, y + 54, helmName(f), 2);
    });
    return y + 86;
  }

  /** Übrige Sprites im Fluss, das hohe Gipfelkreuz rechts daneben. */
  private spriteFlow(top: number): number {
    const kraxel = new Set<string>([...KRAXEL_FRAMES, ...KRAXEL_FRAMES.map(helmName)]);
    const names = Object.keys(buildSprites()).filter((n) => !kraxel.has(n) && n !== 'cross' && n !== 'crossGold');
    const right = W - 96;
    let x = PAD, y = top, rowH = 0;
    for (const n of names) {
      const img = this.image(0, 0, n, 2);
      const label = n.toUpperCase();
      const w = Math.max(img.displayWidth, textWidth(label)) + 6;
      if (x + w > right) { x = PAD; y += rowH; rowH = 0; }
      img.setPosition(x, y);
      new PixelText(this, x, y + img.displayHeight + 3, label, 'dark');
      x += w;
      rowH = Math.max(rowH, img.displayHeight + 3 + GLYPH_H + 6);
    }
    const cross = this.image(right + 12, top, 'cross', 2);
    new PixelText(this, right + 10, top + cross.displayHeight + 3, 'CROSS', 'dark');
    const gold = this.image(right + 52, top, 'crossGold', 2);
    new PixelText(this, right + 50, top + gold.displayHeight + 3, 'GOLD', 'dark');
    return Math.max(y + rowH, top + cross.displayHeight + 3 + GLYPH_H);
  }

  /** Knöpfe hochkant und quer, jeweils ruhend und gedrückt. */
  private buttons(top: number): number {
    let y = top;
    BUTTON_RADII.dpad.forEach((r, i) => {
      const keys = [
        dpadKey(r, NONE), dpadKey(r, { ...NONE, right: true, up: true }),
        roundButtonKey('jump', BUTTON_RADII.jump[i], false), roundButtonKey('jump', BUTTON_RADII.jump[i], true),
        roundButtonKey('action', BUTTON_RADII.action[i], false), roundButtonKey('action', BUTTON_RADII.action[i], true),
      ];
      let x = PAD;
      for (const k of keys) x += this.image(x, y, k).width + 8;
      y += r * 2 + 2 + 6;
    });
    return y;
  }

  /** Der Bodenstreifen mit allen Randvarianten, doppelt groß, darunter die Namen versetzt. */
  private tileset(top: number): number {
    const img = this.image(PAD, top, 'tiles-w1', 2);
    const labelY = top + img.displayHeight + 3;
    GROUND_TILES.forEach((n, i) => new PixelText(this, PAD + i * 32, labelY + (i % 2) * 9, n.toUpperCase(), 'dark'));
    return labelY + 9 + GLYPH_H;
  }

  /** Alle Glyphen dunkel auf hell, alle Texte aus ui-text weiß auf dunkel. */
  private fontSample(top: number): number {
    new PixelText(this, PAD, top, Object.keys(FONT5).join(''), 'dark');
    const lines = Object.values(TEXT).flat();
    const perCol = Math.ceil(lines.length / 2), lineH = GLYPH_H + 3;
    const boxY = top + GLYPH_H + 5, boxH = perCol * lineH + 6;
    this.add.rectangle(0, boxY, W, boxH, Phaser.Display.Color.HexStringToColor(DARK).color).setOrigin(0);
    lines.forEach((t, i) => {
      new PixelText(this, PAD + 2 + Math.floor(i / perCol) * (W / 2), boxY + 4 + (i % perCol) * lineH, t, 'white');
    });
    return boxY + boxH;
  }

  /** Die vier Parallax-Ebenen übereinander, unten zwei Reihen Bodenkacheln. */
  private background(top: number): number {
    this.image(0, top, 'bg-sky').setDisplaySize(W, VIEW_H);
    for (const k of ['bg-far', 'bg-clouds', 'bg-hills']) this.image(0, top, k);
    for (let x = 0; x < W; x += 16) {
      this.image(x, top + VIEW_H - 32, 'groundTop');
      this.image(x, top + VIEW_H - 16, 'groundFill');
    }
    return top + VIEW_H;
  }
}
