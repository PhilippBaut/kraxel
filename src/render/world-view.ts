// Sprites zum Spielzustand: Kraxel, Felsblöcke, Kisten, Pickups und kleine Effekte.
// Liest den GameState nur, verändert ihn nie.
import Phaser from 'phaser';
import { TILE } from '../config.ts';
import type { EnemyState } from '../core/enemies.ts';
import type { GameState } from '../core/game.ts';
import type { TileGrid } from '../core/grid.ts';
import type { PickupState } from '../core/pickups.ts';
import { Cell } from '../core/types.ts';
import type { GameEvent } from '../core/types.ts';
import { playerFlipX, playerFrame } from './player-frame.ts';

export { playerFrame } from './player-frame.ts';

type Image = Phaser.GameObjects.Image;

const DEPTH = { marker: 1, pickup: 2, enemy: 4, block: 3, player: 5, fx: 6 } as const;
const BUMP_TIME = 0.15, BUMP_PX = 4;
/** Kristall aus der Kiste: steigt 24 px auf und verschwindet dann mit Funkeln. */
const POP_TIME = 0.4, POP_PX = 24, POP_SPIN = 22;
const SPARKLE_TIME = 0.3;
const SPIN_RATE = 4; // rad/s, wie `drawCrystal` im Entwurf
const DEBRIS_GRAVITY = 700, DEBRIS_TIME = 1;
const DEBRIS_START: readonly (readonly [number, number, number, number])[] = [
  [4, 4, -60, -210], [12, 4, 60, -210], [4, 12, -40, -130], [12, 12, 40, -130],
];
/** Käfer: alle 0,15 s wird gespiegelt, das gibt zwei Laufbilder. */
const BEETLE_STEP_TIME = 0.15;
const SHAKE_MS = 120, SHAKE_PX = 2;
/** Ausschnitt des Kristalls im 16×16-Sprite (wie `drawCrystal`: 8×9 ab 4,3). */
const CRYSTAL_FRAME = 'spin', CRYSTAL_X = 4, CRYSTAL_Y = 3, CRYSTAL_W = 8, CRYSTAL_H = 9;

interface Block { img: Image; bumpAt: number }
interface Pop { img: Image; x: number; y: number; start: number }
interface Sparkle { x: number; y: number; start: number }
interface Debris { img: Image; x: number; y: number; vx: number; vy: number; start: number }

function blockTexture(cell: Cell): string | null {
  if (cell === Cell.Rock) return 'stone';
  if (cell === Cell.Crate) return 'crate';
  if (cell === Cell.CrateUsed) return 'crateUsed';
  return null;
}

/** Breite des drehenden Kristalls: gerade, mindestens 2 px (wie `drawCrystal`). */
function crystalWidth(phase: number): number {
  return Math.max(2, Math.round((CRYSTAL_W * Math.abs(Math.cos(phase))) / 2) * 2);
}

export class WorldView {
  private readonly scene: Phaser.Scene;
  private readonly player: Image;
  private readonly fx: Phaser.GameObjects.Graphics;
  private readonly blocks = new Map<number, Block>();
  private pickups: Image[] = [];
  private enemies: Image[] = [];
  /** Steinmännchen nach Index; Kreuz am Ziel. */
  private cairns: Image[] = [];
  private crosses: Image[] = [];
  private pops: Pop[] = [];
  private sparkles: Sparkle[] = [];
  private debris: Debris[] = [];
  private grid: TileGrid;
  private lastTime = -1;

  constructor(scene: Phaser.Scene, s: GameState) {
    this.scene = scene;
    const tex = scene.textures.get('crystal');
    if (!tex.has(CRYSTAL_FRAME)) tex.add(CRYSTAL_FRAME, 0, CRYSTAL_X, CRYSTAL_Y, CRYSTAL_W, CRYSTAL_H);
    this.player = scene.add.image(0, 0, 'kraxel').setOrigin(0.5, 1).setDepth(DEPTH.player);
    this.fx = scene.add.graphics().setDepth(DEPTH.fx);
    this.grid = s.grid;
    this.rebuild(s);
  }

  /** Baut alle Sprites neu auf, z. B. nach einem Neustart mit neuem GameState. */
  rebuild(s: GameState): void {
    this.grid = s.grid;
    for (const b of this.blocks.values()) b.img.destroy();
    this.blocks.clear();
    for (const img of this.pickups) img.destroy();
    this.pickups = [];
    for (const img of this.enemies) img.destroy();
    this.enemies = [];
    for (const p of this.pops) p.img.destroy();
    for (const d of this.debris) d.img.destroy();
    this.pops = [];
    this.debris = [];
    this.sparkles = [];
    for (const img of this.cairns) img.destroy();
    for (const img of this.crosses) img.destroy();
    this.crosses = [];
    this.cairns = [];
    for (const sp of s.level.spawns) {
      if (sp.kind === 'checkpoint') {
        this.cairns[sp.index] = this.scene.add.image(sp.cx * TILE, sp.cy * TILE, 'cairn').setOrigin(0).setDepth(DEPTH.marker);
      } else if (sp.kind === 'goal' || sp.kind === 'secretGoal') {
        const key = sp.kind === 'secretGoal' ? 'crossGold' : 'cross';
        this.crosses.push(this.scene.add.image(sp.cx * TILE, (sp.cy + 1) * TILE, key).setOrigin(0, 1).setDepth(DEPTH.marker));
      }
    }
    const g = s.grid;
    for (let cy = 0; cy < g.height; cy++) {
      for (let cx = 0; cx < g.width; cx++) if (blockTexture(g.get(cx, cy))) this.addBlock(cx, cy);
    }
  }

  handle(events: GameEvent[]): void {
    const now = this.scene.time.now / 1000;
    for (const e of events) {
      switch (e.type) {
        case 'bump': this.bump(e.cx, e.cy, now); break;
        case 'crateOpen':
          // Versteckte Kisten haben noch kein Sprite.
          if (!this.blocks.has(this.grid.index(e.cx, e.cy))) this.addBlock(e.cx, e.cy);
          this.bump(e.cx, e.cy, now);
          break;
        case 'crystal':
          if (e.fromCrate) this.pop(e.x, e.y, now);
          else this.sparkles.push({ x: Math.round(e.x), y: Math.round(e.y), start: now });
          break;
        case 'rockBreak': this.breakRock(e.cx, e.cy, now); break;
        case 'poundLand': {
          const cam = this.scene.cameras.main;
          cam.shake(SHAKE_MS, new Phaser.Math.Vector2(0, SHAKE_PX / cam.height));
          break;
        }
        default: break;
      }
    }
  }

  /** `time` in Sekunden (Szenenzeit). */
  sync(s: GameState, time: number): void {
    const dt = this.lastTime < 0 ? 0 : Math.min(0.05, Math.max(0, time - this.lastTime));
    this.lastTime = time;
    this.syncPlayer(s);
    this.cairns.forEach((img, i) => img.setTexture(i <= s.checkpoint ? 'cairnFlag' : 'cairn'));
    this.syncBlocks(time);
    this.syncPickups(s.pickups, time);
    this.syncEnemies(s.enemies, time);
    this.syncPops(time);
    this.syncDebris(time, dt);
    this.drawSparkles(time);
  }

  private syncPlayer(s: GameState): void {
    const p = s.player, b = p.body;
    this.player
      .setTexture(playerFrame(p, p.animTime))
      .setFlipX(playerFlipX(p))
      .setPosition(Math.round(b.x + b.w / 2), Math.round(b.y + b.h))
      .setVisible(p.mode === 'dead' || p.invuln <= 0 || Math.floor(p.invuln * 15) % 2 === 0);
  }

  private addBlock(cx: number, cy: number): void {
    const img = this.scene.add.image(cx * TILE, cy * TILE, 'crate').setOrigin(0).setDepth(DEPTH.block);
    this.blocks.set(this.grid.index(cx, cy), { img, bumpAt: -Infinity });
  }

  private bump(cx: number, cy: number, now: number): void {
    const b = this.blocks.get(this.grid.index(cx, cy));
    if (b) b.bumpAt = now;
  }

  private syncBlocks(time: number): void {
    for (const [key, b] of this.blocks) {
      const tex = blockTexture(this.grid.cells[key] as Cell);
      if (!tex) {
        b.img.destroy();
        this.blocks.delete(key);
        continue;
      }
      const t = time - b.bumpAt;
      const lift = t < BUMP_TIME ? Math.round(BUMP_PX * Math.sin((Math.PI * t) / BUMP_TIME)) : 0;
      const cy = Math.floor(key / this.grid.width);
      b.img.setTexture(tex).setY(cy * TILE - lift);
    }
  }

  private syncPickups(list: PickupState[], time: number): void {
    for (let i = 0; i < list.length; i++) {
      const p = list[i]!;
      const img = (this.pickups[i] ??= this.makePickup(p));
      img.setVisible(!p.taken);
      if (p.taken) continue;
      const b = p.body, cx = Math.round(b.x + b.w / 2);
      if (p.kind === 'crystal') this.placeCrystal(img, cx, Math.round(b.y + b.h / 2) - TILE / 2, time * SPIN_RATE + i * 0.7);
      else if (p.kind === 'edelweiss') img.setPosition(cx, Math.round(b.y + b.h / 2));
      else img.setPosition(cx, Math.round(b.y + b.h));
    }
  }

  /** Beide Sprites schauen nach links; besiegte Gegner stehen 0,5 s flach (Schnecke kopfüber). */
  private syncEnemies(list: EnemyState[], time: number): void {
    for (let i = 0; i < list.length; i++) {
      const e = list[i]!;
      const img = (this.enemies[i] ??= this.scene.add.image(0, 0, e.kind).setOrigin(0.5, 1).setDepth(DEPTH.enemy));
      const shown = e.alive || e.defeatTimer > 0;
      img.setVisible(shown);
      if (!shown) continue;
      const b = e.body;
      img.setPosition(Math.round(b.x + b.w / 2), Math.round(b.y + b.h) + 1);
      if (!e.alive) {
        img.setTexture(e.kind === 'beetle' ? 'beetleFlat' : 'snail').setFlipX(false).setFlipY(e.kind === 'snail');
      } else {
        const step = e.kind === 'beetle' && e.active && Math.floor(time / BEETLE_STEP_TIME) % 2 === 1;
        img.setTexture(e.kind).setFlipY(false).setFlipX(e.dir > 0 !== step);
      }
    }
  }

  private makePickup(p: PickupState): Image {
    if (p.kind === 'crystal') return this.crystalImage(DEPTH.pickup);
    const img = this.scene.add.image(0, 0, p.kind === 'edelweiss' ? 'edel' : 'helm').setDepth(DEPTH.pickup);
    // Items tauchen hinter der Kiste auf (Blöcke liegen darüber).
    return p.kind === 'item' ? img.setOrigin(0.5, 1) : img;
  }

  private crystalImage(depth: number): Image {
    return this.scene.add.image(0, 0, 'crystal', CRYSTAL_FRAME).setOrigin(0.5, 0).setDepth(depth);
  }

  /** `top` ist die Oberkante des 16×16-Sprites, `cx` seine Mitte. */
  private placeCrystal(img: Image, cx: number, top: number, phase: number): void {
    img.setScale(crystalWidth(phase) / CRYSTAL_W, 1).setPosition(cx, top + CRYSTAL_Y);
  }

  private pop(x: number, y: number, now: number): void {
    this.pops.push({ img: this.crystalImage(DEPTH.fx), x: Math.round(x), y: Math.round(y), start: now });
  }

  private syncPops(time: number): void {
    this.pops = this.pops.filter((p) => {
      const t = time - p.start;
      if (t >= POP_TIME) {
        p.img.destroy();
        this.sparkles.push({ x: p.x, y: p.y - TILE - POP_PX + CRYSTAL_Y + 4, start: p.start + POP_TIME });
        return false;
      }
      const k = t / POP_TIME, rise = POP_PX * (1 - (1 - k) * (1 - k));
      this.placeCrystal(p.img, p.x, Math.round(p.y - TILE - rise), t * POP_SPIN);
      return true;
    });
  }

  private breakRock(cx: number, cy: number, now: number): void {
    for (const [dx, dy, vx, vy] of DEBRIS_START) {
      const img = this.scene.add.image(0, 0, 'debris').setDepth(DEPTH.fx).setFlipX(vx > 0);
      this.debris.push({ img, x: cx * TILE + dx, y: cy * TILE + dy, vx, vy, start: now });
    }
  }

  private syncDebris(time: number, dt: number): void {
    this.debris = this.debris.filter((d) => {
      if (time - d.start >= DEBRIS_TIME) {
        d.img.destroy();
        return false;
      }
      d.vy += DEBRIS_GRAVITY * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.img.setPosition(Math.round(d.x), Math.round(d.y));
      return true;
    });
  }

  /** Funkeln wie `sparkle` im Entwurf: ein wachsendes Kreuz, ab 30 % mit Eckpunkten. */
  private drawSparkles(time: number): void {
    const g = this.fx.clear();
    this.sparkles = this.sparkles.filter((sp) => {
      const p = (time - sp.start) / SPARKLE_TIME;
      if (p >= 1) return false;
      if (p < 0) return true;
      const r = Math.round(1 + p * 4), { x, y } = sp;
      g.fillStyle(0xffffff, 1 - p * 0.7);
      g.fillRect(x, y - r, 1, r * 2 + 1);
      g.fillRect(x - r, y, r * 2 + 1, 1);
      if (p > 0.3) {
        for (const [ox, oy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) g.fillRect(x + ox * (r - 1), y + oy * (r - 1), 1, 1);
      }
      return true;
    });
  }
}
