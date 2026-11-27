// Level 1-3 „Bachgrund“: Aufbau, die treibenden Stämme (Lehrstellen), der geheime Ausgang im Felsturm, die drei Edelweiß, Gruben und Kamera.
// Alle Wege laufen über echte Eingabe-Skripte mit durchgehendem Eingabe-Takt, nichts wird zum Ziel teleportiert.
import { describe, expect, it } from 'vitest';
import { STEP, TILE, VIEW_H } from '../config.ts';
import { createCamera, stepCamera } from '../core/camera.ts';
import { platformSupports } from '../core/collide.ts';
import { createGame, GOAL_HEIGHT_TILES, stepGame } from '../core/game.ts';
import type { GameState } from '../core/game.ts';
import { InputSampler } from '../core/input-frame.ts';
import { parseLevel, validateLevel } from '../core/level.ts';
import type { LevelData } from '../core/level.ts';
import type { PlatformState } from '../core/platforms.ts';
import { held, placePlayer, runGame } from '../core/test-helpers.ts';
import type { Script } from '../core/test-helpers.ts';
import { DEFAULT_TUNING } from '../core/tuning.ts';
import { Cell } from '../core/types.ts';
import type { GameEvent, Held, SpecialItem } from '../core/types.ts';
import { LEVELS } from './index.ts';

const L = parseLevel('1-3', LEVELS['1-3']);

// Stellen aus 1-3.txt als (Spalte, Reihe). „Füße“ meint die Reihe, auf deren Oberkante Kraxel steht.
const BANK_FEET = 17;                                // alle Ufer am Bach
const WATER_TOP = 18;                                // oberste Wasserreihe, darunter Wasser bis zum Levelboden
const START_EDGE = 17;                               // rechter Rand der Startwiese, dahinter Stamm 1
const BANK_C = { from: 25, to: 38 };                 // Ufer zwischen Stamm 1 und den beiden Treffstämmen
const BANK_E = { from: 55, to: 66 };                 // Ufer unter dem Felsturm
const HUMPS_E = [57, 63];                            // Höcker auf Ufer E, dazwischen die Helm-Kiste
const TOWER = { x0: 58, x1: 65, roof: 2, floor: 8 }; // Felsturm, innen die Kammer mit dem goldenen Kreuz
const ARCH = { x0: 66, x1: 69 };                     // Felsbogen: das Turmdach reicht über den Schacht von Stamm 4 bis an die Felsnase
const ROOF_ROCKS = [61, 62];                         // Felsblöcke im Turmdach (Stampfen von oben)
const FLOOR_ROCK = { cx: 61, cy: 8 };                // Felsblock im Kammerboden (Helm von unten)
const LEDGE = { x0: 58, x1: 65, feet: 11 };          // Absatz unter dem Turm, von Stamm 4 aus zu erreichen
const MEADOW = { from: 70, to: 104, feet: 9 };       // Hochwiese über dem senkrechten Stamm
const OVERHANG = { x0: 70, x1: 72, top: 3 };         // Felsnase über dem Ausstieg von Stamm 4, Edelweiß 2 obenauf
const NEST = { x0: 80, x1: 82, top: 4 };             // schwebendes Felsnest, Edelweiß 1 zwischen zwei Felsblöcken
const NEST_ROCK = { cx: 81, cy: 6 };                 // unterer Felsblock des Nests, der obere liegt in Reihe 4
const STEPS = [{ from: 105, feet: 12 }, { from: 108, feet: 15 }]; // Abstieg von der Hochwiese zum Bach
const BANK_H = { from: 111, to: 118 };               // Ufer vor der Stromschnelle
const PILLAR = { x0: 130, x1: 132, feet: 15 };       // Felssäule im Bach, zwei Kacheln über dem Ufer
const HIDDEN = { cx: 131, cy: 12 };                  // versteckte Kiste über der Säule, Edelweiß 3 darüber
const BANK_J = { from: 143, to: 154 };               // Ufer hinter der Stromschnelle
const ISLAND_1 = { from: 158, to: 166 };             // Insel zwischen den Gruben, Anlauf für die breite Grube
const ISLAND_2 = { from: 172, to: 178 };             // Insel vor dem letzten Stamm
const FINAL_FROM = 190;                              // Schlussufer mit dem Gipfelkreuz
const LOG = { first: 0, meetA: 1, meetB: 2, lift: 3, rapid: 4, rapidLift: 5, drop: 6, last: 7 } as const;

const feetRow = (s: GameState) => (s.player.body.y + s.player.body.h) / TILE;
const midCol = (s: GameState) => (s.player.body.x + s.player.body.w / 2) / TILE;
const cellAt = (l: LevelData, cx: number, cy: number) => l.cells[cy * l.width + cx];
const solidCell = (l: LevelData, cx: number, cy: number) => {
  const c = cellAt(l, cx, cy);
  return c === Cell.Ground || c === Cell.Rock || c === Cell.Crate || c === Cell.CrateUsed || c === Cell.LeafPad;
};
/** Ohne Gegner: für Wege, bei denen es nur um Sprünge und Stämme geht. */
const calm = (l: LevelData = L, opts: { helm?: boolean; special?: SpecialItem | null } = {}) => {
  const s = createGame(l, undefined, opts);
  s.enemies = [];
  return s;
};
const standsAt = (s: GameState, feet: number) => s.player.grounded && Math.abs(feetRow(s) - feet) < 1e-6;
const has = (ev: GameEvent[], type: GameEvent['type']) => ev.some((e) => e.type === type);
const exitOf = (ev: GameEvent[]) => ev.find((e) => e.type === 'goal')?.exit ?? null;
const edelweiss = (i: number) => L.spawns.find((s) => s.kind === 'edelweiss' && s.index === i)!;
const secretGoal = () => L.spawns.find((s) => s.kind === 'secretGoal')!;
const logRight = (pl: PlatformState) => pl.x + pl.spec.width * TILE;
const onLog = (s: GameState, pl: PlatformState) => s.player.grounded && platformSupports(s.player.body, pl);
/** Spalten, die die Plattform auf ihrem ganzen Weg überstreicht. */
const pathCols = (pl: { cx: number; width: number; axis: 'h' | 'v'; travel: number }) => {
  const h = pl.axis === 'h';
  return { x0: pl.cx + (h ? Math.min(0, pl.travel) : 0), x1: pl.cx + pl.width - 1 + (h ? Math.max(0, pl.travel) : 0) };
};

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
    for (let i = 0; i < max && !done() && s.phase === 'playing'; i++) step(input);
  };
  return { step, until, cam, events };
}
type Play = ReturnType<typeof play>;

/** Geht gesteuert, bis die Körpermitte höchstens 1 px neben `x` (px) liegt, und bleibt stehen. Springt nicht. */
function goToX(s: GameState, p: Play, x: number): void {
  for (let i = 0; i < 900 && s.phase === 'playing'; i++) {
    const b = s.player.body, dx = x - (b.x + b.w / 2);
    if (Math.abs(dx) <= 1 && Math.abs(b.vx) < 1 && s.player.grounded) return;
    const stop = (b.vx * b.vx) / (2 * DEFAULT_TUNING.groundDecel);
    if (dx > 1 && (b.vx <= 0 || dx > stop + 1)) p.step({ right: true });
    else if (dx < -1 && (b.vx >= 0 || -dx > stop + 1)) p.step({ left: true });
    else p.step({});
  }
}
/** Körpermitte auf die Mitte von Spalte `cx`. */
const goTo = (s: GameState, p: Play, cx: number) => goToX(s, p, (cx + 0.5) * TILE);
/** An die rechte Kante der Fläche, die in Spalte `edge` endet: Körper 2 px vor dem Rand. */
const toEdge = (s: GameState, p: Play, edge: number) => goToX(s, p, (edge + 1) * TILE - 7);

/** Läuft nach rechts, bis die Körpermitte hinter Spalte `cx` liegt; vor einem Höcker (feste Zelle auf Fußhöhe) ein kurzer Hüpfer. */
function walkRight(s: GameState, p: Play, cx: number, max = 900): void {
  for (let i = 0; i < max && midCol(s) < cx && s.phase === 'playing'; i++) {
    const b = s.player.body;
    const ahead = Math.floor((b.x + b.w + 1) / TILE), row = Math.floor((b.y + b.h - 1) / TILE);
    p.step({ right: true, jump: s.player.grounded && s.grid.isSolid(ahead, row) });
  }
}

/** Wartet an der Uferkante `edge`, bis der waagerechte Stamm bündig anliegt, steigt auf und stellt sich an seinen rechten Rand. */
function boardRight(s: GameState, p: Play, pl: PlatformState, edge: number): void {
  toEdge(s, p, edge);
  p.until({}, () => pl.x <= (edge + 1) * TILE + 2, 900);
  p.until({ right: true }, () => onLog(s, pl) && s.player.body.x + s.player.body.w >= logRight(pl) - 8, 240);
  p.step({}, 12);
}
/** Auf dem Stamm an seinen rechten Rand gehen. */
function toLogRight(s: GameState, p: Play, pl: PlatformState): void {
  p.until({ right: true }, () => s.player.body.x + s.player.body.w >= logRight(pl) - 8, 240);
  p.step({}, 12);
}
/** Fährt mit, bis der Stamm am Ufer ab Spalte `bank` anliegt, und geht hinüber. */
function alightRight(s: GameState, p: Play, pl: PlatformState, bank: number): void {
  p.until({}, () => logRight(pl) >= bank * TILE - 2, 900);
  p.until({ right: true }, () => s.player.grounded && !onLog(s, pl) && midCol(s) > bank + 0.5, 240);
  p.step({}, 12);
}
/**
 * Springt (Sprung `hold` Schritte gehalten) und steuert in der Luft auf `target()` (px, Körpermitte) zu, wie ein Spieler, der eine
 * Landestelle anpeilt: drücken, solange der Bremsweg noch reicht, sonst gegensteuern. Endet, wenn Kraxel wieder steht.
 */
function jumpTo(s: GameState, p: Play, target: () => number, hold = 20): void {
  const brakeAccel = DEFAULT_TUNING.airAccel;
  for (let i = 0; i < 150 && s.phase === 'playing' && (i === 0 || !s.player.grounded); i++) {
    const b = s.player.body, dx = target() - (b.x + b.w / 2);
    const brake = (b.vx * Math.abs(b.vx)) / (2 * brakeAccel);
    const steer = dx - brake > 3 ? { right: true } : dx - brake < -3 ? { left: true } : {};
    p.step({ ...steer, jump: i < hold });
  }
  p.step({}, 10);
}

// Abschnitte des Hauptwegs. Jeder beginnt dort, wo der vorige endet; zusammen ergeben sie den Weg von P bis Z.
const route = {
  /** Startwiese → Stamm 1 → Ufer C. */
  first(s: GameState, p: Play) {
    const pl = s.platforms[LOG.first]!;
    boardRight(s, p, pl, START_EDGE);
    alightRight(s, p, pl, BANK_C.from);
  },
  /** Ufer C → Stamm 2, in der Mitte hinüber auf Stamm 3 → Ufer E. */
  meeting(s: GameState, p: Play) {
    const a = s.platforms[LOG.meetA]!, b = s.platforms[LOG.meetB]!;
    boardRight(s, p, a, BANK_C.to);
    p.until({}, () => b.x - logRight(a) <= 20, 900);
    jumpTo(s, p, () => b.x + 24, 10);
    expect(onLog(s, b), 'auf Stamm 3').toBe(true);
    toLogRight(s, p, b);
    alightRight(s, p, b, BANK_E.from);
  },
  /** Ufer E → an die Kante vor Stamm 4. */
  toLift(s: GameState, p: Play) {
    walkRight(s, p, BANK_E.to - 1.5);
    toEdge(s, p, BANK_E.to);
  },
  /** Auf den senkrechten Stamm 4 springen, wenn er tief genug ist (aus der Lage an der Kante vor ihm). */
  boardLift(s: GameState, p: Play) {
    const pl = s.platforms[LOG.lift]!;
    p.until({}, () => pl.dir < 0 && pl.y >= (BANK_FEET - 3) * TILE, 900);
    p.step({ right: true, jump: true }, 10);
    p.until({ right: true }, () => onLog(s, pl), 90);
    expect(onLog(s, pl), 'auf Stamm 4').toBe(true);
  },
  /** Auf Stamm 4 rechts halten: oben tritt Kraxel auf die Hochwiese. */
  liftToMeadow(s: GameState, p: Play) {
    p.until({ right: true }, () => standsAt(s, MEADOW.feet) && midCol(s) > MEADOW.from + 0.5, 600);
    p.step({}, 10);
  },
  /** Über die Hochwiese (Höcker der Gegner-Pferche) und die Stufen hinab an die Kante vor Stamm 5. */
  meadowAndDescent(s: GameState, p: Play) {
    walkRight(s, p, BANK_H.to - 1.5);
    toEdge(s, p, BANK_H.to);
  },
  /** Stamm 5 → hinüber auf den senkrechten Stamm 6, wenn er unten ist → hinauf auf die Felssäule. */
  rapid(s: GameState, p: Play) {
    const a = s.platforms[LOG.rapid]!, v = s.platforms[LOG.rapidLift]!;
    boardRight(s, p, a, BANK_H.to);
    p.until({}, () => logRight(a) >= (v.spec.cx - 1) * TILE - 2 && v.y >= (BANK_FEET - 1) * TILE, 900);
    jumpTo(s, p, () => v.x + v.spec.width * TILE / 2, 10);
    expect(onLog(s, v), 'auf Stamm 6').toBe(true);
    p.until({ right: true }, () => standsAt(s, PILLAR.feet) && midCol(s) > PILLAR.x0 + 0.5, 400);
    p.step({}, 10);
  },
  /** Von der Säule auf Stamm 7 hinunter, sobald er anliegt → Ufer J. */
  drop(s: GameState, p: Play) {
    const pl = s.platforms[LOG.drop]!;
    toEdge(s, p, PILLAR.x1);
    p.until({}, () => pl.dir < 0 && pl.x <= (PILLAR.x1 + 1) * TILE + 12, 900);
    p.until({ right: true }, () => !s.player.grounded, 30);
    p.until({}, () => s.player.grounded, 60);
    p.step({}, 10);
    expect(onLog(s, pl), 'auf Stamm 7').toBe(true);
    toLogRight(s, p, pl);
    alightRight(s, p, pl, BANK_J.from);
  },
  /** Ufer J mit dem Schnecken-Pferch, kleine Grube, Anlauf über Insel 1, breite Grube → Insel 2. */
  pits(s: GameState, p: Play) {
    walkRight(s, p, BANK_J.to - 1.5);
    toEdge(s, p, BANK_J.to);
    jumpTo(s, p, () => (ISLAND_1.from + 1.5) * TILE);
    goTo(s, p, ISLAND_1.from);
    p.until({ right: true }, () => s.player.body.x + s.player.body.w >= (ISLAND_1.to + 1) * TILE - 2, 300);
    jumpTo(s, p, () => (ISLAND_2.from + 1.5) * TILE, 40);
  },
  /** Von Insel 2 auf den letzten Stamm, ihn reiten, auf das Schlussufer springen, zum Gipfelkreuz. */
  last(s: GameState, p: Play) {
    const pl = s.platforms[LOG.last]!;
    toEdge(s, p, ISLAND_2.to);
    // Abspringen, wenn der Stamm anderthalb bis zwei Kacheln vor seinem linken Ende auf Kraxel zukommt.
    p.until({}, () => pl.dir < 0 && pl.x <= (pl.spec.cx + 2) * TILE && pl.x >= (pl.spec.cx + 1.5) * TILE, 900);
    jumpTo(s, p, () => pl.x + 24);
    expect(onLog(s, pl), 'auf dem letzten Stamm').toBe(true);
    toLogRight(s, p, pl);
    p.until({}, () => pl.dir > 0 && logRight(pl) >= (pl.spec.cx + pl.spec.travel + pl.spec.width) * TILE - 2, 900);
    jumpTo(s, p, () => (FINAL_FROM + 1.5) * TILE);
    expect(standsAt(s, BANK_FEET) && midCol(s) > FINAL_FROM, 'auf dem Schlussufer').toBe(true);
    walkRight(s, p, L.width, 900);
  },
};

describe('Level 1-3: Aufbau', () => {
  it('ist gültig, heißt Bachgrund und hat die Maße', () => {
    expect(validateLevel(L, { requireEdelweiss: true, requireGoal: true })).toEqual([]);
    expect(L.name).toBe('Bachgrund');
    expect(L.world).toBe(1);
    expect(L.width).toBeGreaterThanOrEqual(180); expect(L.width).toBeLessThanOrEqual(240);
    expect(L.height).toBeGreaterThanOrEqual(14); expect(L.height).toBeLessThanOrEqual(24);
  });

  it('genau ein Steinmännchen etwa in der Mitte, das Gipfelkreuz am Ende auf dem Ufer, das goldene Kreuz oben im Felsturm', () => {
    const cps = L.spawns.filter((s) => s.kind === 'checkpoint');
    expect(cps.length).toBe(1);
    expect(cps[0]!.cx / L.width).toBeGreaterThan(0.4); expect(cps[0]!.cx / L.width).toBeLessThan(0.65);
    const goals = L.spawns.filter((s) => s.kind === 'goal');
    expect(goals.length).toBe(1);
    expect(goals[0]!.cx).toBeGreaterThan(L.width - 10);
    expect(goals[0]!.cy).toBe(BANK_FEET - 1);
    const secrets = L.spawns.filter((s) => s.kind === 'secretGoal');
    expect(secrets.length).toBe(1);
    expect(secrets[0]!.cy).toBeLessThanOrEqual(8);
    expect(secrets[0]!.cx).toBeGreaterThan(TOWER.x0); expect(secrets[0]!.cx).toBeLessThan(TOWER.x1);
  });

  it('das goldene Kreuz steckt in einer geschlossenen Kammer: ringsum Boden, Zugang nur durch die Felsblöcke im Dach und im Boden', () => {
    const g = secretGoal();
    const seen = new Set<number>();
    const border = new Map<number, number>();
    const stack: Array<[number, number]> = [[g.cx, g.cy]];
    while (stack.length) {
      const [x, y] = stack.pop()!;
      const k = y * L.width + x;
      if (seen.has(k)) continue;
      seen.add(k);
      expect(x > TOWER.x0 && x < TOWER.x1 && y > TOWER.roof && y < TOWER.floor, `Kammer reicht bis ${x},${y}`).toBe(true);
      expect([Cell.Empty]).toContain(cellAt(L, x, y));
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (solidCell(L, nx, ny)) border.set(ny * L.width + nx, cellAt(L, nx, ny)!);
        else stack.push([nx, ny]);
      }
    }
    // Die ganze Zielzone (5 Kacheln über der Zelle von G) liegt in der Kammer.
    for (let dy = 0; dy < GOAL_HEIGHT_TILES; dy++) expect(seen.has((g.cy - dy) * L.width + g.cx), `Zielzone Reihe ${g.cy - dy}`).toBe(true);
    expect([...border.values()].every((c) => c === Cell.Ground || c === Cell.Rock)).toBe(true);
    const rocks = [...border].filter(([, c]) => c === Cell.Rock).map(([k]) => [k % L.width, Math.floor(k / L.width)]);
    rocks.sort((a, b) => a[1]! - b[1]! || a[0]! - b[0]!);
    expect(rocks).toEqual([...ROOF_ROCKS.map((cx) => [cx, TOWER.roof]), [FLOOR_ROCK.cx, FLOOR_ROCK.cy]]);
    expect(g.cx).toBe(FLOOR_ROCK.cx);
    expect(ROOF_ROCKS).toContain(g.cx);
  });

  it('acht Stämme über dem Bach, zwei davon senkrecht; jede Lage liegt über Wasser, mindestens eine Kachel über der Oberfläche', () => {
    expect(L.platforms.length).toBe(8);
    expect(L.platforms.every((p) => p.art === 'stamm')).toBe(true);
    expect(L.platforms.filter((p) => p.axis === 'v').length).toBe(2);
    for (const [i, pl] of L.platforms.entries()) {
      const { x0, x1 } = pathCols(pl);
      const top = pl.axis === 'v' ? pl.cy + Math.min(0, pl.travel) : pl.cy;
      const low = pl.axis === 'v' ? pl.cy + Math.max(0, pl.travel) : pl.cy;
      for (let cx = x0; cx <= x1; cx++) {
        for (let cy = top; cy <= low; cy++) expect(cellAt(L, cx, cy), `Stamm ${i + 1}, Zelle ${cx},${cy}`).toBe(Cell.Empty);
        let cy = low + 1;
        while (cy < L.height && cellAt(L, cx, cy) === Cell.Empty) cy++;
        expect(cellAt(L, cx, cy), `Stamm ${i + 1}: unter Spalte ${cx}`).toBe(Cell.Water);
        expect(cy, `Stamm ${i + 1}: Wasser unter Spalte ${cx}`).toBe(WATER_TOP);
      }
    }
  });

  it('mindestens 30 Kristalle, Kristall-Kisten, eine versteckte Kiste und genau eine Helm-Kiste auf Ufer E vor dem Turm', () => {
    expect(L.spawns.filter((s) => s.kind === 'crystal').length).toBeGreaterThanOrEqual(30);
    expect([...L.crates].filter(([i, c]) => c.kind === 'crystal' && L.cells[i] === Cell.Crate).length).toBeGreaterThanOrEqual(3);
    expect([...L.cells].includes(Cell.HiddenCrate)).toBe(true);
    const helm = [...L.crates].filter(([, c]) => c.kind === 'item' && c.item === 'helm').map(([i]) => i % L.width);
    expect(helm.length).toBe(1);
    expect(helm[0]).toBeGreaterThan(HUMPS_E[0]!); expect(helm[0]).toBeLessThan(HUMPS_E[1]!);
    expect(helm[0]).toBeLessThan(pathCols(L.platforms[LOG.lift]!).x0);
  });

  it('Käfer und Schnecken kommen erst nach Stamm 4 und stehen jeder zwischen zwei Höckern auf festem Ufer', () => {
    const lift = pathCols(L.platforms[LOG.lift]!);
    const foes = L.spawns.filter((s) => s.kind === 'beetle' || s.kind === 'snail');
    expect(foes.length).toBeGreaterThanOrEqual(4);
    expect(foes.filter((f) => f.kind === 'snail').length).toBeGreaterThanOrEqual(2);
    for (const f of foes) {
      expect(f.cx, `${f.kind} ${f.cx}`).toBeGreaterThan(lift.x1);
      let a = f.cx, b = f.cx;
      while (a > f.cx - 6 && !solidCell(L, a - 1, f.cy)) a--;
      while (b < f.cx + 6 && !solidCell(L, b + 1, f.cy)) b++;
      expect(solidCell(L, a - 1, f.cy) && solidCell(L, b + 1, f.cy), `Höcker um ${f.kind} ${f.cx}`).toBe(true);
      for (let cx = a; cx <= b; cx++) expect(solidCell(L, cx, f.cy + 1), `Boden unter ${f.kind} ${f.cx}`).toBe(true);
    }
  });
});

describe('Level 1-3: Stämme', () => {
  const waits = [0, 0.7, 1.5, 2.5, 3.5, 4.5];

  it('Stamm 1 liegt an beiden Ufern an: aufsteigen, mitfahren, absteigen, egal wann Kraxel ankommt', () => {
    expect(pathCols(L.platforms[LOG.first]!)).toEqual({ x0: START_EDGE + 1, x1: BANK_C.from - 1 });
    expect(L.platforms[LOG.first]!.cy).toBe(BANK_FEET);
    for (const wait of waits) {
      const s = calm();
      placePlayer(s, START_EDGE - 4, BANK_FEET - 1);
      const p = play(s);
      p.step({}, 2 + Math.round(wait * 60));
      route.first(s, p);
      expect(standsAt(s, BANK_FEET) && midCol(s) > BANK_C.from, `nach ${wait} s`).toBe(true);
      expect(has(p.events, 'death')).toBe(false);
      expect(p.events.filter((e) => e.type === 'crystal').length, `Kristalle auf dem Stamm, nach ${wait} s`).toBeGreaterThanOrEqual(2);
    }
  });

  it('wer mitten im Bach vom Stamm tritt, fällt sichtbar ins Wasser und stirbt', () => {
    for (const dir of [{ left: true }, { right: true }]) {
      const s = calm();
      const pl = s.platforms[LOG.first]!;
      placePlayer(s, START_EDGE - 1, BANK_FEET - 1);
      const p = play(s);
      boardRight(s, p, pl, START_EDGE);
      p.until({}, () => pl.x >= (START_EDGE + 3) * TILE, 300);
      p.until(dir, () => !onLog(s, pl), 60);
      const fromY = s.player.body.y + s.player.body.h;
      p.until(dir, () => s.phase !== 'playing', 120);
      expect(has(p.events, 'death')).toBe(true);
      expect(s.player.body.y + s.player.body.h - fromY).toBeGreaterThanOrEqual(TILE);
    }
  });

  it('Stamm 2 und Stamm 3 treffen sich in der Mitte: hinüberhüpfen und am Ufer E absteigen, egal wann Kraxel ankommt', () => {
    for (const wait of waits) {
      const s = calm();
      placePlayer(s, BANK_C.to - 4, BANK_FEET - 1);
      const p = play(s);
      p.step({}, 2 + Math.round(wait * 60));
      route.meeting(s, p);
      expect(standsAt(s, BANK_FEET) && midCol(s) > BANK_E.from, `nach ${wait} s`).toBe(true);
      expect(has(p.events, 'death'), `nach ${wait} s`).toBe(false);
    }
  });

  it('der senkrechte Stamm 4 hebt Kraxel vom Ufer E auf die Hochwiese, egal wann Kraxel ankommt', () => {
    const pl = L.platforms[LOG.lift]!;
    expect(pl.axis).toBe('v');
    expect(pl.cy + Math.min(0, pl.travel)).toBe(MEADOW.feet);
    expect(pathCols(pl).x0).toBe(BANK_E.to + 1);
    expect(pathCols(pl).x1).toBe(MEADOW.from - 1);
    for (const wait of [...waits, 5.5]) {
      const s = calm();
      placePlayer(s, BANK_E.to - 1, BANK_FEET - 1);
      const p = play(s);
      p.step({}, 2 + Math.round(wait * 60));
      route.toLift(s, p);
      route.boardLift(s, p);
      route.liftToMeadow(s, p);
      expect(standsAt(s, MEADOW.feet), `nach ${wait} s`).toBe(true);
      expect(has(p.events, 'death'), `nach ${wait} s`).toBe(false);
    }
  });

  it('wer von der Hochwiese in den Schacht tritt, landet auf Stamm 4: er füllt den Schacht ganz aus, egal wo er gerade ist', () => {
    const pl = L.platforms[LOG.lift]!;
    expect(pathCols(pl)).toEqual({ x0: BANK_E.to + 1, x1: MEADOW.from - 1 });
    for (const wait of [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5]) {
      const s = calm();
      placePlayer(s, MEADOW.from + 1, MEADOW.feet - 1);
      const p = play(s);
      p.step({}, 2 + Math.round(wait * 60));
      p.until({ left: true }, () => !s.player.grounded, 60);
      p.until({}, () => s.player.grounded, 120);
      p.step({}, 5);
      expect(onLog(s, s.platforms[LOG.lift]!), `nach ${wait} s`).toBe(true);
      expect(has(p.events, 'death'), `nach ${wait} s`).toBe(false);
    }
  });

  it('wer über den Rand eines senkrechten Stamms hinaussteht, fährt zwei ganze Runden mit und wird nirgends eingeklemmt', () => {
    let tried = 0;
    for (const i of [LOG.lift, LOG.rapidLift]) {
      const spec = L.platforms[i]!;
      const period = (2 * Math.abs(spec.travel)) / spec.speed;
      for (const side of [-1, 1] as const) {
        const s = calm();
        const pl = s.platforms[i]!, b = s.player.body;
        // Startlage des Stamms, Kraxel steht so weit über dem Rand, dass nur 2 px aufliegen.
        b.x = side < 0 ? pl.x - b.w + 2 : logRight(pl) - 2;
        b.y = pl.y - b.h;
        s.playerPrevBottom = b.y + b.h;
        const cx0 = Math.floor(b.x / TILE), cx1 = Math.floor((b.x + b.w - 1e-9) / TILE);
        const cy0 = Math.floor(b.y / TILE), cy1 = Math.floor((b.y + b.h - 1e-9) / TILE);
        let blocked = false;
        for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) blocked ||= s.grid.isSolid(cx, cy);
        if (blocked) continue; // neben dem Stamm steht eine Wand: dort kann niemand überstehen
        tried++;
        const p = play(s);
        p.step({}, 2);
        for (let n = 0; n < Math.round(2 * period * 60); n++) {
          p.step({});
          expect(s.player.grounded && s.phase === 'playing', `Stamm ${i + 1}, ${side < 0 ? 'links' : 'rechts'} überstehend, Schritt ${n}`).toBe(true);
        }
      }
    }
    expect(tried).toBeGreaterThanOrEqual(3);
  });

  it('ohne Stamm 4 und ohne Kraxeln kommt niemand vom Ufer E auf die Hochwiese', () => {
    const without = parseLevel('1-3', LEVELS['1-3'].replace(/^plattform: 67 .*\n/m, ''));
    expect(without.platforms.length).toBe(L.platforms.length - 1);
    let landedOnMeadow = 0, atCliff = 0;
    for (let cx = BANK_E.to - 6; cx <= BANK_E.to; cx++) {
      for (let run = 0; run <= 48; run += 12) {
        for (const hold of [8, 20, 40]) {
          const s = calm(without);
          placePlayer(s, cx - Math.round(run / 12), BANK_FEET - 1);
          const ev = runGame(s, [[{}, 2], [{ right: true }, run], [{ right: true, jump: true }, hold], [{ right: true, jump: true }, 90], [{}, 30]]);
          if (standsAt(s, MEADOW.feet)) landedOnMeadow++;
          if (has(ev, 'death')) atCliff++; // in den Schacht gesprungen, an der Wand der Hochwiese hinab ins Wasser
        }
      }
    }
    expect(landedOnMeadow).toBe(0);
    expect(atCliff).toBeGreaterThan(0);
  });

  it('Stamm 5 und der senkrechte Stamm 6 laufen im selben Takt: hinüber, wenn Stamm 6 unten ist, und hinauf auf die Felssäule', () => {
    const a = L.platforms[LOG.rapid]!, v = L.platforms[LOG.rapidLift]!;
    expect(2 * Math.abs(a.travel) / a.speed).toBeCloseTo(2 * Math.abs(v.travel) / v.speed, 6);
    expect(v.axis).toBe('v');
    for (const wait of waits) {
      const s = calm();
      placePlayer(s, BANK_H.to - 3, BANK_FEET - 1);
      const p = play(s);
      p.step({}, 2 + Math.round(wait * 60));
      route.rapid(s, p);
      expect(standsAt(s, PILLAR.feet), `nach ${wait} s`).toBe(true);
      expect(has(p.events, 'death'), `nach ${wait} s`).toBe(false);
    }
  });

  it('von der Felssäule auf Stamm 7 hinunter und am Ufer J absteigen, egal wann Kraxel ankommt', () => {
    for (const wait of waits) {
      const s = calm();
      placePlayer(s, PILLAR.x0, PILLAR.feet - 1);
      const p = play(s);
      p.step({}, 2 + Math.round(wait * 60));
      route.drop(s, p);
      expect(standsAt(s, BANK_FEET) && midCol(s) > BANK_J.from, `nach ${wait} s`).toBe(true);
      expect(has(p.events, 'death'), `nach ${wait} s`).toBe(false);
    }
  });

  it('der letzte Stamm liegt frei im Wasser: abgepasst hinauf und hinüber aufs Schlussufer, egal wann Kraxel ankommt', () => {
    const pl = L.platforms[LOG.last]!;
    const { x0, x1 } = pathCols(pl);
    expect(x0 - ISLAND_2.to - 1).toBe(2);
    expect(FINAL_FROM - x1 - 1).toBe(2);
    for (const wait of [0, 0.5, 1, 1.5, 2, 2.5, 3]) {
      const s = calm();
      placePlayer(s, ISLAND_2.to - 3, BANK_FEET - 1);
      const p = play(s);
      p.step({}, 2 + Math.round(wait * 60));
      route.last(s, p);
      expect(s.phase, `nach ${wait} s`).toBe('goal');
      expect(exitOf(p.events)).toBe('normal');
      expect(has(p.events, 'death')).toBe(false);
    }
  });
});

describe('Level 1-3: geheimer Ausgang im Felsturm', () => {
  /** Von der Kante vor Stamm 4 hinauf; wenn der Stamm auf Höhe des Absatzes ist, nach links hinüber auf den Absatz. */
  function liftToLedge(s: GameState, p: Play): void {
    const pl = s.platforms[LOG.lift]!;
    route.boardLift(s, p);
    p.until({ left: true }, () => s.player.body.x <= pl.x + 1, 60);
    p.step({}, 10);
    p.until({}, () => pl.dir > 0 && pl.y <= LEDGE.feet * TILE, 600);
    p.step({ left: true, jump: true }, 6);
    p.until({ left: true }, () => s.player.grounded, 90);
    p.step({}, 10);
  }
  /** Unter dem Felsblock im Kammerboden zweimal springen. */
  function breakInFromBelow(s: GameState, p: Play): void {
    goTo(s, p, FLOOR_ROCK.cx);
    p.step({ jump: true }, 20);
    p.step({}, 40);
    p.step({ jump: true }, 30);
    p.step({}, 20);
  }

  it('mit Helm von unten: von Stamm 4 auf den Absatz, Kammerboden aufschlagen, hineinspringen meldet secret', () => {
    const s = calm(L, { helm: true });
    placePlayer(s, BANK_E.to - 2, BANK_FEET - 1);
    const p = play(s);
    p.step({}, 2);
    route.toLift(s, p);
    liftToLedge(s, p);
    expect(standsAt(s, LEDGE.feet), 'auf dem Absatz').toBe(true);
    breakInFromBelow(s, p);
    expect(p.events).toContainEqual({ type: 'rockBreak', ...FLOOR_ROCK });
    expect(exitOf(p.events)).toBe('secret');
    expect(has(p.events, 'death')).toBe(false);
  });

  it('ohne mitgebrachten Helm: die Helm-Kiste auf Ufer E gibt ihn, danach geht es ebenso hinein', () => {
    const helm = [...L.crates].find(([, c]) => c.kind === 'item' && c.item === 'helm')![0];
    const hx = helm % L.width;
    const s = calm();
    placePlayer(s, hx, BANK_FEET - 1);
    const p = play(s);
    p.step({}, 2);
    p.step({ jump: true }, 10);
    p.step({}, 40);
    const item = s.pickups.find((it) => it.kind === 'item' && !it.taken)!;
    expect(item).toBeDefined();
    for (let i = 0; i < 400 && !item.taken; i++) {
      const dx = item.body.x + item.body.w / 2 - (s.player.body.x + s.player.body.w / 2);
      p.step(dx > 2 ? { right: true } : dx < -2 ? { left: true } : {});
    }
    expect(s.player.helm).toBe(true);
    route.toLift(s, p);
    liftToLedge(s, p);
    breakInFromBelow(s, p);
    expect(exitOf(p.events)).toBe('secret');
  });

  it('per Stampfen von oben: an der Felsnase hinauf, über den Felsbogen aufs Turmdach, Felsblock zerstampfen meldet secret', () => {
    const s = calm();
    placePlayer(s, OVERHANG.x1 + 2, MEADOW.feet - 1);
    const p = play(s);
    p.step({}, 2);
    p.step({ left: true, jump: true }, 6);
    p.until({ left: true, up: true, jump: true }, () => standsAt(s, OVERHANG.top), 120);
    p.step({}, 10);
    expect(standsAt(s, OVERHANG.top), 'auf der Felsnase').toBe(true);
    expect(s.session.edelweiss[1], 'Edelweiß 2 nebenbei').toBe(true);
    // Eine Kachel hinauf auf den Felsbogen, über ihn aufs Turmdach.
    p.step({ left: true, jump: true }, 12);
    p.until({ left: true }, () => s.player.grounded, 90);
    p.step({}, 10);
    expect(standsAt(s, TOWER.roof) && midCol(s) < ARCH.x1 + 1, 'auf dem Felsbogen').toBe(true);
    goToX(s, p, (ROOF_ROCKS[0]! + 1) * TILE);
    p.step({ jump: true }, 8);
    p.step({ down: true }, 1);
    p.step({}, 60);
    expect(p.events).toContainEqual({ type: 'rockBreak', cx: ROOF_ROCKS[0]!, cy: TOWER.roof });
    expect(exitOf(p.events)).toBe('secret');
    expect(s.player.helm).toBe(false);
  });

  it('ohne Helm und ohne Stampfen bleibt das goldene Kreuz unerreichbar: vom Absatz, vom Dach, von der Felsnase und vom Wiesenrand', () => {
    const spots: Array<[number, number]> = [];
    for (let cx = LEDGE.x0; cx <= LEDGE.x1; cx++) spots.push([cx, LEDGE.feet - 1]);
    for (let cx = TOWER.x0; cx <= ARCH.x1; cx++) spots.push([cx, TOWER.roof - 1]);
    for (let cx = OVERHANG.x0; cx <= OVERHANG.x1; cx++) spots.push([cx, OVERHANG.top - 1]);
    for (let cx = MEADOW.from; cx <= MEADOW.from + 4; cx++) spots.push([cx, MEADOW.feet - 1]);
    let bumps = 0, onRock = 0;
    for (const [cx, cy] of spots) {
      for (const dir of [{}, { right: true }, { left: true }]) {
        for (const run of [0, 12, 24]) {
          for (const hold of [4, 16, 40]) {
            const s = calm();
            placePlayer(s, cx, cy);
            const ev = runGame(s, [[{}, 2], [dir, run], [{ ...dir, jump: true }, hold], [{ ...dir, up: true, jump: hold >= 40 }, 90], [{}, 30]]);
            if (ev.some((e) => e.type === 'bump' && e.cx === FLOOR_ROCK.cx && e.cy === FLOOR_ROCK.cy)) bumps++;
            if (standsAt(s, TOWER.roof) && ROOF_ROCKS.includes(Math.floor(midCol(s)))) onRock++;
            expect(exitOf(ev), `Start ${cx},${cy}`).not.toBe('secret');
            expect(has(ev, 'rockBreak'), `Start ${cx},${cy}`).toBe(false);
          }
        }
      }
    }
    // Die Läufe kommen wirklich an die Felsblöcke heran.
    expect(bumps).toBeGreaterThan(0);
    expect(onRock).toBeGreaterThan(0);
  }, 30_000);

  for (const opts of [{}, { helm: true }, { special: 'sling' as const }]) {
    it(`Dauerlauf nach rechts von P bis Z (an Kanten springen, auf Stämme warten) erreicht das normale Gipfelkreuz, nie das goldene ${JSON.stringify(opts)}`, () => {
      const s = calm(L, opts);
      const p = play(s);
      p.step({}, 2);
      walkRight(s, p, START_EDGE - 1.5);
      route.first(s, p);
      route.meeting(s, p);
      route.toLift(s, p);
      route.boardLift(s, p);
      route.liftToMeadow(s, p);
      route.meadowAndDescent(s, p);
      expect(has(p.events, 'checkpoint')).toBe(true);
      route.rapid(s, p);
      route.drop(s, p);
      route.pits(s, p);
      route.last(s, p);
      expect(s.phase).toBe('goal');
      expect(exitOf(p.events)).toBe('normal');
      expect(p.events.filter((e) => e.type === 'goal').length).toBe(1);
      expect(has(p.events, 'death')).toBe(false);
    }, 30_000);
  }
});

describe('Level 1-3: Helm und Schleuder mitbringen', () => {
  function openHelmCrate(s: GameState): GameEvent[] {
    const helm = [...L.crates].find(([, c]) => c.kind === 'item' && c.item === 'helm')![0];
    placePlayer(s, helm % L.width, BANK_FEET - 1);
    const p = play(s);
    p.step({}, 2);
    p.step({ jump: true }, 10);
    p.step({}, 60);
    return p.events;
  }

  it('ohne Helm gibt die Helm-Kiste den Helm', () => {
    const s = calm();
    const ev = openHelmCrate(s);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'itemSpawn', item: 'helm' }));
  });

  it('wer den Helm aus 1-2 mitbringt, bekommt aus der Helm-Kiste 10 Kristalle', () => {
    const s = calm(L, { helm: true });
    const before = s.session.crystals;
    const ev = openHelmCrate(s);
    const item = s.pickups.find((it) => it.kind === 'item')!;
    const p = play(s);
    for (let i = 0; i < 400 && !item.taken; i++) {
      const dx = item.body.x + item.body.w / 2 - (s.player.body.x + s.player.body.w / 2);
      ev.push(...p.step(dx > 2 ? { right: true } : dx < -2 ? { left: true } : {}));
    }
    expect(has(ev, 'powerUp')).toBe(false);
    expect(s.session.crystals - before - ev.filter((e) => e.type === 'crystal').length).toBe(10);
    expect(s.player.helm).toBe(true);
  });

  it('wer mit der Schleuder kommt, behält sie; die Helm-Kiste gibt dann Kristalle', () => {
    const s = calm(L, { special: 'sling' });
    const ev = openHelmCrate(s);
    const item = s.pickups.find((it) => it.kind === 'item')!;
    const p = play(s);
    for (let i = 0; i < 400 && !item.taken; i++) {
      const dx = item.body.x + item.body.w / 2 - (s.player.body.x + s.player.body.w / 2);
      ev.push(...p.step(dx > 2 ? { right: true } : dx < -2 ? { left: true } : {}));
    }
    expect(has(ev, 'powerUp')).toBe(false);
    expect([s.player.helm, s.player.special]).toEqual([true, 'sling']);
  });

  it('die Helm-Kiste liegt zwischen den Höckern: der Helm läuft nicht ins Wasser', () => {
    const s = calm();
    openHelmCrate(s);
    const item = s.pickups.find((it) => it.kind === 'item')!;
    placePlayer(s, LEDGE.x1, LEDGE.feet - 1); // aus dem Weg, damit Kraxel den Helm nicht einsammelt
    const p = play(s);
    p.step({}, 10 * 60);
    expect(item.taken).toBe(false);
    expect(item.body.x).toBeGreaterThan((HUMPS_E[0]! + 1) * TILE - 1);
    expect(item.body.x + item.body.w).toBeLessThan(HUMPS_E[1]! * TILE + 1);
  });
});

describe('Level 1-3: Edelweiß', () => {
  it('Edelweiß 1 ist mit Helm von unten erreichbar', () => {
    const s = calm();
    placePlayer(s, NEST_ROCK.cx, MEADOW.feet - 1);
    s.player.helm = true;
    const ev = runGame(s, [[{}, 2], [{ jump: true }, 20], [{}, 40], [{ jump: true }, 30], [{}, 40]]);
    expect(ev).toContainEqual({ type: 'rockBreak', ...NEST_ROCK });
    expect(s.session.edelweiss[0]).toBe(true);
  });

  it('aufs Felsnest kommt man durch Kraxeln, von dort per Stampfen an Edelweiß 1', () => {
    for (const [cx, dir] of [[NEST.x0 - 1, { right: true }], [NEST.x1 + 1, { left: true }]] as const) {
      const s = calm();
      placePlayer(s, cx, MEADOW.feet - 1);
      const p = play(s);
      p.step({}, 2);
      p.step({ ...dir, jump: true }, 6);
      p.until({ ...dir, up: true, jump: true }, () => standsAt(s, NEST.top), 120);
      p.step({}, 10);
      expect(standsAt(s, NEST.top), `von ${cx}: oben auf dem Nest`).toBe(true);
      goTo(s, p, NEST_ROCK.cx);
      p.step({ jump: true }, 8);
      p.step({ down: true }, 1);
      p.step({}, 80);
      expect(p.events).toContainEqual({ type: 'rockBreak', cx: NEST_ROCK.cx, cy: NEST.top });
      expect(s.session.edelweiss[0], `von ${cx}`).toBe(true);
      expect(standsAt(s, MEADOW.feet)).toBe(true);
    }
  });

  it('Edelweiß 1 bleibt ohne Helm und ohne Stampfen im Nest', () => {
    for (const [feet, dir] of [[MEADOW.feet, {}], [NEST.top, {}], [NEST.top, { right: true }], [NEST.top, { left: true }]] as const) {
      const s = calm();
      placePlayer(s, NEST_ROCK.cx, feet - 1);
      runGame(s, [[{}, 2], [{ ...dir, jump: true }, 20], [dir, 40], [{ ...dir, jump: true }, 30], [dir, 40]]);
      expect(s.session.edelweiss[0]).toBe(false);
    }
    const s = calm();
    placePlayer(s, NEST_ROCK.cx, MEADOW.feet - 1);
    expect(runGame(s, [[{}, 2], [{ jump: true }, 20], [{}, 30]])).toContainEqual({ type: 'bump', ...NEST_ROCK });
  });

  it('Edelweiß 2: von der Hochwiese an der Felsnase hinaufkraxeln, egal wann oben gedrückt wird', () => {
    expect(edelweiss(1)).toMatchObject({ cy: OVERHANG.top - 1 });
    for (let cx = OVERHANG.x1 + 1; cx <= OVERHANG.x1 + 3; cx++) {
      for (const upAfter of [0, 6, 12, 20]) {
        const s = calm();
        placePlayer(s, cx, MEADOW.feet - 1);
        const jumpPart: Script = upAfter > 0 ? [[{ left: true, jump: true }, upAfter]] : [];
        runGame(s, [[{}, 2], ...jumpPart, [{ left: true, up: true, jump: true }, 80 - upAfter], [{}, 20]]);
        expect(s.session.edelweiss[1], `Start ${cx}, oben nach ${upAfter}`).toBe(true);
        expect(standsAt(s, OVERHANG.top), `Start ${cx}, oben nach ${upAfter}`).toBe(true);
      }
    }
  });

  it('Edelweiß 2 gibt es nur mit Kraxeln oder Wandsprung: Springen und Anlauf von der Hochwiese und vom Nest reichen nicht', () => {
    expect(edelweiss(1)).toMatchObject({ cx: OVERHANG.x0 + 1, cy: OVERHANG.top - 1 });
    expect(solidCell(L, OVERHANG.x0, OVERHANG.top) && !solidCell(L, OVERHANG.x0, MEADOW.feet - 1)).toBe(true);
    const spots: Array<[number, number]> = [];
    for (let cx = MEADOW.from; cx <= NEST.x0 + 2; cx++) spots.push([cx, MEADOW.feet - 1]);
    for (let cx = NEST.x0; cx <= NEST.x1; cx++) spots.push([cx, NEST.top - 1]);
    let underOverhang = 0;
    for (const [cx, cy] of spots) {
      for (const dir of [{ right: true }, { left: true }]) {
        for (let run = 0; run <= 72; run += 12) {
          for (const hold of [4, 16, 40]) {
            const s = calm();
            placePlayer(s, cx, cy);
            const ev = runGame(s, [[{}, 2], [dir, run], [{ ...dir, jump: true }, hold], [{ ...dir, jump: hold >= 40 }, 120], [{}, 30]]);
            if (ev.some((e) => e.type === 'bump' && e.cx >= OVERHANG.x0 && e.cx <= OVERHANG.x1)) underOverhang++;
            expect(s.session.edelweiss[1], `Start ${cx},${cy}`).toBe(false);
          }
        }
      }
    }
    expect(underOverhang).toBeGreaterThan(0);
  }, 30_000);

  /** Stellt Kraxel auf die Säule, deckt die versteckte Kiste auf und kommt wieder zur Ruhe. */
  function revealHidden() {
    const s = calm();
    placePlayer(s, HIDDEN.cx, PILLAR.feet - 1);
    const p = play(s);
    p.step({}, 2);
    p.step({ jump: true }, 8);
    p.step({}, 60);
    return { s, p };
  }

  it('Edelweiß 3: der Hinweis-Kristall über der Säule führt an die versteckte Kiste, von ihr aus springt Kraxel ans Edelweiß', () => {
    for (const side of [-1, 1] as const) {
      const { s, p } = revealHidden();
      expect(p.events).toContainEqual({ type: 'crateOpen', ...HIDDEN });
      expect(p.events.some((e) => e.type === 'crystal' && !e.fromCrate)).toBe(true);
      // An die Säulenkante neben der Kiste, hinaufspringen und über ihr landen.
      goTo(s, p, HIDDEN.cx + side);
      const toward = side < 0 ? { right: true } : { left: true };
      p.step({ jump: true }, 14);
      p.until({ ...toward, jump: true }, () => s.player.body.vy > 0 && Math.abs(midCol(s) - HIDDEN.cx - 0.5) < 0.2, 60);
      p.until({ jump: true }, () => s.player.grounded, 60);
      p.step({}, 20);
      expect(standsAt(s, HIDDEN.cy), `von ${side < 0 ? 'links' : 'rechts'}: auf der Kiste`).toBe(true);
      p.step({ jump: true }, 30);
      p.step({}, 30);
      expect(s.session.edelweiss[2], `von ${side < 0 ? 'links' : 'rechts'}`).toBe(true);
    }
  });

  it('Edelweiß 3 ist ohne die versteckte Kiste nicht erreichbar, auch nicht mit Anlauf oder Kraxeln', () => {
    const rows = LEVELS['1-3'].split('\n');
    const sep = rows.indexOf('---');
    rows[sep + 1 + HIDDEN.cy] = rows[sep + 1 + HIDDEN.cy]!.replace('V', '.');
    const without = parseLevel('1-3', rows.join('\n'));
    expect(cellAt(L, HIDDEN.cx, HIDDEN.cy)).toBe(Cell.HiddenCrate);
    expect(validateLevel(without, { requireEdelweiss: true, requireGoal: true })).toEqual([]);
    let tries = 0;
    for (let cx = PILLAR.x0; cx <= PILLAR.x1; cx++) {
      for (const dir of [{ right: true }, { left: true }, {}]) {
        for (const run of [0, 6, 12]) {
          for (const hold of [1, 20, 40]) {
            for (const upAfter of [-1, 0, 12, 24]) {
              const s = calm(without);
              placePlayer(s, cx, PILLAR.feet - 1);
              const script: Script = upAfter < 0
                ? [[{}, 2], [dir, run], [{ ...dir, jump: true }, hold], [{ ...dir, jump: true }, 100], [{}, 30]]
                : [[{}, 2], [dir, run], [{ ...dir, jump: true }, Math.min(hold, upAfter)], [{ ...dir, up: true, jump: hold > upAfter }, 100], [{}, 30]];
              runGame(s, script);
              tries++;
              expect(s.session.edelweiss[2], `Start ${cx}`).toBe(false);
            }
          }
        }
      }
    }
    expect(tries).toBeGreaterThan(100);
  }, 30_000);
});

describe('Level 1-3: Kamera', () => {
  const levelPx = { w: L.width * TILE, h: L.height * TILE };
  /** Steht Kraxel an (cx, cy) und schaut in Richtung `facing`, liegt die Zelle (tx, ty) ganz im Bild und unter der Info-Leiste (12 px)? */
  function inView(cx: number, cy: number, tx: number, ty: number, w: number, facing: -1 | 1 = 1, minPx = TILE): boolean {
    const s = calm();
    placePlayer(s, cx, cy);
    runGame(s, [[{}, 5]]);
    s.player.facing = facing;
    const view = { w, h: VIEW_H };
    const c = createCamera(s.player, view, levelPx);
    // Blickrichtung wie nach einem kurzen Schritt in diese Richtung.
    c.look = facing * 32;
    for (let i = 0; i < 120; i++) stepCamera(c, s.player, view, levelPx, STEP);
    const x = tx * TILE, y = ty * TILE;
    return x >= c.x && x + TILE <= c.x + w && y >= c.y + 12 && y + minPx <= c.y + VIEW_H;
  }
  /** Landestellen unter Kraxel: die Oberkante und mindestens eine halbe Kachel darunter sind im Bild. */
  const LANDING_PX = TILE / 2;

  it('vom Absatz unter dem Turm sieht man das goldene Kreuz, hochkant und quer; vom Wiesenrand quer', () => {
    const g = secretGoal();
    for (const w of [256, 416]) expect(inView(LEDGE.x1, LEDGE.feet - 1, g.cx, g.cy, w, -1), `Bild ${w}`).toBe(true);
    expect(inView(MEADOW.from + 1, MEADOW.feet - 1, g.cx, g.cy, 416, -1)).toBe(true);
  });

  it('zeigt Edelweiß 1 und 2 von der Hochwiese und Edelweiß 3 von der Säule, hochkant und quer', () => {
    for (const w of [256, 416]) {
      expect(inView(NEST.x0 - 2, MEADOW.feet - 1, edelweiss(0).cx, edelweiss(0).cy, w), `E1, Bild ${w}`).toBe(true);
      expect(inView(OVERHANG.x1 + 2, MEADOW.feet - 1, edelweiss(1).cx, edelweiss(1).cy, w, -1), `E2, Bild ${w}`).toBe(true);
      expect(inView(PILLAR.x0, PILLAR.feet - 1, edelweiss(2).cx, edelweiss(2).cy, w), `E3, Bild ${w}`).toBe(true);
    }
  });

  it('von jeder Absprungstelle ist der Stamm zu sehen, von jedem Stamm-Ende die Landestelle (hochkant)', () => {
    const lg = (i: number) => L.platforms[i]!;
    const end = (i: number) => pathCols(lg(i)).x1;
    const pairs: Array<[string, number, number, number, number]> = [
      ['Startwiese → Ende von Stamm 1', START_EDGE, BANK_FEET - 1, end(LOG.first), BANK_FEET],
      ['Ufer C → Treffpunkt von Stamm 2', BANK_C.to, BANK_FEET - 1, end(LOG.meetA), BANK_FEET],
      ['Stamm 2 rechts → Stamm 3 am Treffpunkt', end(LOG.meetA), BANK_FEET - 1, end(LOG.meetA) + 3, BANK_FEET],
      ['Ufer E → Stamm 4 unten', BANK_E.to, BANK_FEET - 1, BANK_E.to + 2, BANK_FEET - 1],
      ['Stamm 4 oben → Hochwiese', MEADOW.from - 1, MEADOW.feet - 1, MEADOW.from + 2, MEADOW.feet],
      ['Ufer H → Ende von Stamm 5', BANK_H.to, BANK_FEET - 1, end(LOG.rapid), BANK_FEET],
      ['Stamm 5 rechts → Stamm 6 unten', end(LOG.rapid) - 1, BANK_FEET - 1, end(LOG.rapidLift), BANK_FEET],
      ['Stamm 5 rechts → Felssäule', end(LOG.rapid) - 1, BANK_FEET - 1, PILLAR.x1, PILLAR.feet],
      ['Felssäule → Stamm 7', PILLAR.x1, PILLAR.feet - 1, PILLAR.x1 + 3, lg(LOG.drop).cy],
      ['Stamm 7 rechts → Ufer J', end(LOG.drop) - 1, lg(LOG.drop).cy - 1, BANK_J.from + 1, BANK_FEET],
      ['Insel 2 → letzter Stamm ganz', ISLAND_2.to, BANK_FEET - 1, end(LOG.last), BANK_FEET],
      ['letzter Stamm rechts → Schlussufer', end(LOG.last) - 1, BANK_FEET - 1, FINAL_FROM + 1, BANK_FEET],
    ];
    for (const [name, cx, cy, tx, ty] of pairs) expect(inView(cx, cy, tx, ty, 256, 1, LANDING_PX), name).toBe(true);
  });

  it('wo man auf einen Stamm steigt oder springt, ist das Wasser darunter im Bild: niemand hält den Bach für Hintergrund (hochkant)', () => {
    const lg = (i: number) => L.platforms[i]!;
    const spots: Array<[string, number, number]> = [
      ['Startwiese', START_EDGE, BANK_FEET - 1],
      ['Ufer C', BANK_C.to, BANK_FEET - 1],
      ['Ufer E', BANK_E.to, BANK_FEET - 1],
      ['Ufer H', BANK_H.to, BANK_FEET - 1],
      ['Stamm 5 rechts', pathCols(lg(LOG.rapid)).x1 - 1, BANK_FEET - 1],
      ['Felssäule', PILLAR.x1, PILLAR.feet - 1],
      ['Stamm 7 rechts', pathCols(lg(LOG.drop)).x1 - 1, lg(LOG.drop).cy - 1],
      ['Insel 2', ISLAND_2.to, BANK_FEET - 1],
    ];
    for (const [name, cx, cy] of spots) {
      // Die nächste Wasserzelle rechts der Stelle: ihre Oberfläche (mindestens 4 px) muss im Bild liegen.
      let wx = cx + 1;
      while (cellAt(L, wx, WATER_TOP) !== Cell.Water) wx++;
      expect(inView(cx, cy, wx, WATER_TOP, 256, 1, 4), name).toBe(true);
    }
  });

  it('beim Abstieg von der Hochwiese ist jede nächste Stufe zu sehen (hochkant)', () => {
    expect(inView(MEADOW.to, MEADOW.feet - 1, STEPS[0]!.from + 1, STEPS[0]!.feet, 256, 1, LANDING_PX)).toBe(true);
    expect(inView(STEPS[1]!.from - 1, STEPS[0]!.feet - 1, STEPS[1]!.from + 1, STEPS[1]!.feet, 256, 1, LANDING_PX)).toBe(true);
    expect(inView(BANK_H.from - 1, STEPS[1]!.feet - 1, BANK_H.from + 1, BANK_FEET, 256, 1, LANDING_PX)).toBe(true);
  });
});

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
/** Wasser, über das ein Stamm fährt. */
const hasLog = (pit: { from: number; to: number }) => L.platforms.some((pl) => pathCols(pl).x0 <= pit.to && pathCols(pl).x1 >= pit.from);
/** Gruben ohne Stamm: hier muss vom Boden gesprungen werden. */
const plainPits = () => pits(L).filter((p) => !hasLog(p));

describe('Level 1-3: Gruben', () => {
  it('jede Grube ist Bachwasser; ohne Stamm höchstens 6 breit, mindestens eine braucht Anlauf', () => {
    for (const pit of pits(L)) {
      for (let cx = pit.from; cx <= pit.to; cx++) expect(cellAt(L, cx, L.height - 1), `Spalte ${cx}`).toBe(Cell.Water);
    }
    const widths = plainPits().map((p) => p.to - p.from + 1);
    expect(widths.length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...widths)).toBeLessThanOrEqual(6);
    expect(widths.some((w) => w >= 5)).toBe(true);
    expect(pits(L).filter(hasLog).length).toBe(6);
  });

  it('jede Grube ohne Stamm ist mit Renntempo überspringbar', () => {
    expect(plainPits().length).toBeGreaterThanOrEqual(2);
    for (const pit of plainPits()) {
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

  it('Gegner nehmen niemandem die Landung, mit echter Kamera und wartendem Spieler', () => {
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

    const list = plainPits().filter((p) => p.from > checkpoint.cx);
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

  it('kein Gegner steht direkt an einer Landestelle, auch nicht dort, wo man vom Stamm absteigt', () => {
    expect(pits(L).length).toBeGreaterThanOrEqual(8);
    for (const pit of pits(L)) {
      const ground = surface(L, pit.to + 1);
      const close = L.spawns.filter((e) => (e.kind === 'beetle' || e.kind === 'snail') && e.cx > pit.to && e.cx <= pit.to + 3 && e.cy >= ground - 2);
      expect(close, `Grube ${pit.from}-${pit.to}`).toEqual([]);
    }
  });

  it('Gegner bleiben in ihren Pferchen, mit echter Kamera über 20 s', () => {
    const foes = L.spawns.filter((e) => e.kind === 'beetle' || e.kind === 'snail');
    expect(foes.length).toBeGreaterThanOrEqual(4);
    for (const f of foes) {
      const s = createGame(L);
      placePlayer(s, f.cx - 6, f.cy);
      const p = play(s, 256, true);
      const e = s.enemies.find((en) => Math.abs(en.body.x - f.cx * TILE) < TILE)!;
      let a = f.cx, b = f.cx;
      while (!solidCell(L, a - 1, f.cy)) a--;
      while (!solidCell(L, b + 1, f.cy)) b++;
      for (let i = 0; i < 20 * 60; i++) {
        p.step({});
        expect(e.alive, `${f.kind} ${f.cx}`).toBe(true);
        expect(e.body.x >= a * TILE - 1e-6 && e.body.x + e.body.w <= (b + 1) * TILE + 1e-6, `${f.kind} ${f.cx} nach ${i} Schritten`).toBe(true);
      }
      expect(e.active, `${f.kind} ${f.cx}`).toBe(true);
    }
  });
});

describe('Level 1-3: Weg durch die Abschnitte', () => {
  it('von der Hochwiese führen Stufen hinab bis zum Ufer vor Stamm 5, nicht ins Wasser', () => {
    const s = calm();
    placePlayer(s, MEADOW.to, MEADOW.feet - 1);
    const p = play(s);
    p.step({}, 2);
    p.until({ right: true }, () => midCol(s) > BANK_H.from + 2, 400);
    p.step({}, 30);
    expect(standsAt(s, BANK_FEET)).toBe(true);
    expect(has(p.events, 'death')).toBe(false);
    expect(surface(L, STEPS[0]!.from)).toBe(STEPS[0]!.feet);
    expect(surface(L, STEPS[1]!.from)).toBe(STEPS[1]!.feet);
  });
});
