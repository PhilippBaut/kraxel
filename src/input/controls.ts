// Fasst Tastatur und Touch zusammen (ODER) und liefert Eingabe-Frames mit Flanken.
import { emptyHeld, InputSampler } from '../core/input-frame.ts';
import type { Held, InputFrame } from '../core/types.ts';
import type { Layout } from '../view/layout.ts';
import { KeyboardSource } from './keyboard.ts';
import { PointerTracker, resolveTouch, zoneAt } from './touch.ts';

type ToGame = (cx: number, cy: number) => { x: number; y: number };

export class Controls {
  touchSeen = false;
  private layout: Layout | null = null;
  private toGame: ToGame = (x, y) => ({ x, y });
  private actionVisible = false;
  private pauseCbs: (() => void)[] = [];
  private readonly sampler = new InputSampler();
  private readonly keys: KeyboardSource;
  private readonly pointers: PointerTracker;

  constructor(canvasParent: HTMLElement) {
    this.keys = new KeyboardSource(window, () => { for (const cb of this.pauseCbs) cb(); });
    this.pointers = new PointerTracker(
      canvasParent,
      (cx, cy) => this.toGame(cx, cy),
      (x, y) => (this.layout ? zoneAt(x, y, this.layout, this.actionVisible) : null),
    );
    this.pointers.onFirstTouch(() => { this.touchSeen = true; });
  }

  setLayout(l: Layout, toGame: ToGame): void {
    this.layout = l;
    this.toGame = toGame;
    this.pointers.book.reset();
  }
  setActionVisible(v: boolean): void { this.actionVisible = v; }

  held(): Held {
    const k = this.keys.read();
    if (!this.layout) return k;
    const t = resolveTouch(this.pointers.book.points(), this.layout);
    const h = emptyHeld();
    for (const key of Object.keys(h) as (keyof Held)[]) h[key] = k[key] || t[key];
    return h;
  }
  sample(): InputFrame { return this.sampler.sample(this.held()); }
  onTap(cb: (x: number, y: number) => void): void { this.pointers.onTap(cb); }
  onPause(cb: () => void): void { this.pauseCbs.push(cb); }

  dispose(): void { this.keys.dispose(); this.pointers.dispose(); }
}
