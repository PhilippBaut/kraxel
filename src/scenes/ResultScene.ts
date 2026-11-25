// Ergebnis nach dem Gipfelkreuz über dem angehaltenen Spiel: Zeit, Bestzeit, Edelweiß und Kristalle; NOCHMAL oder WEITER.
import Phaser from 'phaser';
import { formatTime } from '../core/format.ts';
import { GLYPH_H } from '../gfx/font.ts';
import { OutlinedText } from '../gfx/pixel-text.ts';
import { TEXT } from '../ui-text.ts';
import type { Layout } from '../view/layout.ts';
import { dim, drawPanel, Menu } from './menu.ts';
import type { PlayScene } from './PlayScene.ts';

export interface ResultData {
  levelId: string;
  time: number;
  edelweiss: [boolean, boolean, boolean];
  crystals: number;
  newBest: boolean;
  bestTime: number | null;
}

type Part = Phaser.GameObjects.Image | OutlinedText;
/** Eine Zeile: Beschriftung links und Werte rechtsbündig, ohne Beschriftung mittig. `y` relativ zum Inhalt. */
interface Row { label: OutlinedText | null; parts: Part[]; y: number }

const PAD = 10, ROW_H = GLYPH_H + 4, BLOCK_GAP = 6, CONTENT_W = 124;
/** Abstand nach einem Symbol (Edelweiß 7 px breit, also alle 9 px eines). */
const ICON_GAP = 2;
/** Gelb aus der Palette (S) für Überschrift und Rekord. */
const GOLD = 0xffd23f;
const RECORD_BLINK_MS = 400;
const INPUT_LOCK_MS = 500;

function partsWidth(parts: readonly Part[]): number {
  return parts.reduce((w, p, i) => w + p.width + (p instanceof OutlinedText || i === parts.length - 1 ? 0 : ICON_GAP), 0);
}

export class ResultScene extends Phaser.Scene {
  private result!: ResultData;
  private bg!: Phaser.GameObjects.Graphics;
  private menu!: Menu;
  private rows: Row[] = [];
  private contentH = 0;
  private record: OutlinedText | null = null;
  private closing = false;

  constructor() {
    super('result');
  }

  init(data: ResultData): void {
    this.result = data;
  }

  create(): void {
    const d = this.result;
    this.closing = false;
    this.bg = this.add.graphics();
    this.rows = [];
    let y = 0;
    const text = (s: string, tint?: number) => {
      const t = new OutlinedText(this, 0, 0, s);
      return tint === undefined ? t : t.setFaceTint(tint);
    };
    const icon = (key: string) => this.add.image(0, 0, key).setOrigin(0);
    const row = (label: string | null, ...parts: Part[]) => {
      this.rows.push({ label: label === null ? null : text(label), parts, y });
      y += ROW_H;
    };

    row(null, text(TEXT.GOAL, GOLD));
    y += BLOCK_GAP;
    row(TEXT.TIME, text(formatTime(d.time)));
    row(TEXT.BEST, text(d.bestTime === null ? '-' : formatTime(d.bestTime)));
    this.record = d.newBest ? text(TEXT.NEW_RECORD, GOLD) : null;
    if (this.record) row(null, this.record);
    y += BLOCK_GAP;
    row(TEXT.EDELWEISS, ...d.edelweiss.map((e) => icon(e ? 'iEdel' : 'iEdelOff')));
    row(TEXT.CRYSTALS, icon('iCrystal'), text(String(d.crystals)));
    this.contentH = y + BLOCK_GAP;

    this.menu = new Menu(this, [
      { label: () => TEXT.AGAIN, run: () => this.again() },
      { label: () => TEXT.NEXT, run: () => this.next() },
    ], INPUT_LOCK_MS);
    this.applyLayout(this.registry.get('layout') as Layout);
    this.game.events.on('layout', this.applyLayout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off('layout', this.applyLayout, this));
  }

  update(time: number): void {
    this.record?.setVisible(Math.floor(time / RECORD_BLINK_MS) % 2 === 0);
    this.menu.update();
  }

  private again(): void {
    if (this.closing) return;
    this.closing = true;
    (this.scene.get('play') as PlayScene).restart();
    this.scene.resume('play');
    this.scene.stop();
  }

  /** In Meilenstein 1 gibt es nur ein Level: WEITER führt zum Titel. */
  private next(): void {
    if (this.closing) return;
    this.closing = true;
    (this.scene.get('play') as PlayScene).goToTitle();
  }

  /** Tafel mittig im Spielbild. */
  private applyLayout(l: Layout): void {
    this.cameras.main.setSize(l.gameW, l.gameH);
    const v = l.view, m = this.menu;
    const w = Math.max(CONTENT_W, m.width) + 2 * PAD, h = PAD + this.contentH + m.height + PAD;
    const x = v.x + Math.floor((v.w - w) / 2), y = v.y + Math.floor((v.h - h) / 2);
    this.bg.clear();
    dim(this.bg, v);
    drawPanel(this.bg, { x, y, w, h });
    for (const r of this.rows) {
      const top = y + PAD + r.y, pw = partsWidth(r.parts);
      r.label?.setPosition(x + PAD, top);
      let px = r.label ? x + w - PAD - pw : x + Math.floor((w - pw) / 2);
      for (const p of r.parts) {
        p.setPosition(px, top);
        px += p.width + (p instanceof OutlinedText ? 0 : ICON_GAP);
      }
    }
    m.setPosition(x + Math.floor((w - m.width) / 2), y + PAD + this.contentH);
  }
}
