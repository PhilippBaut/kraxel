// Tastatur-Eingabe. Ausgewertet wird event.code (Position der Taste, unabhängig vom Layout).
import { emptyHeld } from '../core/input-frame.ts';
import type { Held } from '../core/types.ts';

export const KEYMAP: Readonly<Record<string, keyof Held | 'pause'>> = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyZ: 'jump', KeyY: 'jump', KeyK: 'jump',
  KeyX: 'action', KeyJ: 'action',
  Escape: 'pause', KeyP: 'pause',
};

export class KeyboardSource {
  private down = new Set<string>();
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const m = KEYMAP[e.code];
    if (!m) return;
    e.preventDefault();
    if (m === 'pause') { if (!e.repeat) this.onPause(); return; }
    this.down.add(e.code);
  };
  private readonly onKeyUp = (e: KeyboardEvent): void => { this.down.delete(e.code); };
  private readonly onBlur = (): void => { this.down.clear(); };

  private readonly target: Window;
  private readonly onPause: () => void;

  constructor(target: Window, onPause: () => void) {
    this.target = target;
    this.onPause = onPause;
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.onBlur);
  }

  read(): Held {
    const h = emptyHeld();
    for (const code of this.down) {
      const m = KEYMAP[code];
      if (m && m !== 'pause') h[m] = true;
    }
    return h;
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.onBlur);
    this.down.clear();
  }
}
