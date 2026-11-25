import { describe, expect, it } from 'vitest';
import { defaultSave, loadSave, recordEdelweiss, recordResult, safeStorage, writeSave } from './save.ts';

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

describe('Speicherstand', () => {
  it('fehlend, kaputt oder falsche Version ergibt Standard', () => {
    expect(loadSave(mem())).toEqual(defaultSave());
    expect(loadSave({ getItem: () => '{x', setItem: () => {} })).toEqual(defaultSave());
    expect(loadSave({ getItem: () => JSON.stringify({ version: 9 }), setItem: () => {} })).toEqual(defaultSave());
    expect(loadSave({ getItem: () => { throw new Error(); }, setItem: () => {} })).toEqual(defaultSave());
    expect(loadSave(null)).toEqual(defaultSave());
  });

  it('falsche Form ergibt Standard', () => {
    expect(loadSave({ getItem: () => JSON.stringify({ version: 1, levels: 5, muted: false }), setItem: () => {} })).toEqual(defaultSave());
    expect(loadSave({ getItem: () => JSON.stringify({ version: 1, levels: {}, muted: 'ja' }), setItem: () => {} })).toEqual(defaultSave());
  });

  it('Schreiben wirft nie', () => { expect(() => writeSave({ getItem: () => null, setItem: () => { throw new Error('voll'); } }, defaultSave())).not.toThrow(); });

  it('Bestzeit und Edelweiß zusammenführen', () => {
    let r = recordResult(defaultSave(), '1-1', 90, [true, false, false]); expect(r.newBest).toBe(true);
    r = recordResult(r.data, '1-1', 95, [false, true, false]); expect(r.newBest).toBe(false);
    expect(r.data.levels['1-1']).toEqual({ bestTime: 90, edelweiss: [true, true, false], completed: true });
  });

  it('kürzere Zeit ist neue Bestzeit', () => {
    const first = recordResult(defaultSave(), '1-1', 90, [false, false, false]);
    const second = recordResult(first.data, '1-1', 70, [false, false, false]);
    expect(second.newBest).toBe(true);
    expect(second.data.levels['1-1'].bestTime).toBe(70);
  });

  it('recordResult verändert die Eingabe nicht', () => {
    const before = defaultSave();
    const snapshot = JSON.stringify(before);
    recordResult(before, '1-1', 80, [true, true, true]);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('recordEdelweiss vereinigt Edelweiß ohne Abschluss und Bestzeit', () => {
    const fresh = recordEdelweiss(defaultSave(), '1-1', [false, true, false]);
    expect(fresh.levels['1-1']).toEqual({ bestTime: null, edelweiss: [false, true, false], completed: false });
    const done = recordResult(defaultSave(), '1-1', 90, [true, false, false]).data;
    const before = JSON.stringify(done);
    const merged = recordEdelweiss(done, '1-1', [false, false, true]);
    expect(merged.levels['1-1']).toEqual({ bestTime: 90, edelweiss: [true, false, true], completed: true });
    expect(JSON.stringify(done)).toBe(before);
    expect(recordEdelweiss({ ...defaultSave(), muted: true }, '1-1', [false, false, false]).muted).toBe(true);
  });

  it('speichern und wieder laden', () => { const s = mem(); const d = recordResult(defaultSave(), '1-1', 80, [true, true, true]).data; writeSave(s, d); expect(loadSave(s)).toEqual(d); });

  it('safeStorage ist in Node ohne localStorage null und wirft nicht', () => {
    expect(safeStorage()).toBeNull();
  });
});
