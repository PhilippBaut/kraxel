// Pausenmenü über dem angehaltenen Spiel: WEITER, NEU STARTEN, TON: AN/AUS.
import Phaser from 'phaser';
import type { Sfx } from '../audio/sfx.ts';
import { loadSave, safeStorage, writeSave } from '../core/save.ts';
import { GLYPH_H } from '../gfx/font.ts';
import { OutlinedText } from '../gfx/pixel-text.ts';
import type { Controls } from '../input/controls.ts';
import { TEXT } from '../ui-text.ts';
import type { Layout } from '../view/layout.ts';
import { dim, drawPanel, Menu } from './menu.ts';
import type { PlayScene } from './PlayScene.ts';

const PAD = 10, TITLE_GAP = 8;

export class PauseScene extends Phaser.Scene {
  private sfx!: Sfx;
  private bg!: Phaser.GameObjects.Graphics;
  private title!: OutlinedText;
  private menu!: Menu;
  private closing = false;

  constructor() {
    super('pause');
  }

  create(): void {
    this.closing = false;
    this.sfx = this.registry.get('sfx') as Sfx;
    const controls = this.registry.get('controls') as Controls;
    this.bg = this.add.graphics();
    this.title = new OutlinedText(this, 0, 0, TEXT.PAUSE);
    this.menu = new Menu(this, [
      { label: () => TEXT.RESUME, run: () => this.resume() },
      { label: () => TEXT.RESTART, run: () => this.restart() },
      { label: () => (this.sfx.muted ? TEXT.SOUND_OFF : TEXT.SOUND_ON), run: () => this.toggleSound() },
    ]);
    this.applyLayout(this.registry.get('layout') as Layout);
    const offPause = controls.onPause(() => this.resume());
    this.game.events.on('layout', this.applyLayout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offPause();
      this.game.events.off('layout', this.applyLayout, this);
    });
  }

  update(): void {
    this.menu.update();
  }

  /** Zurück ins Spiel (auch Escape/P oder der Pause-Knopf). */
  resume(): void {
    if (this.closing) return;
    this.closing = true;
    this.scene.resume('play');
    this.scene.stop();
  }

  private restart(): void {
    if (this.closing) return;
    (this.scene.get('play') as PlayScene).restart();
    this.resume();
  }

  /** Stummschaltung umschalten und im Speicherstand merken. */
  private toggleSound(): void {
    const muted = !this.sfx.muted;
    const store = safeStorage();
    writeSave(store, { ...loadSave(store), muted });
    this.sfx.setMuted(muted);
  }

  /** Tafel mittig im Spielbild (hochkant oben, quer der ganze Bildschirm). */
  private applyLayout(l: Layout): void {
    this.cameras.main.setSize(l.gameW, l.gameH);
    const v = l.view, m = this.menu;
    const w = m.width + 2 * PAD, h = PAD + GLYPH_H + TITLE_GAP + m.height + PAD;
    const x = v.x + Math.floor((v.w - w) / 2), y = v.y + Math.floor((v.h - h) / 2);
    this.bg.clear();
    dim(this.bg, v);
    drawPanel(this.bg, { x, y, w, h });
    this.title.setPosition(x + Math.floor((w - this.title.width) / 2), y + PAD);
    m.setPosition(x + PAD, y + PAD + GLYPH_H + TITLE_GAP);
  }
}
