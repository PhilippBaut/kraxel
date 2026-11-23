// Macht aus dem gehaltenen Zustand der Tasten Flanken (nur im ersten Schritt wahr).
import type { Held, InputFrame } from './types.ts';

export function emptyHeld(): Held {
  return { left: false, right: false, up: false, down: false, jump: false, action: false };
}

export class InputSampler {
  private prev: Held = emptyHeld();

  sample(h: Held): InputFrame {
    const p = this.prev;
    this.prev = { ...h };
    return {
      ...h,
      jumpPressed: h.jump && !p.jump,
      jumpReleased: !h.jump && p.jump,
      downPressed: h.down && !p.down,
      actionPressed: h.action && !p.action,
    };
  }
}
