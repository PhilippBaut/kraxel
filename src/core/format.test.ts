import { describe, expect, it } from 'vitest';
import { formatTime } from './format.ts';

describe('Zeitanzeige', () => {
  it('formatTime', () => { expect(formatTime(83.456)).toBe('1:23.45'); expect(formatTime(5)).toBe('0:05.00'); expect(formatTime(600)).toBe('10:00.00'); });

  it('rundet auf Hundertstel ab, auch bei Gleitkomma-Resten', () => {
    expect(formatTime(1.15)).toBe('0:01.15');
    expect(formatTime(59.999)).toBe('0:59.99');
    expect(formatTime(69 / 60)).toBe('0:01.15');
  });

  it('ohne Hundertstel als m:ss für die Info-Leiste', () => {
    expect(formatTime(83.456, false)).toBe('1:23');
    expect(formatTime(59.999, false)).toBe('0:59');
    expect(formatTime(0, false)).toBe('0:00');
  });

  it('negative oder ungültige Zeit zeigt 0', () => {
    expect(formatTime(-3)).toBe('0:00.00');
    expect(formatTime(Number.NaN)).toBe('0:00.00');
  });
});
