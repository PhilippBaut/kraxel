// Level 1-2 „Blumenhang“: Aufbau, die Lehrstellen (Blätterpolster, Schleuder gegen Schnecken), die drei Edelweiß, Gruben und Kamera.
// Alle Wege laufen über echte Eingabe-Skripte, nichts wird zum Ziel teleportiert.
import { describe, expect, it } from 'vitest';
import { STEP, TILE, VIEW_H } from '../config.ts';
import { createCamera, stepCamera } from '../core/camera.ts';
import { createGame, stepGame } from '../core/game.ts';
import type { GameState } from '../core/game.ts';
import { InputSampler } from '../core/input-frame.ts';
import { parseLevel, validateLevel } from '../core/level.ts';
import type { LevelData } from '../core/level.ts';
import { held, placePlayer, runGame } from '../core/test-helpers.ts';
import type { Script } from '../core/test-helpers.ts';
import { DEFAULT_TUNING } from '../core/tuning.ts';
import { Cell } from '../core/types.ts';
import type { GameEvent, Held } from '../core/types.ts';
import { LEVELS } from './index.ts';

const L = parseLevel('1-2', LEVELS['1-2']);

// Stellen aus 1-2.txt als (Spalte, Reihe). „Füße“ meint die Reihe, auf deren Oberkante Kraxel steht.
const START_FEET = 19;                      // Wiese am Start
const INTRO_PAD = { cx: 25, cy: 18 };       // erstes Polster, ein Block auf der Wiese direkt vor der Wand
const CLIFF = { cx: 27, feet: 13 };         // Wand hinter dem ersten Polster, oben die Wiese mit der Helm-Kiste
const PAD_A = { cx: 39, cy: 14 };           // Polster in einer Mulde der Wiese vor dem Felsblock-Absatz (zwei Zellen breit)
const E1_BLOCK = { cx: 42, feet: 9 };       // linker Rand des Absatzes, in dem Edelweiß 1 zwischen zwei Felsblöcken steckt
const E1_ROCK = { cx: 44, cy: 11 };         // unterer Felsblock, der obere liegt in Reihe 9
const PLATEAU_FEET = 6;                     // Hochfläche mit der Schleuder-Kiste
const TERRACE = { cx: 65, feet: 11 };       // rechter Rand des Absatzes vor den Schneckenbänken
const BENCHES = [68, 74, 80];               // linke Zellen der drei Schneckenbänke (Oberkante Reihe 11, darunter frei)
const VALLEY_FEET = 14;                     // Talboden unter den Bänken
const RESCUE_PAD = { cx: 66, cy: 14 };      // Polster im Talboden, hebt zurück auf den Absatz
const CHAIN_EDGE = { cx: 106, feet: 11 };   // rechter Rand der Steinmännchen-Fläche, direkt dahinter (eine Kachel tiefer) das erste Polster der Kette
const LEDGE_D = { cx: 122, feet: 9 };       // Absatz hinter der Polsterkette
const RIM = { cx: 165, feet: 16 };          // rechter Rand über der Mulde mit Edelweiß 3
const E3_PAD = { cx: 170, cy: 19 };         // Polster im Boden der Mulde (zwei Zellen breit)
const HIDDEN = { cx: 170, cy: 13 };         // versteckte Kiste über dem Polster
const E3_LEDGE = { cx: 173, feet: 10 };     // linke Zelle des schwebenden Absatzes mit Edelweiß 3 (drei Zellen breit)
const ROCK = { cx: 183, top: 13, bottom: 16 }; // schwebender Felsklotz (zwei Zellen breit) über einem Durchgang, Edelweiß 2 obenauf
const FLOOR_FEET = 19;                      // Boden der Schlussmulde
const FINAL = { cx: 190, feet: 19 };        // vor dem Schlussanstieg
const FINAL_PAD = { cx: 194, cy: 18 };      // Polster am Fuß des Pfeilers (zwei Zellen breit)
const PILLAR_FEET = 14;                     // Pfeiler, rechts darauf das Polster am Gipfelhang
const TOP_BENCH_FEET = 8;                   // Bank unter der Gipfelfläche

const feetRow = (s: GameState) => (s.player.body.y + s.player.body.h) / TILE;
const midCol = (s: GameState) => (s.player.body.x + s.player.body.w / 2) / TILE;
const cellAt = (l: LevelData, cx: number, cy: number) => l.cells[cy * l.width + cx];
const solidCell = (l: LevelData, cx: number, cy: number) => {
  const c = cellAt(l, cx, cy);
  return c === Cell.Ground || c === Cell.Rock || c === Cell.Crate || c === Cell.CrateUsed || c === Cell.LeafPad;
};
/** Ohne Gegner: für Wege, bei denen es nur um Sprünge geht. */
const calm = (l: LevelData = L) => {
  const s = createGame(l);
  s.enemies = [];
  return s;
};
const standsAt = (s: GameState, feet: number) => s.player.grounded && Math.abs(feetRow(s) - feet) < 1e-6;
const has = (ev: GameEvent[], type: GameEvent['type']) => ev.some((e) => e.type === type);

/**
 * Spielt mit einem durchgehenden Eingabe-Takt (Sprung gilt nur beim ersten gehaltenen Schritt als gedrückt).
 * `camera`: echte Kamera mit Bildbreite `viewW`; Gegner werden dann nur im Bild aktiv, wie im Spiel.
 */
function play(s: GameState, viewW = 512, camera = false) {
  const sampler = new InputSampler();
  const view = { w: viewW, h: VIEW_H };
  const levelPx = { w: s.level.width * TILE, h: s.level.height * TILE };
  const cam = createCamera(s.player, view, levelPx);
  const events: GameEvent[] = [];
  const step = (input: Partial<Held> = {}, n = 1): GameEvent[] => {
    const out: GameEvent[] = [];
    for (let i = 0; i < n; i++) {
      out.push(...stepGame(s, sampler.sample(held(input)), DEFAULT_TUNING, camera ? { x: cam.x, w: viewW } : { x: 0, w: 512 }, STEP));
      stepCamera(cam, s.player, view, levelPx, STEP);
    }
    events.push(...out);
    return out;
  };
  /** Spielt mit `input`, bis `done` gilt (höchstens `max` Schritte). */
  const until = (input: Partial<Held>, done: () => boolean, max = 400): void => {
    for (let i = 0; i < max && !done(); i++) step(input);
  };
  return { step, until, cam, events };
}

/** Lücken in der untersten Reihe als Spaltenbereiche. */
function pits(l: LevelData): Array<{ from: number; to: number }> {
  const out: Array<{ from: number; to: number }> = [];
  for (let cx = 0; cx < l.width; cx++) {
    if (solidCell(l, cx, l.height - 1)) continue;
    const last = out[out.length - 1];
    if (last && last.to === cx - 1) last.to = cx;
    else out.push({ from: cx, to: cx });
  }
  return out;
}
/** Oberkante der festen Säule, die in Spalte cx am Levelboden beginnt. */
function surface(l: LevelData, cx: number): number {
  let cy = l.height - 1;
  while (cy > 0 && solidCell(l, cx, cy - 1)) cy--;
  return cy;
}
/** Gruben, deren beide Ränder aus festem Boden sind (kein Polster obenauf). */
const groundPits = (l: LevelData) => pits(l).filter((p) => cellAt(l, p.from - 1, surface(l, p.from - 1)) !== Cell.LeafPad
  && cellAt(l, p.to + 1, surface(l, p.to + 1)) !== Cell.LeafPad);

/** Zusammenhängende Polster-Gruppen (waagerecht benachbarte Polsterzellen zählen als eine). */
function padGroups(l: LevelData): Array<{ cx: number; cy: number; w: number }> {
  const out: Array<{ cx: number; cy: number; w: number }> = [];
  for (let cy = 0; cy < l.height; cy++) {
    for (let cx = 0; cx < l.width; cx++) {
      if (cellAt(l, cx, cy) !== Cell.LeafPad || (cx > 0 && cellAt(l, cx - 1, cy) === Cell.LeafPad)) continue;
      let w = 1;
      while (cellAt(l, cx + w, cy) === Cell.LeafPad) w++;
      out.push({ cx, cy, w });
    }
  }
  return out.sort((a, b) => a.cx - b.cx);
}

const crates = (item: string) => [...L.crates]
  .filter(([, c]) => c.kind === 'item' && c.item === item)
  .map(([i]) => ({ cx: i % L.width, cy: Math.floor(i / L.width) }));
const edelweiss = (i: number) => L.spawns.find((s) => s.kind === 'edelweiss' && s.index === i)!;

describe('Level 1-2: Aufbau', () => {
  it('ist gültig, heißt Blumenhang und hat die Maße', () => {
    expect(validateLevel(L, { requireEdelweiss: true, requireGoal: true })).toEqual([]);
    expect(L.name).toBe('Blumenhang');
    expect(L.world).toBe(1);
    expect(L.width).toBeGreaterThanOrEqual(180); expect(L.width).toBeLessThanOrEqual(240);
    expect(L.height).toBeGreaterThanOrEqual(20); expect(L.height).toBeLessThanOrEqual(24);
  });

  it('genau ein Steinmännchen etwa in der Mitte, das Gipfelkreuz oben am Ende, kein geheimes', () => {
    const cps = L.spawns.filter((s) => s.kind === 'checkpoint');
    expect(cps.length).toBe(1);
    expect(cps[0]!.cx / L.width).toBeGreaterThan(0.4); expect(cps[0]!.cx / L.width).toBeLessThan(0.65);
    const goal = L.spawns.find((s) => s.kind === 'goal')!;
    expect(goal.cx).toBeGreaterThan(L.width - 10);
    expect(goal.cy).toBeLessThanOrEqual(PLATEAU_FEET);
    expect(L.spawns.some((s) => s.kind === 'secretGoal')).toBe(false);
  });

  it('erst eine Helm-Kiste, ein Stück später die Schleuder-Kiste', () => {
    const h = crates('helm'), j = crates('sling');
    expect([h.length, j.length]).toEqual([1, 1]);
    expect(h[0]!.cx).toBeLessThan(j[0]!.cx);
    expect(j[0]!.cx - h[0]!.cx).toBeGreaterThanOrEqual(10);
    expect(crates('enzian').length).toBeLessThanOrEqual(1);
  });

  it('mindestens drei Blätterpolster, mindestens 30 Kristalle, Kristall- und versteckte Kisten', () => {
    expect(padGroups(L).length).toBeGreaterThanOrEqual(3);
    expect(L.spawns.filter((s) => s.kind === 'crystal').length).toBeGreaterThanOrEqual(30);
    expect([...L.crates.values()].filter((c) => c.kind === 'crystal').length).toBeGreaterThanOrEqual(3);
    expect([...L.cells].includes(Cell.HiddenCrate)).toBe(true);
  });

  it('mindestens drei Schnecken, alle nach der Schleuder-Kiste und jede auf einer kurzen Bank, von der sie nicht herunterfällt', () => {
    const j = crates('sling')[0]!;
    const snails = L.spawns.filter((s) => s.kind === 'snail');
    expect(snails.length).toBeGreaterThanOrEqual(3);
    for (const sn of snails) {
      expect(sn.cx, `Schnecke ${sn.cx}`).toBeGreaterThan(j.cx);
      const row = sn.cy + 1;
      let a = sn.cx, b = sn.cx;
      while (solidCell(L, a - 1, row)) a--;
      while (solidCell(L, b + 1, row)) b++;
      expect(b - a + 1, `Bank unter Schnecke ${sn.cx}`).toBeLessThanOrEqual(6);
      expect(solidCell(L, sn.cx, sn.cy - 1), `über Schnecke ${sn.cx} frei`).toBe(false);
    }
  });

  it('mindestens eine waagerecht fahrende Plattform aus Stamm', () => {
    expect(L.platforms.some((p) => p.axis === 'h' && p.art === 'stamm')).toBe(true);
  });

  it('geht viel nach oben: zwei Anstiege höher als ein Bildschirm (12 Kacheln)', () => {
    // Von der Startwiese zur Hochfläche mit der Schleuder-Kiste und vom Boden der Schlussmulde zur Gipfelfläche.
    const j = crates('sling')[0]!;
    const goal = L.spawns.find((s) => s.kind === 'goal')!;
    expect([L.start.cy + 1, surface(L, 0)]).toEqual([START_FEET, START_FEET]);
    expect(surface(L, j.cx)).toBe(PLATEAU_FEET);
    expect(START_FEET - PLATEAU_FEET).toBeGreaterThan(12);
    expect(surface(L, FINAL.cx)).toBe(FLOOR_FEET);
    expect(FLOOR_FEET - (goal.cy + 1)).toBeGreaterThan(12);
  });
});

describe('Level 1-2: Blätterpolster (Lehrstellen)', () => {
  it('das erste Polster hebt Kraxel auf die Wand, die Kristallspur zeigt den Weg', () => {
    // Aus Stand und mit Anlauf, Sprung kurz oder lang gehalten: wer auf dem Polster landet und rechts hält, steht danach oben.
    let tried = 0;
    for (let start = INTRO_PAD.cx - 6; start <= INTRO_PAD.cx - 2; start++) {
      for (const hold of [4, 12, 24]) {
        const s = calm();
        placePlayer(s, start, START_FEET - 1);
        const p = play(s);
        p.step({}, 2);
        p.until({ right: true }, () => s.player.body.x + s.player.body.w >= INTRO_PAD.cx * TILE - 6);
        p.step({ right: true, jump: true }, hold);
        // Wer gegen die Wand springt, rutscht an ihr langsam aufs Polster.
        p.until({ right: true }, () => has(p.events, 'bounce') && s.player.grounded, 150);
        p.step({}, 10);
        if (!has(p.events, 'bounce')) continue;
        tried++;
        expect(standsAt(s, CLIFF.feet), `Start ${start}, Sprung ${hold}`).toBe(true);
        expect(midCol(s)).toBeGreaterThan(CLIFF.cx);
        expect(p.events.filter((e) => e.type === 'crystal').length, `Kristallspur, Start ${start}`).toBeGreaterThanOrEqual(2);
      }
    }
    expect(tried).toBeGreaterThanOrEqual(10);
  });

  it('ohne das erste Polster und ohne Kraxeln kommt niemand auf die Wand', () => {
    const rows = LEVELS['1-2'].split('\n');
    const sep = rows.indexOf('---');
    rows[sep + 1 + INTRO_PAD.cy] = rows[sep + 1 + INTRO_PAD.cy]!.replace(/L/g, '.');
    const without = parseLevel('1-2', rows.join('\n'));
    for (let cx = 10; cx <= CLIFF.cx - 1; cx += 2) {
      for (let run = 0; run <= 84; run += 12) {
        for (const hold of [8, 20, 40]) {
          const s = calm(without);
          placePlayer(s, cx, START_FEET - 1);
          runGame(s, [[{}, 2], [{ right: true }, run], [{ right: true, jump: true }, hold], [{ right: true }, 60]]);
          expect(feetRow(s) > CLIFF.feet + 1e-6 || midCol(s) < CLIFF.cx, `Start ${cx}, Anlauf ${run}`).toBe(true);
        }
      }
    }
  });

  it('wer auf der Wiese weiterläuft, fällt in die Mulde, Polster A hebt ihn auf den Felsblock-Absatz, von dort geht es auf die Hochfläche', () => {
    for (let start = PAD_A.cx - 6; start <= PAD_A.cx - 1; start++) {
      for (const run of ['gehen', 'rennen'] as const) {
        const s = calm();
        placePlayer(s, run === 'rennen' ? start - 6 : start, CLIFF.feet - 1);
        const p = play(s);
        p.step({}, 2);
        p.until({ right: true }, () => has(p.events, 'bounce'), 300);
        p.until({ right: true }, () => s.player.grounded, 90);
        p.step({}, 20);
        expect(standsAt(s, E1_BLOCK.feet), `Start ${start}, ${run}`).toBe(true);
        p.step({ right: true }, 20);
        p.step({ right: true, jump: true }, 20);
        p.step({ right: true }, 20);
        p.step({}, 20);
        expect(standsAt(s, PLATEAU_FEET), `Start ${start}, ${run}: Hochfläche`).toBe(true);
      }
    }
  });

  it('aus dem Tal unter den Bänken hebt das Polster Kraxel zurück auf den Absatz', () => {
    const s = calm();
    placePlayer(s, RESCUE_PAD.cx + 6, VALLEY_FEET - 1);
    const p = play(s);
    p.step({}, 2);
    p.until({ left: true }, () => s.player.body.x < (RESCUE_PAD.cx + 1) * TILE + 2);
    p.step({}, 20);
    p.step({ jump: true }, 6);
    p.until({}, () => has(p.events, 'bounce'), 60);
    p.step({ left: true }, 70);
    p.step({}, 20);
    expect(cellAt(L, RESCUE_PAD.cx, RESCUE_PAD.cy)).toBe(Cell.LeafPad);
    expect(has(p.events, 'bounce')).toBe(true);
    expect(standsAt(s, TERRACE.feet)).toBe(true);
    expect(midCol(s)).toBeLessThan(TERRACE.cx + 1);
  });

  it('Polsterkette über dem Abgrund: von der Kante gehen und rechts halten trägt von Polster zu Polster auf den Absatz', () => {
    const s = calm();
    placePlayer(s, CHAIN_EDGE.cx, CHAIN_EDGE.feet - 1);
    const p = play(s);
    p.step({}, 2);
    p.until({ right: true }, () => s.player.grounded && midCol(s) > LEDGE_D.cx, 400);
    p.step({}, 20);
    expect(p.events.filter((e) => e.type === 'bounce').length).toBeGreaterThanOrEqual(3);
    expect(has(p.events, 'death')).toBe(false);
    expect(standsAt(s, LEDGE_D.feet)).toBe(true);
  });

  it('Polsterkette: wer im Flug das nächste Polster ansteuert, kommt hinüber, ob gegangen oder gerannt, mit oder ohne Sprung an der Kante', () => {
    const chain = padGroups(L).filter((g) => g.cx > CHAIN_EDGE.cx && g.cx < LEDGE_D.cx);
    expect(chain[0]).toMatchObject({ cx: CHAIN_EDGE.cx + 1, cy: CHAIN_EDGE.feet + 1 }); // erstes Polster direkt an der Kante
    const targets = [...chain.map((g) => ({ x: (g.cx + g.w / 2) * TILE, top: g.cy * TILE })), { x: (LEDGE_D.cx + 1.5) * TILE, top: LEDGE_D.feet * TILE }];
    const g = (2 * DEFAULT_TUNING.jumpHeight) / DEFAULT_TUNING.timeToApex ** 2, gFall = g * DEFAULT_TUNING.fallGravityMul;
    /** Grob geschätzte Restflugzeit, bis die Füße die Höhe `top` erreichen. */
    const airtime = (vy: number, feet: number, top: number) => {
      if (vy < 0) return -vy / g + Math.sqrt((2 * Math.max(0, top - (feet - (vy * vy) / (2 * g)))) / gFall);
      return (-vy + Math.sqrt(vy * vy + 2 * gFall * Math.max(0, top - feet))) / gFall;
    };
    for (let start = CHAIN_EDGE.cx - 8; start <= CHAIN_EDGE.cx; start += 2) {
      for (const jump of [false, true]) {
        const s = calm();
        placePlayer(s, start, CHAIN_EDGE.feet - 1);
        const p = play(s);
        p.step({}, 2);
        p.until({ right: true }, () => s.player.body.x + s.player.body.w >= (CHAIN_EDGE.cx + 1) * TILE - 2);
        if (jump) p.step({ right: true, jump: true }, 4);
        let k = 0;
        for (let i = 0; i < 900 && !(s.player.grounded && midCol(s) > LEDGE_D.cx) && s.phase === 'playing'; i++) {
          const b = s.player.body, mid = b.x + b.w / 2, t = targets[k]!;
          let input: Partial<Held> = {};
          if (s.player.grounded && k === 0 && mid < (CHAIN_EDGE.cx + 1) * TILE) input = { right: true };
          else {
            // Tempo so wählen, dass Kraxel bis zur Landung genau über dem Ziel ist.
            const want = (t.x - mid) / Math.max(0.08, airtime(b.vy, b.y + b.h, t.top));
            input = b.vx < want - 12 ? { right: true } : b.vx > want + 12 ? { left: true } : {};
          }
          if (has(p.step(input), 'bounce')) k = Math.min(k + 1, targets.length - 1);
        }
        p.step({}, 20);
        expect(has(p.events, 'death'), `Start ${start}, ${jump ? 'mit' : 'ohne'} Sprung`).toBe(false);
        expect(standsAt(s, LEDGE_D.feet), `Start ${start}, ${jump ? 'mit' : 'ohne'} Sprung`).toBe(true);
      }
    }
  });
});

describe('Level 1-2: Helm und Schleuder', () => {
  /** Stößt die Kiste von unten an (Kraxel steht darunter) und läuft dem Item nach, bis es eingesammelt ist. */
  function openAndChase(s: GameState, crate: { cx: number; cy: number }, feet: number): GameEvent[] {
    placePlayer(s, crate.cx, feet - 1);
    const p = play(s);
    p.step({}, 2);
    p.step({ jump: true }, 10);
    p.step({}, 40);
    const item = s.pickups.find((it) => it.kind === 'item' && !it.taken);
    if (item) {
      for (let i = 0; i < 300 && !item.taken; i++) {
        const dx = item.body.x + item.body.w / 2 - (s.player.body.x + s.player.body.w / 2);
        p.step(dx > 2 ? { right: true } : dx < -2 ? { left: true } : {});
      }
    }
    return p.events;
  }
  const h = () => crates('helm')[0]!, j = () => crates('sling')[0]!;

  it('Helm-Kiste gibt den Helm, die Schleuder-Kiste danach die Schleuder', () => {
    const s = calm();
    const a = openAndChase(s, h(), CLIFF.feet);
    expect(a).toContainEqual({ type: 'powerUp', item: 'helm' });
    expect([s.player.helm, s.player.special]).toEqual([true, null]);
    const b = openAndChase(s, j(), PLATEAU_FEET);
    expect(b).toContainEqual({ type: 'powerUp', item: 'sling' });
    expect(s.player.special).toBe('sling');
  });

  it('wer den Helm aus 1-1 mitbringt, bekommt aus der Helm-Kiste Kristalle und aus der Schleuder-Kiste die Schleuder', () => {
    const s = createGame(L, undefined, { helm: true });
    s.enemies = [];
    const ev = openAndChase(s, h(), CLIFF.feet);
    expect(has(ev, 'powerUp')).toBe(false);
    expect(s.session.crystals - ev.filter((e) => e.type === 'crystal').length).toBe(10);
    openAndChase(s, j(), PLATEAU_FEET);
    expect(s.player.special).toBe('sling');
  });

  it('wer mit der Schleuder kommt, behält sie; beide Kisten geben dann Kristalle', () => {
    const s = createGame(L, undefined, { special: 'sling' });
    s.enemies = [];
    const ev = [...openAndChase(s, h(), CLIFF.feet), ...openAndChase(s, j(), PLATEAU_FEET)];
    expect(has(ev, 'powerUp')).toBe(false);
    expect([s.player.helm, s.player.special]).toEqual([true, 'sling']);
    expect(s.session.crystals - ev.filter((e) => e.type === 'crystal').length).toBe(20);
  });

  it('wer die Helm-Kiste auslässt, bekommt aus der Schleuder-Kiste den Helm (die Schnecken bleiben trotzdem lösbar)', () => {
    const s = calm();
    openAndChase(s, j(), PLATEAU_FEET);
    expect([s.player.helm, s.player.special]).toEqual([true, null]);
  });
});

describe('Level 1-2: Schnecken auf den Bänken und der Stamm', () => {
  const snailsOnBenches = (s: GameState) => s.enemies.filter((e) => e.kind === 'snail' && BENCHES.some((b) => e.body.x >= b * TILE - TILE && e.body.x < (b + 5) * TILE));

  it('die Schnecken bleiben auf ihren Bänken und drehen an den Kanten um', () => {
    const s = createGame(L);
    placePlayer(s, TERRACE.cx, TERRACE.feet - 1);
    const p = play(s, 512, true);
    const turns = BENCHES.map(() => 0);
    for (let i = 0; i < 20 * 60; i++) {
      const before = snailsOnBenches(s).map((e) => e.dir);
      p.step({});
      snailsOnBenches(s).forEach((e, k) => {
        expect(e.body.y + e.body.h).toBe(TERRACE.feet * TILE);
        if (e.dir !== before[k]) turns[k]!++;
      });
    }
    expect(snailsOnBenches(s).length).toBe(BENCHES.length);
    expect(snailsOnBenches(s).every((e) => e.alive)).toBe(true);
    for (const t of turns) expect(t).toBeGreaterThanOrEqual(2);
  });

  it('mit der Schleuder: vom Absatz und von Bank zu Bank schießt Kraxel alle drei Schnecken ab, hochkant und quer', () => {
    for (const viewW of [256, 416]) {
      const s = createGame(L, undefined, { special: 'sling' });
      placePlayer(s, TERRACE.cx - 1, TERRACE.feet - 1);
      const p = play(s, viewW, true);
      p.step({}, 30);
      const edges = [TERRACE.cx + 1, ...BENCHES.slice(0, -1).map((b) => b + 4)];
      for (let k = 0; k < BENCHES.length; k++) {
        // An die Kante der eigenen Bank, nach rechts schauen, schießen.
        p.until({ right: true }, () => s.player.body.x + s.player.body.w >= edges[k]! * TILE - 3);
        p.step({}, 10);
        for (let shot = 0; shot < 4 && snailsOnBenches(s)[k]!.alive; shot++) {
          p.step({ action: true });
          p.step({}, 40);
        }
        expect(snailsOnBenches(s)[k]!.alive, `Bild ${viewW}, Schnecke ${k + 1}`).toBe(false);
        // Hinüber auf die nächste Bank.
        p.step({ right: true, jump: true }, 18);
        p.until({ right: true }, () => s.player.grounded, 60);
        p.step({}, 10);
        expect(standsAt(s, TERRACE.feet), `Bild ${viewW}, auf Bank ${k + 1}`).toBe(true);
      }
      expect(has(p.events, 'hurt'), `Bild ${viewW}`).toBe(false);
    }
  });

  it('ohne Schleuder: ein Kopfstoß von unten gegen die Bank besiegt die Schnecke darauf', () => {
    const s = createGame(L);
    const bench = BENCHES[1]!;
    placePlayer(s, bench + 1, VALLEY_FEET - 1);
    const p = play(s, 512, true);
    p.step({}, 2);
    const snail = snailsOnBenches(s)[1]!;
    // Warten, bis die Schnecke über Kraxels Kopf ist, dann springen.
    p.until({}, () => Math.abs(snail.body.x + snail.body.w / 2 - midCol(s) * TILE) < 3, 600);
    p.step({ jump: true }, 10);
    p.step({}, 30);
    expect(snail.alive).toBe(false);
    expect(has(p.events, 'enemyDefeated')).toBe(true);
    expect(has(p.events, 'hurt')).toBe(false);
  });

  it('der Stamm trägt Kraxel von der letzten Bank hinüber zur Steinmännchen-Fläche', () => {
    for (const wait of [0, 1, 2.5, 4]) {
      const s = calm();
      placePlayer(s, BENCHES[2]! + 2, TERRACE.feet - 1);
      const p = play(s);
      p.step({}, 2 + Math.round(wait * 60));
      const log = s.platforms[0]!;
      const lastBenchEnd = (BENCHES[2]! + 4) * TILE;
      p.until({}, () => log.x <= lastBenchEnd + TILE + 2 && log.dir > 0, 600);
      p.until({ right: true }, () => s.player.body.x + s.player.body.w >= lastBenchEnd - 2);
      p.step({ right: true, jump: true }, 10);
      p.until({ right: true }, () => s.player.grounded, 60);
      p.step({}, 2);
      expect(standsAt(s, TERRACE.feet) && s.player.body.x >= log.x - s.player.body.w, `nach ${wait} s: auf dem Stamm`).toBe(true);
      p.until({}, () => log.dir < 0 || log.x >= log.spec.cx * TILE + log.spec.travel * TILE - 1, 600);
      p.until({ right: true }, () => s.player.body.x + s.player.body.w >= log.x + log.spec.width * TILE - 2, 60);
      p.step({ right: true, jump: true }, 12);
      p.until({ right: true }, () => has(p.events, 'checkpoint'), 120);
      expect(has(p.events, 'checkpoint'), `nach ${wait} s: Steinmännchen`).toBe(true);
      expect(has(p.events, 'death')).toBe(false);
    }
  });
});

describe('Level 1-2: Edelweiß', () => {
  it('Edelweiß 1 ist mit Helm von unten erreichbar', () => {
    const s = calm();
    placePlayer(s, E1_ROCK.cx, CLIFF.feet - 1);
    s.player.helm = true;
    const ev = runGame(s, [[{}, 2], [{ jump: true }, 20], [{}, 40], [{ jump: true }, 30], [{}, 40]]);
    expect(ev).toContainEqual({ type: 'rockBreak', ...E1_ROCK });
    expect(s.session.edelweiss[0]).toBe(true);
  });

  it('Edelweiß 1 ist auch per Stampfen von oben erreichbar', () => {
    const s = calm();
    placePlayer(s, E1_ROCK.cx, E1_BLOCK.feet - 1);
    const ev = runGame(s, [[{}, 2], [{ jump: true }, 10], [{ down: true }, 1], [{}, 60]]);
    expect(ev).toContainEqual({ type: 'rockBreak', cx: E1_ROCK.cx, cy: E1_BLOCK.feet });
    expect(s.session.edelweiss[0]).toBe(true);
  });

  it('Edelweiß 1 bleibt ohne Helm und ohne Stampfen hinter den Felsblöcken', () => {
    for (const [feet, dir] of [[CLIFF.feet, {}], [E1_BLOCK.feet, {}], [E1_BLOCK.feet, { right: true }]] as const) {
      const s = calm();
      placePlayer(s, E1_ROCK.cx, feet - 1);
      runGame(s, [[{}, 2], [{ ...dir, jump: true }, 20], [dir, 40], [{ ...dir, jump: true }, 30], [dir, 40]]);
      expect(s.session.edelweiss[0]).toBe(false);
    }
    const s = calm();
    placePlayer(s, E1_ROCK.cx, CLIFF.feet - 1);
    expect(runGame(s, [[{}, 2], [{ jump: true }, 20], [{}, 30]])).toContainEqual({ type: 'bump', ...E1_ROCK });
  });

  it('Edelweiß 2: am schwebenden Felsklotz hinaufkraxeln, von links und von rechts, egal wann oben gedrückt wird', () => {
    for (const [cx, dir] of [[ROCK.cx - 1, { right: true }], [ROCK.cx + 2, { left: true }]] as const) {
      for (const upAfter of [0, 6, 12, 20]) {
        const s = calm();
        placePlayer(s, cx, FLOOR_FEET - 1);
        const jumpPart: Script = upAfter > 0 ? [[{ ...dir, jump: true }, upAfter]] : [];
        runGame(s, [[{}, 2], ...jumpPart, [{ ...dir, up: true, jump: true }, 60 - upAfter], [{}, 20]]);
        expect(s.session.edelweiss[1], `Start ${cx}, oben nach ${upAfter}`).toBe(true);
        expect(standsAt(s, ROCK.top), `Start ${cx}, oben nach ${upAfter}: auf dem Klotz`).toBe(true);
      }
    }
  });

  it('unter dem Felsklotz führt ein Durchgang hindurch, der Weg zum Schlussanstieg ist frei', () => {
    const s = calm();
    placePlayer(s, ROCK.cx - 4, FLOOR_FEET - 1);
    const p = play(s);
    p.step({}, 2);
    p.until({ right: true }, () => midCol(s) > ROCK.cx + 4, 200);
    expect(standsAt(s, FLOOR_FEET)).toBe(true);
    expect(s.session.edelweiss[1]).toBe(false);
  });

  it('Edelweiß 2 gibt es nur mit Kraxeln: Springen, Anlauf und Federn auf den Polstern in der Nähe reichen nicht', () => {
    expect(edelweiss(1)).toMatchObject({ cx: ROCK.cx, cy: ROCK.top - 1 });
    expect(solidCell(L, ROCK.cx, ROCK.bottom + 1)).toBe(false);
    // Vom Boden um den Klotz, vom Absatz mit Edelweiß 3, vom Pfeiler und von der Bank des Schlussanstiegs.
    const spots: Array<[number, number]> = [];
    for (let cx = ROCK.cx - 8; cx <= ROCK.cx + 9; cx++) if (!solidCell(L, cx, FLOOR_FEET - 1)) spots.push([cx, FLOOR_FEET - 1]);
    for (let cx = E3_LEDGE.cx; cx <= E3_LEDGE.cx + 2; cx++) spots.push([cx, E3_LEDGE.feet - 1]);
    for (let cx = FINAL_PAD.cx + 2; cx <= FINAL_PAD.cx + 5; cx++) spots.push([cx, PILLAR_FEET - 1]);
    for (let cx = FINAL_PAD.cx + 3; cx <= FINAL_PAD.cx + 5; cx++) spots.push([cx, TOP_BENCH_FEET - 1]);
    for (const [cx, cy] of spots) {
      for (const dir of [{ right: true }, { left: true }]) {
        for (let run = 0; run <= 72; run += 12) {
          for (const hold of [4, 16, 40]) {
            const s = calm();
            placePlayer(s, cx, cy);
            runGame(s, [[{}, 2], [dir, run], [{ ...dir, jump: true }, hold], [{ ...dir, jump: hold >= 40 }, 120], [{}, 30]]);
            expect(s.session.edelweiss[1], `Start ${cx},${cy}`).toBe(false);
          }
        }
      }
    }
    // Federn auf dem Polster am Pfeiler und in der Mulde, auch mit Anlauf vom Pfeiler herunter.
    for (const [cx, cy] of [[FINAL_PAD.cx + 5, PILLAR_FEET - 1], [FINAL_PAD.cx - 4, FLOOR_FEET - 1], [E3_PAD.cx + 4, FLOOR_FEET - 1]] as const) {
      for (const holdJump of [false, true]) {
        for (let drift = 0; drift <= 120; drift += 20) {
          const s = calm();
          placePlayer(s, cx, cy);
          const p = play(s);
          p.step({}, 2);
          p.until({ left: true, jump: holdJump }, () => has(p.events, 'bounce'), 200);
          p.step({ left: true, jump: holdJump }, drift);
          p.step({ jump: holdJump }, 120);
          expect(s.session.edelweiss[1], `Federn ab ${cx},${cy}, links ${drift}`).toBe(false);
        }
      }
    }
  }, 30_000);

  /** Deckt die versteckte Kiste auf, geht auf festen Boden und stellt sich auf die rechte Polsterhälfte. */
  function revealHidden() {
    const s = calm();
    placePlayer(s, HIDDEN.cx, FLOOR_FEET - 1);
    const p = play(s);
    p.step({}, 2);
    p.step({ jump: true }, 8);
    p.step({}, 90);
    p.until({ right: true }, () => s.player.grounded && s.player.body.x > (E3_PAD.cx + 2) * TILE, 300);
    p.step({}, 20);
    p.until({ left: true }, () => s.player.body.x <= (E3_PAD.cx + 1) * TILE + 10);
    p.step({}, 20);
    return { s, p };
  }

  it('Edelweiß 3: Federn deckt die versteckte Kiste auf, sie dient als Stufe zum Absatz', () => {
    const { s, p } = revealHidden();
    expect(p.events).toContainEqual({ type: 'crateOpen', ...HIDDEN });
    // Hüpfen, gehalten federn, am Scheitel nach links auf die Kiste.
    const before = p.events.length;
    p.step({ jump: true }, 8);
    p.until({ jump: true }, () => p.events.slice(before).some((e) => e.type === 'bounce'), 80);
    p.until({ jump: true }, () => s.player.body.vy >= 0, 60);
    p.step({ left: true, jump: true }, 6);
    p.step({}, 40);
    expect(standsAt(s, HIDDEN.cy), 'auf der Kiste').toBe(true);
    p.step({ right: true, jump: true }, 22);
    p.step({ right: true }, 6);
    p.step({}, 30);
    expect(s.session.edelweiss[2]).toBe(true);
  });

  it('Edelweiß 3: wer nur gerade federt, stößt die Kiste auf, kraxelt an ihr hoch und kommt ebenfalls hin', () => {
    const { s, p } = revealHidden();
    const before = p.events.length;
    p.step({ jump: true }, 8);
    p.until({}, () => p.events.slice(before).some((e) => e.type === 'bounce'), 80);
    p.until({}, () => feetRow(s) < HIDDEN.cy + 1, 60); // neben der Kiste angekommen
    p.until({ left: true, up: true }, () => standsAt(s, HIDDEN.cy), 80);
    p.step({}, 20);
    expect(standsAt(s, HIDDEN.cy), 'auf der Kiste').toBe(true);
    p.step({ right: true, jump: true }, 22);
    p.step({ right: true }, 6);
    p.step({}, 30);
    expect(s.session.edelweiss[2]).toBe(true);
  });

  it('Edelweiß 3 ist ohne die versteckte Kiste nicht erreichbar, auch nicht mit Federn, Anlauf oder Kraxeln', () => {
    const rows = LEVELS['1-2'].split('\n');
    const sep = rows.indexOf('---');
    rows[sep + 1 + HIDDEN.cy] = rows[sep + 1 + HIDDEN.cy]!.replace('V', '.');
    const without = parseLevel('1-2', rows.join('\n'));
    expect(cellAt(L, HIDDEN.cx, HIDDEN.cy)).toBe(Cell.HiddenCrate);
    expect(validateLevel(without, { requireEdelweiss: true, requireGoal: true })).toEqual([]);
    const spots: Array<[number, number]> = [];
    for (let cx = RIM.cx - 3; cx <= RIM.cx; cx++) spots.push([cx, RIM.feet - 1]);
    for (let cx = RIM.cx + 1; cx <= ROCK.cx - 1; cx++) spots.push([cx, FLOOR_FEET - 1]);
    for (const [cx, cy] of spots) {
      for (const dir of [{ right: true }, { left: true }]) {
        for (let run = 0; run <= 72; run += 12) {
          for (const hold of [1, 20, 40]) {
            for (const upAfter of [-1, 0, 12, 24]) {
              const s = calm(without);
              placePlayer(s, cx, cy);
              const script: Script = upAfter < 0
                ? [[{}, 2], [dir, run], [{ ...dir, jump: true }, hold], [{ ...dir, jump: true }, 100], [dir, 30]]
                : [[{}, 2], [dir, run], [{ ...dir, jump: true }, Math.min(hold, upAfter)], [{ ...dir, up: true, jump: hold > upAfter }, 100], [dir, 30]];
              runGame(s, script);
              expect(s.session.edelweiss[2], `Start ${cx},${cy}`).toBe(false);
            }
          }
        }
      }
    }
  }, 60_000);
});

describe('Level 1-2: Kamera', () => {
  const levelPx = { w: L.width * TILE, h: L.height * TILE };
  /** Steht Kraxel an (cx, cy), liegt die Zelle (tx, ty) ganz im Bild und unter der Info-Leiste (12 px)? */
  function inView(cx: number, cy: number, tx: number, ty: number, w: number): boolean {
    const s = calm();
    placePlayer(s, cx, cy);
    runGame(s, [[{}, 5]]);
    const view = { w, h: VIEW_H };
    const c = createCamera(s.player, view, levelPx);
    for (let i = 0; i < 120; i++) stepCamera(c, s.player, view, levelPx, STEP);
    const x = tx * TILE, y = ty * TILE;
    return x >= c.x && x + TILE <= c.x + w && y >= c.y + 12 && y + TILE <= c.y + VIEW_H;
  }

  it('vom ersten Polster aus sieht man die Oberkante der Wand, hochkant und quer', () => {
    for (const w of [256, 416]) expect(inView(INTRO_PAD.cx - 1, START_FEET - 1, CLIFF.cx + 1, CLIFF.feet, w)).toBe(true);
  });

  it('zeigt Edelweiß 1 von der Wiese unter dem Absatz, hochkant und quer', () => {
    for (const w of [256, 416]) expect(inView(E1_ROCK.cx - 3, CLIFF.feet - 1, edelweiss(0).cx, edelweiss(0).cy, w)).toBe(true);
  });

  it('zeigt Edelweiß 3, wenn Kraxel von links an den Rand über der Mulde läuft, hochkant und quer', () => {
    const e3 = edelweiss(2);
    for (const w of [256, 416]) {
      const s = calm();
      placePlayer(s, RIM.cx - 6, 11);
      const p = play(s, w);
      p.step({}, 2);
      p.until({ right: true }, () => standsAt(s, RIM.feet) && midCol(s) > RIM.cx, 300);
      p.step({}, 120);
      expect(standsAt(s, RIM.feet)).toBe(true);
      const c = p.cam;
      expect(e3.cx * TILE >= c.x && (e3.cx + 1) * TILE <= c.x + w && e3.cy * TILE >= c.y + 12 && (e3.cy + 1) * TILE <= c.y + VIEW_H, `Bild ${w}`).toBe(true);
    }
  });

  it('zeigt Edelweiß 2 vom Boden vor dem Felsklotz, hochkant und quer', () => {
    for (const w of [256, 416]) expect(inView(ROCK.cx - 3, FLOOR_FEET - 1, edelweiss(1).cx, edelweiss(1).cy, w)).toBe(true);
  });

  it('von jedem Polster der Polsterkette ist das nächste zu sehen, hochkant', () => {
    const chain = padGroups(L).filter((g) => g.cx > CHAIN_EDGE.cx && g.cx < LEDGE_D.cx);
    expect(chain.length).toBe(3);
    const targets = [...chain.map((g) => ({ cx: g.cx + g.w - 1, cy: g.cy })), { cx: LEDGE_D.cx + 1, cy: LEDGE_D.feet }];
    expect(inView(CHAIN_EDGE.cx, CHAIN_EDGE.feet - 1, targets[0]!.cx, targets[0]!.cy, 256)).toBe(true);
    for (let k = 0; k < chain.length; k++) {
      // Auf dem Polster steht man nie; die Kamera steht wie beim Absprung von der Steinmännchen-Fläche, Kraxel ist über dem Polster.
      const s = calm();
      placePlayer(s, CHAIN_EDGE.cx, CHAIN_EDGE.feet - 1);
      runGame(s, [[{}, 5]]);
      const view = { w: 256, h: VIEW_H };
      const c = createCamera(s.player, view, levelPx);
      for (let i = 0; i < 120; i++) stepCamera(c, s.player, view, levelPx, STEP);
      s.player.body.x = chain[k]!.cx * TILE + 3;
      s.player.grounded = false;
      for (let i = 0; i < 60; i++) stepCamera(c, s.player, view, levelPx, STEP);
      const t = targets[k + 1]!;
      expect(t.cx * TILE + TILE <= c.x + 256 && t.cy * TILE + TILE <= c.y + VIEW_H, `nach Polster ${k + 1}`).toBe(true);
    }
  });
});

describe('Level 1-2: Gruben', () => {
  it('Gruben sind höchstens 6 Kacheln breit, mindestens eine braucht Anlauf', () => {
    const widths = pits(L).map((p) => p.to - p.from + 1);
    expect(widths.length).toBeGreaterThanOrEqual(4);
    expect(Math.max(...widths)).toBeLessThanOrEqual(6);
    expect(groundPits(L).some((p) => p.to - p.from + 1 >= 5)).toBe(true);
  });

  it('jede Grube mit festen Rändern ist mit Renntempo überspringbar', () => {
    const list = groundPits(L);
    expect(list.length).toBeGreaterThanOrEqual(2);
    for (const pit of list) {
      const top = surface(L, pit.from - 1);
      let start = pit.from - 1;
      while (start > pit.from - 8 && surface(L, start - 1) === top && !solidCell(L, start - 1, top - 1) && !solidCell(L, start - 1, top - 2)) start--;
      const s = calm();
      placePlayer(s, start, top - 1);
      const ev: GameEvent[] = runGame(s, [[{}, 2]]);
      for (let n = 0; n < 300 && s.player.body.x + s.player.body.w < pit.from * TILE - 2; n++) ev.push(...runGame(s, [[{ right: true }, 1]]));
      ev.push(...runGame(s, [[{ right: true, jump: true }, 40]]));
      for (let n = 0; n < 200 && !s.player.grounded && s.phase === 'playing'; n++) ev.push(...runGame(s, [[{ right: true }, 1]]));
      expect(ev.filter((e) => e.type === 'death'), `Grube ${pit.from}-${pit.to}`).toEqual([]);
      expect(s.player.grounded, `Grube ${pit.from}-${pit.to}`).toBe(true);
      expect(s.player.body.x + s.player.body.w / 2, `Grube ${pit.from}-${pit.to}`).toBeGreaterThan((pit.to + 1) * TILE);
    }
  });

  it('Gegner auf den Landeinseln nehmen niemandem die Landung, mit echter Kamera und wartendem Spieler', () => {
    const checkpoint = L.spawns.find((e) => e.kind === 'checkpoint')!;
    const levelPx = { w: L.width * TILE, h: L.height * TILE };
    const SECOND = 60;
    function tryPit(pit: { from: number; to: number }, viewW: number, mode: 'run' | 'stand', wait: number): { events: GameEvent[]; landed: boolean } {
      const top = surface(L, pit.from - 1);
      let start = pit.from - 1;
      if (mode === 'run') {
        while (start > pit.from - 8 && surface(L, start - 1) === top && !solidCell(L, start - 1, top - 1) && !solidCell(L, start - 1, top - 2)) start--;
      }
      const s = createGame(L); // mit Gegnern
      placePlayer(s, start, top - 1);
      const view = { w: viewW, h: VIEW_H };
      const cam = createCamera(s.player, view, levelPx);
      const sampler = new InputSampler();
      const events: GameEvent[] = [];
      let recording = false;
      const step = (input: Partial<Held>) => {
        const ev = stepGame(s, sampler.sample(held(input)), DEFAULT_TUNING, { x: cam.x, w: viewW }, STEP);
        if (recording) events.push(...ev);
        stepCamera(cam, s.player, view, levelPx, STEP);
      };
      for (let i = 0; i < 3; i++) step({});
      const edge = () => s.player.body.x + s.player.body.w >= pit.from * TILE - 2;
      if (mode === 'run') {
        for (let i = 0; i < Math.round(wait * SECOND); i++) step({});
        for (let n = 0; n < 300 && !edge(); n++) step({ right: true });
      } else {
        for (let n = 0; n < 300 && !edge(); n++) step({ right: true });
        for (let i = 0; i < 40; i++) step({});
        for (let i = 0; i < Math.round(wait * SECOND); i++) step({});
      }
      recording = true;
      for (let i = 0; i < 40; i++) step({ right: true, jump: true });
      for (let n = 0; n < 200 && !s.player.grounded && s.phase === 'playing'; n++) step({ right: true });
      const landed = s.player.grounded;
      for (let i = 0; i < 6; i++) step({ right: true });
      return { events, landed };
    }

    const list = groundPits(L).filter((p) => p.from > checkpoint.cx);
    expect(list.length).toBeGreaterThanOrEqual(2);
    for (const pit of list) {
      for (const viewW of [256, 416, 512]) {
        for (const wait of [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3]) {
          const r = tryPit(pit, viewW, 'run', wait);
          expect(r.events.filter((e) => e.type === 'hurt'), `Grube ${pit.from}-${pit.to} Anlauf nach ${wait} s, Bild ${viewW}`).toEqual([]);
          expect(r.landed, `Grube ${pit.from}-${pit.to} Anlauf nach ${wait} s, Bild ${viewW}: gelandet`).toBe(true);
          if (pit.to - pit.from + 1 <= 4) {
            const t = tryPit(pit, viewW, 'stand', wait);
            expect(t.events.filter((e) => e.type === 'hurt'), `Grube ${pit.from}-${pit.to} Stand nach ${wait} s, Bild ${viewW}`).toEqual([]);
          }
        }
      }
    }
  }, 30_000);

  it('kein Gegner steht direkt an einer Landestelle', () => {
    expect(pits(L).length).toBeGreaterThanOrEqual(4);
    for (const pit of pits(L)) {
      const ground = surface(L, pit.to + 1);
      const close = L.spawns.filter((e) => (e.kind === 'beetle' || e.kind === 'snail') && e.cx > pit.to && e.cx <= pit.to + 3 && e.cy >= ground - 2);
      expect(close, `Grube ${pit.from}-${pit.to}`).toEqual([]);
    }
  });
});

describe('Level 1-2: Weg durch die Abschnitte', () => {
  it('von der Hochfläche führen Stufen hinunter auf den Absatz vor den Bänken, nicht ins Tal', () => {
    const j = crates('sling')[0]!;
    const s = calm();
    placePlayer(s, j.cx, PLATEAU_FEET - 1);
    const p = play(s);
    p.step({}, 2);
    p.until({ right: true }, () => midCol(s) > TERRACE.cx - 1.5, 400);
    p.step({}, 30);
    expect(standsAt(s, TERRACE.feet)).toBe(true);
    expect(surface(L, TERRACE.cx)).toBe(TERRACE.feet);
    expect(surface(L, TERRACE.cx + 1)).toBe(VALLEY_FEET);
  });

  it('vom Absatz hinter den Gruben geht es über Stufen hinab bis zum Rand über der Mulde', () => {
    const s = calm();
    placePlayer(s, RIM.cx - 8, 8);
    const p = play(s);
    p.step({}, 2);
    p.until({ right: true }, () => midCol(s) > RIM.cx, 400);
    p.step({}, 30);
    expect(standsAt(s, RIM.feet)).toBe(true);
  });

  it('Schlussanstieg als Polsterleiter: Polster am Pfeiler, Polster am Gipfelhang, Bank, Gipfelfläche bis zum Gipfelkreuz', () => {
    for (let start = FINAL.cx - 4; start <= FINAL.cx + 2; start += 2) {
      for (const hold of [6, 20]) {
        const s = calm();
        placePlayer(s, start, FINAL.feet - 1);
        const p = play(s);
        p.step({}, 2);
        const bounces = () => p.events.filter((e) => e.type === 'bounce').length;
        // Aufs Polster am Pfeiler springen (zu weit springt gegen den Pfeiler und rutscht aufs Polster), rechts halten.
        p.until({ right: true }, () => s.player.body.x + s.player.body.w >= FINAL_PAD.cx * TILE - 20);
        p.step({ right: true, jump: true }, hold);
        p.until({ right: true }, () => bounces() >= 1 && s.player.grounded, 200);
        p.step({}, 10);
        expect(standsAt(s, PILLAR_FEET), `Start ${start}, Sprung ${hold}: Pfeiler`).toBe(true);
        // Aufs Polster am Gipfelhang, beim Federn links auf die Bank.
        const before = bounces();
        p.step({ right: true, jump: true }, hold);
        p.until({ right: true }, () => bounces() > before, 200);
        p.until({ left: true }, () => s.player.grounded, 200);
        p.step({}, 10);
        expect(standsAt(s, TOP_BENCH_FEET), `Start ${start}, Sprung ${hold}: Bank`).toBe(true);
        p.step({ right: true, jump: true }, 20);
        p.until({ right: true }, () => s.phase !== 'playing', 400);
        expect(s.phase, `Start ${start}, Sprung ${hold}`).toBe('goal');
        expect(has(p.events, 'death')).toBe(false);
      }
    }
  });
});
