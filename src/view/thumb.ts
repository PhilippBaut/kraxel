// Daumengroße Knopfhöhe (Spielpixel) für Menüs und Werkzeugleiste; rein rechnerisch, ohne Phaser.
import type { Layout } from './layout.ts';

/** Kleinste Knopfhöhe (Spielpixel), auch wenn es eng wird. */
export const MIN_BUTTON_H = 15;
/** Ziel: etwa 44 CSS-px (Daumen), begrenzt je Ansicht, damit Tafeln ins Bild passen. */
export const THUMB_CSS_PX = 44;
export const THUMB_H_MAX = { portrait: 32, landscape: 24 } as const;

/** Knopfhöhe in Spielpixeln: etwa 44 CSS-px, zwischen MIN_BUTTON_H und dem Höchstwert der Ansicht. */
export function thumbHeight(l: Pick<Layout, 'scale' | 'orientation'>): number {
  const h = Math.ceil(THUMB_CSS_PX / l.scale);
  return Math.max(MIN_BUTTON_H, Math.min(THUMB_H_MAX[l.orientation], h));
}

/**
 * Knopfhöhe für `count` Knöpfe mit `gap` Abstand: daumengroß, aber so klein wie nötig, damit
 * `reservedH` (Titel, Texte, Ränder) plus Knöpfe ins Spielbild passen; nie unter MIN_BUTTON_H.
 */
export function fitButtonHeight(l: Pick<Layout, 'scale' | 'orientation' | 'view'>, count: number, gap: number, reservedH: number): number {
  const room = Math.floor((l.view.h - reservedH - (count - 1) * gap) / count);
  return Math.max(MIN_BUTTON_H, Math.min(thumbHeight(l), room));
}
