import { describe, expect, it } from 'vitest';
import { isShortcut, KEYMAP } from './keyboard.ts';

describe('KEYMAP', () => {
  it('Y springt (deutsche Tastatur)', () => {
    expect(KEYMAP.KeyY).toBe('jump');
    expect(KEYMAP.Space).toBe('jump');
    expect(KEYMAP.Escape).toBe('pause');
  });
  it('Richtungen und Aktion', () => {
    expect(KEYMAP.ArrowLeft).toBe('left');
    expect(KEYMAP.KeyD).toBe('right');
    expect(KEYMAP.KeyW).toBe('up');
    expect(KEYMAP.KeyS).toBe('down');
    expect(KEYMAP.KeyX).toBe('action');
    expect(KEYMAP.KeyP).toBe('pause');
  });
  it('Cmd/Strg/Alt sind Browser-Kürzel', () => {
    const n = { metaKey: false, ctrlKey: false, altKey: false };
    expect(isShortcut(n)).toBe(false);
    expect(isShortcut({ ...n, metaKey: true })).toBe(true);
    expect(isShortcut({ ...n, ctrlKey: true })).toBe(true);
    expect(isShortcut({ ...n, altKey: true })).toBe(true);
  });
});
