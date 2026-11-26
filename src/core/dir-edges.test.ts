import { describe, expect, it } from 'vitest';
import { DirEdges } from './dir-edges.ts';

const none = { left: false, right: false, up: false, down: false };

describe('DirEdges', () => {
  it('ein normaler Druck gibt genau eine Flanke', () => {
    const e = new DirEdges();
    e.seed(none);
    expect(e.step({ ...none, right: true })).toEqual(['right']);
    expect(e.step({ ...none, right: true })).toEqual([]);
    expect(e.step(none)).toEqual([]);
  });

  it('eine beim Betreten gehaltene Richtung gibt erst nach Loslassen und erneutem Druck eine Flanke', () => {
    const e = new DirEdges();
    e.seed({ ...none, right: true });
    expect(e.step({ ...none, right: true })).toEqual([]);
    expect(e.step({ ...none, right: true })).toEqual([]);
    expect(e.step(none)).toEqual([]);
    expect(e.step({ ...none, right: true })).toEqual(['right']);
  });

  it('mehrere gleichzeitig gedrückte Richtungen kommen in fester Reihenfolge', () => {
    const e = new DirEdges();
    e.seed(none);
    expect(e.step({ left: true, right: false, up: false, down: true })).toEqual(['left', 'down']);
  });
});
