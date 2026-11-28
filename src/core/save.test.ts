import { describe, expect, it } from 'vitest';
import { SAVE_KEY, SAVE_KEY_V1, defaultSave, loadSave, recordEdelweiss, recordResult, safeStorage, withLastNode, writeSave } from './save.ts';

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
    expect(loadSave({ getItem: () => JSON.stringify({ version: 2, levels: 5, muted: false, musicMuted: false, lastNode: null }), setItem: () => {} })).toEqual(defaultSave());
    expect(loadSave({ getItem: () => JSON.stringify({ version: 2, levels: {}, muted: 'ja', musicMuted: false, lastNode: null }), setItem: () => {} })).toEqual(defaultSave());
  });

  it('Schreiben wirft nie', () => { expect(() => writeSave({ getItem: () => null, setItem: () => { throw new Error('voll'); } }, defaultSave())).not.toThrow(); });

  it('Bestzeit und Edelweiß zusammenführen', () => {
    let r = recordResult(defaultSave(), '1-1', 90, [true, false, false]); expect(r.newBest).toBe(true);
    r = recordResult(r.data, '1-1', 95, [false, true, false]); expect(r.newBest).toBe(false);
    expect(r.data.levels['1-1']).toEqual({ bestTime: 90, edelweiss: [true, true, false], completed: true, exits: { normal: true, secret: false } });
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
    expect(fresh.levels['1-1']).toEqual({ bestTime: null, edelweiss: [false, true, false], completed: false, exits: { normal: false, secret: false } });
    const done = recordResult(defaultSave(), '1-1', 90, [true, false, false]).data;
    const before = JSON.stringify(done);
    const merged = recordEdelweiss(done, '1-1', [false, false, true]);
    expect(merged.levels['1-1']).toEqual({ bestTime: 90, edelweiss: [true, false, true], completed: true, exits: { normal: true, secret: false } });
    expect(JSON.stringify(done)).toBe(before);
    expect(recordEdelweiss({ ...defaultSave(), muted: true }, '1-1', [false, false, false]).muted).toBe(true);
  });

  it('speichern und wieder laden', () => { const s = mem(); const d = recordResult(defaultSave(), '1-1', 80, [true, true, true]).data; writeSave(s, d); expect(loadSave(s)).toEqual(d); });

  const v1Stand = { version: 1, levels: { '1-1': { bestTime: 83.5, edelweiss: [true, false, true], completed: true } }, muted: true };
  const v2Stand = { ...defaultSave(), muted: false, lastNode: '1-2' };

  it('v1-Stand wird übernommen: completed zählt als normaler Ausgang', () => {
    const s = mem(); s.setItem(SAVE_KEY_V1, JSON.stringify(v1Stand));
    const d = loadSave(s);
    expect(d.version).toBe(2); expect(d.muted).toBe(true); expect(d.musicMuted).toBe(false); expect(d.lastNode).toBeNull();
    expect(d.levels['1-1']).toEqual({ bestTime: 83.5, edelweiss: [true, false, true], completed: true, exits: { normal: true, secret: false } });
  });

  it('v1-Level ohne Abschluss bekommt keinen Ausgang', () => {
    const s = mem(); s.setItem(SAVE_KEY_V1, JSON.stringify({ version: 1, levels: { '1-2': { bestTime: null, edelweiss: [true, false, false], completed: false } }, muted: false }));
    expect(loadSave(s).levels['1-2']).toEqual({ bestTime: null, edelweiss: [true, false, false], completed: false, exits: { normal: false, secret: false } });
  });

  it('v2 hat Vorrang vor v1', () => {
    const s = mem(); s.setItem(SAVE_KEY_V1, JSON.stringify(v1Stand)); s.setItem(SAVE_KEY, JSON.stringify(v2Stand));
    const d = loadSave(s);
    expect(d).toEqual(v2Stand); expect(d.levels['1-1']).toBeUndefined();
  });

  it('kaputter v2 mit gültigem v1 → v1 migriert; beides kaputt → Standard', () => {
    const s = mem(); s.setItem(SAVE_KEY, '{kaputt'); s.setItem(SAVE_KEY_V1, JSON.stringify(v1Stand));
    expect(loadSave(s).levels['1-1'].completed).toBe(true);
    const t = mem(); t.setItem(SAVE_KEY, '{kaputt'); t.setItem(SAVE_KEY_V1, '[1');
    expect(loadSave(t)).toEqual(defaultSave());
  });

  it('falsche Form in v2 (exits fehlt, lastNode keine Zeichenkette) → Standard bzw. v1', () => {
    const ohneExits = { ...v2Stand, levels: { '1-1': { bestTime: 1, edelweiss: [false, false, false], completed: true } } };
    const s = mem(); s.setItem(SAVE_KEY, JSON.stringify(ohneExits));
    expect(loadSave(s)).toEqual(defaultSave());
    s.setItem(SAVE_KEY_V1, JSON.stringify(v1Stand));
    expect(loadSave(s).levels['1-1'].exits).toEqual({ normal: true, secret: false });
    const t = mem(); t.setItem(SAVE_KEY, JSON.stringify({ ...v2Stand, lastNode: 5 }));
    expect(loadSave(t)).toEqual(defaultSave());
    const u = mem(); u.setItem(SAVE_KEY, JSON.stringify({ ...v2Stand, musicMuted: 'ja' }));
    expect(loadSave(u)).toEqual(defaultSave());
  });

  it('geheimer Ausgang setzt exits.secret, nicht exits.normal', () => {
    const r = recordResult(defaultSave(), '1-3', 70, [false, false, false], 'secret');
    expect(r.data.levels['1-3'].exits).toEqual({ normal: false, secret: true }); expect(r.data.levels['1-3'].completed).toBe(true);
  });

  it('Ausgänge bleiben unabhängig und die Bestzeit zählt für beide', () => {
    const a = recordResult(defaultSave(), '1-3', 80, [false, false, false], 'secret');
    const b = recordResult(a.data, '1-3', 75, [false, false, false]);
    expect(b.newBest).toBe(true); expect(b.data.levels['1-3'].bestTime).toBe(75);
    expect(b.data.levels['1-3'].exits).toEqual({ normal: true, secret: true });
    const c = recordResult(b.data, '1-3', 90, [false, false, false], 'secret');
    expect(c.data.levels['1-3'].exits).toEqual({ normal: true, secret: true });
  });

  it('withLastNode speichert den Punkt, writeSave schreibt nur v2', () => {
    const s = mem(); s.setItem(SAVE_KEY_V1, 'alt');
    const d = withLastNode(defaultSave(), '1-2');
    expect(d.lastNode).toBe('1-2'); expect(defaultSave().lastNode).toBeNull();
    writeSave(s, d);
    expect(s.getItem(SAVE_KEY)).not.toBeNull(); expect(s.getItem(SAVE_KEY_V1)).toBe('alt');
    expect(loadSave(s).lastNode).toBe('1-2');
  });

  it('recordResult und recordEdelweiss erhalten musicMuted und lastNode', () => {
    const d = { ...defaultSave(), musicMuted: true, lastNode: '1-1' };
    const r = recordResult(d, '1-1', 50, [false, false, false]).data;
    expect(r.musicMuted).toBe(true); expect(r.lastNode).toBe('1-1');
    const e = recordEdelweiss(d, '1-1', [true, false, false]);
    expect(e.musicMuted).toBe(true); expect(e.lastNode).toBe('1-1');
  });

  it('safeStorage ist in Node ohne localStorage null und wirft nicht', () => {
    expect(safeStorage()).toBeNull();
  });
});

describe('Speicherstand: Fassung von 1-F (levelRevs)', () => {
  const rec = (bestTime: number | null, normal: boolean) => ({ bestTime, edelweiss: [false, false, false], completed: normal, exits: { normal, secret: false } });
  /** Stand aus der Zeit des Platzhalters: 1-F in 10 s „geschafft“, ohne levelRevs. */
  const alterStand = () => {
    const d: Record<string, unknown> = { ...defaultSave(), levels: { '1-1': rec(60, true), '1-2': rec(70, true), '1-3': rec(80, true), '1-4': rec(90, true), '1-F': rec(10, true) }, muted: true, musicMuted: true, lastNode: 'teaser' };
    delete d.levelRevs;
    return d;
  };
  const laden = (d: unknown) => loadSave({ getItem: () => JSON.stringify(d), setItem: () => {} });

  it('der Standardstand trägt die Fassung 1 für 1-F', () => {
    expect(defaultSave().levelRevs).toEqual({ '1-F': 1 });
  });
  it('ein Stand mit Platzhalter-1-F und ohne levelRevs verliert nur 1-F; 1-1 bis 1-4 und Einstellungen bleiben', () => {
    const d = laden(alterStand());
    expect(Object.keys(d.levels).sort()).toEqual(['1-1', '1-2', '1-3', '1-4']);
    expect(d.levels['1-4']).toEqual(rec(90, true));
    expect(d.muted).toBe(true); expect(d.musicMuted).toBe(true);
    expect(d.levelRevs).toEqual({ '1-F': 1 });
  });
  it('lastNode auf dem nun gesperrten Teaser wird auf die Festung zurückgesetzt, andere Punkte bleiben', () => {
    expect(laden(alterStand()).lastNode).toBe('1-F');
    expect(laden({ ...alterStand(), lastNode: '1-2' }).lastNode).toBe('1-2');
  });
  it('zweimal laden ist stabil: der geschriebene Stand lädt gleich wieder', () => {
    const store = mem();
    store.setItem(SAVE_KEY, JSON.stringify(alterStand()));
    const a = loadSave(store);
    writeSave(store, a);
    const b = loadSave(store);
    expect(b).toEqual(a);
    expect(loadSave(store)).toEqual(b);
  });
  it('ein Stand mit levelRevs 1-F = 1 behält seinen echten 1-F-Eintrag', () => {
    const d = laden({ ...alterStand(), levelRevs: { '1-F': 1 }, lastNode: 'teaser' });
    expect(d.levels['1-F']).toEqual(rec(10, true));
    expect(d.lastNode).toBe('teaser');
  });
  it('die Übernahme von v1 endet mit levelRevs', () => {
    const t = mem();
    t.setItem(SAVE_KEY_V1, JSON.stringify({ version: 1, muted: true, levels: { '1-1': { bestTime: 50, edelweiss: [true, false, false], completed: true } } }));
    const d = loadSave(t);
    expect(d.levelRevs).toEqual({ '1-F': 1 });
    expect(d.levels['1-1']!.exits.normal).toBe(true);
  });
  it('kaputte levelRevs werfen nie und gelten als fehlend', () => {
    for (const bad of [5, 'x', null, [], { '1-F': 'eins' }, { '1-F': null }, { '1-F': Infinity }]) {
      let d: ReturnType<typeof loadSave> | undefined;
      expect(() => { d = laden({ ...alterStand(), levelRevs: bad }); }, JSON.stringify(bad)).not.toThrow();
      expect(d!.levels['1-F'], JSON.stringify(bad)).toBeUndefined();
      expect(d!.levelRevs).toEqual({ '1-F': 1 });
    }
  });
  it('recordResult, recordEdelweiss und withLastNode erhalten levelRevs', () => {
    const d = defaultSave();
    expect(recordResult(d, '1-1', 50, [false, false, false]).data.levelRevs).toEqual({ '1-F': 1 });
    expect(recordEdelweiss(d, '1-1', [true, false, false]).levelRevs).toEqual({ '1-F': 1 });
    expect(withLastNode(d, '1-1').levelRevs).toEqual({ '1-F': 1 });
  });
});
