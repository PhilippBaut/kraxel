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

/** Versatz der dunklen Kopien: `shadow` nur rechts unten (Info-Leiste wie im Entwurf), `ring` ringsum (Titel). */
const RIM: Readonly<Record<'shadow' | 'ring', readonly (readonly [number, number])[]>> = {
  shadow: [[1, 1]],
  ring: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
};

/** Weißer Pixeltext mit dunklem Rand, damit er auch über hellem Hintergrund lesbar bleibt. Mit setScale wächst der Rand mit. */
export class OutlinedText extends Phaser.GameObjects.Container {
  private readonly layers: PixelText[];
  private readonly face: PixelText;
  private faceTint: number | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, rim: 'shadow' | 'ring' = 'shadow') {
    super(scene, x, y);
    scene.add.existing(this);
    this.layers = RIM[rim].map(([dx, dy]) => new PixelText(scene, dx, dy, text, 'dark'));
    this.face = new PixelText(scene, 0, 0, text, 'white');
    this.add([...this.layers, this.face]);
    this.setSize(this.face.width, this.face.height);
  }

  setText(t: string): this {
    for (const l of this.layers) l.setText(t);
    this.face.setText(t);
    this.applyTint();
    return this.setSize(this.face.width, this.face.height);
  }

  /** Färbt die helle Schrift (Multiplikation mit Weiß ergibt genau die Farbe). */
  setFaceTint(color: number): this {
    this.faceTint = color;
    this.applyTint();
    return this;
  }

  private applyTint(): void {
    if (this.faceTint === null) return;
    for (const img of this.face.list) (img as Phaser.GameObjects.Image).setTint(this.faceTint);
  }
}
