// Touch-Eingabe: reine Logik (zoneAt, resolveTouch, PointerBook) und DOM-Hülle (PointerTracker).
import { emptyHeld } from '../core/input-frame.ts';
import type { Held } from '../core/types.ts';
import type { Circle, Layout } from '../view/layout.ts';

export type Zone = 'dpad' | 'jump' | 'action' | null;
export interface TouchPoint { id: number; x: number; y: number; zone: Zone }

const DEAD_ZONE = 0.25;

/** Hochkant zählt jeder Punkt im Steuerfeld (außer Pause) für den Knopf mit dem nächsten Rand;
 *  quer sind nur Knöpfe bis hitR Kandidaten, unter ihnen gewinnt der nächste Rand. */
export function zoneAt(x: number, y: number, l: Layout, actionVisible: boolean): Zone {
  const p = l.panel;
  const portrait = p !== null;
  if (p) {
    if (x < p.x || x >= p.x + p.w || y < p.y || y >= p.y + p.h) return null;
    const q = l.pause;
    if (x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h) return null;
  }
  const cands: [Zone, Circle][] = [['dpad', l.dpad], ['jump', l.jump]];
  if (actionVisible) cands.push(['action', l.action]);
  let best: Zone = null;
  let bestEdge = Infinity;
  for (const [zone, c] of cands) {
    const d = Math.hypot(x - c.cx, y - c.cy);
    if (!portrait && d > c.hitR) continue;
    const edge = d - c.r;
    if (edge < bestEdge) { best = zone; bestEdge = edge; }
  }
  return best;
}

export function resolveTouch(points: readonly TouchPoint[], l: Layout): Held {
  const h = emptyHeld();
  let dpadSeen = false; // nur der älteste Steuerkreuz-Finger zählt
  for (const p of points) {
    if (p.zone === 'jump') h.jump = true;
    else if (p.zone === 'action') h.action = true;
    else if (p.zone === 'dpad') {
      if (dpadSeen) continue;
      dpadSeen = true;
      const dx = p.x - l.dpad.cx;
      const dy = p.y - l.dpad.cy;
      if (Math.hypot(dx, dy) < l.dpad.r * DEAD_ZONE) continue;
      const deg = (Math.atan2(-dy, dx) * 180) / Math.PI; // 0 = rechts, 90 = oben
      if (Math.abs(deg) < 67.5) h.right = true;
      if (Math.abs(deg) > 112.5) h.left = true;
      if (deg > 22.5 && deg < 157.5) h.up = true;
      if (deg < -22.5 && deg > -157.5) h.down = true;
    }
  }
  return h;
}

export class PointerBook {
  private pts = new Map<number, TouchPoint>();
  down(id: number, x: number, y: number, zone: Zone): void { this.pts.set(id, { id, x, y, zone }); }
  move(id: number, x: number, y: number): void {
    const p = this.pts.get(id);
    if (p) { p.x = x; p.y = y; }
  }
  up(id: number): void { this.pts.delete(id); }
  reset(): void { this.pts.clear(); }
  points(): TouchPoint[] { return [...this.pts.values()].map((p) => ({ ...p })); }
}

export class PointerTracker {
  readonly book = new PointerBook();
  private tapCbs: ((x: number, y: number) => void)[] = [];
  private touchCbs: (() => void)[] = [];
  private readonly handlers: [string, (e: PointerEvent) => void][];

  private readonly el: HTMLElement;
  private readonly toGame: (clientX: number, clientY: number) => { x: number; y: number };
  private readonly zoneFor: (x: number, y: number) => Zone;

  constructor(
    el: HTMLElement,
    toGame: (clientX: number, clientY: number) => { x: number; y: number },
    zoneFor: (x: number, y: number) => Zone,
  ) {
    this.el = el;
    this.toGame = toGame;
    this.zoneFor = zoneFor;
    this.handlers = [
      ['pointerdown', (e) => this.onDown(e)],
      ['pointermove', (e) => this.onMove(e)],
      ['pointerup', (e) => this.onUp(e)],
      ['pointercancel', (e) => this.onUp(e)],
      ['lostpointercapture', (e) => this.onUp(e)],
    ];
    for (const [t, h] of this.handlers) el.addEventListener(t, h as EventListener);
    window.addEventListener('blur', this.resetAll);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  private readonly resetAll = (): void => { this.book.reset(); };
  private readonly onVisibility = (): void => { if (document.visibilityState === 'hidden') this.book.reset(); };

  onTap(cb: (x: number, y: number) => void): void { this.tapCbs.push(cb); }
  onFirstTouch(cb: () => void): void { this.touchCbs.push(cb); }

  dispose(): void {
    for (const [t, h] of this.handlers) this.el.removeEventListener(t, h as EventListener);
    window.removeEventListener('blur', this.resetAll);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.book.reset();
  }

  private onDown(e: PointerEvent): void {
    e.preventDefault();
    if (e.pointerType === 'touch' || e.pointerType === 'pen') for (const cb of this.touchCbs) cb();
    try { this.el.setPointerCapture(e.pointerId); } catch { /* Zeiger schon weg */ }
    const g = this.toGame(e.clientX, e.clientY);
    this.book.down(e.pointerId, g.x, g.y, this.zoneFor(g.x, g.y));
    for (const cb of this.tapCbs) cb(g.x, g.y);
  }
  private onMove(e: PointerEvent): void {
    const g = this.toGame(e.clientX, e.clientY);
    this.book.move(e.pointerId, g.x, g.y);
  }
  private onUp(e: PointerEvent): void {
    this.book.up(e.pointerId);
  }
}
