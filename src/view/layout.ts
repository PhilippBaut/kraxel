// Bildschirm-Aufteilung hochkant (Spielbild oben, Steuerfeld unten) und quer (Vollbild).
// Alle Maße in Spielpixeln. Nur readSafeInsets() greift auf das DOM zu.
import { MAX_VIEW_W, PORTRAIT_VIEW_W, VIEW_H } from '../config.ts';
import type { Rect } from '../core/types.ts';

export interface Insets { top: number; right: number; bottom: number; left: number }
export interface Circle { cx: number; cy: number; r: number; hitR: number }
export interface Layout {
  orientation: 'portrait' | 'landscape'; gameW: number; gameH: number; scale: number;
  view: Rect; panel: Rect | null; hud: Rect; pause: Rect;
  dpad: Circle; jump: Circle; action: Circle; controlsAlpha: number;
}

const MIN_PANEL_H = 140;

function landscape(cssW: number, cssH: number, insets: Insets): Layout {
  const scale = cssH / VIEW_H;
  const gameW = Math.min(Math.round(cssW / scale), MAX_VIEW_W);
  const L = Math.ceil(insets.left / scale);
  const R = Math.ceil(insets.right / scale);
  const T = Math.ceil(insets.top / scale);
  const B = VIEW_H - Math.ceil(insets.bottom / scale) - 6;
  const jump: Circle = { cx: gameW - R - 37, cy: B - 39, r: 21, hitR: 38 };
  return {
    orientation: 'landscape', gameW, gameH: VIEW_H, scale,
    view: { x: 0, y: 0, w: gameW, h: VIEW_H }, panel: null,
    hud: { x: L, y: T, w: gameW - L - R, h: 12 },
    pause: { x: gameW / 2 - 8, y: T + 2, w: 16, h: 12 },
    dpad: { cx: L + 44, cy: B - 38, r: 32, hitR: 60 },
    jump,
    action: { cx: jump.cx - 58, cy: B - 14, r: 14, hitR: 24 },
    controlsAlpha: 0.45,
  };
}

export function computeLayout(cssW: number, cssH: number, insets: Insets): Layout {
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
        dpad: { cx: 60, cy: B - 50, r: 42, hitR: 60 },
        jump: { cx: 200, cy: B - 56, r: 28, hitR: 44 },
        action: { cx: 140, cy: B - 16, r: 16, hitR: 24 },
        controlsAlpha: 1,
      };
    }
  }
  return landscape(cssW, cssH, insets);
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
