// Die Weltkarte: Kraxel läuft auf Wegen zwischen den Punkten (Steuerkreuz oder Tippen), Sprung oder zweiter Tipp betritt das Level.
// Die Info zum Punkt (Name, Bestzeit, Edelweiß) zeichnet UiScene aus der Registry (`mapInfo`), damit sie über dem Steuerfeld bzw. in der Leiste liegt.
import Phaser from 'phaser';
import type { Sfx } from '../audio/sfx.ts';
import { TILE } from '../config.ts';
import { formatTime } from '../core/format.ts';
import { DirEdges } from '../core/dir-edges.ts';
import { newRun } from '../core/run.ts';
import { loadSave, safeStorage, withLastNode, writeSave, type SaveData } from '../core/save.ts';
import { enterable, nodeAtPoint, nodeById, nodeOpen, pathOpen, pickDirection, route, withoutOpened, worldCleared, type MapNode, type MapPath } from '../core/worldmap.ts';
import { GLYPH_H } from '../gfx/font.ts';
import { OutlinedText } from '../gfx/pixel-text.ts';
import { helmName, type SpriteName } from '../gfx/sprites.ts';
import type { Controls } from '../input/controls.ts';
import { zoneAt } from '../input/touch.ts';
import { WORLD1 } from '../maps/world1.ts';
import { TEXT } from '../ui-text.ts';
import type { Layout } from '../view/layout.ts';

const MAP_W = WORLD1.width * TILE, MAP_H = WORLD1.height * TILE;
/** Gehgeschwindigkeit in Kacheln pro Sekunde. */
const WALK_SPEED = 5;
/** Ein neu aufgegangener Weg zeichnet sich in dieser Zeit (s) ein. */
const REVEAL_SECONDS = 0.6;
/** Trefferradius für Tipps in CSS-Pixeln (44 pt Durchmesser) und mindestens in Spielpixeln (Punkte liegen ≥ 48 px auseinander, die Radien überlappen nicht). */
const TAP_RADIUS_CSS = 22;
const TAP_RADIUS_MIN = 24;
/** Bildwechsel der Laufbilder (s). */
const WALK_FRAME_TIME = 0.12;
/** Kraxel steht mit den Füßen etwas unter der Punktmitte. */
const FIGURE_DY = 5;
const GRASS = '#5fd35a';
/** So lange steht das Band „GRASWELT GESCHAFFT!“ nach dem ersten Sieg über die Festung (s); danach zeichnen sich die neuen Wege ein. */
const BAND_SECONDS = 3;
/** Das Band klappt in dieser Zeit (s) von der Mittellinie auf und am Ende wieder zu. */
const BAND_FOLD = 0.2;
const BAND_H = 26;
const BAND_SCALE = 2;
const BAND_COLOR = 0x1a1030;
const BAND_ALPHA = 0.85;
const GOLD = 0xffd23f;

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
  /** Band „GRASWELT GESCHAFFT!“ samt Restzeit; solange es steht, ruht die Karte (auch die Einzeichen-Animation). */
  private band: { bg: Phaser.GameObjects.Graphics; text: OutlinedText; left: number } | null = null;
  private pending: { arriveAt?: string; opened?: MapPath[] } = {};
  private leaving = false;
  private pausing = false;
  /** Kurz nach dem Fortsetzen gesperrt: derselbe Tipp, der WEITER drückt, darf Kraxel nicht auch bewegen. */
  private tapLock = false;
  private readonly dirs = new DirEdges();
  private faceLeft = false;

  private root!: Phaser.GameObjects.Container;
  private side!: Phaser.GameObjects.TileSprite;
  private pathImages = new Map<MapPath, Phaser.GameObjects.Image[]>();
  private nodeImages = new Map<string, { img: Phaser.GameObjects.Image; mark: Phaser.GameObjects.Image | null }>();
  private figure!: Phaser.GameObjects.Image;
  /** Kleines Kreuz über Kraxels Kopf, wenn er auf einem geschafften Level steht (er verdeckt ja das Punktbild). */
  private atMark!: Phaser.GameObjects.Image;
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
    this.shown = opened.length > 0 ? withoutOpened(this.map, this.save, opened) : this.save;
    this.reveals = opened.map((path) => ({ path, progress: 0 }));
    this.walk = null;
    this.leaving = false;
    this.pausing = false;
    this.faceLeft = false;

    const wanted = this.pending.arriveAt ?? this.save.lastNode;
    const known = wanted !== null && wanted !== undefined && this.map.nodes.some((n) => n.id === wanted);
    this.at = known && nodeOpen(this.map, wanted, this.save) ? wanted : this.map.start;

    this.cameras.main.setBackgroundColor(GRASS);
    this.side = this.add.tileSprite(0, 0, 4, 4, 'mapGrassA').setOrigin(0);
    this.root = this.add.container(0, 0);
    this.buildMap();
    this.figure = this.add.image(0, 0, 'kraxel').setOrigin(0.5, 1);
    this.atMark = this.add.image(0, 0, 'mapMark').setOrigin(0.5, 1).setVisible(false);
    this.root.add([this.figure, this.atMark]);
    this.placeFigure();
    this.refresh();
    if (this.pending.arriveAt !== undefined) this.rememberNode(this.at);
    this.publishInfo();
    this.band = worldCleared(this.map, opened) ? this.createBand() : null;

    this.applyLayout(this.registry.get('layout') as Layout);
    this.dirs.seed(this.controls.sample()); // Taste oder Finger, die hierher geführt haben (auch eine gehaltene Richtung), zählen nicht
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
    if (n.kind === 'teaser') { if (open) img.clearTint(); else img.setTint(0x8a8aa0); }
  }

  /** Band quer über die Karte; die Fanfare `goal` steht für die eigene Melodie, die mit der Musik kommt. */
  private createBand(): { bg: Phaser.GameObjects.Graphics; text: OutlinedText; left: number } {
    const bg = this.add.graphics().setDepth(10).setScale(1, 0);
    const text = new OutlinedText(this, 0, 0, TEXT.WORLD_CLEAR, 'ring').setFaceTint(GOLD).setScale(BAND_SCALE).setDepth(11).setVisible(false);
    (this.registry.get('sfx') as Sfx | undefined)?.play('goal');
    return { bg, text, left: BAND_SECONDS };
  }

  private stepBand(dt: number): void {
    const b = this.band!;
    b.left -= dt;
    if (b.left <= 0) {
      b.bg.destroy();
      b.text.destroy();
      this.band = null;
      return;
    }
    const open = Math.min(1, (BAND_SECONDS - b.left) / BAND_FOLD, b.left / BAND_FOLD);
    b.bg.setScale(1, open);
    b.text.setVisible(open >= 1);
  }

  private node(id: string): MapNode {
    return nodeById(this.map, id)!;
  }

  // ------------------------------------------------------------ Kraxel

  private figureTexture(frame: SpriteName): string {
    const run = this.registry.get('run') as { helm: boolean } | undefined;
    return run?.helm ? helmName(frame) : frame;
  }

  private placeFigure(): void {
    const [x, y] = nodeCenter(this.node(this.at));
    this.figure.setPosition(x, y + FIGURE_DY).setTexture(this.figureTexture('kraxel')).setFlipX(this.faceLeft);
    const n = this.node(this.at);
    const done = n.kind === 'level' && this.shown.levels[n.levelId ?? '']?.completed === true;
    this.atMark.setVisible(done).setPosition(x, this.figure.y - this.figure.height - 1);
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
    this.atMark.setVisible(false);
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
    const n = this.node(this.at);
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
    return this.band !== null || this.walk !== null || this.reveals.length > 0 || this.leaving;
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 100) / 1000;
    const f = this.controls.sample();
    const edges = this.dirs.step(f);

    if (this.band) {
      this.stepBand(dt);
      return;
    }
    if (this.reveals.length > 0) {
      this.stepReveal(dt);
      return;
    }
    if (this.walk) {
      this.stepWalk(dt);
      return;
    }
    if (this.leaving) return;
    for (const d of edges) {
      const pick = pickDirection(this.map, this.at, d, this.save);
      if (pick) { this.startWalk([this.at, pick.to]); return; } // Richtung und Sprung im selben Bild: nur gehen
    }
    if (f.jumpPressed) this.tryEnter();
  }

  private stepReveal(dt: number): void {
    const r = this.reveals[0];
    r.progress = Math.min(1, r.progress + dt / REVEAL_SECONDS);
    if (r.progress >= 1) {
      this.reveals.shift();
      // Fertige Wege bleiben offen: gezeigt wird der Stand ohne die noch ausstehenden Wege.
      this.shown = this.reveals.length === 0 ? this.save : withoutOpened(this.map, this.save, this.reveals.map((x) => x.path));
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
    if (!this.scene.isActive() || this.busy || this.tapLock) return;
    for (const key of ['pause', 'controls']) {
      if (this.scene.isActive(key) || this.scene.isSleeping(key) || this.scene.isPaused(key)) return;
    }
    const l = this.layout;
    const p = l.pauseHit;
    if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) return; // Pause macht UiScene
    const v = l.view;
    if (x < v.x || x >= v.x + v.w || y < v.y || y >= v.y + v.h) return; // Steuerfeld
    if (l.orientation === 'landscape' && (y < l.hud.y + l.hud.h || zoneAt(x, y, l, false) !== null)) return;
    const mx = x - v.x - this.origin.x, my = y - v.y - this.origin.y;
    const id = nodeAtPoint(this.map, mx, my, Math.max(TAP_RADIUS_CSS / l.scale, TAP_RADIUS_MIN));
    if (id === null) return;
    if (id === this.at) { this.tryEnter(); return; }
    const r = route(this.map, this.at, id, this.save);
    if (r) this.startWalk(r);
  }

  private tryEnter(): void {
    const n = this.node(this.at);
    if (n.levelId !== null && enterable(this.map, n.id, this.save)) this.enterLevel(n.levelId);
  }

  /** Level betreten; PlayScene bringt Kraxel danach über `arriveAt` zurück auf diesen Punkt. */
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
    this.tapLock = true;
    setTimeout(() => { this.tapLock = false; }, 0); // gilt bis zum Ende des laufenden Ereignisses
    this.dirs.seed(this.controls.sample()); // schon gehaltene Richtungen sind keine neue Flanke
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
    if (this.band) {
      // Mitten über der Karte, so breit wie das Spielbild; die Grafik liegt um ihre Mittellinie, damit sie dort auf- und zuklappt.
      const cy = this.origin.y + Math.floor(MAP_H / 2), t = this.band.text;
      this.band.bg.clear().fillStyle(BAND_COLOR, BAND_ALPHA).fillRect(0, -BAND_H / 2, v.w, BAND_H).setPosition(0, cy);
      t.setPosition(Math.floor((v.w - t.width * BAND_SCALE) / 2), cy - Math.floor((GLYPH_H * BAND_SCALE) / 2));
    }
  }
}
