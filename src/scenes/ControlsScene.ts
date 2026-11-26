// Knopf-Editor: Steuerkreuz, Sprung- und Aktionsknopf ziehen und in der Größe ändern.
// Öffnet über dem Pausenmenü oder dem Titelbild; die Rückkehr-Szene schläft, solange er offen ist.
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
  applyControls, BUTTON_IDS, configFromLayout, moveButton, pickButton, resizeButton,
  saveControlsConfig, SCALE_STEP, withOrientation, type ButtonId, type ControlsConfig,
} from '../view/controls-config.ts';
import type { Circle, Layout } from '../view/layout.ts';
import { BUTTON_H, dim, drawPanel, EDGE, FILL, FILL_HI, SEL, SEL_HI } from './menu.ts';

type ReturnTo = 'pause' | 'title';
interface Tool { label: string; rect: Rect; run: () => void }

const NONE = { left: false, right: false, up: false, down: false };
const PAD = 6, GAP = 4, ROW_GAP = 4;
const SQUARE_W = 18;
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
    this.tools = defs.map((d) => ({ ...d, rect: { x: 0, y: 0, w: 0, h: BUTTON_H } }));
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
    const scale = Math.round(configFromLayout(this.cur)[id].scale / SCALE_STEP) * SCALE_STEP;
    const next = resizeButton(this.cur, id, scale + delta);
    if (next) this.commit(next);
    else this.render();
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
    this.scene.wake(this.returnTo);
    this.scene.stop();
  }

  // ---- Eingabe -------------------------------------------------------------

  private onPointer(e: PointerEventInfo): void {
    if (this.closing) return;
    if (e.type === 'down') {
      this.drag = null; // ein altes Ziehen ohne 'up' (z. B. nach Fokusverlust) verfällt
      const tool = this.tools.find((t) => inside(t.rect, e.x, e.y));
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

  /** Hochkant im Spielbild, quer oben mittig unter der Info-Leiste. */
  private layoutBar(l: Layout): void {
    const widths = [SQUARE_W, SQUARE_W, textWidth(TEXT.DEFAULTS) + 16, textWidth(TEXT.DONE) + 16];
    const rowW = widths.reduce((a, b) => a + b, 0) + GAP * (widths.length - 1);
    const w = Math.max(rowW, textWidth(TEXT.CONTROLS_HINT)) + 2 * PAD;
    const h = PAD + GLYPH_H + ROW_GAP + GLYPH_H + ROW_GAP + 2 + BUTTON_H + PAD;
    const v = l.view;
    const x = v.x + Math.floor((v.w - w) / 2);
    const y = l.orientation === 'portrait' ? v.y + Math.floor((v.h - h) / 2) : l.hud.y + l.hud.h + 3;
    // Verdeckt die Leiste einen Knopf (ganz oder teils), wird sie durchscheinend.
    const covers = BUTTON_IDS.some((id) => {
      const c = l[id];
      const nx = Math.max(x, Math.min(c.cx, x + w)), ny = Math.max(y, Math.min(c.cy, y + h));
      return Math.hypot(c.cx - nx, c.cy - ny) < c.r;
    });
    const a = covers ? 0.55 : 1;
    this.bar.setAlpha(a);
    this.title.setAlpha(a);
    this.hint.setAlpha(a);
    for (const t of this.toolLabels) t.setAlpha(a);
    this.bar.clear();
    drawPanel(this.bar, { x, y, w, h });
    this.title.setPosition(x + Math.floor((w - this.title.width) / 2), y + PAD);
    this.hint.setPosition(x + Math.floor((w - this.hint.width) / 2), y + PAD + GLYPH_H + ROW_GAP);
    let bx = x + Math.floor((w - rowW) / 2);
    const by = y + h - PAD - BUTTON_H;
    this.tools.forEach((t, i) => {
      t.rect = { x: bx, y: by, w: widths[i]!, h: BUTTON_H };
      this.bar.fillStyle(EDGE).fillRect(bx - 1, by - 1, t.rect.w + 2, BUTTON_H + 2);
      this.bar.fillStyle(FILL).fillRect(bx, by, t.rect.w, BUTTON_H);
      this.bar.fillStyle(FILL_HI).fillRect(bx, by, t.rect.w, 1);
      const label = this.toolLabels[i]!;
      label.setPosition(bx + Math.floor((t.rect.w - label.width) / 2), by + 4);
      bx += t.rect.w + GAP;
    });
  }
}

function inside(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}
