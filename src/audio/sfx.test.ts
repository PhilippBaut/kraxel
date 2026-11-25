import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../core/types.ts';
import { EVENT_SOUND, SOUND_DEFS, Sfx, soundsForEvents } from './sfx.ts';

function fakeContext(counter: { started: number }): AudioContext {
  const param = { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} };
  const fake = {
    currentTime: 0, state: 'running', resume: () => Promise.resolve(), destination: {},
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
    expect(ev({ type: 'extraLife' }, { type: 'goal', bonusCrystals: 0, extraLife: true })).toEqual(['goal']);
  });
  it('ohne goal bleibt extraLife; unbekannte Events schweigen', () => {
    expect(ev({ type: 'extraLife' }, { type: 'land' })).toEqual(['extraLife']);
  });
});
