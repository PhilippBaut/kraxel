// Text in der Pixelschrift: ein Image pro Zeichen aus dem Font-Atlas (`font-white` / `font-dark`).
import Phaser from 'phaser';
import { ADVANCE, FONT5, GLYPH_H, textWidth } from './font.ts';

export class PixelText extends Phaser.GameObjects.Container {
  private readonly fontKey: string;
  private current = '';

  /** (x, y) ist die linke obere Ecke; Breite und Höhe stehen danach in `width`/`height`. */
  constructor(scene: Phaser.Scene, x: number, y: number, text: string, color: 'white' | 'dark') {
    super(scene, x, y);
    this.fontKey = color === 'white' ? 'font-white' : 'font-dark';
    scene.add.existing(this);
    this.setText(text);
  }

  setText(t: string): this {
    if (t === this.current) return this;
    this.current = t;
    this.removeAll(true);
    let x = 0;
    for (const ch of t) {
      if (ch !== ' ' && ch in FONT5) this.add(new Phaser.GameObjects.Image(this.scene, x, 0, this.fontKey, ch).setOrigin(0));
      x += ADVANCE;
    }
    this.setSize(textWidth(t), GLYPH_H);
    return this;
  }
}
