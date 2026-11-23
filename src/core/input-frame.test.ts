import { describe, expect, it } from 'vitest';
import { InputSampler } from './input-frame.ts';
import { held } from './test-helpers.ts';

describe('InputSampler', () => {
  it('Flanken nur im ersten Schritt', () => {
    const s = new InputSampler();
    expect(s.sample(held({ jump: true })).jumpPressed).toBe(true);
    expect(s.sample(held({ jump: true })).jumpPressed).toBe(false);
    expect(s.sample(held()).jumpReleased).toBe(true);
    expect(s.sample(held()).jumpReleased).toBe(false);
  });
  it('down und action haben ebenfalls Flanken', () => {
    const s = new InputSampler();
    const f = s.sample(held({ down: true, action: true }));
    expect(f.downPressed && f.actionPressed).toBe(true);
    const g = s.sample(held({ down: true, action: true }));
    expect(g.downPressed || g.actionPressed).toBe(false);
  });
});
