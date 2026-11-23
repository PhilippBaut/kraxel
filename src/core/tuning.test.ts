import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING, isDebug, loadTuning, saveTuning, TUNING_KEY } from './tuning.ts';

describe('Debug-Tuning', () => {
  it('isDebug', () => {
    expect(isDebug('?debug')).toBe(true);
    expect(isDebug('?level=x&debug')).toBe(true);
    expect(isDebug('?level=x')).toBe(false);
  });

  it('loadTuning übernimmt nur gültige bekannte Werte', () => {
    const store = { getItem: () => JSON.stringify({ walkSpeed: 100, foo: 1, runSpeed: 'x' }), setItem: () => {} };
    const t = loadTuning(store);
    expect(t.walkSpeed).toBe(100);
    expect(t.runSpeed).toBe(DEFAULT_TUNING.runSpeed);
    expect('foo' in t).toBe(false);
  });

  it('kaputter oder fehlender Speicher ergibt Standardwerte', () => {
    expect(loadTuning({ getItem: () => '{kaputt', setItem: () => {} })).toEqual(DEFAULT_TUNING);
    expect(loadTuning({ getItem: () => { throw new Error('privat'); }, setItem: () => {} })).toEqual(DEFAULT_TUNING);
    expect(loadTuning(null)).toEqual(DEFAULT_TUNING);
    expect(() => saveTuning({ getItem: () => null, setItem: () => { throw new Error('voll'); } }, DEFAULT_TUNING)).not.toThrow();
  });

  it('loadTuning liefert eine veränderbare Kopie, saveTuning schreibt unter TUNING_KEY', () => {
    const t = loadTuning(null);
    t.walkSpeed = 1;
    expect(DEFAULT_TUNING.walkSpeed).toBe(96);
    let saved: [string, string] | null = null;
    saveTuning({ getItem: () => null, setItem: (k, v) => { saved = [k, v]; } }, t);
    expect(saved![0]).toBe(TUNING_KEY);
    expect(JSON.parse(saved![1]).walkSpeed).toBe(1);
  });
});
