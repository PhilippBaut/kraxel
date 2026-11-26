// Bedienoberfläche über dem Spielbild: Steuerfeld hochkant, Steuerkreuz, Sprungknopf und die Info-Leiste mit Pause-Knopf.
import Phaser from 'phaser';
import { formatTime } from '../core/format.ts';
import type { GameState } from '../core/game.ts';
import { GLYPH_H, textWidth } from '../gfx/font.ts';
import { drawPanelEdge, ensurePanelPattern, PATTERN_KEY } from '../gfx/panel.ts';
import { OutlinedText } from '../gfx/pixel-text.ts';
import { BUTTON_RADII, dpadKey, ensureButtonTextures, roundButtonKey } from '../gfx/textures.ts';
import type { Controls } from '../input/controls.ts';
import type { Circle, Layout } from '../view/layout.ts';
import type { MapInfo, MapScene } from './MapScene.ts';
import type { PauseScene } from './PauseScene.ts';
import type { PlayScene } from './PlayScene.ts';

const NONE = { left: false, right: false, up: false, down: false };
/** Info-Leiste quer: dunkle, halbtransparente Leiste oben. */
const STRIP = 0x1b1230, STRIP_ALPHA = 0.55;
/** Pause-Symbol: zwei Balken, hochkant in Steuerfeld-Lila, quer halbtransparent weiß (Entwurf). */
const PAUSE_PORTRAIT = 0x6d5f99, PAUSE_LANDSCAPE = 0xffffff, PAUSE_LANDSCAPE_ALPHA = 0.5;
const PAUSE_BAR_W = 2, PAUSE_BAR_GAP = 3;
/** Symbole: Kristall und Edelweiß 7×7, Kopf 8×6. Edelweiß alle 9 px. */
const ICON = 7, HEAD_W = 8, ICON_GAP = 2, GROUP_GAP = 8, EDEL_STEP = 9;

/** Linke obere Ecke einer Knopf-Textur, deren Mitte bei r+1 liegt (Steuerkreuz und runde Knöpfe). */
function placeButton(img: Phaser.GameObjects.Image, c: Circle, alpha: number): void {
  img.setPosition(c.cx - c.r - 1, c.cy - c.r - 1).setAlpha(alpha);
}

export class UiScene extends Phaser.Scene {
  private controls!: Controls;
  private layout!: Layout;
  private panel!: Phaser.GameObjects.TileSprite;
  private panelEdge!: Phaser.GameObjects.Graphics;
  private dpad!: Phaser.GameObjects.Image;
  private jump!: Phaser.GameObjects.Image;
  /** Aktionsknopf (Kiesel schießen): nur sichtbar, solange Kraxel die Schleuder trägt. */
  private action!: Phaser.GameObjects.Image;
  /** Der Knopf-Editor blendet die Knöpfe aus, solange er offen ist. */
  private editing = false;
  /** Ohne Touch bleiben die Knöpfe verborgen, bis der erste Finger den Bildschirm berührt. */
  private readonly touchDevice = navigator.maxTouchPoints > 0;
  private hud!: {
    strip: Phaser.GameObjects.Graphics; pause: Phaser.GameObjects.Graphics;
    crystal: Phaser.GameObjects.Image; crystals: OutlinedText;
    head: Phaser.GameObjects.Image; lives: OutlinedText;
    edel: Phaser.GameObjects.Image[]; time: OutlinedText;
    /** Schleuder-Symbol, nur sichtbar mit Schleuder. */
    sling: Phaser.GameObjects.Image;
    /** Kartenmodus: Name des Punkts. */
    name: OutlinedText;
  };
  /** `'map'`: Info-Leiste zeigt den Kartenpunkt statt der Spielwerte (Event `ui-mode`, Registry `uiMode`). */
  private mode: 'play' | 'map' = 'play';
  private mapInfo: MapInfo | null = null;
  /** Rechte Kante der Zeit, sie steht rechtsbündig. */
  private timeRight = 0;

  constructor() {
    super('ui');
  }

  create(): void {
    this.controls = this.registry.get('controls') as Controls;
    ensurePanelPattern(this);
    this.panel = this.add.tileSprite(0, 0, 4, 8, PATTERN_KEY).setOrigin(0);
    this.panelEdge = this.add.graphics();
    this.dpad = this.add.image(0, 0, dpadKey(BUTTON_RADII.dpad[0], NONE)).setOrigin(0);
    this.jump = this.add.image(0, 0, roundButtonKey('jump', BUTTON_RADII.jump[0], false)).setOrigin(0);
    this.action = this.add.image(0, 0, roundButtonKey('action', BUTTON_RADII.action[0], false)).setOrigin(0).setVisible(false);
    const icon = (key: string) => this.add.image(0, 0, key).setOrigin(0);
    this.hud = {
      strip: this.add.graphics(), pause: this.add.graphics(),
      crystal: icon('iCrystal'), crystals: new OutlinedText(this, 0, 0, ''),
      head: icon('iHead'), lives: new OutlinedText(this, 0, 0, ''),
      edel: [icon('iEdelOff'), icon('iEdelOff'), icon('iEdelOff')], time: new OutlinedText(this, 0, 0, ''),
      name: new OutlinedText(this, 0, 0, ''), sling: icon('iSling').setVisible(false),
    };
    this.mode = this.registry.get('uiMode') === 'map' ? 'map' : 'play';
    this.mapInfo = null;
    this.applyLayout(this.registry.get('layout') as Layout);
    const offTap = this.controls.onTap((x, y) => this.onTap(x, y));
    const onEditing = (v: boolean): void => { this.editing = v; this.update(); };
    const onMode = (m: 'play' | 'map'): void => { this.mode = m; this.mapInfo = null; this.applyLayout(this.layout); };
    this.game.events.on('layout', this.applyLayout, this);
    this.game.events.on('controls-editing', onEditing);
    this.game.events.on('ui-mode', onMode);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offTap();
      this.controls.setActionVisible(false); // die Aktionszone gehört nur zum laufenden Spiel
      this.game.events.off('layout', this.applyLayout, this);
      this.game.events.off('controls-editing', onEditing);
      this.game.events.off('ui-mode', onMode);
    });
  }

  update(): void {
    const held = this.controls.held(), l = this.layout;
    const show = (this.touchDevice || this.controls.touchSeen) && !this.editing;
    this.dpad.setVisible(show).setTexture(dpadKey(l.dpad.r, held));
    this.jump.setVisible(show).setTexture(roundButtonKey('jump', l.jump.r, held.jump));
    const sling = this.mode === 'play' && this.carriesSling();
    const showAction = show && sling;
    this.action.setVisible(showAction).setTexture(roundButtonKey('action', l.action.r, held.action));
    this.controls.setActionVisible(showAction);
    this.hud.sling.setVisible(sling);
    if (this.mode === 'map') this.updateMapInfo();
    else this.updateHud();
  }

  private carriesSling(): boolean {
    const s = (this.scene.get('play') as PlayScene).state as GameState | undefined;
    return s?.player.special === 'sling';
  }

  /** Info zum Kartenpunkt aus der Registry; nur bei Änderung neu setzen und anordnen. */
  private updateMapInfo(): void {
    const info = (this.registry.get('mapInfo') as MapInfo | undefined) ?? null;
    if (info === this.mapInfo) return;
    this.mapInfo = info;
    const h = this.hud;
    h.name.setText(info?.name ?? '');
    h.time.setText(info?.time ?? '');
    const e = info?.edelweiss;
    h.edel.forEach((img, i) => img.setTexture(e?.[i] ? 'iEdel' : 'iEdelOff'));
    this.layoutHud(this.layout);
  }

  /** Werte aus dem laufenden Spiel. Beim allerersten Start kann die Spielszene noch fehlen. */
  private updateHud(): void {
    const s = (this.scene.get('play') as PlayScene).state as GameState | undefined;
    if (!s) return;
    const { crystals, lives, edelweiss, time } = s.session, h = this.hud;
    h.crystals.setText('×' + String(crystals).padStart(3, '0'));
    h.lives.setText('×' + lives);
    h.edel.forEach((img, i) => img.setTexture(edelweiss[i] ? 'iEdel' : 'iEdelOff'));
    h.time.setText(formatTime(time, false));
    h.time.x = this.timeRight - h.time.width;
  }

  /** Tipp auf den Pause-Knopf: pausieren, im Pausenmenü weiterspielen. */
  private onTap(x: number, y: number): void {
    if (this.editing) return;
    const p = this.layout.pauseHit;
    if (x < p.x || x >= p.x + p.w || y < p.y || y >= p.y + p.h) return;
    if (this.scene.isActive('pause')) (this.scene.get('pause') as PauseScene).resume();
    else if (this.mode === 'map') (this.scene.get('map') as MapScene).requestPause();
    else (this.scene.get('play') as PlayScene).requestPause();
  }

  /** Hochkant in `layout.hud` im Steuerfeld (unter dessen 2 px Kante), quer als Leiste oben. */
  private layoutHud(l: Layout): void {
    const h = this.hud, r = l.hud, portrait = l.orientation === 'portrait';
    const top = portrait ? r.y + 2 : r.y;
    const y = top + Math.floor((r.y + r.h - top - GLYPH_H) / 2);
    h.strip.clear();
    if (!portrait) h.strip.fillStyle(STRIP, STRIP_ALPHA).fillRect(0, 0, l.gameW, r.y + r.h);
    const map = this.mode === 'map';
    for (const o of [h.crystal, h.crystals, h.head, h.lives]) o.setVisible(!map);
    h.name.setVisible(map);
    const info = map ? this.mapInfo : null;
    const hasTime = !map || info?.time != null;
    h.time.setVisible(hasTime);
    h.edel.forEach((img) => img.setVisible(hasTime));
    const p = l.pause, bx = p.x + Math.floor((p.w - 2 * PAUSE_BAR_W - PAUSE_BAR_GAP) / 2);
    h.pause.clear().fillStyle(portrait ? PAUSE_PORTRAIT : PAUSE_LANDSCAPE, portrait ? 1 : PAUSE_LANDSCAPE_ALPHA);
    h.pause.fillRect(bx, y, PAUSE_BAR_W, GLYPH_H).fillRect(bx + PAUSE_BAR_W + PAUSE_BAR_GAP, y, PAUSE_BAR_W, GLYPH_H);
    if (map) {
      this.layoutMapInfo(l, y);
      return;
    }
    let x = r.x + (portrait ? 6 : 4);
    h.crystal.setPosition(x, y);
    x += ICON + ICON_GAP;
    h.crystals.setPosition(x, y);
    x += textWidth('×000') + GROUP_GAP;
    h.head.setPosition(x, y + 1);
    x += HEAD_W + ICON_GAP;
    h.lives.setPosition(x, y);
    x += textWidth('×00') + GROUP_GAP;
    h.edel.forEach((img, i) => img.setPosition(x + i * EDEL_STEP, y));
    h.sling.setPosition(x + 2 * EDEL_STEP + ICON + GROUP_GAP, y);
    this.timeRight = portrait ? l.pause.x - 6 : r.x + r.w - 4;
    h.time.setPosition(this.timeRight - h.time.width, y);
  }

  /**
   * Kartenmodus. Hochkant: Name mittig im Steuerfeld, darunter Bestzeit und Edelweiß. Quer: Name links in der Leiste,
   * Bestzeit und Edelweiß rechts neben dem Pause-Zeichen.
   */
  private layoutMapInfo(l: Layout, barY: number): void {
    const h = this.hud, r = l.hud, hasTime = this.mapInfo?.time != null;
    const edelW = 2 * EDEL_STEP + ICON;
    if (l.orientation === 'portrait') {
      const nameY = r.y + 6, rowY = nameY + GLYPH_H + 5;
      h.name.setPosition(Math.floor((l.gameW - h.name.width) / 2), nameY);
      const total = h.time.width + GROUP_GAP + edelW;
      const x0 = Math.floor((l.gameW - total) / 2);
      h.time.setPosition(x0, rowY + 1);
      h.edel.forEach((img, i) => img.setPosition(x0 + h.time.width + GROUP_GAP + i * EDEL_STEP, rowY));
      return;
    }
    h.name.setPosition(r.x + 4, barY);
    if (!hasTime) return;
    const x0 = l.pause.x + l.pause.w + 8;
    h.time.setPosition(x0, barY);
    h.edel.forEach((img, i) => img.setPosition(x0 + h.time.width + GROUP_GAP + i * EDEL_STEP, barY - 1));
  }

  private applyLayout(l: Layout): void {
    this.layout = l;
    this.cameras.main.setSize(l.gameW, l.gameH);
    const p = l.panel;
    this.panel.setVisible(p !== null);
    this.panelEdge.clear();
    if (p) {
      this.panel.setPosition(p.x, p.y).setSize(p.w, p.h);
      drawPanelEdge(this.panelEdge, p);
    }
    ensureButtonTextures(this, 'dpad', l.dpad.r);
    ensureButtonTextures(this, 'jump', l.jump.r);
    ensureButtonTextures(this, 'action', l.action.r);
    const alpha = l.orientation === 'portrait' ? 1 : l.controlsAlpha;
    placeButton(this.dpad, l.dpad, alpha);
    placeButton(this.jump, l.jump, alpha);
    placeButton(this.action, l.action, alpha);
    this.layoutHud(l);
    this.update();
  }
}
