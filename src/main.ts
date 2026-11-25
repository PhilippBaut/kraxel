import Phaser from 'phaser';
import { Sfx } from './audio/sfx.ts';
import { loadSave, safeStorage } from './core/save.ts';
import { Controls } from './input/controls.ts';
import { BootScene } from './scenes/BootScene.ts';
import { GalleryScene } from './scenes/GalleryScene.ts';
import { PlayScene } from './scenes/PlayScene.ts';
import { UiScene } from './scenes/UiScene.ts';
import { computeLayout, readSafeInsets, type Layout } from './view/layout.ts';

for (const type of ['gesturestart', 'dblclick', 'contextmenu']) {
  document.addEventListener(type, (e) => e.preventDefault());
}

function createAudioContext(): AudioContext | null {
  try {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const C = w.AudioContext ?? w.webkitAudioContext;
    return C ? new C() : null;
  } catch {
    return null;
  }
}

const parent = document.getElementById('game');
if (!parent) throw new Error('#game fehlt');

const measure = (): Layout => computeLayout(window.innerWidth, window.innerHeight, readSafeInsets());
let layout = measure();

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#1b1230',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: layout.gameW,
    height: layout.gameH,
  },
  input: { keyboard: false, mouse: false, touch: false, gamepad: false },
  audio: { noAudio: true },
  // Reihenfolge = Zeichenreihenfolge: die UiScene liegt über der PlayScene.
  scene: [BootScene, PlayScene, UiScene, GalleryScene],
});

const controls = new Controls(parent);

/** Bildschirmkoordinaten (CSS-Pixel) in Spielpixel, über die aktuelle Lage der Zeichenfläche. */
function toGame(clientX: number, clientY: number): { x: number; y: number } {
  const r = game.canvas.getBoundingClientRect();
  return {
    x: ((clientX - r.left) * game.scale.width) / r.width,
    y: ((clientY - r.top) * game.scale.height) / r.height,
  };
}

const sfx = new Sfx(createAudioContext);
sfx.setMuted(loadSave(safeStorage()).muted);
game.registry.set('layout', layout);
game.registry.set('controls', controls);
game.registry.set('sfx', sfx);

// Task 16 verlegt das Entsperren auf den Titel-Tipp; bis dahin die erste Geste.
const unlockAudio = (): void => {
  window.removeEventListener('pointerdown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
  sfx.unlock();
};
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);
controls.setLayout(layout, toGame);

function applyLayout(): void {
  const next = measure();
  // Unverändert: nichts tun, sonst würden gehaltene Finger zurückgesetzt.
  if (JSON.stringify(next) === JSON.stringify(layout)) return;
  layout = next;
  game.registry.set('layout', layout);
  // Die Galerie legt ihre Größe selbst fest.
  if (!game.scene.isActive('gallery')) game.scale.setGameSize(layout.gameW, layout.gameH);
  controls.setLayout(layout, toGame);
  game.events.emit('layout', layout);
}

let layoutQueued = false;
function queueLayout(): void {
  if (layoutQueued) return;
  layoutQueued = true;
  requestAnimationFrame(() => {
    layoutQueued = false;
    applyLayout();
  });
}

window.addEventListener('resize', queueLayout);
window.addEventListener('orientationchange', queueLayout);
window.visualViewport?.addEventListener('resize', queueLayout);
