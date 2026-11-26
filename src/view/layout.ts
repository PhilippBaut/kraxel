// Bildschirm-Aufteilung hochkant (Spielbild oben, Steuerfeld unten) und quer (Vollbild).
// Alle Maße in Spielpixeln. Nur readSafeInsets() greift auf das DOM zu.
import { MAX_VIEW_W, PORTRAIT_VIEW_W, VIEW_H } from '../config.ts';
import type { Rect } from '../core/types.ts';
import { BASE_RADII, applyControls, type ControlsConfig } from './controls-config.ts';

export interface Insets { top: number; right: number; bottom: number; left: number }
export interface Circle { cx: number; cy: number; r: number; hitR: number }
export interface Layout {
  orientation: 'portrait' | 'landscape'; gameW: number; gameH: number; scale: number;
  view: Rect; panel: Rect | null; hud: Rect; pause: Rect;
  /** Tipp-Fläche für Pause (mind. 30×24); das sichtbare Zeichen `pause` liegt darin. */
  pauseHit: Rect;
  dpad: Circle; jump: Circle; action: Circle; controlsAlpha: number;
  /** Fläche, in der die Knöpfe liegen dürfen (Safe Area; hochkant unter der Info-Zeile, quer unter der HUD-Leiste). */
  controlsArea: Rect;
}

const MIN_PANEL_H = 140;

const circle = (o: 'portrait' | 'landscape', id: 'dpad' | 'jump' | 'action', cx: number, cy: number): Circle => ({ cx, cy, ...BASE_RADII[o][id] });

function landscape(cssW: number, cssH: number, insets: Insets): Layout {
  const scale = cssH / VIEW_H;
  const gameW = Math.min(Math.round(cssW / scale), MAX_VIEW_W);
  const L = Math.ceil(insets.left / scale);
  const R = Math.ceil(insets.right / scale);
  const T = Math.ceil(insets.top / scale);
  const B = VIEW_H - Math.ceil(insets.bottom / scale) - 6;
  const jump = circle('landscape', 'jump', gameW - R - 37, B - 39);
  const bottom = VIEW_H - Math.ceil(insets.bottom / scale) - 2;
  return {
    orientation: 'landscape', gameW, gameH: VIEW_H, scale,
    view: { x: 0, y: 0, w: gameW, h: VIEW_H }, panel: null,
    hud: { x: L, y: T, w: gameW - L - R, h: 12 },
    pause: { x: gameW / 2 - 8, y: T + 2, w: 16, h: 12 },
    pauseHit: { x: gameW / 2 - 16, y: T, w: 32, h: 24 },
    dpad: circle('landscape', 'dpad', L + 44, B - 38),
    jump,
    action: circle('landscape', 'action', jump.cx - 58, B - 14),
    controlsAlpha: 0.45,
    controlsArea: { x: L, y: T + 12, w: gameW - L - R, h: bottom - (T + 12) },
  };
}

function baseLayout(cssW: number, cssH: number, insets: Insets): Layout {
  if (cssH > cssW) {
    const scale = cssW / PORTRAIT_VIEW_W;
    const gameH = Math.floor(cssH / scale);
    const T = Math.ceil(insets.top / scale);
    const panelY = T + VIEW_H;
    const panelH = gameH - panelY;
    if (panelH >= MIN_PANEL_H) {
      const B = gameH - Math.ceil(insets.bottom / scale) - 8;
      return {
        orientation: 'portrait', gameW: PORTRAIT_VIEW_W, gameH, scale,
        view: { x: 0, y: T, w: PORTRAIT_VIEW_W, h: VIEW_H },
        panel: { x: 0, y: panelY, w: PORTRAIT_VIEW_W, h: panelH },
        hud: { x: 0, y: panelY, w: PORTRAIT_VIEW_W, h: 16 },
        pause: { x: 236, y: panelY + 2, w: 16, h: 12 },
        pauseHit: { x: 224, y: panelY, w: 32, h: 24 }, // rechtes Ende der Info-Zeile, 8 px nach unten verlängert
        dpad: circle('portrait', 'dpad', 60, B - 50),
        jump: circle('portrait', 'jump', 200, B - 56),
        action: circle('portrait', 'action', 140, B - 16),
        controlsAlpha: 1,
        controlsArea: { x: 0, y: panelY + 16, w: PORTRAIT_VIEW_W, h: gameH - Math.ceil(insets.bottom / scale) - 4 - (panelY + 16) },
      };
    }
  }
  return landscape(cssW, cssH, insets);
}

/** Bildschirm-Aufteilung; mit `controls` liegen die Knöpfe dort, wo der Spieler sie hingesetzt hat (ungültig: Standard). */
export function computeLayout(cssW: number, cssH: number, insets: Insets, controls?: ControlsConfig): Layout {
  const base = baseLayout(cssW, cssH, insets);
  return applyControls(base, controls?.[base.orientation] ?? null);
}

let probe: HTMLDivElement | null = null;

/** Liest die Safe-Area-Ränder (CSS-Pixel) über ein verstecktes Element mit env(safe-area-inset-*). */
export function readSafeInsets(): Insets {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(probe);
  }
  const s = getComputedStyle(probe);
  const n = (v: string) => Number.parseFloat(v) || 0;
  return { top: n(s.paddingTop), right: n(s.paddingRight), bottom: n(s.paddingBottom), left: n(s.paddingLeft) };
}
