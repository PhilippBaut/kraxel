// Verlauf in Gruben: nach unten immer dunkler. Rein rechnerisch, damit er sich testen lässt.
import { TILE } from '../config.ts';

export const PIT_ALPHA = 0.85;
/** Ab diesem Anteil der Grubentiefe ist der Verlauf voll dunkel (Entwurf: min(.85, d·1,1)). */
export const PIT_FULL_AT = PIT_ALPHA / 1.1;
/** Tiefe, ab der der Verlauf nicht mehr länger wird: so sehen 3 Kacheln tiefe Gruben (Level 1-1) aus, tiefere werden nicht heller. */
const PIT_REF_DEPTH = 3 * TILE;

/** Länge des Verlaufs vom Grubenrand nach unten (px) bei der Tiefe `depth` (px). */
export function pitFadeLength(depth: number): number {
  return Math.round(Math.min(depth, PIT_REF_DEPTH) * PIT_FULL_AT);
}

/** Deckkraft des Schattens im Abstand `below` (px) unter dem Grubenrand. */
export function pitAlphaAt(depth: number, below: number): number {
  const fade = pitFadeLength(depth);
  return fade <= 0 ? PIT_ALPHA : PIT_ALPHA * Math.min(1, Math.max(0, below) / fade);
}
