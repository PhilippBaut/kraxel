import { describe, expect, it } from 'vitest';
import { STEP, TILE } from '../config.ts';
import { BOSS_LIE, createBoss, stepBoss, summitSpawn } from './boss.ts';
import type { BossPhase } from './boss.ts';
import { killPlayer, respawn, stepGame } from './game.ts';
import type { GameState } from './game.ts';
import { InputSampler } from './input-frame.ts';
import { LevelError, parseLevel, validateLevel } from './level.ts';
import { DEFAULT_TUNING } from './tuning.ts';
import type { GameEvent } from './types.ts';
import { gameFrom, held, placePlayer, runGame } from './test-helpers.ts';

/** Arena Spalte 2 bis 17 (16 breit), Tür in Spalte 1, rechte Mauer in Spalte 18 (Prüfung verlangt sie). Murmelkönig X unten links in Spalte 14, Reihe 10 (Körper: Spalten 14-15, Reihen 9-10).
 *  Start P liegt links der Arena. Boden in Reihe 11, Decke in Reihe 0. */
const ROWS = [
  '####################',
  ...Array(9).fill('#.................##'),
  '#P............X...##',
  '####################',
];
const HEADER = ['arena: 2 17'];
const types = (ev: Array<{ type: string }>) => ev.map((e) => e.type);
const steps = (sec: number) => Math.round(sec / STEP);

function arena(): GameState {
  const s = gameFrom(ROWS, undefined, HEADER);
  placePlayer(s, 4, 10); // schon in der Arena: die Tür schließt im ersten Schritt
  return s;
}
const boss = (s: GameState) => s.boss!;
const bossCx = (s: GameState) => boss(s).body.x + boss(s).body.w / 2;
const playerCx = (s: GameState) => s.player.body.x + s.player.body.w / 2;

/** Schritt für Schritt, bis `done` gilt (höchstens `max` Schritte); liefert Ereignisse und Schrittzahl. */
function until(s: GameState, done: () => boolean, max: number, input: Partial<Parameters<typeof held>[0]> = {}) {
  const events: GameEvent[] = [];
  let n = 0;
  while (!done() && n < max) {
    events.push(...runGame(s, [[input, 1]]));
    n++;
  }
  return { events, n };
}

/** Setzt den Murmelkönig in eine Phase (Zeit 0). */
function setPhase(s: GameState, phase: BossPhase, t = 0): void {
  boss(s).phase = phase;
  boss(s).t = t;
}

/** Kraxel fällt von oben auf den Kopf des Murmelkönigs. */
function dropOnHead(s: GameState): void {
  placePlayer(s, 14, 7);
  s.player.body.vy = 100;
}

describe('Murmelkönig: Aufbau im Level', () => {
  it('X und Kopfzeile arena erzeugen Boss und Arena; Tür offen', () => {
    const s = gameFrom(ROWS, undefined, HEADER);
    expect(s.level.arena).toEqual({ x0: 2, x1: 17 });
    expect(s.arena).toEqual({ x0: 2, x1: 17, closed: false });
    const b = boss(s);
    expect(b).toMatchObject({ phase: 'wait', t: 0, hits: 0, invuln: 0, throwsLeft: 0, rocks: [] });
    // X ist die Zelle unten links des 2x2-Körpers.
    expect(b.body).toMatchObject({ x: 14 * TILE, y: 11 * TILE - 32, w: 32, h: 32 });
    expect(b.moundX).toBe(14 * TILE + 16);
    expect(s.grid.isSolid(1, 5)).toBe(false);
  });
  it('ohne X gibt es keinen Murmelkönig, ohne arena keine Arena', () => {
    const s = gameFrom(['P..', '###']);
    expect(s.boss).toBeNull();
    expect(s.arena).toBeNull();
  });
  it('createBoss stellt den Körper auf die Zelle', () => {
    const b = createBoss({ kind: 'boss', cx: 5, cy: 3, index: 0 });
    expect(b.body).toMatchObject({ x: 5 * TILE, y: 4 * TILE - 32 });
    expect(b.floorY).toBe(4 * TILE);
  });
});

describe('Murmelkönig: Prüfung der Kopfzeile und von X', () => {
  const text = (rows: string[], header = HEADER) => ['name: t', 'world: 1', ...header, '---', ...rows].join('\n');
  const check = (rows: string[], header = HEADER, requireGoal = true) =>
    validateLevel(parseLevel('t', text(rows, header)), { requireEdelweiss: false, requireGoal });

  it('ein gültiges Bosslevel braucht kein Z: X zählt als Ziel', () => {
    expect(check(ROWS)).toEqual([]);
  });
  it('arena muss genau 16 breit sein und im Level liegen', () => {
    expect(check(ROWS, ['arena: 2 16']).join('|')).toMatch(/16/);
    expect(check(ROWS, ['arena: 6 21']).join('|')).toMatch(/Level/);
    expect(() => parseLevel('t', text(ROWS, ['arena: 2']))).toThrow(LevelError);
    expect(() => parseLevel('t', text(ROWS, ['arena: a b']))).toThrow(LevelError);
  });
  it('X braucht eine arena und liegt darin', () => {
    expect(check(ROWS, []).join('|')).toMatch(/arena/);
    const rows = [...ROWS];
    rows[10] = '#X..............P..#';
    expect(check(rows).join('|')).toMatch(/Arena/);
  });
  it('X höchstens einmal', () => {
    const rows = [...ROWS];
    rows[10] = '#P....X.......X....#';
    expect(check(rows).join('|')).toMatch(/höchstens einmal/);
  });
  it('arena ohne X ist ein Fehler', () => {
    const rows = [...ROWS];
    rows[10] = '#P.................#';
    expect(check(rows).join('|')).toMatch(/braucht/);
  });
  it('in der Arena darf kein Z stehen', () => {
    const rows = [...ROWS];
    rows[10] = '#P.....Z......X....#';
    expect(check(rows).join('|')).toMatch(/Z/);
  });
  it('mit X darf Z auch außerhalb der Arena nicht vorkommen (nur ein Ausgang)', () => {
    const rows = [...ROWS];
    rows[10] = '#Z............X....#'; // Z in Spalte 1, außerhalb der Arena
    const p = check(rows).join('|');
    expect(p).toMatch(/Z bei 1,10/);
    expect(check(rows, HEADER, false).join('|')).toMatch(/Z bei 1,10/);
  });
  it('über dem Arenaboden müssen 5 Kacheln frei sein, quer über die ganze Arena', () => {
    const low = [...ROWS];
    low[6] = '#' + '.'.repeat(5) + '#' + '.'.repeat(12) + '#'; // Brocken in Reihe 6 (5 Kacheln über Reihe 11), Spalte 6
    expect(check(low).join('|')).toMatch(/5 freie Kacheln/);
    const ok = [...ROWS];
    ok[5] = '#' + '.'.repeat(5) + '#' + '.'.repeat(12) + '#'; // Reihe 5 ist schon die sechste Kachel
    expect(check(ok)).toEqual([]);
  });
  it('X braucht Platz und Boden unter dem Körper', () => {
    const rows = [...ROWS];
    rows[9] = '#' + '.'.repeat(14) + '#' + '.'.repeat(3) + '#';
    expect(check(rows).join('|')).toMatch(/Murmelkönig/);
  });
  it('ohne requireGoal braucht ein Bosslevel kein Ziel', () => {
    expect(check(ROWS, HEADER, false)).toEqual([]);
  });
});

describe('Arena: Tür', () => {
  it('draußen bleibt sie offen, beim Betreten schließt sie sich hinter Kraxel', () => {
    const s = gameFrom(ROWS, undefined, HEADER);
    placePlayer(s, 1, 10);
    const ev = runGame(s, [[{}, 5]]);
    expect(s.arena!.closed).toBe(false);
    expect(types(ev)).not.toContain('arenaClose');
    runGame(s, [[{ right: true }, 40]]);
    expect(s.arena!.closed).toBe(true);
    expect(s.grid.isSolid(1, 10)).toBe(true);
    expect(s.grid.isSolid(1, 1)).toBe(true);
    expect(s.grid.isSolid(1, 0)).toBe(true);
    expect(s.grid.isSolid(2, 5)).toBe(false); // innen bleibt frei
    expect(playerCx(s)).toBeGreaterThan(2 * TILE);
  });
  it('das Schließen meldet arenaClose genau einmal', () => {
    const s = gameFrom(ROWS, undefined, HEADER);
    placePlayer(s, 3, 10);
    const ev = runGame(s, [[{}, 30]]);
    expect(types(ev).filter((x) => x === 'arenaClose')).toHaveLength(1);
  });
  it('Respawn öffnet die Tür wieder und setzt den Murmelkönig zurück', () => {
    const s = arena();
    runGame(s, [[{}, 5]]);
    expect(s.arena!.closed).toBe(true);
    const b = boss(s);
    b.hits = 2;
    b.phase = 'throw';
    b.invuln = 0.5;
    b.body.x = 100;
    b.moundX = 50;
    b.rocks.push({ x: 0, y: 0, w: 8, h: 8, vx: 0, vy: 0 });
    killPlayer(s);
    respawn(s);
    expect(s.arena!.closed).toBe(false);
    expect(s.grid.isSolid(1, 10)).toBe(false);
    expect(boss(s)).toMatchObject({ phase: 'wait', t: 0, hits: 0, invuln: 0, throwsLeft: 0, rocks: [] });
    expect(boss(s).body.x).toBe(14 * TILE);
    expect(boss(s)).not.toBe(b);
    const start = { x: 1 * TILE + (TILE - s.player.body.w) / 2, y: 11 * TILE - s.player.body.h };
    expect(s.player.body).toMatchObject(start);
    expect(s.phase).toBe('playing');
  });
  it('vor dem Schließen ruht der Murmelkönig', () => {
    const s = gameFrom(ROWS, undefined, HEADER);
    placePlayer(s, 1, 10);
    runGame(s, [[{}, 120]]);
    expect(boss(s)).toMatchObject({ phase: 'wait', t: 0 });
  });
});

describe('Murmelkönig: Phasenfolge', () => {
  it('Warten 1,0 s, Eingraben 0,4 s, Hügel höchstens 2,5 s, Beben 0,5 s, Springen, Benommen 1,2 s, Steinwurf 0,4 s, zurück zu Warten', () => {
    const s = arena();
    placePlayer(s, 3, 10);
    s.player.enzian = 999; // Kraxel bleibt heil; es geht um die Zeiten
    const seen: Array<{ phase: BossPhase; n: number }> = [];
    let n = 0, last: BossPhase | null = null;
    const events: GameEvent[] = [];
    while (n < 900 && !(seen.length >= 8)) {
      events.push(...runGame(s, [[{}, 1]]));
      n++;
      if (boss(s).phase !== last) {
        last = boss(s).phase;
        seen.push({ phase: last, n });
      }
    }
    const order = seen.map((x) => x.phase);
    expect(order.slice(0, 8)).toEqual(['wait', 'dig', 'mound', 'tremble', 'pop', 'stunned', 'throw', 'wait']);
    const dur = (i: number) => seen[i + 1]!.n - seen[i]!.n;
    // Der erste Schritt zählt schon zu "wait" (die Tür schließt dabei), daher ein Schritt Spielraum.
    expect(Math.abs(dur(0) - steps(1.0))).toBeLessThanOrEqual(1);
    expect(Math.abs(dur(1) - steps(0.4))).toBeLessThanOrEqual(1);
    expect(Math.abs(dur(2) - steps(2.5))).toBeLessThanOrEqual(1); // Kraxel ist weit weg: der Hügel läuft die vollen 2,5 s
    expect(Math.abs(dur(3) - steps(0.5))).toBeLessThanOrEqual(1);
    expect(dur(4)).toBeGreaterThan(steps(0.4)); // ca. 3 Kacheln Sprunghöhe
    expect(dur(4)).toBeLessThan(steps(1));
    expect(Math.abs(dur(5) - steps(1.2))).toBeLessThanOrEqual(1);
    expect(Math.abs(dur(6) - steps(0.6))).toBeLessThanOrEqual(1);
    expect(types(events)).toEqual(expect.arrayContaining(['bossDig', 'bossPop', 'bossThrow']));
  });
  it('der Sprung ist etwa 3 Kacheln hoch', () => {
    const s = arena();
    s.player.enzian = 999;
    setPhase(s, 'tremble', 0.49);
    let minY = boss(s).body.y;
    const base = boss(s).body.y;
    for (let i = 0; i < 80 && boss(s).phase !== 'stunned'; i++) {
      runGame(s, [[{}, 1]]);
      minY = Math.min(minY, boss(s).body.y);
    }
    expect(base - minY).toBeGreaterThan(2.7 * TILE);
    expect(base - minY).toBeLessThan(3.3 * TILE);
    expect(boss(s).body.y).toBe(base); // landet wieder auf dem Boden
  });
  it('bossDig beim Eingraben, bossPop beim Herausspringen', () => {
    const s = arena();
    s.player.enzian = 999;
    setPhase(s, 'wait', 0.99);
    const ev1 = runGame(s, [[{}, 3]]);
    expect(types(ev1)).toContain('bossDig');
    expect(boss(s).phase).toBe('dig');
    setPhase(s, 'tremble', 0.49);
    const ev2 = runGame(s, [[{}, 3]]);
    expect(types(ev2)).toContain('bossPop');
  });
});

describe('Murmelkönig: Hügel', () => {
  it('der Hügel wandert mit 3 Kacheln/s auf Kraxel zu und folgt ihm', () => {
    const s = arena();
    s.player.enzian = 999;
    setPhase(s, 'mound');
    boss(s).moundX = 120;
    placePlayer(s, 3, 10); // links
    runGame(s, [[{}, 30]]);
    expect(boss(s).moundX).toBeCloseTo(120 - 3 * TILE * 0.5, 0);
    placePlayer(s, 16, 10); // rechts davon
    const before = boss(s).moundX;
    runGame(s, [[{}, 30]]);
    expect(boss(s).moundX).toBeCloseTo(before + 3 * TILE * 0.5, 0);
  });
  it('erreicht der Hügel Kraxel, bebt er an der Stelle, auch vor Ablauf der 2,5 s', () => {
    const s = arena();
    s.player.enzian = 999;
    setPhase(s, 'mound');
    boss(s).moundX = 100;
    placePlayer(s, 6, 10);
    until(s, () => boss(s).phase === 'tremble', 100);
    expect(boss(s).phase).toBe('tremble');
    expect(boss(s).t).toBeLessThan(0.1);
    expect(boss(s).moundX).toBeCloseTo(playerCx(s), 0);
    const x = boss(s).moundX;
    placePlayer(s, 12, 10);
    runGame(s, [[{}, 20]]);
    expect(boss(s).moundX).toBe(x); // beim Beben bleibt er stehen
  });
  it('der Hügel bleibt in der Arena', () => {
    const s = arena();
    s.player.enzian = 999;
    setPhase(s, 'mound');
    boss(s).moundX = 5 * TILE;
    placePlayer(s, 3, 10);
    s.player.body.x = 2 * TILE; // ganz links
    runGame(s, [[{}, 5]]);
    expect(boss(s).moundX).toBeGreaterThanOrEqual(2 * TILE + 16);
  });
  it('der Hügel selbst ist harmlos', () => {
    const s = arena();
    s.player.helm = true;
    setPhase(s, 'mound');
    boss(s).moundX = 100;
    placePlayer(s, 6, 10);
    const ev = runGame(s, [[{}, 20]]);
    expect(types(ev)).not.toContain('hurt');
  });
});

describe('Murmelkönig: Herausspringen trifft nur an der Stelle', () => {
  it('wer beim Herausspringen im Körper steht, wird getroffen', () => {
    const s = arena();
    s.player.helm = true;
    setPhase(s, 'tremble', 0.49);
    boss(s).moundX = 8 * TILE + 8;
    placePlayer(s, 8, 10);
    const ev = runGame(s, [[{}, 10]]);
    expect(types(ev)).toContain('hurt');
    expect(s.player.helm).toBe(false);
  });
  it('wer drei Kacheln daneben steht, wird nicht getroffen', () => {
    const s = arena();
    s.player.helm = true;
    setPhase(s, 'tremble', 0.49);
    boss(s).moundX = 8 * TILE + 8;
    placePlayer(s, 5, 10);
    const ev = runGame(s, [[{}, 80]]);
    expect(types(ev)).not.toContain('hurt');
    expect(types(ev)).toContain('bossPop');
  });
});

describe('Murmelkönig: Treffer', () => {
  it('in Benommen zählt Landen auf dem Kopf: Treffer, Schonzeit bis zum Ende der Benommenheit (mindestens 0,8 s), Kraxel prallt ab', () => {
    const s = arena();
    setPhase(s, 'stunned');
    dropOnHead(s);
    const { events } = until(s, () => boss(s).hits > 0, 60);
    expect(events).toContainEqual({ type: 'bossHit', hits: 1 });
    expect(types(events)).toContain('stomp');
    expect(boss(s).hits).toBe(1);
    expect(boss(s).invuln).toBeGreaterThan(0.7);
    expect(boss(s).invuln).toBeLessThanOrEqual(1.2); // früh getroffen: bis zum Ende der 1,2 s Benommenheit
    expect(s.player.body.vy).toBeLessThan(0);
    expect(types(events)).not.toContain('hurt');
  });
  it('die Schonzeit läuft ab; währenddessen zählt kein zweiter Treffer', () => {
    const s = arena();
    setPhase(s, 'stunned');
    dropOnHead(s);
    until(s, () => boss(s).hits > 0, 60);
    dropOnHead(s);
    runGame(s, [[{}, 10]]);
    expect(boss(s).hits).toBe(1);
    runGame(s, [[{}, steps(1.2)]]);
    expect(boss(s).invuln).toBe(0);
  });
  it('ein Treffer je Benommenheit: wer früh trifft und den Sprung hält, prallt weiter auf dem Kopf ab, ohne einen zweiten Treffer (alle drei Fenster)', () => {
    const s = arena();
    const hitsSeen: number[] = [];
    for (let cycle = 0; cycle < 3; cycle++) {
      expect(boss(s).hits).toBe(cycle);
      setPhase(s, 'stunned');
      boss(s).invuln = 0;
      dropOnHead(s);
      const all: GameEvent[] = [];
      let bounces = 0, firstHitT = -1;
      // Das Fenster (1,2 s) fast ganz durchspielen; Sprung gehalten, damit Kraxel immer wieder hoch abprallt.
      for (let i = 0; i < steps(1.15) && boss(s).phase === 'stunned'; i++) {
        const ev = runGame(s, [[{ jump: true }, 1]]);
        if (types(ev).includes('bossHit') && firstHitT < 0) firstHitT = boss(s).t;
        bounces += ev.filter((e) => e.type === 'stomp').length;
        all.push(...ev);
      }
      expect(firstHitT, 'der erste Treffer fällt früh in die Benommenheit').toBeLessThanOrEqual(0.1 + 1e-6);
      const hitEvents = all.filter((e) => e.type === 'bossHit');
      expect(hitEvents, `Fenster ${cycle + 1}: genau ein Treffer`).toHaveLength(1);
      hitsSeen.push(...hitEvents.map((e) => (e.type === 'bossHit' ? e.hits : 0)));
      if (cycle < 2) expect(bounces, 'er prallt mehrmals ab').toBeGreaterThanOrEqual(2);
      expect(types(all), 'die Abpraller tun Kraxel nichts').not.toContain('hurt');
      expect(boss(s).invuln, 'er blinkt bis zum Ende der Benommenheit').toBeGreaterThan(0);
      if (cycle < 2) expect(boss(s).phase).toBe('stunned');
    }
    expect(hitsSeen).toEqual([1, 2, 3]);
    expect(boss(s).phase).toBe('defeated');
  });
  it('Stampfen in Benommen zählt auch', () => {
    const s = arena();
    setPhase(s, 'stunned');
    placePlayer(s, 14, 7);
    s.player.mode = 'pound';
    s.player.body.vy = 300;
    const { events } = until(s, () => boss(s).hits > 0, 60);
    expect(events).toContainEqual({ type: 'bossHit', hits: 1 });
  });
  it('ein Kopftreffer außerhalb von Benommen trifft Kraxel, nicht den Murmelkönig', () => {
    for (const phase of ['wait', 'dig', 'throw'] as const) {
      const s = arena();
      s.player.helm = true;
      setPhase(s, phase);
      dropOnHead(s);
      const ev = runGame(s, [[{}, 30]]);
      expect(types(ev)).toContain('hurt');
      expect(boss(s).hits).toBe(0);
      expect(types(ev)).not.toContain('bossHit');
    }
  });
  it('ohne Helm kostet die Berührung außerhalb von Benommen das Leben', () => {
    const s = arena();
    setPhase(s, 'wait');
    placePlayer(s, 14, 10);
    const lives = s.session.lives;
    runGame(s, [[{}, 3]]);
    expect(s.phase).toBe('dying');
    expect(s.session.lives).toBe(lives - 1);
  });
  it('in Benommen ist Seitenberührung harmlos', () => {
    const s = arena();
    s.player.helm = true;
    setPhase(s, 'stunned');
    placePlayer(s, 14, 10);
    const ev = runGame(s, [[{}, 10]]);
    expect(types(ev)).not.toContain('hurt');
    expect(boss(s).hits).toBe(0);
  });
  it('Kiesel prallen ab, ohne Wirkung', () => {
    for (const phase of ['wait', 'stunned'] as const) {
      const s = arena();
      s.player.special = 'sling';
      setPhase(s, phase);
      s.pebbles.push({ age: 0, body: { x: bossCx(s) - 2, y: boss(s).body.y + 12, w: 4, h: 4, vx: 0, vy: 0 } });
      const ev = runGame(s, [[{}, 2]]);
      expect(types(ev)).toContain('pebblePop');
      expect(s.pebbles).toHaveLength(0);
      expect(boss(s).hits).toBe(0);
      expect(types(ev)).not.toContain('bossHit');
      expect(boss(s).phase).toBe(phase);
    }
  });
  it('im Hügel fliegen Kiesel durch', () => {
    const s = arena();
    s.player.special = 'sling';
    setPhase(s, 'mound');
    s.pebbles.push({ age: 0, body: { x: bossCx(s) - 2, y: boss(s).body.y + 12, w: 4, h: 4, vx: 0, vy: 0 } });
    const ev = runGame(s, [[{}, 1]]);
    expect(types(ev)).not.toContain('pebblePop');
  });
  it('der Enzian schützt Kraxel, besiegt den Murmelkönig aber nicht', () => {
    const s = arena();
    s.player.enzian = 30;
    setPhase(s, 'wait');
    placePlayer(s, 14, 10);
    const ev = runGame(s, [[{}, 20]]);
    expect(types(ev)).not.toContain('hurt');
    expect(s.phase).toBe('playing');
    expect(boss(s).hits).toBe(0);
    expect(boss(s).phase).not.toBe('defeated');
  });
  it('mit Enzian zählt Draufspringen in Benommen als Treffer, ohne Schaden und mit Abprall', () => {
    const s = arena();
    s.player.enzian = 30;
    setPhase(s, 'stunned');
    dropOnHead(s);
    const { events } = until(s, () => boss(s).hits > 0, 60);
    expect(events).toContainEqual({ type: 'bossHit', hits: 1 });
    expect(types(events)).not.toContain('hurt');
    expect(s.player.body.vy).toBeLessThan(0);
  });
  it('mit Enzian trifft bloße Berührung in Benommen den Murmelkönig nicht', () => {
    const s = arena();
    s.player.enzian = 30;
    setPhase(s, 'stunned');
    placePlayer(s, 14, 10);
    const ev = runGame(s, [[{}, 20]]);
    expect(types(ev)).not.toContain('bossHit');
    expect(boss(s).hits).toBe(0);
    expect(boss(s).phase).toBe('stunned');
  });
});

describe('Murmelkönig: Tempo steigt, Steinwurf', () => {
  it('Warten verkürzt sich um 0,25 s je Treffer', () => {
    for (const hits of [0, 1, 2]) {
      const s = arena();
      s.player.enzian = 999;
      boss(s).hits = hits;
      const { n } = until(s, () => boss(s).phase !== 'wait', 200);
      expect(Math.abs(n - steps(1.0 - 0.25 * hits))).toBeLessThanOrEqual(1);
    }
  });
  it('der Hügel wird je Treffer um 0,75 Kacheln/s schneller', () => {
    for (const hits of [0, 1, 2]) {
      const s = arena();
      s.player.enzian = 999;
      boss(s).hits = hits;
      setPhase(s, 'mound');
      boss(s).moundX = 200;
      placePlayer(s, 3, 10);
      runGame(s, [[{}, 30]]);
      expect(200 - boss(s).moundX).toBeCloseTo((3 + 0.75 * hits) * TILE * 0.5, 0);
    }
  });
  it('1 Stein ohne Treffer, 2 Steine mit Treffer, im Abstand von 0,4 s, als Bogen auf Kraxel', () => {
    for (const hits of [0, 1, 2]) {
      const s = arena();
      s.player.enzian = 999;
      boss(s).hits = hits;
      setPhase(s, 'stunned', 1.19);
      placePlayer(s, 4, 10);
      const throws: number[] = [];
      let n = 0;
      while (n < 100) {
        const ev = runGame(s, [[{}, 1]]);
        n++;
        if (types(ev).includes('bossThrow')) throws.push(n);
        if (boss(s).phase === 'wait') break;
      }
      expect(throws).toHaveLength(hits === 0 ? 1 : 2);
      if (throws.length === 2) expect(Math.abs(throws[1]! - throws[0]! - steps(0.4))).toBeLessThanOrEqual(1);
    }
  });
  it('der Stein fliegt auf Kraxels Stelle und trifft ihn dort', () => {
    const s = arena();
    s.player.helm = true;
    setPhase(s, 'stunned', 1.19);
    placePlayer(s, 4, 10);
    const ev = runGame(s, [[{}, steps(0.2) + 3]]);
    expect(types(ev)).toContain('bossThrow');
    expect(boss(s).rocks).toHaveLength(1);
    const { events } = until(s, () => !s.player.helm || boss(s).rocks.length === 0, 120);
    expect(types(events)).toContain('hurt');
    expect(boss(s).rocks).toHaveLength(0);
  });
  it('ein Stein, der niemanden trifft, verschwindet am Boden', () => {
    const s = arena();
    s.player.enzian = 999;
    setPhase(s, 'stunned', 1.19);
    placePlayer(s, 4, 10);
    runGame(s, [[{}, steps(0.2) + 3]]);
    expect(boss(s).rocks).toHaveLength(1);
    s.player.body.x += 80; // Kraxel weicht aus
    runGame(s, [[{}, 80]]);
    expect(boss(s).rocks).toHaveLength(0);
  });
});

describe('Murmelkönig: Schonfrist am Wurfbeginn', () => {
  it('0,2 s lang tut Berührung nicht weh und der erste Stein ist noch nicht los; danach trifft sie', () => {
    const s = arena();
    s.player.helm = true;
    setPhase(s, 'stunned', 1.19);
    placePlayer(s, 14, 10); // steht im Murmelkönig
    const early = runGame(s, [[{}, steps(0.2) - 3]]);
    expect(boss(s).phase).toBe('throw');
    expect(types(early)).not.toContain('hurt');
    expect(types(early)).not.toContain('bossThrow');
    expect(boss(s).rocks).toHaveLength(0);
    const later = runGame(s, [[{}, 10]]);
    expect(types(later)).toContain('hurt');
    expect(types(later)).toContain('bossThrow');
  });
});

describe('Murmelkönig: Sieg', () => {
  const hitOnce = (s: GameState) => {
    setPhase(s, 'stunned');
    boss(s).invuln = 0;
    dropOnHead(s);
    const before = boss(s).hits;
    return until(s, () => boss(s).hits > before, 60).events;
  };
  it('drei Treffer besiegen ihn, das Gipfelkreuz erscheint mittig auf dem Arenaboden, Ausgang führt zum Ziel', () => {
    const s = arena();
    const all: GameEvent[] = [];
    all.push(...hitOnce(s));
    expect(boss(s).hits).toBe(1);
    expect(boss(s).phase).toBe('stunned');
    all.push(...hitOnce(s));
    expect(boss(s).hits).toBe(2);
    expect(boss(s).phase).not.toBe('defeated');
    expect(types(all)).not.toContain('bossDefeated');
    const last = hitOnce(s);
    expect(last).toContainEqual({ type: 'bossHit', hits: 3 });
    expect(types(last)).toContain('bossDefeated');
    expect(boss(s).phase).toBe('defeated');
    // Nach dem Sieg liegt er BOSS_LIE da, dann erscheint das Kreuz; Kraxel läuft hin (Spalte 10 = Arenamitte x0+8) und löst das Ziel aus.
    runGame(s, [[{}, steps(BOSS_LIE) + 2]]);
    expect(summitSpawn(s)).not.toBeNull();
    const sampler = new InputSampler();
    const goal: GameEvent[] = [];
    for (let i = 0; i < 300 && s.phase === 'playing'; i++) {
      goal.push(...stepGame(s, sampler.sample(held({ left: true })), DEFAULT_TUNING, { x: 0, w: 512 }, STEP));
    }
    const g = goal.find((e) => e.type === 'goal');
    expect(g).toMatchObject({ type: 'goal', exit: 'normal' });
    expect(s.phase).toBe('goal');
    expect(types(goal)).not.toContain('hurt');
  });
  it('das Gipfelkreuz gibt es erst, wenn der Murmelkönig BOSS_LIE gelegen hat; vorher löst auch Berührung kein Ziel aus', () => {
    const s = arena();
    boss(s).hits = 2;
    hitOnce(s);
    expect(boss(s).phase).toBe('defeated');
    expect(summitSpawn(s)).toBeNull();
    placePlayer(s, 10, 10); // mitten auf der Kreuzspalte (Arenamitte x0 + 8)
    const früh = runGame(s, [[{}, steps(BOSS_LIE) - 5]]);
    expect(types(früh)).not.toContain('goal');
    expect(s.phase).toBe('playing');
    expect(summitSpawn(s)).toBeNull();
    const spät = runGame(s, [[{}, 10]]);
    expect(summitSpawn(s)).not.toBeNull();
    expect(types(spät)).toContain('goal');
  });
  it('der besiegte Murmelkönig tut nichts mehr', () => {
    const s = arena();
    s.player.helm = true;
    boss(s).hits = 2;
    hitOnce(s);
    expect(boss(s).phase).toBe('defeated');
    placePlayer(s, 14, 10);
    const ev = runGame(s, [[{}, 10]]);
    expect(types(ev)).not.toContain('hurt');
  });
  it('das Kreuz gibt die Zielhöhe wie ein normales Z: hoch berührt gibt ein Extraleben', () => {
    const s = arena();
    boss(s).hits = 2;
    hitOnce(s);
    boss(s).t = BOSS_LIE; // das Kreuz ist da
    placePlayer(s, 10, 6); // Füße 4 Kacheln über dem Kreuzfuß: zwischen Reihe 6 und 7 -> Höhe 4 Kacheln +
    s.player.body.y -= 12; // etwas höher (>= 4,5 Kacheln)
    const lives = s.session.lives;
    const ev = runGame(s, [[{}, 2]]);
    expect(ev.find((e) => e.type === 'goal')).toMatchObject({ extraLife: true });
    expect(s.session.lives).toBe(lives + 1);
  });
});

describe('Murmelkönig: Ausweichen', () => {
  it.each([0, 1, 2])('ein Ausweich-Skript übersteht Hügel, Herausspringen und Steinwurf ohne hurt (Treffer: %i)', (hits) => {
    const s = arena();
    boss(s).hits = hits; // schneller Hügel, kürzeres Warten, zwei Steine
    s.player.helm = true; // jeder Treffer wäre sichtbar als hurt und würde den Helm kosten
    placePlayer(s, 9, 10);
    const sampler = new InputSampler();
    const events: GameEvent[] = [];
    const center = (2 + 8) * TILE; // Arenamitte
    let pops = 0, throws = 0;
    for (let i = 0; i < steps(16); i++) {
      const b = boss(s);
      const x = playerCx(s);
      const awayFrom = (spot: number) => (x < spot ? -1 : 1);
      // Voraus: weg vom Hügel (beim Beben) bzw. vom Körper und vom Stein; sonst zur Mitte.
      let dir: -1 | 0 | 1 = 0;
      if (b.phase === 'tremble' || b.phase === 'pop') {
        dir = Math.abs(x - b.moundX) < 70 ? (x < b.moundX ? -1 : 1) : 0;
        if (Math.abs(x - b.moundX) < 70 && ((dir === -1 && x < 2 * TILE + 40) || (dir === 1 && x > 18 * TILE - 40))) dir = (dir * -1) as -1 | 1;
      } else if (b.phase === 'stunned' || b.phase === 'throw' || b.phase === 'wait' || b.phase === 'dig') {
        const bx = b.body.x + b.body.w / 2;
        if (b.rocks.length > 0 || b.phase === 'throw') dir = awayFrom(bx) as -1 | 1;
        else if (Math.abs(x - bx) < 50) dir = awayFrom(bx) as -1 | 1;
        else dir = Math.abs(x - center) > 12 ? ((x < center ? 1 : -1) as -1 | 1) : 0;
      } else if (b.phase === 'mound') {
        dir = Math.abs(x - center) > 12 ? ((x < center ? 1 : -1) as -1 | 1) : 0; // der Hügel jagt Kraxel; er bleibt in Bewegung
      }
      const ev = stepGame(s, sampler.sample(held({ left: dir === -1, right: dir === 1 })), DEFAULT_TUNING, { x: 0, w: 512 }, STEP);
      events.push(...ev);
      pops += ev.filter((e) => e.type === 'bossPop').length;
      throws += ev.filter((e) => e.type === 'bossThrow').length;
    }
    expect(pops).toBeGreaterThanOrEqual(2);
    expect(throws).toBeGreaterThanOrEqual(2);
    expect(types(events)).not.toContain('hurt');
    expect(s.player.helm).toBe(true);
    expect(s.phase).toBe('playing');
  });
});

describe('stepBoss direkt', () => {
  it('ohne Murmelkönig oder bei offener Tür tut es nichts', () => {
    const plain = gameFrom(['P..', '###']);
    expect(stepBoss(plain, STEP)).toEqual([]);
    const s = gameFrom(ROWS, undefined, HEADER);
    expect(stepBoss(s, STEP)).toEqual([]);
    expect(boss(s).t).toBe(0);
  });
});
