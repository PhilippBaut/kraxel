// Knopf-Editor: Steuerkreuz, Sprung- und Aktionsknopf ziehen und in der Größe ändern.
// Öffnet über dem Pausenmenü (das schläft) oder dem Titelbild (das pausiert und bleibt sichtbar).
import Phaser from 'phaser';
import type { Sfx } from '../audio/sfx.ts';
import { safeStorage } from '../core/save.ts';
import type { Rect } from '../core/types.ts';
import { GLYPH_H, textWidth } from '../gfx/font.ts';
import { drawPanelEdge, ensurePanelPattern, PATTERN_KEY } from '../gfx/panel.ts';
import { OutlinedText } from '../gfx/pixel-text.ts';
import { BUTTON_RADII, dpadKey, ensureButtonTextures, roundButtonKey } from '../gfx/textures.ts';
import type { Controls } from '../input/controls.ts';
import type { PointerEventInfo } from '../input/touch.ts';
import { TEXT } from '../ui-text.ts';
import {
  applyControls, BUTTON_IDS, circleHitsRect, configFromLayout, moveButton, pickButton, resizeButton,
  saveControlsConfig, SCALE_MAX, SCALE_MIN, SCALE_STEP, withOrientation, type ButtonId, type ControlsConfig,
} from '../view/controls-config.ts';
import type { Circle, Layout } from '../view/layout.ts';
import { thumbHeight } from '../view/thumb.ts';
import { BUTTON_H, dim, drawButton, drawPanel, SEL, SEL_HI } from './menu.ts';

type ReturnTo = 'pause' | 'title';
/** `rect` ist der gezeichnete Knopf, `hit` die Trefferfläche (größer, damit der Daumen reicht). */
interface Tool { label: string; rect: Rect; hit: Rect; run: () => void }

const NONE = { left: false, right: false, up: false, down: false };
const PAD = 6, GAP = 6, ROW_GAP = 4;
/** Luft zwischen `+` und STANDARD: ein Fehltipp setzt sonst die ganze Ansicht zurück. */
const SEP_GAP = 14;
/** Trefferfläche über und unter dem gezeichneten Knopf. */
const HIT_PAD_Y = 4;
/** Auswahl-Ring um den gewählten Knopf. */
const RING_GAP = 3;
const AREA_LINE = 0x4a3d6b;

export class ControlsScene extends Phaser.Scene {
  private returnTo: ReturnTo = 'pause';
  private controls!: Controls;
  private sfx!: Sfx;
  private work!: ControlsConfig;
  private base!: Layout;
  private cur!: Layout;
  private sel: ButtonId | null = null;
  private drag: { pointer: number; id: ButtonId; dx: number; dy: number } | null = null;
  private closing = false;

  private bg!: Phaser.GameObjects.Graphics;
  private panel!: Phaser.GameObjects.TileSprite;
  private panelEdge!: Phaser.GameObjects.Graphics;
  private images!: Record<ButtonId, Phaser.GameObjects.Image>;
  private ring!: Phaser.GameObjects.Graphics;
  private bar!: Phaser.GameObjects.Graphics;
  private title!: OutlinedText;
  private hint!: OutlinedText;
  private toolLabels: OutlinedText[] = [];
  private tools: Tool[] = [];

  constructor() {
    super('controls');
  }

  init(data: { returnTo?: ReturnTo }): void {
    this.returnTo = data?.returnTo ?? 'pause';
  }

  create(): void {
    this.closing = false;
    this.sel = null;
    this.drag = null;
    this.controls = this.registry.get('controls') as Controls;
    this.sfx = this.registry.get('sfx') as Sfx;
    this.work = this.registry.get('controlsConfig') as ControlsConfig;
    ensurePanelPattern(this);

    this.bg = this.add.graphics();
    this.panel = this.add.tileSprite(0, 0, 4, 8, PATTERN_KEY).setOrigin(0);
    this.panelEdge = this.add.graphics();
    this.images = {
      dpad: this.add.image(0, 0, dpadKey(BUTTON_RADII.dpad[0], NONE)).setOrigin(0),
      jump: this.add.image(0, 0, roundButtonKey('jump', BUTTON_RADII.jump[0], false)).setOrigin(0),
      action: this.add.image(0, 0, roundButtonKey('action', BUTTON_RADII.action[0], false)).setOrigin(0),
    };
    this.ring = this.add.graphics();
    this.bar = this.add.graphics(); // Werkzeugleiste über den Knöpfen
    this.title = new OutlinedText(this, 0, 0, TEXT.CONTROLS);
    this.hint = new OutlinedText(this, 0, 0, TEXT.CONTROLS_HINT);
    const defs: { label: string; run: () => void }[] = [
      { label: '-', run: () => this.step(-SCALE_STEP) },
      { label: '+', run: () => this.step(SCALE_STEP) },
      { label: TEXT.DEFAULTS, run: () => this.reset() },
      { label: TEXT.DONE, run: () => this.close() },
    ];
    const none = { x: 0, y: 0, w: 0, h: BUTTON_H };
    this.tools = defs.map((d) => ({ ...d, rect: none, hit: none }));
    this.toolLabels = defs.map((d) => new OutlinedText(this, 0, 0, d.label));

    this.refresh(this.registry.get('layoutBase') as Layout);
    this.game.events.emit('controls-editing', true);

    const offPointer = this.controls.onPointer((e) => this.onPointer(e));
    const offPause = this.controls.onPause(() => this.close());
    const onLayout = (): void => { if (!this.closing) this.refresh(this.registry.get('layoutBase') as Layout); };
    this.game.events.on('layout', onLayout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offPointer();
      offPause();
      this.game.events.off('layout', onLayout);
    });
  }

  // ---- Zustand -------------------------------------------------------------

  /** Arbeitsanordnung auf eine (neue) Standard-Aufteilung anwenden und alles neu zeichnen. */
  private refresh(base: Layout): void {
    this.base = base;
    this.cur = applyControls(base, this.work[base.orientation]);
    this.drag = null;
    this.cameras.main.setSize(base.gameW, base.gameH);
    this.render();
  }

  /** Neue gültige Anordnung übernehmen. */
  private commit(next: Layout): void {
    this.cur = next;
    this.work = withOrientation(this.work, next.orientation, configFromLayout(next));
    this.render();
  }

  private step(delta: number): void {
    const id = this.sel ?? 'jump';
    this.sel = id;
    const target = configFromLayout(this.cur)[id].scale + delta;
    // Schon am kleinsten/größten Maß oder abgelehnt (Überlappung): kurzes Brummen statt Stille.
    const next = target < SCALE_MIN - 1e-9 || target > SCALE_MAX + 1e-9 ? null : resizeButton(this.cur, id, target);
    if (next) this.commit(next);
    else {
      this.sfx.play('bump');
      this.render();
    }
  }

  private reset(): void {
    this.work = withOrientation(this.work, this.cur.orientation, null);
    this.cur = this.base;
    this.render();
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    saveControlsConfig(safeStorage(), this.work);
    this.game.events.emit('controls-config', this.work);
    this.game.events.emit('controls-editing', false);
    this.controls.sample(); // Flanken von Tipp oder Taste schlucken
    if (this.returnTo === 'title') this.scene.resume('title');
    else this.scene.wake(this.returnTo);
    this.scene.stop();
  }

  // ---- Eingabe -------------------------------------------------------------

  private onPointer(e: PointerEventInfo): void {
    if (this.closing) return;
    if (e.type === 'down') {
      this.drag = null; // ein altes Ziehen ohne 'up' (z. B. nach Fokusverlust) verfällt
      const tool = this.tools.find((t) => inside(t.hit, e.x, e.y));
      if (tool) {
        this.sfx.play('select');
        tool.run();
        return;
      }
      const id = pickButton(this.cur, e.x, e.y);
      if (!id) return;
      const c = this.cur[id];
      this.sel = id;
      this.drag = { pointer: e.id, id, dx: c.cx - e.x, dy: c.cy - e.y };
      this.render();
    } else if (e.type === 'move') {
      const d = this.drag;
      if (!d || d.pointer !== e.id) return;
      const next = moveButton(this.cur, d.id, e.x + d.dx, e.y + d.dy);
      if (next) this.commit(next); // abgelehnt: letzter gültiger Stand bleibt
    } else if (this.drag?.pointer === e.id) {
      this.drag = null;
    }
  }

  // ---- Zeichnen ------------------------------------------------------------

  private render(): void {
    const l = this.cur;
    const full: Rect = { x: 0, y: 0, w: l.gameW, h: l.gameH };
    this.bg.clear();
    dim(this.bg, full);
    const p = l.panel;
    this.panel.setVisible(p !== null);
    this.panelEdge.clear();
    if (p) {
      this.panel.setPosition(p.x, p.y).setSize(p.w, p.h);
      drawPanelEdge(this.panelEdge, p);
    } else {
      // Quer: Rahmen der erlaubten Fläche
      const a = l.controlsArea;
      this.bg.lineStyle(1, AREA_LINE).strokeRect(a.x + 0.5, a.y + 0.5, a.w - 1, a.h - 1);
    }
    for (const id of BUTTON_IDS) {
      const c = l[id];
      ensureButtonTextures(this, id, c.r);
      const key = id === 'dpad' ? dpadKey(c.r, NONE) : roundButtonKey(id, c.r, false);
      this.images[id].setTexture(key).setPosition(c.cx - c.r - 1, c.cy - c.r - 1).setAlpha(1);
    }
    this.drawRing(this.sel ? l[this.sel] : null);
    this.layoutBar(l);
  }

  private drawRing(c: Circle | null): void {
    this.ring.clear();
    if (!c) return;
    this.ring.lineStyle(2, SEL_HI).strokeCircle(c.cx, c.cy, c.r + RING_GAP);
    this.ring.lineStyle(1, SEL).strokeCircle(c.cx, c.cy, c.r + RING_GAP + 1.5);
  }

  /** Hochkant im Spielbild, quer oben mittig unter der Info-Leiste. Knopfhöhe nach Bildschirm: etwa 44 CSS-px. */
  private layoutBar(l: Layout): void {
    const toolH = thumbHeight(l);
    const widths = [toolH, toolH, textWidth(TEXT.DEFAULTS) + 16, textWidth(TEXT.DONE) + 16];
    const gaps = [GAP, SEP_GAP, GAP]; // zwischen den Knöpfen
    const rowW = widths.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0);
    const w = Math.max(rowW, textWidth(TEXT.CONTROLS_HINT)) + 2 * PAD;
    const h = PAD + GLYPH_H + ROW_GAP + GLYPH_H + ROW_GAP + 2 + toolH + PAD;
    const v = l.view;
    const x = v.x + Math.floor((v.w - w) / 2);
    const y = l.orientation === 'portrait' ? v.y + Math.floor((v.h - h) / 2) : l.hud.y + l.hud.h + 3;
    // Verdeckt die Leiste einen Knopf (ganz oder teils), wird sie durchscheinend.
    const bar: Rect = { x, y, w, h };
    const covers = BUTTON_IDS.some((id) => circleHitsRect(bar, l[id]));
    const a = covers ? 0.55 : 1;
    this.bar.setAlpha(a);
    this.title.setAlpha(a);
    this.hint.setAlpha(a);
    for (const t of this.toolLabels) t.setAlpha(a);
    this.bar.clear();
    drawPanel(this.bar, bar);
    this.title.setPosition(x + Math.floor((w - this.title.width) / 2), y + PAD);
    this.hint.setPosition(x + Math.floor((w - this.hint.width) / 2), y + PAD + GLYPH_H + ROW_GAP);
    let bx = x + Math.floor((w - rowW) / 2);
    const by = y + h - PAD - toolH;
    this.tools.forEach((t, i) => {
      const bw = widths[i]!;
      t.rect = { x: bx, y: by, w: bw, h: toolH };
      // Trefferfläche: seitlich bis zur Mitte der Lücke, oben und unten ein Stück mehr.
      const left = i === 0 ? GAP / 2 : gaps[i - 1]! / 2, right = i === gaps.length ? GAP / 2 : gaps[i]! / 2;
      t.hit = { x: bx - left, y: by - HIT_PAD_Y, w: bw + left + right, h: toolH + 2 * HIT_PAD_Y };
      drawButton(this.bar, t.rect);
      const label = this.toolLabels[i]!;
      label.setPosition(bx + Math.floor((bw - label.width) / 2), by + Math.floor((toolH - GLYPH_H) / 2));
      bx += bw + (gaps[i] ?? 0);
    });
  }
}

function inside(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}
