// Die Spielszene: Kachelkarte, Parallax-Hintergrund, Kamera und der feste 60-Hz-Takt.
// Dazu der Ablauf drumherum: Titelkarte, Pause, Ergebnis nach dem Ziel, Game Over; zurück zur Karte (Entwickler-Zugang `?level=`: zum Titel).
import Phaser from 'phaser';
import { MAX_VIEW_W, STEP, TILE, VIEW_H } from '../config.ts';
import { soundsForEvents, type Sfx } from '../audio/sfx.ts';
import { createCamera, stepCamera, type CameraState } from '../core/camera.ts';
import { createGame, restartLevel, stepGame, type GameState } from '../core/game.ts';
import type { TileGrid } from '../core/grid.ts';
import { parseLevel } from '../core/level.ts';
import { levelTitle } from '../core/level-title.ts';
import { newRun, runAfterGameOver, runAfterLevel, sessionFor, type RunState } from '../core/run.ts';
import { loadSave, recordEdelweiss, recordResult, safeStorage, writeSave, type ExitKind, type SaveData } from '../core/save.ts';
import { FixedStepper } from '../core/stepper.ts';
import { DEFAULT_TUNING, isDebug, loadTuning, type Tuning } from '../core/tuning.ts';
import { nodeForLevel, openedBetween } from '../core/worldmap.ts';
import { DebugPanel } from '../debug/debug-panel.ts';
import { GLYPH_H } from '../gfx/font.ts';
import { OutlinedText, PixelText } from '../gfx/pixel-text.ts';
import { groundTileIndex } from '../gfx/tiles.ts';
import type { Controls } from '../input/controls.ts';
import { LEVELS, START_LEVEL } from '../levels/index.ts';
import { WORLD1 } from '../maps/world1.ts';
import { WorldView } from '../render/world-view.ts';
import { TEXT } from '../ui-text.ts';
import type { Layout } from '../view/layout.ts';
import type { ResultData } from './ResultScene.ts';

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
/** So lange steht GAME OVER da, dann geht es zurück zur Karte (Entwickler-Zugang: zum Titel) (s). */
const GAME_OVER_WAIT = 2;
const GAME_OVER_SCALE = 2;
/** So lange steht die Titelkarte beim Levelstart da (s); das Spiel steht so lange. */
const TITLE_CARD_TIME = 1;
const TITLE_CARD_SCALE = 2;
/** Rand, den die Titelkarte links und rechts mindestens frei lässt (px). */
const TITLE_CARD_MARGIN = 6;

export class PlayScene extends Phaser.Scene {
  state!: GameState;
  controls!: Controls;
  private sfx!: Sfx;
  private levelId = START_LEVEL;
  /** Das Level wurde von der Karte aus betreten (sonst Entwickler-Zugang `?level=`). */
  private fromMap = false;
  private readonly stepper = new FixedStepper();
  private cam!: CameraState;
  private worldView!: WorldView;
  private background: { sprite: Phaser.GameObjects.TileSprite; factor: number; drift: number }[] = [];
  private viewSize = { w: 0, h: VIEW_H };
  private levelPx = { w: 0, h: 0 };
  private tuning: Tuning = DEFAULT_TUNING;
  /** Seit Game Over verstrichene Zeit in s. */
  private gameOverWait = 0;
  private gameOverText!: OutlinedText;
  private resultShown = false;
  private goalExit: ExitKind = 'normal';
  /** Restzeit der Titelkarte in s; solange > 0 steht das Spiel. */
  private cardWait = 0;
  private titleCard!: OutlinedText;
  /** Speicherstand beim Betreten des Levels von der Karte; NOCHMAL und NEU STARTEN setzen ihn nicht zurück (kein neues `create`).
   *  Daraus ergeben sich beim Zurück zur Karte die neu geöffneten Wege für die Einzeichen-Animation. */
  private entrySave: SaveData | null = null;
  private pauseRequested = false;
  /** Die Seite wurde während der Titelkarte verborgen: Pause nach der Karte nachholen. */
  private pausePending = false;
  /** Der Wechsel zu Karte oder Titel ist angestoßen; die Szene endet im nächsten Bild. */
  private leaving = false;
  private debug: { panel: DebugPanel; boxes: Phaser.GameObjects.Graphics; fps: PixelText } | null = null;

  constructor() {
    super('play');
  }

  /** Ohne Angabe oder mit unbekanntem Level (z. B. Tippfehler in `?level=`) startet START_LEVEL. */
  init(data?: { levelId?: string; fromMap?: boolean }): void {
    const id = data?.levelId;
    if (id !== undefined && LEVELS[id] === undefined) console.warn(`Unbekanntes Level "${id}", starte "${START_LEVEL}".`);
    this.levelId = id !== undefined && LEVELS[id] !== undefined ? id : START_LEVEL;
    this.fromMap = data?.fromMap === true;
  }

  create(): void {
    const text = LEVELS[this.levelId];
    if (text === undefined) throw new Error(`Unbekanntes Level "${this.levelId}"`);
    const levelData = parseLevel(this.levelId, text);
    if (this.fromMap) {
      if (this.registry.get('run') === undefined) this.registry.set('run', newRun());
      const run = this.registry.get('run') as RunState;
      // restartLevel stellt Leben, Kristalle, Helm und Spezial-Item vom Levelbeginn wieder her (startSession, startHelm, startSpecial).
      this.state = createGame(levelData, sessionFor(run), { helm: run.helm, special: run.special });
    } else {
      this.state = createGame(levelData);
    }
    this.registry.set('uiMode', 'play');
    this.game.events.emit('ui-mode', 'play');
    this.controls = this.registry.get('controls') as Controls;
    this.sfx = this.registry.get('sfx') as Sfx;
    const { level } = this.state;
    this.levelPx = { w: level.width * TILE, h: level.height * TILE };

    this.createBackground();
    this.createPitShade(this.state.grid);
    this.createGround(this.state.grid);
    this.worldView = new WorldView(this, this.state);
    this.gameOverWait = 0;
    this.resultShown = false;
    this.pauseRequested = false;
    this.leaving = false;
    this.pausePending = false;
    this.entrySave = this.fromMap ? loadSave(safeStorage()) : null;
    this.goalExit = 'normal';
    this.cardWait = TITLE_CARD_TIME;
    this.titleCard = new OutlinedText(this, 0, 0, levelTitle(this.levelId, this.state.level.name), 'ring')
      .setScrollFactor(0).setDepth(41);
    this.gameOverText = new OutlinedText(this, 0, 0, TEXT.GAME_OVER, 'ring')
      .setScale(GAME_OVER_SCALE).setScrollFactor(0).setDepth(40).setVisible(false);

    this.applyLayout(this.registry.get('layout') as Layout);
    this.cam = createCamera(this.state.player, this.viewSize, this.levelPx);
    this.scrollTo(0);
    this.worldView.sync(this.state, this.time.now / 1000);

    this.tuning = DEFAULT_TUNING;
    this.debug = null;
    if (isDebug(window.location.search)) this.createDebug();

    this.game.events.on('layout', this.applyLayout, this);
    const offPause = this.controls.onPause(() => this.requestPause());
    document.addEventListener('visibilitychange', this.onVisibility);
    this.events.on(Phaser.Scenes.Events.RESUME, this.onResume, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('layout', this.applyLayout, this);
      offPause();
      document.removeEventListener('visibilitychange', this.onVisibility);
      this.events.off(Phaser.Scenes.Events.RESUME, this.onResume, this);
      this.debug?.panel.destroy();
      this.debug = null;
    });
  }

  /** Pause-Knopf, Escape/P oder Tab im Hintergrund. Nur mitten im Spiel, nie über Ergebnis oder Game Over. */
  requestPause(): void {
    if (this.cardWait > 0) { this.pausePending = true; return; } // nach der Titelkarte nachholen
    if (this.pauseRequested || this.state.phase !== 'playing' || !this.scene.isActive()) return;
    this.pauseRequested = true;
    this.scene.pause();
    this.scene.launch('pause');
  }

  /** Zurück zum Levelanfang (Pause: NEU STARTEN, Ergebnis: NOCHMAL). Die Aufrufer setzen die Szene danach fort. */
  restart(): void {
    this.saveEdelweiss(); // wie bei Game Over: in diesem Durchgang gefundene Edelweiß gehen nicht verloren
    restartLevel(this.state);
    this.worldView.rebuild(this.state);
    this.cam = createCamera(this.state.player, this.viewSize, this.levelPx); // Kamera springt zum Neustart
    this.gameOverWait = 0;
    this.resultShown = false;
    this.gameOverText.setVisible(false);
    this.scrollTo(this.time.now / 1000);
    this.worldView.sync(this.state, this.time.now / 1000);
  }

  /** Spiel samt Info-Leiste und Menüs beenden und zum Titel (Entwickler-Zugang). Ein neues Spiel beginnt dort mit START_LIVES. */
  goToTitle(): void {
    if (this.leaving) return;
    this.leaving = true;
    for (const key of ['ui', 'pause', 'result']) {
      if (this.scene.isActive(key) || this.scene.isPaused(key)) this.scene.stop(key);
    }
    this.scene.start('title');
  }

  /** Ob ZUR KARTE im Pausenmenü erscheint (nur wenn das Level von der Karte kam). */
  get canGoToMap(): boolean {
    return this.fromMap;
  }

  /** Zurück zur Karte: Edelweiß speichern, Runde fortschreiben (Leben, Kristalle, Helm, Spezial-Item), dann die Karte an diesem Punkt. */
  goToMap(): void {
    if (this.leaving || !this.fromMap) return;
    this.leaving = true;
    this.saveEdelweiss();
    this.registry.set('run', runAfterLevel(this.registry.get('run') as RunState, this.state));
    this.openMap();
  }

  /** Nach dem Ergebnis: von der Karte kommend zurück zur Karte (mit neuen Wegen), sonst zum Titel. */
  finishResult(): void {
    if (this.fromMap) this.goToMap();
    else this.goToTitle();
  }

  /** Karte öffnen; Wege, die seit dem Betreten dieses Levels aufgegangen sind, zeichnen sich dort ein (auch nach NOCHMAL). */
  private openMap(): void {
    const opened = this.entrySave ? openedBetween(WORLD1, this.entrySave, loadSave(safeStorage())) : [];
    for (const key of ['pause', 'result']) {
      if (this.scene.isActive(key) || this.scene.isPaused(key)) this.scene.stop(key);
    }
    this.scene.start('map', { arriveAt: nodeForLevel(WORLD1, this.levelId)?.id, opened });
  }

  private readonly onVisibility = (): void => {
    if (document.visibilityState === 'hidden') this.requestPause();
  };

  private onResume(): void {
    this.pauseRequested = false;
  }

  update(time: number, delta: number): void {
    if (this.cardWait > 0) {
      this.cardWait -= delta / 1000;
      this.controls.sample(); // Eingaben während der Titelkarte verfallen
      if (this.cardWait <= 0) {
        this.titleCard.setVisible(false);
        if (this.pausePending) { this.pausePending = false; this.requestPause(); }
      }
      this.scrollTo(time / 1000);
      this.worldView.sync(this.state, time / 1000);
      return;
    }
    const steps = this.stepper.advance(delta); // der Schritt-Zähler rundet Bildzeiten knapp neben 1/60 s selbst
    for (let i = 0; i < steps; i++) {
      const input = this.controls.sample();
      const events = stepGame(this.state, input, this.tuning, { x: this.cam.x, w: this.viewSize.w }, STEP);
      this.worldView.handle(events);
      for (const n of soundsForEvents(events)) this.sfx.play(n);
      if (events.some((e) => e.type === 'respawn')) {
        this.worldView.rebuild(this.state);
        this.cam = createCamera(this.state.player, this.viewSize, this.levelPx); // Kamera springt zum Neustart
      }
      for (const e of events) if (e.type === 'goal') this.goalExit = e.exit;
      if (events.some((e) => e.type === 'gameOver')) this.onGameOver();
      this.stepOutcome();
      stepCamera(this.cam, this.state.player, this.viewSize, this.levelPx, STEP);
    }
    this.scrollTo(time / 1000);
    this.worldView.sync(this.state, time / 1000);
    this.drawDebug(delta);
  }

  /** Hält die bisher gesammelten Edelweiß im Speicherstand fest (nur dazu, nie weg). */
  private saveEdelweiss(): void {
    const e = this.state.session.edelweiss;
    if (!e.some(Boolean)) return;
    const store = safeStorage();
    writeSave(store, recordEdelweiss(loadSave(store), this.levelId, [e[0], e[1], e[2]]));
  }

  /** Game Over: gesammelte Edelweiß bleiben gespeichert, GAME OVER erscheint. */
  private onGameOver(): void {
    this.saveEdelweiss();
    this.gameOverWait = 0;
    this.gameOverText.setVisible(true);
  }

  /** Je Schritt: nach Ziel und Jubel das Ergebnis zeigen, nach Game Over und Wartezeit zurück (Karte oder Titel). */
  private stepOutcome(): void {
    const s = this.state;
    if (s.phase === 'goal' && s.phaseTimer <= 0 && !this.resultShown) this.showResult(this.goalExit);
    if (s.phase === 'gameOver') {
      this.gameOverWait += STEP;
      if (this.gameOverWait >= GAME_OVER_WAIT) this.afterGameOver();
    }
  }

  /** Nach GAME OVER: von der Karte kommend neue Runde und zurück auf die Karte, sonst zum Titel. */
  private afterGameOver(): void {
    if (!this.fromMap) {
      this.goToTitle();
      return;
    }
    if (this.leaving) return;
    this.leaving = true;
    this.registry.set('run', runAfterGameOver());
    this.openMap();
  }

  /** Ergebnis speichern und anzeigen; das Spiel steht so lange (die Menü-Eingabe braucht den InputSampler allein). */
  private showResult(exit: ExitKind): void {
    this.resultShown = true;
    const store = safeStorage();
    const { time, crystals, edelweiss: e } = this.state.session;
    const edelweiss: [boolean, boolean, boolean] = [e[0], e[1], e[2]];
    const { data, newBest } = recordResult(loadSave(store), this.levelId, time, edelweiss, exit);
    writeSave(store, data);
    if (this.fromMap) this.registry.set('run', runAfterLevel(this.registry.get('run') as RunState, this.state));
    const result: ResultData = {
      levelId: this.levelId, time, edelweiss, crystals, newBest, bestTime: data.levels[this.levelId]?.bestTime ?? null,
    };
    this.scene.pause();
    this.scene.launch('result', result);
  }

  /** Mit ?debug: veränderbares Tuning, Panel, Trefferboxen und FPS. */
  private createDebug(): void {
    this.tuning = loadTuning(safeStorage());
    const boxes = this.add.graphics().setDepth(20);
    const fps = new PixelText(this, 2, 2, 'FPS', 'white').setScrollFactor(0).setDepth(30);
    this.debug = { panel: new DebugPanel(this.tuning, safeStorage()), boxes, fps };
  }

  private drawDebug(delta: number): void {
    if (!this.debug) return;
    const { boxes, fps } = this.debug;
    boxes.clear();
    boxes.lineStyle(1, 0x00ff00, 1);
    const b = this.state.player.body;
    boxes.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    boxes.lineStyle(1, 0xffff00, 1);
    for (const p of this.state.pickups) {
      if (!p.taken) boxes.strokeRect(p.body.x + 0.5, p.body.y + 0.5, p.body.w - 1, p.body.h - 1);
    }
    boxes.lineStyle(1, 0xff0000, 1);
    for (const e of this.state.enemies) {
      if (e.alive) boxes.strokeRect(e.body.x + 0.5, e.body.y + 0.5, e.body.w - 1, e.body.h - 1);
    }
    fps.setText(`FPS ${Math.round(1000 / Math.max(1, delta))}`);
  }

  private applyLayout(l: Layout): void {
    this.viewSize = { w: l.view.w, h: l.view.h };
    this.cameras.main.setViewport(l.view.x, l.view.y, l.view.w, l.view.h);
    // Bildfest mitten im Spielbild (Koordinaten relativ zum Kamera-Ausschnitt).
    const t = this.gameOverText;
    t.setPosition(Math.floor((l.view.w - t.width * GAME_OVER_SCALE) / 2), Math.floor((l.view.h - GLYPH_H * GAME_OVER_SCALE) / 2));
    // Titelkarte: doppelt groß, wenn sie ins Spielbild passt, sonst einfach.
    const c = this.titleCard;
    const scale = c.width * TITLE_CARD_SCALE + 2 * TITLE_CARD_MARGIN <= l.view.w ? TITLE_CARD_SCALE : 1;
    c.setScale(scale).setPosition(Math.floor((l.view.w - c.width * scale) / 2), Math.floor((l.view.h - GLYPH_H * scale) / 2));
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
