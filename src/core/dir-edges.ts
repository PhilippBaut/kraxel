// Flankenerkennung für Richtungen: eine Richtung zählt nur, wenn sie neu gedrückt wird. Kein Phaser, kein DOM.
import type { Dir } from './worldmap.ts';

export type DirHeld = Readonly<Record<Dir, boolean>>;

const ORDER: readonly Dir[] = ['left', 'right', 'up', 'down'];

export class DirEdges {
  private prev: Record<Dir, boolean> = { left: false, right: false, up: false, down: false };

  /** Stand übernehmen, ohne Flanken zu melden (beim Betreten und nach dem Fortsetzen): schon Gehaltenes ist keine neue Taste. */
  seed(held: DirHeld): void {
    this.prev = { left: held.left, right: held.right, up: held.up, down: held.down };
  }

  /** Neu gedrückte Richtungen seit dem letzten Aufruf, in der Reihenfolge links, rechts, oben, unten. */
  step(held: DirHeld): Dir[] {
    const out = ORDER.filter((d) => held[d] && !this.prev[d]);
    this.seed(held);
    return out;
  }
}
