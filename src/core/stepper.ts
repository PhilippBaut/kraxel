// Fester Spieltakt: wandelt die Bildzeit der Anzeige in eine Anzahl fester Schritte um.

/** Zwei 120-Hz-Frames sollen sicher genau einen Schritt ergeben, trotz Rundung. */
const EPS_MS = 1e-6;

export class FixedStepper {
  private readonly stepMs: number;
  private readonly maxSteps: number;
  private acc = 0;

  constructor(stepMs: number = 1000 / 60, maxSteps: number = 5) {
    this.stepMs = stepMs;
    this.maxSteps = maxSteps;
  }

  /** Gibt zurück, wie viele Schritte jetzt fällig sind. Wären es mehr als `maxSteps`, wird der Rest verworfen. */
  advance(deltaMs: number): number {
    this.acc += Math.max(0, deltaMs);
    const due = Math.floor((this.acc + EPS_MS) / this.stepMs);
    if (due > this.maxSteps) {
      this.acc = 0;
      return this.maxSteps;
    }
    this.acc -= due * this.stepMs;
    return due;
  }
}
