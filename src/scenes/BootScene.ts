import Phaser from 'phaser';
import { registerTextures } from '../gfx/textures.ts';

/** Phase A startet ohne Angabe direkt auf dem Übungsplatz. */
const DEFAULT_LEVEL = 'uebungsplatz';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    registerTextures(this, 1);
    const params = new URLSearchParams(window.location.search);
    if (params.has('galerie')) {
      this.scene.start('gallery');
      return;
    }
    this.scene.launch('ui');
    this.scene.start('play', { levelId: params.get('level') ?? DEFAULT_LEVEL });
  }
}
