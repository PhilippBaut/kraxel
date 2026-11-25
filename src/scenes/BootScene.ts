import Phaser from 'phaser';
import { registerTextures } from '../gfx/textures.ts';

/** Startet das Titelbild. Mit `?level=` geht es direkt ins Spiel, mit `?galerie` in die Galerie. */
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
    const level = params.get('level');
    if (level !== null) {
      // Unbekannte Level fängt PlayScene.init ab (START_LEVEL).
      this.scene.start('play', { levelId: level });
      this.scene.launch('ui');
      return;
    }
    this.scene.start('title');
  }
}
