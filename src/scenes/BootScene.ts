import Phaser from 'phaser';
import { registerTextures } from '../gfx/textures.ts';

/** Bis es die Spielszene gibt (Task 9), startet ohne Angabe die Galerie. */
const DEFAULT_SCENE = 'gallery';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    registerTextures(this, 1);
    const params = new URLSearchParams(window.location.search);
    this.scene.start(params.has('galerie') ? 'gallery' : DEFAULT_SCENE);
  }
}
