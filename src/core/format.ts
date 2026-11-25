// Zeitanzeige für Info-Leiste und Ergebnis. Kein Phaser, kein DOM.

/** Gegen Gleitkomma-Reste wie 1.15 * 100 = 114.999…; deutlich kleiner als eine Hundertstel. */
const EPS = 1e-6;

/** Sekunden als `m:ss.cc`, auf Hundertstel abgerundet; mit `hundredths = false` als `m:ss`. */
export function formatTime(seconds: number, hundredths = true): string {
  const cs = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds * 100 + EPS) : 0;
  const m = Math.floor(cs / 6000);
  const s = Math.floor(cs / 100) % 60;
  const base = `${m}:${String(s).padStart(2, '0')}`;
  return hundredths ? `${base}.${String(cs % 100).padStart(2, '0')}` : base;
}
