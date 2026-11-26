import './error-overlay.ts'; // zuerst: fängt auch Fehler beim Laden der übrigen Module
import Phaser from 'phaser';
import { Sfx } from './audio/sfx.ts';
import { loadSave, safeStorage } from './core/save.ts';
import { Controls } from './input/controls.ts';
import { BootScene } from './scenes/BootScene.ts';
import { GalleryScene } from './scenes/GalleryScene.ts';
import { PauseScene } from './scenes/PauseScene.ts';
import { PlayScene } from './scenes/PlayScene.ts';
import { ResultScene } from './scenes/ResultScene.ts';
import { TitleScene } from './scenes/TitleScene.ts';
import { UiScene } from './scenes/UiScene.ts';
import { loadControlsConfig, type ControlsConfig } from './view/controls-config.ts';
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

let controlsConfig = loadControlsConfig(safeStorage());
/** Standard-Anordnung (`layoutBase`) und angewendete Anordnung (`layout`) für die aktuelle Fenstergröße. */
const measure = (): { base: Layout; layout: Layout } => {
  const insets = readSafeInsets();
  return {
    base: computeLayout(window.innerWidth, window.innerHeight, insets),
    layout: computeLayout(window.innerWidth, window.innerHeight, insets, controlsConfig),
  };
};
const first = measure();
let layout = first.layout;

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
  // Reihenfolge = Zeichenreihenfolge: UiScene über PlayScene, Pause und Ergebnis über beiden.
  scene: [BootScene, TitleScene, PlayScene, UiScene, PauseScene, ResultScene, GalleryScene],
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
game.registry.set('layoutBase', first.base);
game.registry.set('controlsConfig', controlsConfig);
game.registry.set('controls', controls);
game.registry.set('sfx', sfx);

// Der Titel-Tipp entsperrt den Ton ausdrücklich. Diese Listener bleiben trotzdem dauerhaft:
// unlock() ist billig und weckt den Kontext nach Unterbrechung (Anruf, Hintergrund) wieder auf.
for (const type of ['pointerdown', 'touchend', 'keydown']) {
  window.addEventListener(type, () => sfx.unlock(), { passive: true });
}
controls.setLayout(layout, toGame);

function applyLayout(force = false): void {
  const m = measure();
  const next = m.layout;
  game.registry.set('layoutBase', m.base);
  // Unverändert: nichts tun, sonst würden gehaltene Finger zurückgesetzt. Neue Anordnung wirkt immer.
  if (!force && JSON.stringify(next) === JSON.stringify(layout)) return;
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

game.events.on('controls-config', (c: ControlsConfig) => {
  controlsConfig = c;
  game.registry.set('controlsConfig', c);
  applyLayout(true);
});

window.addEventListener('resize', queueLayout);
// iOS meldet Größe und Safe-Area nach einer Drehung oft verspätet: später noch einmal messen (ohne Änderung passiert nichts).
window.addEventListener('orientationchange', () => {
  queueLayout();
  window.setTimeout(queueLayout, 300);
});
window.visualViewport?.addEventListener('resize', queueLayout);
