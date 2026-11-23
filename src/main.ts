import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.ts';
import { GalleryScene } from './scenes/GalleryScene.ts';

for (const type of ['gesturestart', 'dblclick', 'contextmenu']) {
  document.addEventListener(type, (e) => e.preventDefault());
}

new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#1b1230',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 256,
    height: 192,
  },
  input: { keyboard: false, mouse: false, touch: false, gamepad: false },
  audio: { noAudio: true },
  scene: [BootScene, GalleryScene],
});
