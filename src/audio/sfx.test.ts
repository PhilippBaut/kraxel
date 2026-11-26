import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../core/types.ts';
import { EVENT_SOUND, SOUND_DEFS, Sfx, soundsForEvents } from './sfx.ts';

function fakeContext(counter: { started: number; resumed?: number; state?: string }): AudioContext {
  const param = { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} };
  const fake: Record<string, unknown> = {
    currentTime: 0, state: counter.state ?? 'running',
    resume: () => { counter.resumed = (counter.resumed ?? 0) + 1; fake.state = 'running'; return Promise.resolve(); }, destination: {},
    createOscillator: () => ({ type: '', frequency: param, connect: () => ({ connect() {} }), start: () => { counter.started++; }, stop() {} }),
    createGain: () => ({ gain: param, connect() {} }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(1) }),
    createBufferSource: () => ({ connect() {}, start: () => { counter.started++; }, stop() {} }),
    sampleRate: 44100,
  };
  return fake as unknown as AudioContext;
}

describe('Sfx', () => {
  it('jedes zugeordnete Event hat einen Klang', () => {
    for (const n of Object.values(EVENT_SOUND)) expect(SOUND_DEFS[n!]).toBeDefined();
  });

  it('play vor unlock wirft nicht und erzeugt keinen Kontext', () => {
    let created = 0;
    const sfx = new Sfx(() => { created++; return null; });
    expect(() => sfx.play('jump')).not.toThrow();
    expect(created).toBe(0);
  });

  it('unlock ohne Audio-Unterstützung wirft nicht', () => {
    const sfx = new Sfx(() => null);
    expect(() => { sfx.unlock(); sfx.play('crystal'); }).not.toThrow();
  });

  it('stumm: keine Oszillatoren', () => {
    const c = { started: 0 };
    const sfx = new Sfx(() => fakeContext(c));
    sfx.unlock();
    sfx.setMuted(true);
    sfx.play('jump');
    expect(c.started).toBe(0);
    sfx.setMuted(false);
    sfx.play('jump');
    expect(c.started).toBeGreaterThan(0);
  });

  it('suspendiert: play startet nichts, nach unlock wieder', () => {
    const c: { started: number; resumed?: number } = { started: 0 };
    let ctx: AudioContext | null = null;
    const sfx = new Sfx(() => (ctx = fakeContext(c)));
    sfx.unlock();
    (ctx as unknown as { state: string }).state = 'suspended';
    sfx.play('jump');
    expect(c.started).toBe(0);
    sfx.unlock();
    expect(c.resumed).toBe(1);
    sfx.play('jump');
    expect(c.started).toBeGreaterThan(0);
  });

  it('mehrfaches unlock erzeugt genau einen Kontext', () => {
    const c = { started: 0 };
    let created = 0;
    const sfx = new Sfx(() => { created++; return fakeContext(c); });
    for (let i = 0; i < 10; i++) sfx.unlock();
    expect(created).toBe(1);
  });

  it('Rauschklang startet einen Puffer', () => {
    const c = { started: 0 };
    const sfx = new Sfx(() => fakeContext(c));
    sfx.unlock();
    sfx.play('rockBreak');
    expect(c.started).toBeGreaterThan(0);
  });

  it('Kristall ist kein Quartsprung aufwärts', () => {
    const n = SOUND_DEFS.crystal.notes;
    expect(n.length).toBeGreaterThanOrEqual(2);
    expect(n[1]!.f / n[0]!.f).not.toBeCloseTo(4 / 3, 1);
  });

  it('Tor-Fanfare ist kürzer als 1,5 s', () => {
    expect(SOUND_DEFS.goal.notes.reduce((s, x) => s + x.d, 0)).toBeLessThan(1.5);
  });
});

describe('soundsForEvents', () => {
  const ev = (...e: GameEvent[]) => soundsForEvents(e);
  it('doppelter Stomp-Klang wird nur einmal gespielt', () => {
    expect(ev({ type: 'stomp', x: 0, y: 0 }, { type: 'enemyDefeated', x: 0, y: 0 }, { type: 'enemyDefeated', x: 1, y: 0 })).toEqual(['stomp']);
  });
  it('mit goal entfällt extraLife', () => {
    expect(ev({ type: 'extraLife' }, { type: 'goal', bonusCrystals: 0, extraLife: true, exit: 'normal' })).toEqual(['goal']);
  });
  it('ohne goal bleibt extraLife; unbekannte Events schweigen', () => {
    expect(ev({ type: 'extraLife' }, { type: 'land' })).toEqual(['extraLife']);
  });
  it('Schleuder, Federn und Enzian haben je einen eigenen Klang', () => {
    expect(ev({ type: 'shoot' })).toEqual(['shoot']);
    expect(ev({ type: 'bounce', cx: 3, cy: 4 })).toEqual(['bounce']);
    expect(ev({ type: 'enzianStart' })).toEqual(['sparkle']);
    expect(new Set(['shoot', 'bounce', 'sparkle']).size).toBe(3);
    for (const n of ['shoot', 'bounce', 'sparkle'] as const) expect(SOUND_DEFS[n].notes.length).toBeGreaterThan(0);
  });
  it('Kiesel-Treffer spielt den Stomp-Klang einmal', () => {
    expect(ev({ type: 'enemyDefeated', x: 0, y: 0 }, { type: 'pebblePop', x: 0, y: 0 })).toEqual(['stomp']);
  });
  it('Schleuder-Klang und Enzian-Klang sind kurz', () => {
    const dur = (n: 'shoot' | 'sparkle' | 'bounce') => SOUND_DEFS[n].notes.reduce((s, x) => s + x.d, 0);
    expect(dur('shoot')).toBeLessThan(0.3);
    expect(dur('bounce')).toBeLessThan(0.4);
    expect(dur('sparkle')).toBeLessThan(0.6);
  });
});
