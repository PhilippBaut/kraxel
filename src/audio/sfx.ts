// Soundeffekte per Web Audio: kurze Chip-Töne, alles im Code erzeugt.
// Nichts hier baut beim Import etwas aus dem DOM auf; der AudioContext entsteht erst in unlock().
import type { GameEvent } from '../core/types.ts';

export type SoundName = 'jump' | 'wallJump' | 'bump' | 'crate' | 'crystal' | 'item' | 'powerUp' | 'stomp' | 'pound' | 'rockBreak'
  | 'hurt' | 'death' | 'checkpoint' | 'edelweiss' | 'extraLife' | 'goal' | 'select' | 'shoot' | 'sparkle' | 'bounce';

/** Eine Note: Frequenz f (Hz), optional gleitend nach f2, Dauer d (s). Bei Rauschen zählt nur d. */
export interface SoundDef {
  wave: 'square' | 'triangle' | 'sawtooth' | 'sine' | 'noise';
  notes: ReadonlyArray<{ f: number; f2?: number; d: number }>;
  vol: number;
}

export const SOUND_DEFS: Readonly<Record<SoundName, SoundDef>> = {
  jump: { wave: 'square', vol: 0.5, notes: [{ f: 220, f2: 440, d: 0.11 }] },
  wallJump: { wave: 'square', vol: 0.45, notes: [{ f: 300, f2: 520, d: 0.06 }, { f: 420, f2: 760, d: 0.07 }] },
  bump: { wave: 'triangle', vol: 0.9, notes: [{ f: 150, f2: 80, d: 0.09 }] },
  crate: { wave: 'sawtooth', vol: 0.4, notes: [{ f: 260, f2: 170, d: 0.06 }, { f: 170, f2: 320, d: 0.09 }] },
  // Kristall: schnelle Dur-Terz (C6 -> E6), dann Oktave (C7).
  crystal: { wave: 'triangle', vol: 0.7, notes: [{ f: 1047, d: 0.05 }, { f: 1319, d: 0.05 }, { f: 2093, d: 0.1 }] },
  item: { wave: 'sine', vol: 0.8, notes: [{ f: 400, f2: 800, d: 0.12 }, { f: 800, f2: 600, d: 0.1 }] },
  powerUp: { wave: 'sawtooth', vol: 0.4, notes: [{ f: 200, f2: 600, d: 0.14 }, { f: 300, f2: 900, d: 0.14 }, { f: 450, f2: 1350, d: 0.18 }] },
  stomp: { wave: 'square', vol: 0.5, notes: [{ f: 300, f2: 100, d: 0.09 }] },
  pound: { wave: 'sawtooth', vol: 0.6, notes: [{ f: 130, f2: 40, d: 0.18 }] },
  rockBreak: { wave: 'noise', vol: 0.8, notes: [{ f: 0, d: 0.2 }] },
  hurt: { wave: 'sawtooth', vol: 0.45, notes: [{ f: 420, f2: 150, d: 0.22 }] },
  death: { wave: 'triangle', vol: 0.9, notes: [{ f: 500, f2: 420, d: 0.12 }, { f: 400, f2: 310, d: 0.12 }, { f: 300, f2: 190, d: 0.15 }, { f: 200, f2: 60, d: 0.3 }] },
  checkpoint: { wave: 'triangle', vol: 0.8, notes: [{ f: 659, d: 0.08 }, { f: 523, d: 0.08 }, { f: 784, d: 0.18 }] },
  edelweiss: { wave: 'sine', vol: 0.9, notes: [{ f: 1319, d: 0.1 }, { f: 988, d: 0.1 }, { f: 1480, d: 0.22 }] },
  extraLife: { wave: 'square', vol: 0.4, notes: [{ f: 440, d: 0.09 }, { f: 659, d: 0.09 }, { f: 554, d: 0.09 }, { f: 880, d: 0.22 }] },
  // Eigene kurze Fanfare, rund 0,9 s.
  goal: { wave: 'square', vol: 0.42, notes: [{ f: 392, d: 0.12 }, { f: 392, d: 0.12 }, { f: 523, d: 0.12 }, { f: 392, d: 0.1 }, { f: 659, d: 0.12 }, { f: 784, d: 0.35 }] },
  select: { wave: 'square', vol: 0.35, notes: [{ f: 500, f2: 700, d: 0.05 }] },
  // Schleuder: Gummiband-Zupfer, erst hoch, dann zurückfedernd (weich, kein Zischen).
  shoot: { wave: 'triangle', vol: 0.8, notes: [{ f: 180, f2: 560, d: 0.05 }, { f: 560, f2: 260, d: 0.07 }] },
  // Enzian: glitzernde Gleittöne in wechselnder Richtung, bewusst keine Tonleiter.
  sparkle: { wave: 'sine', vol: 0.75, notes: [{ f: 1200, f2: 2400, d: 0.08 }, { f: 1900, f2: 950, d: 0.08 }, { f: 1500, f2: 3000, d: 0.14 }, { f: 2600, f2: 2000, d: 0.12 }] },
  // Blätterpolster: federndes Boing.
  bounce: { wave: 'triangle', vol: 0.9, notes: [{ f: 200, f2: 620, d: 0.08 }, { f: 620, f2: 360, d: 0.07 }, { f: 360, f2: 520, d: 0.08 }] },
};

export const EVENT_SOUND: Readonly<Partial<Record<GameEvent['type'], SoundName>>> = {
  jump: 'jump', wallJump: 'wallJump', bump: 'bump', crateOpen: 'crate', crystal: 'crystal', itemSpawn: 'item',
  powerUp: 'powerUp', stomp: 'stomp', enemyDefeated: 'stomp', poundLand: 'pound', rockBreak: 'rockBreak',
  hurt: 'hurt', death: 'death', checkpoint: 'checkpoint', edelweiss: 'edelweiss', extraLife: 'extraLife', goal: 'goal',
  // Der Kiesel-Treffer läuft über `enemyDefeated` (Stomp-Klang); das Zerplatzen an der Wand bleibt still.
  shoot: 'shoot', bounce: 'bounce', enzianStart: 'sparkle',
};

/**
 * Klänge für die Events eines Schritts: jeder Klang höchstens einmal (kein Stapeln bei Doppel-Stomp),
 * bei einem Ziel entfällt extraLife (nur die Fanfare), beim Enzian entfällt powerUp (nur das Funkeln).
 */
export function soundsForEvents(events: readonly GameEvent[]): SoundName[] {
  const hasGoal = events.some((e) => e.type === 'goal');
  const hasEnzian = events.some((e) => e.type === 'enzianStart');
  const out: SoundName[] = [];
  for (const e of events) {
    if (hasGoal && e.type === 'extraLife') continue;
    if (hasEnzian && e.type === 'powerUp') continue;
    const n = EVENT_SOUND[e.type];
    if (n !== undefined && !out.includes(n)) out.push(n);
  }
  return out;
}

const MASTER_GAIN = 0.2;
const ATTACK = 0.004;
const FLOOR = 0.0001;

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private _muted = false;
  private readonly createContext: () => AudioContext | null;

  constructor(createContext: () => AudioContext | null) {
    this.createContext = createContext;
  }

  get muted(): boolean {
    return this._muted;
  }

  setMuted(m: boolean): void {
    this._muted = m;
  }

  /** Erzeugt den Kontext (einmal) und weckt ihn auf, falls er nicht läuft; idempotent, bei jeder Geste aufrufbar. */
  unlock(): void {
    try {
      // iPhone: Ton auch bei Stummschalter.
      if (typeof navigator !== 'undefined') {
        const nav = navigator as Navigator & { audioSession?: { type: string } };
        if (nav.audioSession) nav.audioSession.type = 'playback';
      }
      if (!this.ctx) {
        const ctx = this.createContext();
        if (!ctx) return;
        const master = ctx.createGain();
        master.gain.setValueAtTime(MASTER_GAIN, 0);
        master.connect(ctx.destination);
        this.ctx = ctx;
        this.master = master;
      }
      if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => {});
    } catch {
      /* Audio ist nur Beiwerk: Fehler nie ins Spiel durchreichen. */
    }
  }

  play(n: SoundName): void {
    const { ctx, master } = this;
    // Nicht im Ruhezustand planen: currentTime steht dann, alle Noten kämen gebündelt beim Aufwachen.
    if (!ctx || !master || this._muted || ctx.state !== 'running') return;
    try {
      const def = SOUND_DEFS[n];
      let t = ctx.currentTime;
      for (const note of def.notes) {
        const g = ctx.createGain();
        g.gain.setValueAtTime(FLOOR, t);
        g.gain.linearRampToValueAtTime(def.vol, t + ATTACK);
        g.gain.exponentialRampToValueAtTime(FLOOR, t + note.d);
        g.connect(master);
        if (def.wave === 'noise') {
          const src = ctx.createBufferSource();
          src.buffer = this.noiseBuffer(ctx);
          src.connect(g);
          src.start(t);
          src.stop(t + note.d);
        } else {
          const osc = ctx.createOscillator();
          osc.type = def.wave;
          osc.frequency.setValueAtTime(note.f, t);
          if (note.f2 !== undefined) osc.frequency.exponentialRampToValueAtTime(note.f2, t + note.d);
          osc.connect(g);
          osc.start(t);
          osc.stop(t + note.d + 0.02);
        }
        t += note.d;
      }
    } catch {
      /* siehe unlock */
    }
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noise) {
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    return this.noise;
  }
}
