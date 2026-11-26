// Die Weltkarte: Kraxel läuft auf Wegen zwischen den Punkten (Steuerkreuz oder Tippen), Sprung oder zweiter Tipp betritt das Level.
// Die Info zum Punkt (Name, Bestzeit, Edelweiß) zeichnet UiScene aus der Registry (`mapInfo`), damit sie über dem Steuerfeld bzw. in der Leiste liegt.
import Phaser from 'phaser';
import { formatTime } from '../core/format.ts';
import { newRun } from '../core/run.ts';
import { loadSave, safeStorage, withLastNode, writeSave, type SaveData } from '../core/save.ts';
import { enterable, nodeAtPoint, nodeOpen, openedBetween, pathOpen, pickDirection, route, type Dir, type MapNode, type MapPath } from '../core/worldmap.ts';
import { helmName } from '../gfx/sprites.ts';
import type { Controls } from '../input/controls.ts';
import { zoneAt } from '../input/touch.ts';
import { WORLD1 } from '../maps/world1.ts';
import { TEXT } from '../ui-text.ts';
import type { Layout } from '../view/layout.ts';

const TILE = 16;
const MAP_W = WORLD1.width * TILE, MAP_H = WORLD1.height * TILE;
/** Gehgeschwindigkeit in Kacheln pro Sekunde. */
const WALK_SPEED = 5;
/** Ein neu aufgegangener Weg zeichnet sich in dieser Zeit (s) ein. */
const REVEAL_SECONDS = 0.6;
/** Trefferradius für Tipps in CSS-Pixeln (44 pt Durchmesser). */
const TAP_RADIUS_CSS = 22;
/** Bildwechsel der Laufbilder (s). */
const WALK_FRAME_TIME = 0.12;
/** Kraxel steht mit den Füßen etwas unter der Punktmitte. */
const FIGURE_DY = 5;
const GRASS = '#5fd35a';

/** Was UiScene über den aktuellen Punkt anzeigt. `time` und `edelweiss` sind bei Hütte und Platzhalter null. */
export interface MapInfo { name: string; time: string | null; edelweiss: [boolean, boolean, boolean] | null }

interface Walk {
  /** Zellen von der Startzelle bis zum Ziel, über alle Teilstrecken. */
  cells: Array<readonly [number, number]>;
  /** Index in `cells`, an dem jeweils ein Punkt erreicht ist, samt Punkt-Id. */
  stops: Array<{ index: number; id: string }>;
  /** Fortschritt in Zellen (0 = Startzelle). */
  pos: number;
}

interface Reveal { path: MapPath; progress: number }

const nodeCenter = (n: { cx: number; cy: number }): [number, number] => [n.cx * TILE + TILE / 2, n.cy * TILE + TILE / 2];

export class MapScene extends Phaser.Scene {
  private readonly map = WORLD1;
  private controls!: Controls;
  private layout!: Layout;
  private save!: SaveData;
  /** Stand, nach dem gezeichnet wird: während der Einzeichen-Animation der Stand davor. */
  private shown!: SaveData;
  private at = WORLD1.start;
  private walk: Walk | null = null;
  private reveals: Reveal[] = [];
  private pending: { arriveAt?: string; opened?: MapPath[] } = {};
  private leaving = false;
  private pausing = false;
  private prevHeld: Record<Dir, boolean> = { left: false, right: false, up: false, down: false };
  private faceLeft = false;

  private root!: Phaser.GameObjects.Container;
  private side!: Phaser.GameObjects.TileSprite;
  private pathImages = new Map<MapPath, Phaser.GameObjects.Image[]>();
  private nodeImages = new Map<string, { img: Phaser.GameObjects.Image; mark: Phaser.GameObjects.Image | null }>();
  private figure!: Phaser.GameObjects.Image;
  /** Linke obere Ecke der Karte im Spielbild (relativ zur Kamera). */
  private origin = { x: 0, y: 0 };

  constructor() {
    super('map');
  }

  init(data?: { arriveAt?: string; opened?: MapPath[] }): void {
    this.pending = { arriveAt: data?.arriveAt, opened: data?.opened };
  }

  create(): void {
    this.controls = this.registry.get('controls') as Controls;
    if (this.registry.get('run') === undefined) this.registry.set('run', newRun());
    this.registry.set('uiMode', 'map');
    this.game.events.emit('ui-mode', 'map');

    this.save = loadSave(safeStorage());
    const opened = (this.pending.opened ?? []).filter((p) => pathOpen(this.map, p, this.save));
    this.shown = opened.length > 0 ? this.withoutExits(this.save, opened) : this.save;
    this.reveals = opened.map((path) => ({ path, progress: 0 }));
    this.walk = null;
    this.leaving = false;
    this.pausing = false;
    this.faceLeft = false;
    this.prevHeld = { left: false, right: false, up: false, down: false };

    const wanted = this.pending.arriveAt ?? this.save.lastNode;
    const known = wanted !== null && wanted !== undefined && this.map.nodes.some((n) => n.id === wanted);
    this.at = known && nodeOpen(this.map, wanted, this.save) ? wanted : this.map.start;

    this.cameras.main.setBackgroundColor(GRASS);
    this.side = this.add.tileSprite(0, 0, 4, 4, 'mapGrassA').setOrigin(0);
    this.root = this.add.container(0, 0);
    this.buildMap();
    this.figure = this.add.image(0, 0, 'kraxel').setOrigin(0.5, 1);
    this.root.add(this.figure);
    this.placeFigure();
    this.refresh();
    if (this.pending.arriveAt !== undefined) this.rememberNode(this.at);
    this.publishInfo();

    this.applyLayout(this.registry.get('layout') as Layout);
    this.controls.sample(); // die Taste oder der Finger, die hierher geführt haben, zählen nicht
    const offTap = this.controls.onTap((x, y) => this.onTap(x, y));
    const offPause = this.controls.onPause(() => this.requestPause());
    this.game.events.on('layout', this.applyLayout, this);
    this.events.on(Phaser.Scenes.Events.RESUME, this.onResume, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offTap();
      offPause();
      this.game.events.off('layout', this.applyLayout, this);
      this.events.off(Phaser.Scenes.Events.RESUME, this.onResume, this);
    });
  }

  /** Stand ohne die Ausgänge, die diese Wege geöffnet haben (für die Darstellung vor der Animation). */
  private withoutExits(save: SaveData, paths: MapPath[]): SaveData {
    const levels = { ...save.levels };
    for (const p of paths) {
      const id = this.map.nodes.find((n) => n.id === p.from)?.levelId;
      if (id == null || p.via === 'always' || !levels[id]) continue;
      levels[id] = { ...levels[id], exits: { ...levels[id].exits, [p.via]: false } };
    }
    return { ...save, levels };
  }

  // ------------------------------------------------------------ Aufbau

  private buildMap(): void {
    const m = this.map;
    const pathCells = new Set<string>();
    const nodeCells = new Set(m.nodes.map((n) => `${n.cx},${n.cy}`));
    for (const p of m.paths) for (const c of p.cells) pathCells.add(`${c[0]},${c[1]}`);
    const add = (x: number, y: number, key: string): Phaser.GameObjects.Image => {
      const img = this.add.image(x * TILE, y * TILE, key).setOrigin(0);
      this.root.add(img);
      return img;
    };
    m.tiles.forEach((row, y) => {
      for (let x = 0; x < m.width; x++) {
        const ch = row[x];
        const onPath = pathCells.has(`${x},${y}`);
        if (ch === '~' && !onPath) { add(x, y, 'mapWater'); continue; }
        add(x, y, (x * 7 + y * 3) % 5 === 0 ? 'mapGrassB' : 'mapGrassA');
        if (onPath) continue;
        if (ch === 'T') add(x, y, 'mapTree');
        else if (ch === '^') add(x, y, 'mapHill');
        else if (ch === 'f') add(x, y, 'mapFlower');
      }
    });
    for (const p of m.paths) {
      const imgs: Phaser.GameObjects.Image[] = [];
      for (const c of p.cells) {
        if (nodeCells.has(`${c[0]},${c[1]}`)) continue;
        imgs.push(add(c[0], c[1], 'mapDots'));
      }
      this.pathImages.set(p, imgs);
    }
    this.nodeImages.clear();
    for (const n of m.nodes) {
      const img = add(n.cx, n.cy, 'mapNodeOpen');
      const mark = n.kind === 'fortress' ? add(n.cx, n.cy, 'mapMark').setPosition(n.cx * TILE + 8, n.cy * TILE - 2) : null;
      this.nodeImages.set(n.id, { img, mark });
    }
  }

  /** Alle Wege und Punkte nach `shown` (und laufender Einzeichen-Animation) zeichnen. */
  private refresh(): void {
    for (const p of this.map.paths) {
      const imgs = this.pathImages.get(p)!;
      const rev = this.reveals.find((r) => r.path === p);
      let upTo = 0;
      if (pathOpen(this.map, p, this.shown)) upTo = imgs.length;
      else if (rev) upTo = Math.floor(rev.progress * imgs.length);
      imgs.forEach((img, i) => img.setTexture(i < upTo ? 'mapPath' : 'mapDots'));
    }
    for (const n of this.map.nodes) this.styleNode(n);
  }

  private styleNode(n: MapNode): void {
    const { img, mark } = this.nodeImages.get(n.id)!;
    const open = nodeOpen(this.map, n.id, this.shown);
    const done = this.shown.levels[n.levelId ?? '']?.completed === true;
    if (n.kind === 'hut') img.setTexture('mapHut');
    else if (n.kind === 'teaser') img.setTexture('mapSign');
    else if (n.kind === 'fortress') img.setTexture('mapFortress');
    else img.setTexture(!open ? 'mapNodeLocked' : done ? 'mapNodeDone' : 'mapNodeOpen');
    if (n.kind === 'fortress') {
      if (open) img.clearTint(); else img.setTint(0x8a8aa0);
      mark?.setVisible(open && done);
    }
  }

  private nodeById(id: string): MapNode {
    return this.map.nodes.find((n) => n.id === id)!;
  }

  // ------------------------------------------------------------ Kraxel

  private figureTexture(frame: string): string {
    const run = this.registry.get('run') as { helm: boolean } | undefined;
    return run?.helm ? helmName(frame as 'kraxel') : frame;
  }

  private placeFigure(): void {
    const [x, y] = nodeCenter(this.nodeById(this.at));
    this.figure.setPosition(x, y + FIGURE_DY).setTexture(this.figureTexture('kraxel')).setFlipX(this.faceLeft);
  }

  /** Zellen der Teilstrecke von `a` nach `b` (in Laufrichtung). */
  private hopCells(a: string, b: string): ReadonlyArray<readonly [number, number]> {
    for (const p of this.map.paths) {
      if (p.from === a && p.to === b) return p.cells;
      if (p.from === b && p.to === a) return [...p.cells].reverse();
    }
    return [];
  }

  /** Laufweg über mehrere Punkte aufbauen. */
  private startWalk(ids: string[]): void {
    const cells: Array<readonly [number, number]> = [];
    const stops: Walk['stops'] = [];
    for (let i = 1; i < ids.length; i++) {
      const hop = this.hopCells(ids[i - 1], ids[i]);
      cells.push(...(i === 1 ? hop : hop.slice(1)));
      stops.push({ index: cells.length - 1, id: ids[i] });
    }
    if (cells.length < 2) return;
    this.walk = { cells, stops, pos: 0 };
  }

  private onArrive(id: string): void {
    this.at = id;
    this.rememberNode(id);
    this.publishInfo();
  }

  private rememberNode(id: string): void {
    const store = safeStorage();
    writeSave(store, withLastNode(loadSave(store), id));
  }

  private publishInfo(): void {
    const n = this.nodeById(this.at);
    const rec = this.save.levels[n.levelId ?? ''];
    const hasLevel = n.kind === 'level' || n.kind === 'fortress';
    const info: MapInfo = {
      name: n.kind === 'teaser' ? TEXT.COMING_SOON : n.name,
      time: hasLevel ? (rec?.bestTime != null ? formatTime(rec.bestTime, false) : TEXT.NO_TIME) : null,
      edelweiss: hasLevel ? [rec?.edelweiss[0] === true, rec?.edelweiss[1] === true, rec?.edelweiss[2] === true] : null,
    };
    this.registry.set('mapInfo', info);
  }

  // ------------------------------------------------------------ Eingabe

  private get busy(): boolean {
    return this.walk !== null || this.reveals.length > 0 || this.leaving;
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 100) / 1000;
    const f = this.controls.sample();
    const edge: Record<Dir, boolean> = {
      left: f.left && !this.prevHeld.left, right: f.right && !this.prevHeld.right,
      up: f.up && !this.prevHeld.up, down: f.down && !this.prevHeld.down,
    };
    this.prevHeld = { left: f.left, right: f.right, up: f.up, down: f.down };

    if (this.reveals.length > 0) {
      this.stepReveal(dt);
      return;
    }
    if (this.walk) {
      this.stepWalk(dt);
      return;
    }
    if (this.leaving) return;
    for (const d of ['left', 'right', 'up', 'down'] as const) {
      if (!edge[d]) continue;
      const pick = pickDirection(this.map, this.at, d, this.save);
      if (pick) { this.startWalk([this.at, pick.to]); break; }
    }
    if (f.jumpPressed) this.tryEnter();
  }

  private stepReveal(dt: number): void {
    const r = this.reveals[0];
    r.progress = Math.min(1, r.progress + dt / REVEAL_SECONDS);
    if (r.progress >= 1) {
      this.reveals.shift();
      if (this.reveals.length === 0) this.shown = this.save;
    }
    this.refresh();
  }

  private stepWalk(dt: number): void {
    const w = this.walk!;
    const target = w.stops[0];
    w.pos = Math.min(target.index, w.pos + WALK_SPEED * dt);
    const i = Math.min(Math.floor(w.pos), w.cells.length - 2);
    const a = w.cells[i], b = w.cells[i + 1], t = w.pos - i;
    const x = (a[0] + (b[0] - a[0]) * t) * TILE + TILE / 2;
    const y = (a[1] + (b[1] - a[1]) * t) * TILE + TILE / 2 + FIGURE_DY;
    if (b[0] !== a[0]) this.faceLeft = b[0] < a[0];
    const frame = Math.floor(this.time.now / 1000 / WALK_FRAME_TIME) % 2 === 0 ? 'kraxelRun1' : 'kraxelRun2';
    this.figure.setPosition(Math.round(x), Math.round(y)).setTexture(this.figureTexture(frame)).setFlipX(this.faceLeft);
    if (w.pos >= target.index) {
      w.stops.shift();
      this.onArrive(target.id);
      if (w.stops.length === 0) {
        this.walk = null;
        this.placeFigure();
      }
    }
  }

  /** Tipp in Spielpixeln: Punkt antippen läuft hin, der aktuelle Punkt betritt das Level. */
  private onTap(x: number, y: number): void {
    if (!this.scene.isActive() || this.busy) return;
    const l = this.layout;
    const p = l.pauseHit;
    if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) return; // Pause macht UiScene
    const v = l.view;
    if (x < v.x || x >= v.x + v.w || y < v.y || y >= v.y + v.h) return; // Steuerfeld
    if (l.orientation === 'landscape' && (y < l.hud.y + l.hud.h || zoneAt(x, y, l, false) !== null)) return;
    const mx = x - v.x - this.origin.x, my = y - v.y - this.origin.y;
    const id = nodeAtPoint(this.map, mx, my, TAP_RADIUS_CSS / l.scale);
    if (id === null) return;
    if (id === this.at) { this.tryEnter(); return; }
    const r = route(this.map, this.at, id, this.save);
    if (r) this.startWalk(r);
  }

  private tryEnter(): void {
    const n = this.nodeById(this.at);
    if (n.levelId !== null && enterable(this.map, n.id, this.save)) this.enterLevel(n.levelId);
  }

  /** Level betreten. Task 5 verdrahtet die Rückkehr; PlayScene ignoriert `fromMap` bis dahin. */
  enterLevel(levelId: string): void {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start('play', { levelId, fromMap: true });
  }

  /** Kartenmenü: Pause-Knopf, Escape/P. */
  requestPause(): void {
    if (this.pausing || this.leaving || !this.scene.isActive()) return;
    this.pausing = true;
    this.scene.pause();
    this.scene.launch('pause', { context: 'map' });
  }

  private onResume(): void {
    this.pausing = false;
    this.controls.sample();
  }

  /** TITEL im Kartenmenü: Info-Leiste und Menü beenden, zum Titel. */
  goToTitle(): void {
    if (this.leaving) return;
    this.leaving = true;
    for (const key of ['ui', 'pause']) {
      if (this.scene.isActive(key) || this.scene.isPaused(key)) this.scene.stop(key);
    }
    this.scene.start('title');
  }

  // ------------------------------------------------------------ Lage

  /** Hochkant liegt die Karte im Spielbild, quer mittig unter der Info-Leiste, Wiese füllt die Seiten. */
  private applyLayout(l: Layout): void {
    this.layout = l;
    const v = l.view;
    this.cameras.main.setViewport(v.x, v.y, v.w, v.h);
    this.origin = l.orientation === 'portrait'
      ? { x: Math.floor((v.w - MAP_W) / 2), y: 0 }
      : { x: Math.floor((v.w - MAP_W) / 2), y: l.hud.y + l.hud.h };
    this.root.setPosition(this.origin.x, this.origin.y);
    this.side.setPosition(0, 0).setSize(v.w, v.h);
    this.side.tilePositionX = -this.origin.x;
    this.side.tilePositionY = -this.origin.y;
  }
}
