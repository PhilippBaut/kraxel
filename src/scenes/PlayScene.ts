// Die Spielszene: Kachelkarte, Parallax-Hintergrund, Kamera und der feste 60-Hz-Takt.
import Phaser from 'phaser';
import { MAX_VIEW_W, STEP, TILE, VIEW_H } from '../config.ts';
import { createCamera, stepCamera, type CameraState } from '../core/camera.ts';
import { createGame, stepGame, type GameState } from '../core/game.ts';
import type { TileGrid } from '../core/grid.ts';
import { parseLevel } from '../core/level.ts';
import { FixedStepper } from '../core/stepper.ts';
import { DEFAULT_TUNING } from '../core/tuning.ts';
import { groundTileIndex } from '../gfx/tiles.ts';
import type { Controls } from '../input/controls.ts';
import { LEVELS } from '../levels/index.ts';
import { WorldView } from '../render/world-view.ts';
import type { Layout } from '../view/layout.ts';

/** Ebenen von hinten nach vorn mit ihrem Parallax-Faktor (wie im Entwurf); Wolken ziehen zusätzlich nach rechts (px/s). */
const BACKGROUND = [
  { key: 'bg-sky', factor: 0, drift: 0 },
  { key: 'bg-far', factor: 0.18, drift: 0 },
  { key: 'bg-clouds', factor: 0.32, drift: 3 },
  { key: 'bg-hills', factor: 0.5, drift: 0 },
] as const;
const PIT_SHADE = 0x120a1e, PIT_ALPHA = 0.85;
/** Ab diesem Anteil der Grubentiefe ist der Verlauf voll dunkel (Entwurf: min(.85, d·1,1)). */
const PIT_FULL_AT = PIT_ALPHA / 1.1;

export class PlayScene extends Phaser.Scene {
  state!: GameState;
  controls!: Controls;
  private levelId = 'uebungsplatz';
  private readonly stepper = new FixedStepper();
  private cam!: CameraState;
  private worldView!: WorldView;
  private background: { sprite: Phaser.GameObjects.TileSprite; factor: number; drift: number }[] = [];
  private viewSize = { w: 0, h: VIEW_H };
  private levelPx = { w: 0, h: 0 };

  constructor() {
    super('play');
  }

  init(data: { levelId: string }): void {
    this.levelId = data.levelId;
  }

  create(): void {
    const text = LEVELS[this.levelId];
    if (text === undefined) throw new Error(`Unbekanntes Level "${this.levelId}"`);
    this.state = createGame(parseLevel(this.levelId, text));
    this.controls = this.registry.get('controls') as Controls;
    const { level } = this.state;
    this.levelPx = { w: level.width * TILE, h: level.height * TILE };

    this.createBackground();
    this.createPitShade(this.state.grid);
    this.createGround(this.state.grid);
    this.worldView = new WorldView(this, this.state);

    this.applyLayout(this.registry.get('layout') as Layout);
    this.cam = createCamera(this.state.player, this.viewSize, this.levelPx);
    this.scrollTo(0);
    this.worldView.sync(this.state, this.time.now / 1000);

    this.game.events.on('layout', this.applyLayout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off('layout', this.applyLayout, this));
  }

  update(time: number, delta: number): void {
    const steps = this.stepper.advance(delta);
    for (let i = 0; i < steps; i++) {
      const input = this.controls.sample();
      const events = stepGame(this.state, input, DEFAULT_TUNING, { x: this.cam.x, w: this.viewSize.w }, STEP);
      this.worldView.handle(events);
      stepCamera(this.cam, this.state.player, this.viewSize, this.levelPx, STEP);
    }
    this.scrollTo(time / 1000);
    this.worldView.sync(this.state, time / 1000);
  }

  private applyLayout(l: Layout): void {
    this.viewSize = { w: l.view.w, h: l.view.h };
    this.cameras.main.setViewport(l.view.x, l.view.y, l.view.w, l.view.h);
  }

  private scrollTo(time: number): void {
    const x = Math.round(this.cam.x), y = Math.round(this.cam.y);
    this.cameras.main.setScroll(x, y);
    for (const b of this.background) b.sprite.tilePositionX = Math.round(x * b.factor - time * b.drift);
  }

  /** Bildfeste Ebenen, so breit wie das breiteste Spielbild; die Kamera schneidet sie zu. */
  private createBackground(): void {
    this.background = BACKGROUND.map(({ key, factor, drift }, i) => ({
      sprite: this.add.tileSprite(0, 0, MAX_VIEW_W, VIEW_H, key).setOrigin(0).setScrollFactor(0).setDepth(-10 + i),
      factor, drift,
    }));
  }

  /** Bodenkacheln als Tilemap; Felsblöcke und Kisten zeichnet die WorldView. */
  private createGround(g: TileGrid): void {
    const data: number[][] = [];
    for (let cy = 0; cy < g.height; cy++) {
      const row: number[] = [];
      for (let cx = 0; cx < g.width; cx++) row.push(groundTileIndex(g, cx, cy));
      data.push(row);
    }
    const map = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('tiles-w1');
    if (!tileset) throw new Error('Tileset tiles-w1 fehlt');
    map.createLayer(0, tileset, 0, 0);
  }

  /** Gruben (unterste Zeile frei) werden nach unten dunkel, wie im Entwurf. */
  private createPitShade(g: TileGrid): void {
    const shade = this.add.graphics().setDepth(-1);
    const bottom = g.height * TILE;
    const isPit = (cx: number) => !g.isSolid(cx, g.height - 1);
    /** Oberkante des Bodenstapels am unteren Levelrand in Spalte cx (px). */
    const groundTop = (cx: number) => {
      let cy = g.height - 1;
      while (cy > 0 && g.isSolid(cx, cy - 1)) cy--;
      return cy * TILE;
    };
    for (let cx = 0; cx < g.width; cx++) {
      if (!isPit(cx) || (cx > 0 && isPit(cx - 1))) continue;
      let end = cx;
      while (end + 1 < g.width && isPit(end + 1)) end++;
      const sides = [cx - 1, end + 1].filter((c) => c >= 0 && c < g.width).map(groundTop);
      const top = sides.length ? Math.max(...sides) : bottom - TILE;
      const depth = bottom - top, x = cx * TILE, w = (end - cx + 1) * TILE;
      const fade = Math.round(depth * PIT_FULL_AT);
      shade.fillGradientStyle(PIT_SHADE, PIT_SHADE, PIT_SHADE, PIT_SHADE, 0, 0, PIT_ALPHA, PIT_ALPHA);
      shade.fillRect(x, top, w, fade);
      shade.fillStyle(PIT_SHADE, PIT_ALPHA);
      shade.fillRect(x, top + fade, w, depth - fade);
      cx = end;
    }
  }
}
