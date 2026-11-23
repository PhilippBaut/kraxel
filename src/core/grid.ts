// Kachelraster eines Levels. Außerhalb links und rechts steht eine unsichtbare Wand.
import { Cell } from './types.ts';
import type { LevelData } from './level.ts';

export class TileGrid {
  readonly width: number;
  readonly height: number;
  readonly cells: Uint8Array;

  constructor(width: number, height: number, cells?: Uint8Array) {
    this.width = width;
    this.height = height;
    this.cells = cells ?? new Uint8Array(width * height);
  }

  /** Arbeitet auf einer Kopie, damit das Level selbst unverändert bleibt. */
  static fromLevel(l: LevelData): TileGrid {
    return new TileGrid(l.width, l.height, l.cells.slice());
  }

  index(cx: number, cy: number): number {
    return cy * this.width + cx;
  }

  get(cx: number, cy: number): Cell {
    if (cx < 0 || cx >= this.width) return Cell.Ground;
    if (cy < 0 || cy >= this.height) return Cell.Empty;
    return this.cells[this.index(cx, cy)] as Cell;
  }

  set(cx: number, cy: number, c: Cell): void {
    if (cx < 0 || cx >= this.width || cy < 0 || cy >= this.height) return;
    this.cells[this.index(cx, cy)] = c;
  }

  isSolid(cx: number, cy: number): boolean {
    const c = this.get(cx, cy);
    return c === Cell.Ground || c === Cell.Rock || c === Cell.Crate || c === Cell.CrateUsed;
  }
}
