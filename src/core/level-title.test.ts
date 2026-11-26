import { describe, expect, it } from 'vitest';
import { levelTitle } from './level-title.ts';

describe('Titelkarte des Levels', () => {
  it('Kennung und Name in Großbuchstaben', () => {
    expect(levelTitle('1-2', 'Blumenhang')).toBe('1-2 BLUMENHANG');
  });
  it('ß wird zu SS', () => {
    expect(levelTitle('1-4', 'Große Wand')).toBe('1-4 GROSSE WAND');
  });
  it('Umlaute bleiben, Zusatz im Namen bleibt stehen', () => {
    expect(levelTitle('1-3', 'Über (Baustelle)')).toBe('1-3 ÜBER (BAUSTELLE)');
  });
  it('Dev-Level ohne Nummer zeigen nur den Namen, ohne name: nur die Kennung', () => {
    expect(levelTitle('uebungsplatz', 'Übungsplatz')).toBe('ÜBUNGSPLATZ');
    expect(levelTitle('t', 't')).toBe('T');
  });
});
