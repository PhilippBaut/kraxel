import { describe, expect, it } from 'vitest';
import { FixedStepper } from './stepper.ts';

describe('FixedStepper', () => {
  it('60 Hz: ein Schritt pro Frame', () => { expect(new FixedStepper().advance(1000 / 60)).toBe(1); });

  it('120 Hz: jeder zweite Frame', () => {
    const s = new FixedStepper();
    expect(s.advance(1000 / 120)).toBe(0);
    expect(s.advance(1000 / 120)).toBe(1);
  });

  it('nach Hintergrund höchstens 5 Schritte, Rest verworfen', () => {
    const s = new FixedStepper();
    expect(s.advance(1000)).toBe(5);
    expect(s.advance(1)).toBe(0);
  });

  it('30 Hz: zwei Schritte pro Frame', () => {
    const s = new FixedStepper();
    for (let i = 0; i < 10; i++) expect(s.advance(1000 / 30)).toBe(2);
  });

  it('144 Hz: über eine Sekunde genau 60 Schritte', () => {
    const s = new FixedStepper();
    let n = 0;
    for (let i = 0; i < 144; i++) n += s.advance(1000 / 144);
    expect(n).toBe(60);
  });

  it('eigene Schrittweite und Obergrenze', () => {
    const s = new FixedStepper(10, 3);
    expect(s.advance(25)).toBe(2);
    expect(s.advance(5)).toBe(1);
    expect(s.advance(100)).toBe(3);
    expect(s.advance(9)).toBe(0);
  });

  it('knapp neben 60 Hz (59,94 Hz, 61 Hz, Zittern) ergibt nie 0 oder 2 Schritte', () => {
    for (const frameMs of [1000 / 59.94, 1000 / 61, 16.4, 17.0, 17.4]) {
      const s = new FixedStepper();
      for (let i = 0; i < 2000; i++) expect(s.advance(frameMs), `${frameMs} ms, Bild ${i}`).toBe(1);
    }
  });

  it('weiter weg von 60 Hz wird nicht gerundet (50 Hz: fünf Schritte pro sechs Bilder)', () => {
    const s = new FixedStepper();
    let n = 0;
    for (let i = 0; i < 300; i++) n += s.advance(20);
    expect(n).toBe(360);
  });
});
