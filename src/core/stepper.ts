// Fester Spieltakt: wandelt die Bildzeit der Anzeige in eine Anzahl fester Schritte um.

/** Zwei 120-Hz-Frames sollen sicher genau einen Schritt ergeben, trotz Rundung. */
const EPS_MS = 1e-6;
const SNAP_FRACTION = 0.06;

export class FixedStepper {
  private readonly stepMs: number;
  private readonly maxSteps: number;
  private acc = 0;

  constructor(stepMs: number = 1000 / 60, maxSteps: number = 5) {
    this.stepMs = stepMs;
    this.maxSteps = maxSteps;
  }

  /** Bildzeiten knapp neben einem Schritt (59,94 Hz, Zittern um 1 ms) zählen als genau ein Schritt,
   *  sonst gäbe es immer wieder Bilder mit 0 oder 2 Schritten (Mikroruckeln). Toleranz: 6 % der Schrittweite, bei 60 Hz etwa 1 ms. */
  private snap(deltaMs: number): number {
    return Math.abs(deltaMs - this.stepMs) <= this.stepMs * SNAP_FRACTION ? this.stepMs : deltaMs;
  }

  /** Gibt zurück, wie viele Schritte jetzt fällig sind. Wären es mehr als `maxSteps`, wird der Rest verworfen. */
  advance(deltaMs: number): number {
    this.acc += Math.max(0, this.snap(deltaMs));
    const due = Math.floor((this.acc + EPS_MS) / this.stepMs);
    if (due > this.maxSteps) {
      this.acc = 0;
      return this.maxSteps;
    }
    this.acc -= due * this.stepMs;
    return due;
  }
}
