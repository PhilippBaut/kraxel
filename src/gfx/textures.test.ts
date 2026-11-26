import { describe, expect, it } from 'vitest';
import { buttonTextureKeys, roundButtonKey } from './textures.ts';

describe('buttonTextureKeys', () => {
  it('16 Schlüssel fürs Steuerkreuz, 2 für runde Knöpfe, alle verschieden', () => {
    expect(new Set(buttonTextureKeys('dpad', 50)).size).toBe(16);
    expect(buttonTextureKeys('jump', 33)).toEqual([roundButtonKey('jump', 33, false), roundButtonKey('jump', 33, true)]);
    expect(buttonTextureKeys('action', 20)).toEqual([roundButtonKey('action', 20, false), roundButtonKey('action', 20, true)]);
  });
});
