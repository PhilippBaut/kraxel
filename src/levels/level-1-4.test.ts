// Level 1-4 „Gratwanderung“: Aufbau, die langen Gruben (nur mit Anlauf), der Enzian-Sprint durch den Gegnergraben, die Steinplatten,
// die drei Edelweiß, Kamera und der ganze Weg von P bis Z, auch mit wachen Gegnern.
// Alle Wege laufen über echte Eingabe-Skripte mit durchgehendem Eingabe-Takt, nichts wird zum Ziel teleportiert.
import { describe, expect, it } from 'vitest';
import { STEP, TILE, VIEW_H } from '../config.ts';
import { createCamera, stepCamera } from '../core/camera.ts';
import { platformSupports } from '../core/collide.ts';
import { createGame, stepGame } from '../core/game.ts';
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

const L = parseLevel('1-4', LEVELS['1-4']);

// Stellen aus 1-4.txt als (Spalte, Reihe). „Füße“ meint die Reihe, auf deren Oberkante Kraxel steht.
const START = { from: 0, to: 15, feet: 15 };           // Startwiese mit dem Pferch der Helm-Kiste
const HELM_HUMPS = [3, 11];                             // Höcker um die Helm-Kiste
const LOW_RIDGE = { from: 19, to: 30, feet: 15 };       // niedriger Grat hinter Grube A
const CRAG_RIDGE = { from: 31, to: 49, feet: 12 };      // Grat mit dem schwebenden Zacken, zugleich Anlauf zu Grube B
const CRAG = { x0: 35, x1: 37, top: 6, bottom: 9 };     // schwebender Zacken, Edelweiß 2 obenauf
const RIDGE_D = { from: 56, to: 74, feet: 12 };         // Grat hinter Grube B mit dem Enzian-Pferch
const ENZIAN_HUMPS = [60, 68];                          // Höcker um die Enzian-Kiste
const TRENCH = { from: 75, to: 92, feet: 13 };          // Gegnergraben, eine Kachel tiefer als der Grat
const STONES = [77, 83, 89];                            // linke Zellen der drei Trittsteine (je 3 breit) über dem Graben
const STONE_FEET = 10;
const RIDGE_E = { from: 93, to: 107, feet: 12 };        // Grat mit dem Schnecken-Pferch und dem Steinmännchen
const STEPS = [{ from: 108, feet: 10 }, { from: 112, feet: 8 }]; // zwei Stufen hinauf zum hohen Absatz
const HIGH = { from: 112, to: 117, feet: 8 };           // hoher Absatz vor dem Felsnest
const NEST_RIDGE = { from: 118, to: 130, feet: 10 };    // Grat unter dem Felsnest, vor der Schlucht
const NEST = { x0: 119, x1: 121, top: 5 };              // schwebendes Felsnest, Edelweiß 1 zwischen zwei Felsblöcken
const NEST_ROCK = { cx: 120, cy: 7 };                   // unterer Felsblock des Nests, der obere liegt in Reihe 5
const RIDGE_G = { from: 143, to: 154, feet: 10 };       // Grat hinter der Schlucht, Anlauf zu Grube C
const ISLAND = { from: 161, to: 180, feet: 10 };        // Insel hinter Grube C
const PILLARS = [{ x0: 184, x1: 186, feet: 9 }, { x0: 190, x1: 192, feet: 10 }, { x0: 200, x1: 202, feet: 9 }]; // Zackengrat
const HIDDEN = { cx: 185, cy: 6 };                      // versteckte Kiste über der ersten Säule, Edelweiß 3 darüber
const SADDLE = { from: 203, to: 208, feet: 12 };        // Sattel vor dem Gipfel
const PAD = { cx: 208, cy: 11 };                        // Blätterpolster auf dem Sattel, direkt am Fuß der Gipfelwand
const SUMMIT = { from: 209, to: 227, feet: 6 };         // Gipfel mit zwei Pferchen und dem Gipfelkreuz
const PENS = [22, 96, 123, 173, 213, 220];              // linke Höcker der Gegner-Pferche; der rechte steht 4 Spalten weiter
const LONG_PITS = [{ from: 50, to: 55 }, { from: 155, to: 160 }]; // die beiden langen Gruben, nur mit Anlauf
const PLAT = { slab: 0, lift: 1 } as const;             // Steinplatte über der Schlucht, senkrechte Platte im Zackengrat

const feetRow = (s: GameState) => (s.player.body.y + s.player.body.h) / TILE;
const midCol = (s: GameState) => (s.player.body.x + s.player.body.w / 2) / TILE;
const cellAt = (l: LevelData, cx: number, cy: number) => l.cells[cy * l.width + cx];
const solidCell = (l: LevelData, cx: number, cy: number) => {
  const c = cellAt(l, cx, cy);
  return c === Cell.Ground || c === Cell.Rock || c === Cell.Crate || c === Cell.CrateUsed || c === Cell.LeafPad;
};
/** Ohne Gegner: für Wege, bei denen es nur um Sprünge und Platten geht. */
const calm = (l: LevelData = L, opts: { helm?: boolean; special?: SpecialItem | null } = {}) => {
  const s = createGame(l, undefined, opts);
  s.enemies = [];
  return s;
};
const standsAt = (s: GameState, feet: number) => s.player.grounded && Math.abs(feetRow(s) - feet) < 1e-6;
const has = (ev: GameEvent[], type: GameEvent['type']) => ev.some((e) => e.type === type);
const exitOf = (ev: GameEvent[]) => ev.find((e) => e.type === 'goal')?.exit ?? null;
const edelweiss = (i: number) => L.spawns.find((s) => s.kind === 'edelweiss' && s.index === i)!;
const foes = (l: LevelData = L) => l.spawns.filter((s) => s.kind === 'beetle' || s.kind === 'snail');
const inTrench = (cx: number) => cx >= TRENCH.from && cx <= TRENCH.to;
const crates = (item: string) => [...L.crates]
  .filter(([, c]) => c.kind === 'item' && c.item === item)
  .map(([i]) => ({ cx: i % L.width, cy: Math.floor(i / L.width) }));
const platRight = (pl: PlatformState) => pl.x + pl.spec.width * TILE;
const onPlat = (s: GameState, pl: PlatformState) => s.player.grounded && platformSupports(s.player.body, pl);
/** Spalten, die die Plattform auf ihrem ganzen Weg überstreicht. */
const pathCols = (pl: { cx: number; width: number; axis: 'h' | 'v'; travel: number }) => {
  const h = pl.axis === 'h';
  return { x0: pl.cx + (h ? Math.min(0, pl.travel) : 0), x1: pl.cx + pl.width - 1 + (h ? Math.max(0, pl.travel) : 0) };
};
/** Oberste und unterste Reihe, in der die Plattform auf ihrem Weg liegt. */
const pathRows = (pl: { cy: number; axis: 'h' | 'v'; travel: number }) => ({
  y0: pl.cy + (pl.axis === 'v' ? Math.min(0, pl.travel) : 0), y1: pl.cy + (pl.axis === 'v' ? Math.max(0, pl.travel) : 0),
});
/** Level ohne die Plattform mit Index `i` (ihre Kopfzeile fällt weg). */
const withoutPlatform = (i: number) => {
  const spec = L.platforms[i]!;
  const line = `plattform: ${spec.cx} ${spec.cy} ${spec.width} ${spec.axis} ${spec.travel} ${spec.speed} ${spec.art}\n`;
  expect(LEVELS['1-4'].includes(line), 'Kopfzeile gefunden').toBe(true);
  return parseLevel('1-4', LEVELS['1-4'].replace(line, ''));
};
/** Level, in dem die Zelle (cx, cy) leer ist. */
const withEmpty = (cx: number, cy: number) => {
  const rows = LEVELS['1-4'].split('\n');
  const sep = rows.indexOf('---');
  const r = rows[sep + 1 + cy]!;
  rows[sep + 1 + cy] = r.slice(0, cx) + '.' + r.slice(cx + 1);
  return parseLevel('1-4', rows.join('\n'));
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

/** Über einen Gegner-Pferch: auf den linken Höcker, von dort auf den rechten und hinunter. Der Gegner im Pferch reicht an keinen Höcker heran. */
function hopPen(s: GameState, p: Play, left: number): void {
  goTo(s, p, left - 1);
  jumpTo(s, p, () => (left + 0.5) * TILE, 8);
  expect(standsAt(s, feetRow(s)) && Math.floor(midCol(s)) === left, `auf dem linken Höcker ${left}`).toBe(true);
  jumpTo(s, p, () => (left + 4.5) * TILE, 20);
  expect(Math.floor(midCol(s)), `auf dem rechten Höcker ${left + 4}`).toBe(left + 4);
}

/** Läuft (rechts gehalten, also mit Anlauf) bis an die Kante vor `pit` und springt mit vollem Sprung auf den Grat dahinter. */
function runAndJump(s: GameState, p: Play, pit: { from: number; to: number }): void {
  p.until({ right: true }, () => s.player.body.x + s.player.body.w >= pit.from * TILE - 2, 600);
  jumpTo(s, p, () => (pit.to + 3) * TILE, 40);
}

/** Wartet an der Kante `edge`, bis die waagerechte Platte bündig anliegt, steigt auf und stellt sich an ihren rechten Rand. */
function boardRight(s: GameState, p: Play, pl: PlatformState, edge: number): void {
  toEdge(s, p, edge);
  p.until({}, () => pl.x <= (edge + 1) * TILE + 2, 900);
  p.until({ right: true }, () => onPlat(s, pl) && s.player.body.x + s.player.body.w >= platRight(pl) - 8, 240);
  p.step({}, 12);
}
/** Fährt mit, bis die Platte am Grat ab Spalte `bank` anliegt, und geht hinüber. */
function alightRight(s: GameState, p: Play, pl: PlatformState, bank: number): void {
  p.until({}, () => platRight(pl) >= bank * TILE - 2, 900);
  p.until({ right: true }, () => s.player.grounded && !onPlat(s, pl) && midCol(s) > bank + 0.5, 240);
  p.step({}, 12);
}

/** Holt den Enzian: unter die Enzian-Kiste, Kopfstoß, dem Enzian nachgehen, bis er eingesammelt ist. */
function takeEnzian(s: GameState, p: Play): void {
  const e = crates('enzian')[0]!;
  goTo(s, p, e.cx);
  p.step({ jump: true }, 10);
  p.step({}, 40);
  const item = s.pickups.find((it) => it.kind === 'item' && it.item === 'enzian' && !it.taken)!;
  expect(item, 'Enzian aus der Kiste').toBeDefined();
  for (let i = 0; i < 400 && !item.taken; i++) {
    const dx = item.body.x + item.body.w / 2 - (s.player.body.x + s.player.body.w / 2);
    p.step(dx > 2 ? { right: true } : dx < -2 ? { left: true } : {});
  }
  expect(s.player.enzian, 'Enzian wirkt').toBeGreaterThan(0);
}

// Abschnitte des Hauptwegs. Jeder beginnt dort, wo der vorige endet; zusammen ergeben sie den Weg von P bis Z.
// `foes`: Gegner sind wach, Pferche werden von Höcker zu Höcker übersprungen.
const route = {
  /** Startwiese (über den Helm-Pferch) → Grube A → niedriger Grat → Stufe hinauf auf den Zacken-Grat. */
  start(s: GameState, p: Play, foes: boolean) {
    walkRight(s, p, HELM_HUMPS[1]! + 0.5);
    toEdge(s, p, START.to);
    jumpTo(s, p, () => (LOW_RIDGE.from + 1.5) * TILE);
    expect(standsAt(s, LOW_RIDGE.feet) && midCol(s) > LOW_RIDGE.from, 'auf dem niedrigen Grat').toBe(true);
    if (foes) hopPen(s, p, PENS[0]!);
    else walkRight(s, p, PENS[0]! + 5.5);
    goTo(s, p, CRAG_RIDGE.from - 1);
    jumpTo(s, p, () => (CRAG_RIDGE.from + 1.5) * TILE);
    expect(standsAt(s, CRAG_RIDGE.feet), 'auf dem Zacken-Grat').toBe(true);
  },
  /** Unter dem Zacken durch, mit Anlauf über Grube B. */
  pitB(s: GameState, p: Play) {
    runAndJump(s, p, LONG_PITS[0]!);
    expect(standsAt(s, RIDGE_D.feet) && midCol(s) > RIDGE_D.from, 'hinter Grube B').toBe(true);
  },
  /** In den Enzian-Pferch, Enzian holen, durch den Graben rennen (alles, was dort steht, wird besiegt). */
  enzianSprint(s: GameState, p: Play) {
    walkRight(s, p, ENZIAN_HUMPS[0]! + 1.5);
    takeEnzian(s, p);
    walkRight(s, p, RIDGE_E.from + 1.5);
    expect(standsAt(s, RIDGE_E.feet), 'aus dem Graben heraus').toBe(true);
  },
  /** Ohne Enzian: über den Pferch, von der Grabenkante über die drei Trittsteine auf den Grat dahinter. */
  stones(s: GameState, p: Play) {
    walkRight(s, p, TRENCH.from - 2);
    toEdge(s, p, TRENCH.from - 1);
    for (const x0 of STONES) {
      if (x0 !== STONES[0]) toEdge(s, p, x0 - 4);
      jumpTo(s, p, () => (x0 + 1.5) * TILE);
      expect(standsAt(s, STONE_FEET) && midCol(s) > x0 && midCol(s) < x0 + 3, `auf dem Trittstein ${x0}`).toBe(true);
    }
    toEdge(s, p, STONES[2]! + 2);
    jumpTo(s, p, () => (RIDGE_E.from + 1.5) * TILE);
    expect(standsAt(s, RIDGE_E.feet), 'hinter dem Graben').toBe(true);
  },
  /** Ohne Gegner einfach unten durch den leeren Graben. */
  trenchCalm(s: GameState, p: Play) {
    walkRight(s, p, RIDGE_E.from + 1.5);
  },
  /** Schnecken-Pferch, Steinmännchen, zwei Stufen hinauf, über den hohen Absatz hinab unter das Felsnest, Käfer-Pferch, an die Schlucht. */
  checkpointAndNest(s: GameState, p: Play, foes: boolean) {
    if (foes) hopPen(s, p, PENS[1]!);
    else walkRight(s, p, PENS[1]! + 5.5);
    goTo(s, p, STEPS[0]!.from - 1);
    jumpTo(s, p, () => (STEPS[0]!.from + 1.5) * TILE);
    goTo(s, p, STEPS[1]!.from - 1);
    jumpTo(s, p, () => (STEPS[1]!.from + 1.5) * TILE);
    expect(standsAt(s, HIGH.feet), 'auf dem hohen Absatz').toBe(true);
    walkRight(s, p, NEST_RIDGE.from + 1.5);
    if (foes) hopPen(s, p, PENS[2]!);
    else walkRight(s, p, PENS[2]! + 5.5);
  },
  /** Mit der Steinplatte über die Schlucht. */
  slab(s: GameState, p: Play) {
    const pl = s.platforms[PLAT.slab]!;
    boardRight(s, p, pl, NEST_RIDGE.to);
    alightRight(s, p, pl, RIDGE_G.from);
    expect(standsAt(s, RIDGE_G.feet), 'hinter der Schlucht').toBe(true);
  },
  /** Mit Anlauf über Grube C. */
  pitC(s: GameState, p: Play) {
    runAndJump(s, p, LONG_PITS[1]!);
    expect(standsAt(s, ISLAND.feet) && midCol(s) > ISLAND.from, 'hinter Grube C').toBe(true);
  },
  /** Über die Insel (Käfer-Pferch) an ihre Kante, hinüber auf die erste und die zweite Säule des Zackengrats. */
  zacken(s: GameState, p: Play, foes: boolean) {
    if (foes) hopPen(s, p, PENS[3]!);
    else walkRight(s, p, PENS[3]! + 5.5);
    toEdge(s, p, ISLAND.to);
    jumpTo(s, p, () => (PILLARS[0]!.x0 + 1.5) * TILE);
    expect(standsAt(s, PILLARS[0]!.feet), 'auf der ersten Säule').toBe(true);
    toEdge(s, p, PILLARS[0]!.x1);
    jumpTo(s, p, () => (PILLARS[1]!.x0 + 1.5) * TILE);
    expect(standsAt(s, PILLARS[1]!.feet), 'auf der zweiten Säule').toBe(true);
  },
  /** Auf die senkrechte Platte, wenn sie oben genug ist; oben hinüber auf die dritte Säule. */
  lift(s: GameState, p: Play) {
    const pl = s.platforms[PLAT.lift]!;
    toEdge(s, p, PILLARS[1]!.x1);
    p.until({}, () => pl.y <= PILLARS[1]!.feet * TILE && pl.dir < 0, 600);
    jumpTo(s, p, () => pl.x + pl.spec.width * TILE / 2, 12);
    expect(onPlat(s, pl), 'auf der senkrechten Platte').toBe(true);
    p.until({}, () => pl.y <= PILLARS[2]!.feet * TILE, 600);
    jumpTo(s, p, () => (PILLARS[2]!.x0 + 1.5) * TILE, 12);
    expect(standsAt(s, PILLARS[2]!.feet), 'auf der dritten Säule').toBe(true);
  },
  /** Hinab auf den Sattel, aufs Polster und hinauf auf den Gipfel, über die beiden Pferche zum Gipfelkreuz. */
  summit(s: GameState, p: Play, foes: boolean) {
    walkRight(s, p, SADDLE.from + 1);
    goTo(s, p, PAD.cx - 2);
    // Springen und rechts halten: an der Gipfelwand hinab aufs Polster, das federt hoch genug, oben weiter nach rechts.
    p.until({ right: true, jump: true }, () => standsAt(s, SUMMIT.feet), 240);
    p.step({}, 10);
    expect(standsAt(s, SUMMIT.feet), 'auf dem Gipfel').toBe(true);
    if (foes) {
      hopPen(s, p, PENS[4]!);
      hopPen(s, p, PENS[5]!);
    }
    walkRight(s, p, L.width, 900);
  },
};

describe('Level 1-4: Aufbau', () => {
  it('ist gültig, heißt Gratwanderung und hat die Maße', () => {
    expect(validateLevel(L, { requireEdelweiss: true, requireGoal: true })).toEqual([]);
    expect(L.name).toBe('Gratwanderung');
    expect(L.world).toBe(1);
    expect(L.width).toBeGreaterThanOrEqual(180); expect(L.width).toBeLessThanOrEqual(240);
    expect(L.height).toBeGreaterThanOrEqual(14); expect(L.height).toBeLessThanOrEqual(24);
  });

  it('genau ein Steinmännchen etwa in der Mitte, das Gipfelkreuz am Ende auf dem Gipfel, kein geheimes', () => {
    const cps = L.spawns.filter((s) => s.kind === 'checkpoint');
    expect(cps.length).toBe(1);
    expect(cps[0]!.cx / L.width).toBeGreaterThan(0.4); expect(cps[0]!.cx / L.width).toBeLessThan(0.65);
    expect(cps[0]!.cx).toBeGreaterThan(TRENCH.to);
    const goals = L.spawns.filter((s) => s.kind === 'goal');
    expect(goals.length).toBe(1);
    expect(goals[0]!.cx).toBeGreaterThan(L.width - 10);
    expect(goals[0]!.cy).toBe(SUMMIT.feet - 1);
    expect(L.spawns.some((s) => s.kind === 'secretGoal')).toBe(false);
  });

  it('mindestens 30 Kristalle, Kristall-Kisten, eine versteckte Kiste, je eine Helm- und eine Enzian-Kiste in ihrem Pferch, keine Schleuder-Kiste', () => {
    expect(L.spawns.filter((s) => s.kind === 'crystal').length).toBeGreaterThanOrEqual(30);
    expect([...L.crates].filter(([i, c]) => c.kind === 'crystal' && L.cells[i] === Cell.Crate).length).toBeGreaterThanOrEqual(3);
    expect([...L.cells].filter((c) => c === Cell.HiddenCrate).length).toBe(1);
    expect(crates('sling')).toEqual([]);
    const helm = crates('helm'), enzian = crates('enzian');
    expect(helm.length).toBe(1);
    expect(enzian.length).toBe(1);
    expect(helm[0]!.cx).toBeGreaterThan(HELM_HUMPS[0]!); expect(helm[0]!.cx).toBeLessThan(HELM_HUMPS[1]!);
    expect(enzian[0]!.cx).toBeGreaterThan(ENZIAN_HUMPS[0]!); expect(enzian[0]!.cx).toBeLessThan(ENZIAN_HUMPS[1]!);
    for (const [cx, feet] of [...HELM_HUMPS.map((x) => [x, START.feet]), ...ENZIAN_HUMPS.map((x) => [x, RIDGE_D.feet])] as const) {
      expect(solidCell(L, cx, feet - 1) && !solidCell(L, cx, feet - 2), `Höcker ${cx}`).toBe(true);
    }
  });

  it('mindestens zehn Gegner, Käfer und Schnecken gemischt: außerhalb des Grabens jeder in einem Pferch zwischen zwei Höckern', () => {
    const list = foes();
    expect(list.length).toBeGreaterThanOrEqual(10);
    expect(list.filter((f) => f.kind === 'beetle').length).toBeGreaterThanOrEqual(3);
    expect(list.filter((f) => f.kind === 'snail').length).toBeGreaterThanOrEqual(3);
    const outside = list.filter((f) => !inTrench(f.cx));
    expect(outside.map((f) => f.cx - 2).sort((a, b) => a - b)).toEqual(PENS);
    for (const f of outside) {
      // Höcker links und rechts, dazwischen drei freie Zellen auf festem Boden.
      expect(solidCell(L, f.cx - 2, f.cy) && solidCell(L, f.cx + 2, f.cy), `Höcker um ${f.kind} ${f.cx}`).toBe(true);
      for (let cx = f.cx - 1; cx <= f.cx + 1; cx++) {
        expect(solidCell(L, cx, f.cy), `${f.kind} ${f.cx}: Zelle ${cx}`).toBe(false);
        expect(solidCell(L, cx, f.cy + 1), `${f.kind} ${f.cx}: Boden unter ${cx}`).toBe(true);
      }
      for (const hx of [f.cx - 2, f.cx + 2]) expect(solidCell(L, hx, f.cy - 1), `über dem Höcker ${hx}`).toBe(false);
    }
  });

  it('zwei Steinplatten: waagerecht über der Schlucht, senkrecht im Zackengrat; der Fahrweg ist frei und darunter geht es in die Tiefe', () => {
    expect(L.platforms.length).toBe(2);
    expect(L.platforms.every((p) => p.art === 'stein')).toBe(true);
    expect(L.platforms[PLAT.slab]!.axis).toBe('h');
    expect(L.platforms[PLAT.lift]!.axis).toBe('v');
    for (const [i, pl] of L.platforms.entries()) {
      const { x0, x1 } = pathCols(pl), { y0 } = pathRows(pl);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy < L.height; cy++) expect(cellAt(L, cx, cy), `Platte ${i + 1}, Zelle ${cx},${cy}`).toBe(Cell.Empty);
      }
    }
    expect(pathCols(L.platforms[PLAT.slab]!)).toEqual({ x0: NEST_RIDGE.to + 1, x1: RIDGE_G.from - 1 });
    expect(L.platforms[PLAT.slab]!.cy).toBe(NEST_RIDGE.feet);
  });

  it('über jeder Platte und eine Spalte daneben sind auf dem ganzen Weg zwei Reihen frei: kein Fahrer wird eingeklemmt', () => {
    expect(L.platforms.length).toBe(2);
    for (const [i, pl] of L.platforms.entries()) {
      const { x0, x1 } = pathCols(pl), { y0 } = pathRows(pl);
      for (let cx = x0 - 1; cx <= x1 + 1; cx++) {
        for (let cy = y0 - 2; cy < y0; cy++) expect(solidCell(L, cx, cy), `Platte ${i + 1}, Zelle ${cx},${cy}`).toBe(false);
      }
    }
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
/** Grube, über die eine Platte fährt. */
const hasPlat = (pit: { from: number; to: number }) => L.platforms.some((pl) => pathCols(pl).x0 <= pit.to && pathCols(pl).x1 >= pit.from);
/** Gruben ohne Platte: hier muss vom Boden gesprungen werden. */
const plainPits = () => pits(L).filter((p) => !hasPlat(p));
/** Anlauf vor der Grube: so viele Kacheln auf gleicher Höhe, mit zwei freien Reihen darüber, höchstens `max`. */
function runUp(pit: { from: number }, max: number): number {
  const top = surface(L, pit.from - 1);
  let start = pit.from - 1;
  while (start > pit.from - max && surface(L, start - 1) === top && !solidCell(L, start - 1, top - 1) && !solidCell(L, start - 1, top - 2)) start--;
  return start;
}

describe('Level 1-4: Gruben', () => {
  it('jede Grube ohne Platte ist höchstens 6 breit; die zwei langen sind 5 bis 6 breit, mit mindestens 8 Kacheln freiem Anlauf', () => {
    const widths = plainPits().map((p) => p.to - p.from + 1);
    expect(widths.length).toBeGreaterThanOrEqual(4);
    expect(Math.max(...widths)).toBeLessThanOrEqual(6);
    const long = plainPits().filter((p) => p.to - p.from + 1 >= 5);
    expect(long).toEqual(LONG_PITS);
    for (const pit of long) {
      expect(surface(L, pit.from - 1), `Grube ${pit.from}: beide Ränder gleich hoch`).toBe(surface(L, pit.to + 1));
      expect(pit.from - runUp(pit, 12), `Grube ${pit.from}: Anlauf`).toBeGreaterThanOrEqual(8);
      // Kein Gegner auf dem Anlauf.
      expect(foes().filter((f) => f.cx >= pit.from - 8 && f.cx < pit.from), `Grube ${pit.from}`).toEqual([]);
    }
    expect(pits(L).filter(hasPlat).length).toBe(2);
  });

  it('jede Grube ohne Platte ist mit Renntempo überspringbar', () => {
    expect(plainPits().length).toBeGreaterThanOrEqual(4);
    for (const pit of plainPits()) {
      const top = surface(L, pit.from - 1);
      const s = calm();
      placePlayer(s, runUp(pit, 8), top - 1);
      const ev: GameEvent[] = runGame(s, [[{}, 2]]);
      for (let n = 0; n < 300 && s.player.body.x + s.player.body.w < pit.from * TILE - 2; n++) ev.push(...runGame(s, [[{ right: true }, 1]]));
      ev.push(...runGame(s, [[{ right: true, jump: true }, 40]]));
      for (let n = 0; n < 200 && !s.player.grounded && s.phase === 'playing'; n++) ev.push(...runGame(s, [[{ right: true }, 1]]));
      expect(ev.filter((e) => e.type === 'death'), `Grube ${pit.from}-${pit.to}`).toEqual([]);
      expect(s.player.grounded, `Grube ${pit.from}-${pit.to}`).toBe(true);
      expect(s.player.body.x + s.player.body.w / 2, `Grube ${pit.from}-${pit.to}`).toBeGreaterThan((pit.to + 1) * TILE);
    }
  });

  it('die langen Gruben gehen nicht aus dem Stand und nicht im Gehen, auch nicht mit Kraxeln an der Gegenwand', () => {
    let tries = 0, overPit = 0;
    for (const pit of LONG_PITS) {
      const top = surface(L, pit.from - 1);
      // Losgehen höchstens 2 Kacheln vor der Kante: bis zum Absprung reicht das Halten nicht fürs Rennen (0,6 s).
      for (let back = 0; back <= 2; back++) {
        for (const early of [0, 2, 4]) {
          for (const hold of [1, 10, 20, 40]) {
            for (const upAfter of [-1, 10, 30]) {
              const s = calm();
              placePlayer(s, pit.from - 1 - back, top - 1);
              const p = play(s);
              p.step({}, 2);
              p.until({ right: true }, () => s.player.body.x + s.player.body.w >= pit.from * TILE - 2 - early, 120);
              const vx = s.player.body.vx;
              p.step({ right: true, jump: true });
              expect(has(p.events, 'jump'), `Grube ${pit.from}: gesprungen`).toBe(true);
              expect(vx, `Grube ${pit.from}: kein Renntempo beim Absprung`).toBeLessThanOrEqual(DEFAULT_TUNING.walkSpeed + 1);
              let across = false;
              for (let i = 1; i < 600 && s.phase === 'playing'; i++) {
                p.step({ right: true, jump: i < hold, up: upAfter >= 0 && i >= upAfter });
                if (s.player.body.x > pit.from * TILE + TILE) overPit++;
                across ||= s.player.grounded && feetRow(s) <= top + 1e-6 && s.player.body.x + s.player.body.w > (pit.to + 1) * TILE;
              }
              tries++;
              const name = `Grube ${pit.from}, ${back} zurück, früh ${early}, halten ${hold}, oben ${upAfter}`;
              expect(across, name).toBe(false);
              expect(has(p.events, 'death'), name).toBe(true);
            }
          }
        }
      }
    }
    expect(tries).toBeGreaterThanOrEqual(200);
    expect(overPit).toBeGreaterThan(0);
  }, 30_000);

  it('die langen Gruben gehen mit Anlauf über den Streifen, ab 6 Kacheln vor der Kante losgerannt', () => {
    for (const pit of LONG_PITS) {
      const top = surface(L, pit.from - 1);
      for (let back = 6; back <= 10; back++) {
        const s = calm();
        placePlayer(s, pit.from - back, top - 1);
        const p = play(s);
        p.step({}, 2);
        p.until({ right: true }, () => s.player.body.x + s.player.body.w >= pit.from * TILE - 2, 300);
        expect(s.player.body.vx, `Grube ${pit.from}, ${back} Kacheln Anlauf: Renntempo`).toBeGreaterThan(DEFAULT_TUNING.walkSpeed + 1);
        p.step({ right: true, jump: true }, 40);
        p.until({ right: true }, () => s.player.grounded, 200);
        expect(standsAt(s, top) && s.player.body.x > (pit.to + 1) * TILE, `Grube ${pit.from}, ${back} Kacheln Anlauf`).toBe(true);
        expect(has(p.events, 'death')).toBe(false);
      }
    }
  });

  it('Gegner nehmen niemandem die Landung, mit echter Kamera und wartendem Spieler (alle Gruben, hochkant und quer)', () => {
    const levelPx = { w: L.width * TILE, h: L.height * TILE };
    const SECOND = 60;
    function tryPit(pit: { from: number; to: number }, viewW: number, mode: 'run' | 'stand', wait: number): { events: GameEvent[]; landed: boolean } {
      const top = surface(L, pit.from - 1);
      const start = mode === 'run' ? runUp(pit, 8) : pit.from - 1;
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

    expect(plainPits().length).toBeGreaterThanOrEqual(4);
    for (const pit of plainPits()) {
      for (const viewW of [256, 416, 512]) {
        for (const wait of [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3]) {
          const r = tryPit(pit, viewW, 'run', wait);
          expect(r.events.filter((e) => e.type === 'hurt'), `Grube ${pit.from}-${pit.to} Anlauf nach ${wait} s, Bild ${viewW}`).toEqual([]);
          expect(r.landed, `Grube ${pit.from}-${pit.to} Anlauf nach ${wait} s, Bild ${viewW}: gelandet`).toBe(true);
          if (pit.to - pit.from + 1 <= 4) {
            const t = tryPit(pit, viewW, 'stand', wait);
            expect(t.events.filter((e) => e.type === 'hurt'), `Grube ${pit.from}-${pit.to} Stand nach ${wait} s, Bild ${viewW}`).toEqual([]);
            expect(t.landed, `Grube ${pit.from}-${pit.to} Stand nach ${wait} s, Bild ${viewW}: gelandet`).toBe(true);
          }
        }
      }
    }
  }, 30_000);

  it('kein Gegner steht direkt an einer Landestelle, auch nicht dort, wo man von einer Platte absteigt', () => {
    expect(pits(L).length).toBeGreaterThanOrEqual(6);
    for (const pit of pits(L)) {
      const ground = surface(L, pit.to + 1);
      const close = foes().filter((e) => e.cx > pit.to && e.cx <= pit.to + 3 && e.cy >= ground - 2);
      expect(close, `Grube ${pit.from}-${pit.to}`).toEqual([]);
    }
  });

  it('Gegner bleiben in ihren Pferchen und im Graben, mit echter Kamera über 20 s', () => {
    expect(foes().length).toBeGreaterThanOrEqual(10);
    for (const f of foes()) {
      const s = createGame(L);
      // Kraxel steht etwas links davon auf festem Boden (im Graben: auf einem Trittstein darüber), die Kamera weckt den Gegner.
      if (inTrench(f.cx)) {
        const x0 = STONES.reduce((best, x) => (Math.abs(x + 1 - f.cx) < Math.abs(best + 1 - f.cx) ? x : best));
        placePlayer(s, x0 + 1, STONE_FEET - 1);
      } else placePlayer(s, f.cx - 4, surface(L, f.cx - 4) - 1);
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
      expect(has(p.events, 'hurt'), `${f.kind} ${f.cx}`).toBe(false);
    }
  }, 30_000);
});

describe('Level 1-4: Enzian-Sprint durch den Gegnergraben', () => {
  const trenchFoes = (s: GameState) => s.enemies.filter((e) => e.body.x >= TRENCH.from * TILE && e.body.x < (TRENCH.to + 1) * TILE);

  it('vor dem Graben liegt die Enzian-Kiste; im Graben stehen mindestens sechs Gegner, Käfer und Schnecken, eingefasst von zwei Wänden', () => {
    const e = crates('enzian')[0]!;
    expect(e.cx).toBeLessThan(TRENCH.from);
    expect(TRENCH.from - e.cx).toBeLessThanOrEqual(15);
    const row = foes().filter((f) => inTrench(f.cx));
    expect(row.length).toBeGreaterThanOrEqual(6);
    expect(new Set(row.map((f) => f.kind)).size).toBe(2);
    expect(row.every((f) => f.cy === TRENCH.feet - 1)).toBe(true);
    for (let cx = TRENCH.from; cx <= TRENCH.to; cx++) expect(surface(L, cx), `Grabenboden ${cx}`).toBe(TRENCH.feet);
    expect(surface(L, TRENCH.from - 1)).toBe(TRENCH.feet - 1);
    expect(surface(L, TRENCH.to + 1)).toBe(TRENCH.feet - 1);
  });

  it('Enzian holen, nach rechts rennen: alle Gegner im Graben sind besiegt, kein Treffer (hochkant und quer, früh und spät)', () => {
    for (const viewW of [256, 416]) {
      for (const wait of [0, 1, 2.5]) {
        const s = createGame(L);
        placePlayer(s, RIDGE_D.from + 1, RIDGE_D.feet - 1);
        const p = play(s, viewW, true);
        p.step({}, 2 + Math.round(wait * 60));
        const row = trenchFoes(s);
        expect(row.length).toBeGreaterThanOrEqual(6);
        route.enzianSprint(s, p);
        const name = `Bild ${viewW}, nach ${wait} s`;
        expect(row.every((e) => e.active), `${name}: alle waren wach`).toBe(true);
        expect(row.filter((e) => e.alive).length, `${name}: übrig`).toBe(0);
        expect(p.events.filter((e) => e.type === 'enemyDefeated').length, name).toBeGreaterThanOrEqual(row.length);
        expect(has(p.events, 'hurt'), name).toBe(false);
        expect(has(p.events, 'enzianEnd'), `${name}: Enzian hält bis hinter den Graben`).toBe(false);
      }
    }
  });

  it('wer ohne Enzian unten durch den Graben rennt, wird getroffen', () => {
    const s = createGame(L, undefined, { helm: true });
    placePlayer(s, TRENCH.from - 3, RIDGE_D.feet - 1);
    const p = play(s, 256, true);
    p.step({}, 2);
    walkRight(s, p, RIDGE_E.from + 1.5);
    expect(has(p.events, 'hurt')).toBe(true);
  });

  it('ohne Enzian geht es über die Trittsteine, ohne Treffer (hochkant und quer, früh und spät)', () => {
    for (const viewW of [256, 416]) {
      for (const wait of [0, 1.5, 3, 5]) {
        const s = createGame(L);
        placePlayer(s, RIDGE_D.from + 1, RIDGE_D.feet - 1);
        const p = play(s, viewW, true);
        p.step({}, 2 + Math.round(wait * 60));
        route.stones(s, p);
        const name = `Bild ${viewW}, nach ${wait} s`;
        expect(trenchFoes(s).every((e) => e.active && e.alive), `${name}: Gegner wach und am Leben`).toBe(true);
        expect(has(p.events, 'hurt'), name).toBe(false);
        expect(has(p.events, 'death'), name).toBe(false);
      }
    }
  });

  it('der Enzian bleibt im Pferch liegen, bis Kraxel ihn holt', () => {
    const s = calm();
    const e = crates('enzian')[0]!;
    placePlayer(s, e.cx, RIDGE_D.feet - 1);
    const p = play(s);
    p.step({}, 2);
    p.step({ jump: true }, 10);
    placePlayer(s, RIDGE_D.from + 1, RIDGE_D.feet - 1); // aus dem Weg
    p.step({}, 10 * 60);
    const item = s.pickups.find((it) => it.kind === 'item' && it.item === 'enzian')!;
    expect(item.taken).toBe(false);
    expect(item.body.x).toBeGreaterThan((ENZIAN_HUMPS[0]! + 1) * TILE - 1);
    expect(item.body.x + item.body.w).toBeLessThan(ENZIAN_HUMPS[1]! * TILE + 1);
  });

  it('wer mit Helm oder Schleuder kommt, bekommt aus der Enzian-Kiste trotzdem den Enzian und behält sein Item', () => {
    for (const opts of [{ helm: true }, { special: 'sling' as const }]) {
      const s = calm(L, opts);
      placePlayer(s, RIDGE_D.from + 1, RIDGE_D.feet - 1);
      const p = play(s);
      p.step({}, 2);
      walkRight(s, p, ENZIAN_HUMPS[0]! + 1.5);
      takeEnzian(s, p);
      expect([s.player.helm, s.player.special], JSON.stringify(opts)).toEqual([true, opts.special ?? null]);
    }
  });
});

describe('Level 1-4: Steinplatten', () => {
  it('die Steinplatte über der Schlucht: aufsteigen, mitfahren, absteigen, egal wann Kraxel ankommt', () => {
    const spec = L.platforms[PLAT.slab]!;
    const period = (2 * Math.abs(spec.travel)) / spec.speed;
    expect(period).toBeLessThanOrEqual(10);
    for (const wait of [0, 1, 2.5, 4, 5.5, 7, 8.5]) {
      const s = calm();
      placePlayer(s, NEST_ROCK.cx + 8, NEST_RIDGE.feet - 1);
      const p = play(s);
      p.step({}, 2 + Math.round(wait * 60));
      route.slab(s, p);
      expect(has(p.events, 'death'), `nach ${wait} s`).toBe(false);
    }
  });

  it('wer mitten über der Schlucht von der Platte tritt, fällt sichtbar und stirbt', () => {
    for (const dir of [{ left: true }, { right: true }]) {
      const s = calm();
      const pl = s.platforms[PLAT.slab]!;
      placePlayer(s, NEST_RIDGE.to - 1, NEST_RIDGE.feet - 1);
      const p = play(s);
      boardRight(s, p, pl, NEST_RIDGE.to);
      p.until({}, () => pl.x >= (NEST_RIDGE.to + 5) * TILE, 400);
      p.until(dir, () => !onPlat(s, pl), 60);
      const fromY = s.player.body.y + s.player.body.h;
      p.until(dir, () => s.phase !== 'playing', 200);
      expect(has(p.events, 'death')).toBe(true);
      expect(s.player.body.y + s.player.body.h - fromY).toBeGreaterThanOrEqual(3 * TILE);
    }
  });

  it('die senkrechte Platte im Zackengrat: abgepasst hinauf und oben hinüber, egal wann Kraxel ankommt', () => {
    const spec = L.platforms[PLAT.lift]!;
    expect(pathRows(spec)).toEqual({ y0: PILLARS[2]!.feet, y1: PILLARS[2]!.feet + 3 });
    expect(pathCols(spec).x0 - PILLARS[1]!.x1 - 1).toBe(2);
    expect(PILLARS[2]!.x0 - pathCols(spec).x1 - 1).toBe(2);
    for (const wait of [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]) {
      const s = calm();
      placePlayer(s, PILLARS[1]!.x0, PILLARS[1]!.feet - 1);
      const p = play(s);
      p.step({}, 2 + Math.round(wait * 60));
      route.lift(s, p);
      expect(has(p.events, 'death'), `nach ${wait} s`).toBe(false);
    }
  });

  it('ohne die senkrechte Platte kommt niemand über die Lücke im Zackengrat', () => {
    const without = withoutPlatform(PLAT.lift);
    let reachedGap = 0;
    for (let cx = PILLARS[1]!.x0; cx <= PILLARS[1]!.x1; cx++) {
      for (const run of [0, 6, 12, 24]) {
        for (const hold of [8, 20, 40]) {
          for (const upAfter of [-1, 20]) {
            const s = calm(without);
            placePlayer(s, cx, PILLARS[1]!.feet - 1);
            const script: Script = [[{}, 2], [{ right: true }, run], [{ right: true, jump: true }, hold],
              [{ right: true, up: upAfter >= 0, jump: hold >= 40 }, 120], [{}, 30]];
            const ev = runGame(s, script);
            if (s.player.body.x > (PILLARS[1]!.x1 + 2) * TILE || has(ev, 'death')) reachedGap++;
            expect(standsAt(s, PILLARS[2]!.feet) && midCol(s) > PILLARS[2]!.x0, `Start ${cx}, Anlauf ${run}, halten ${hold}`).toBe(false);
          }
        }
      }
    }
    expect(reachedGap).toBeGreaterThan(0);
  }, 30_000);

  it('wer über den Rand einer Platte hinaussteht, fährt zwei ganze Runden mit und wird nirgends eingeklemmt', () => {
    let tried = 0;
    for (const i of [PLAT.slab, PLAT.lift]) {
      const spec = L.platforms[i]!;
      const period = (2 * Math.abs(spec.travel)) / spec.speed;
      for (const side of [-1, 1] as const) {
        const s = calm();
        const pl = s.platforms[i]!, b = s.player.body;
        // Startlage der Platte, Kraxel steht so weit über dem Rand, dass nur 2 px aufliegen.
        b.x = side < 0 ? pl.x - b.w + 2 : platRight(pl) - 2;
        b.y = pl.y - b.h;
        s.playerPrevBottom = b.y + b.h;
        const cx0 = Math.floor(b.x / TILE), cx1 = Math.floor((b.x + b.w - 1e-9) / TILE);
        const cy0 = Math.floor(b.y / TILE), cy1 = Math.floor((b.y + b.h - 1e-9) / TILE);
        let blocked = false;
        for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) blocked ||= s.grid.isSolid(cx, cy);
        if (blocked) continue; // neben der Platte steht eine Wand: dort kann niemand überstehen
        tried++;
        const p = play(s);
        p.step({}, 2);
        for (let n = 0; n < Math.round(2 * period * 60); n++) {
          p.step({});
          const onIt = s.player.grounded && s.phase === 'playing';
          expect(onIt, `Platte ${i + 1}, ${side < 0 ? 'links' : 'rechts'} überstehend, Schritt ${n}`).toBe(true);
          if (!onIt) break;
        }
      }
    }
    expect(tried).toBeGreaterThanOrEqual(3);
  });
});

describe('Level 1-4: Edelweiß', () => {
  it('Edelweiß 1 ist mit Helm von unten erreichbar', () => {
    const s = calm(L, { helm: true });
    placePlayer(s, NEST_ROCK.cx, NEST_RIDGE.feet - 1);
    const ev = runGame(s, [[{}, 2], [{ jump: true }, 20], [{}, 40], [{ jump: true }, 30], [{}, 40]]);
    expect(ev).toContainEqual({ type: 'rockBreak', ...NEST_ROCK });
    expect(s.session.edelweiss[0]).toBe(true);
  });

  it('vom hohen Absatz springt Kraxel aufs Felsnest und stampft sich zu Edelweiß 1 durch', () => {
    const s = calm();
    placePlayer(s, HIGH.to - 1, HIGH.feet - 1);
    const p = play(s);
    p.step({}, 2);
    toEdge(s, p, HIGH.to);
    jumpTo(s, p, () => (NEST_ROCK.cx + 0.5) * TILE);
    expect(standsAt(s, NEST.top), 'oben auf dem Nest').toBe(true);
    goTo(s, p, NEST_ROCK.cx);
    p.step({ jump: true }, 8);
    p.step({ down: true }, 1);
    p.step({}, 80);
    expect(p.events).toContainEqual({ type: 'rockBreak', cx: NEST_ROCK.cx, cy: NEST.top });
    expect(s.session.edelweiss[0]).toBe(true);
    expect(standsAt(s, NEST_RIDGE.feet)).toBe(true);
  });

  it('aufs Felsnest kommt man auch durch Kraxeln vom Grat darunter, von links und von rechts', () => {
    for (const [cx, dir] of [[NEST.x0 - 1, { right: true }], [NEST.x1 + 1, { left: true }]] as const) {
      const s = calm();
      placePlayer(s, cx, NEST_RIDGE.feet - 1);
      const p = play(s);
      p.step({}, 2);
      p.step({ ...dir, jump: true }, 6);
      p.until({ ...dir, up: true, jump: true }, () => standsAt(s, NEST.top), 120);
      p.step({}, 10);
      expect(standsAt(s, NEST.top), `von ${cx}: oben auf dem Nest`).toBe(true);
    }
  });

  it('Edelweiß 1 bleibt ohne Helm und ohne Stampfen im Nest', () => {
    for (const [feet, dir] of [[NEST_RIDGE.feet, {}], [NEST.top, {}], [NEST.top, { right: true }], [NEST.top, { left: true }]] as const) {
      const s = calm();
      placePlayer(s, NEST_ROCK.cx, feet - 1);
      runGame(s, [[{}, 2], [{ ...dir, jump: true }, 20], [dir, 40], [{ ...dir, jump: true }, 30], [dir, 40]]);
      expect(s.session.edelweiss[0]).toBe(false);
    }
    const s = calm();
    placePlayer(s, NEST_ROCK.cx, NEST_RIDGE.feet - 1);
    expect(runGame(s, [[{}, 2], [{ jump: true }, 20], [{}, 30]])).toContainEqual({ type: 'bump', ...NEST_ROCK });
  });

  it('Edelweiß 2: am schwebenden Zacken hinaufkraxeln, von links und von rechts, egal wann oben gedrückt wird', () => {
    expect(edelweiss(1)).toMatchObject({ cx: CRAG.x0 + 1, cy: CRAG.top - 1 });
    for (const [cx, dir] of [[CRAG.x0 - 1, { right: true }], [CRAG.x1 + 1, { left: true }]] as const) {
      for (const upAfter of [0, 6, 12, 20]) {
        const s = calm();
        placePlayer(s, cx, CRAG_RIDGE.feet - 1);
        const jumpPart: Script = upAfter > 0 ? [[{ ...dir, jump: true }, upAfter]] : [];
        runGame(s, [[{}, 2], ...jumpPart, [{ ...dir, up: true, jump: true }, 80 - upAfter], [{}, 20]]);
        expect(s.session.edelweiss[1], `Start ${cx}, oben nach ${upAfter}`).toBe(true);
        expect(standsAt(s, CRAG.top), `Start ${cx}, oben nach ${upAfter}`).toBe(true);
      }
    }
  });

  it('unter dem Zacken führt ein Durchgang hindurch: der Anlauf zu Grube B bleibt frei', () => {
    for (let cx = CRAG.x0; cx <= CRAG.x1; cx++) {
      expect(solidCell(L, cx, CRAG.bottom + 1) || solidCell(L, cx, CRAG.bottom + 2), `Spalte ${cx}`).toBe(false);
      expect(CRAG.bottom + 3).toBe(CRAG_RIDGE.feet);
    }
    const s = calm();
    placePlayer(s, CRAG.x0 - 3, CRAG_RIDGE.feet - 1);
    runGame(s, [[{}, 2], [{ right: true }, 60], [{}, 30]]);
    expect(standsAt(s, CRAG_RIDGE.feet) && midCol(s) > CRAG.x1 + 1).toBe(true);
  });

  it('Edelweiß 2 gibt es nur mit Kraxeln oder Wandsprung: Springen und Anlauf vom Grat und vom niedrigen Grat reichen nicht', () => {
    const spots: Array<[number, number]> = [];
    for (let cx = CRAG_RIDGE.from; cx <= CRAG_RIDGE.to; cx++) spots.push([cx, CRAG_RIDGE.feet - 1]);
    for (let cx = LOW_RIDGE.to - 3; cx <= LOW_RIDGE.to; cx++) spots.push([cx, LOW_RIDGE.feet - 1]);
    let underCrag = 0;
    for (const [cx, cy] of spots) {
      for (const dir of [{ right: true }, { left: true }]) {
        for (let run = 0; run <= 72; run += 24) {
          for (const hold of [4, 16, 40]) {
            const s = calm();
            placePlayer(s, cx, cy);
            const ev = runGame(s, [[{}, 2], [dir, run], [{ ...dir, jump: true }, hold], [{ ...dir, jump: hold >= 40 }, 120], [{}, 30]]);
            if (ev.some((e) => e.type === 'bump' && e.cx >= CRAG.x0 && e.cx <= CRAG.x1)) underCrag++;
            expect(s.session.edelweiss[1], `Start ${cx},${cy}`).toBe(false);
          }
        }
      }
    }
    expect(underCrag).toBeGreaterThan(0);
  }, 30_000);

  /** Stellt Kraxel auf die erste Säule, deckt die versteckte Kiste auf und kommt wieder zur Ruhe. */
  function revealHidden() {
    const s = calm();
    placePlayer(s, HIDDEN.cx, PILLARS[0]!.feet - 1);
    const p = play(s);
    p.step({}, 2);
    p.step({ jump: true }, 8);
    p.step({}, 60);
    return { s, p };
  }

  it('Edelweiß 3: der Hinweis-Kristall auf der Säule führt an die versteckte Kiste, von ihr aus springt Kraxel ans Edelweiß', () => {
    expect(edelweiss(2)).toMatchObject({ cx: HIDDEN.cx, cy: HIDDEN.cy - 4 });
    expect(L.spawns.some((s) => s.kind === 'crystal' && s.cx === HIDDEN.cx && s.cy === PILLARS[0]!.feet - 1)).toBe(true);
    for (const side of [-1, 1] as const) {
      const { s, p } = revealHidden();
      expect(p.events).toContainEqual({ type: 'crateOpen', ...HIDDEN });
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

  it('Edelweiß 3 ist ohne die versteckte Kiste nicht erreichbar, auch nicht mit Anlauf von der Insel oder Kraxeln', () => {
    const without = withEmpty(HIDDEN.cx, HIDDEN.cy);
    expect(cellAt(L, HIDDEN.cx, HIDDEN.cy)).toBe(Cell.HiddenCrate);
    expect(validateLevel(without, { requireEdelweiss: true, requireGoal: true })).toEqual([]);
    const spots: Array<[number, number]> = [];
    for (let cx = PILLARS[0]!.x0; cx <= PILLARS[0]!.x1; cx++) spots.push([cx, PILLARS[0]!.feet - 1]);
    for (let cx = PILLARS[1]!.x0; cx <= PILLARS[1]!.x1; cx++) spots.push([cx, PILLARS[1]!.feet - 1]);
    for (let cx = ISLAND.to - 3; cx <= ISLAND.to; cx++) spots.push([cx, ISLAND.feet - 1]);
    spots.push([PENS[3]! + 4, ISLAND.feet - 2]); // auf dem rechten Höcker des Insel-Pferchs
    let tries = 0, overPillar = 0;
    for (const [cx, cy] of spots) {
      for (const dir of [{ right: true }, { left: true }, {}]) {
        for (const run of [0, 6, 12, 48]) {
          for (const hold of [1, 20, 40]) {
            for (const upAfter of [-1, 0, 12, 24]) {
              const s = calm(without);
              placePlayer(s, cx, cy);
              const script: Script = upAfter < 0
                ? [[{}, 2], [dir, run], [{ ...dir, jump: true }, hold], [{ ...dir, jump: true }, 100], [{}, 30]]
                : [[{}, 2], [dir, run], [{ ...dir, jump: true }, Math.min(hold, upAfter)], [{ ...dir, up: true, jump: hold > upAfter }, 100], [{}, 30]];
              const sm = new InputSampler();
              for (const [input, n] of script) {
                for (let i = 0; i < n; i++) {
                  stepGame(s, sm.sample(held(input)), DEFAULT_TUNING, { x: 0, w: 512 }, STEP);
                  const b = s.player.body;
                  if (b.x < (HIDDEN.cx + 1) * TILE && b.x + b.w > HIDDEN.cx * TILE && b.y < HIDDEN.cy * TILE) overPillar++;
                }
              }
              tries++;
              expect(s.session.edelweiss[2], `Start ${cx},${cy}`).toBe(false);
            }
          }
        }
      }
    }
    expect(tries).toBeGreaterThan(400);
    expect(overPillar).toBeGreaterThan(0); // die Läufe kommen über der Säule höher als die Kiste
  }, 30_000);
});

describe('Level 1-4: Helm und Schleuder mitbringen', () => {
  function openHelmCrate(s: GameState): GameEvent[] {
    const helm = crates('helm')[0]!;
    placePlayer(s, helm.cx, START.feet - 1);
    const p = play(s);
    p.step({}, 2);
    p.step({ jump: true }, 10);
    p.step({}, 60);
    return p.events;
  }
  function collectItem(s: GameState, ev: GameEvent[]): void {
    const item = s.pickups.find((it) => it.kind === 'item')!;
    const p = play(s);
    for (let i = 0; i < 400 && !item.taken; i++) {
      const dx = item.body.x + item.body.w / 2 - (s.player.body.x + s.player.body.w / 2);
      ev.push(...p.step(dx > 2 ? { right: true } : dx < -2 ? { left: true } : {}));
    }
    expect(item.taken).toBe(true);
  }

  it('ohne Helm gibt die Helm-Kiste den Helm', () => {
    const s = calm();
    const ev = openHelmCrate(s);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'itemSpawn', item: 'helm' }));
    collectItem(s, ev);
    expect(s.player.helm).toBe(true);
  });

  it('wer den Helm mitbringt, bekommt aus der Helm-Kiste 10 Kristalle', () => {
    const s = calm(L, { helm: true });
    const before = s.session.crystals;
    const ev = openHelmCrate(s);
    collectItem(s, ev);
    expect(has(ev, 'powerUp')).toBe(false);
    expect(s.session.crystals - before - ev.filter((e) => e.type === 'crystal').length).toBe(10);
    expect(s.player.helm).toBe(true);
  });

  it('wer mit der Schleuder kommt, behält sie; die Helm-Kiste gibt dann Kristalle', () => {
    const s = calm(L, { special: 'sling' });
    const ev = openHelmCrate(s);
    collectItem(s, ev);
    expect(has(ev, 'powerUp')).toBe(false);
    expect([s.player.helm, s.player.special]).toEqual([true, 'sling']);
  });

  it('der Helm bleibt im Pferch auf der Startwiese und fällt nicht in Grube A', () => {
    const s = calm();
    openHelmCrate(s);
    const item = s.pickups.find((it) => it.kind === 'item')!;
    placePlayer(s, 2, START.feet - 1); // aus dem Weg
    const p = play(s);
    p.step({}, 10 * 60);
    expect(item.taken).toBe(false);
    expect(item.body.x).toBeGreaterThan((HELM_HUMPS[0]! + 1) * TILE - 1);
    expect(item.body.x + item.body.w).toBeLessThan(HELM_HUMPS[1]! * TILE + 1);
  });
});

describe('Level 1-4: Kamera', () => {
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

  it('zeigt Edelweiß 2 vom Grat, Edelweiß 1 vom hohen Absatz und vom Grat darunter, Edelweiß 3 von der Säule, hochkant und quer', () => {
    for (const w of [256, 416]) {
      expect(inView(CRAG.x0 - 2, CRAG_RIDGE.feet - 1, edelweiss(1).cx, edelweiss(1).cy, w), `E2, Bild ${w}`).toBe(true);
      expect(inView(HIGH.to - 1, HIGH.feet - 1, edelweiss(0).cx, edelweiss(0).cy, w), `E1 vom Absatz, Bild ${w}`).toBe(true);
      expect(inView(NEST.x0 - 1, NEST_RIDGE.feet - 1, edelweiss(0).cx, edelweiss(0).cy, w), `E1 vom Grat, Bild ${w}`).toBe(true);
      expect(inView(PILLARS[0]!.x0, PILLARS[0]!.feet - 1, edelweiss(2).cx, edelweiss(2).cy, w), `E3, Bild ${w}`).toBe(true);
    }
  });

  it('von jeder Absprungstelle ist die Landestelle zu sehen (hochkant)', () => {
    const pairs: Array<[string, number, number, number, number]> = [];
    for (const pit of plainPits()) {
      const from = surface(L, pit.from - 1), to = surface(L, pit.to + 1);
      pairs.push([`Grube ${pit.from}-${pit.to}`, pit.from - 1, from - 1, pit.to + 2, to]);
    }
    const slab = L.platforms[PLAT.slab]!, lift = L.platforms[PLAT.lift]!;
    pairs.push(
      ['Grat unter dem Nest → Steinplatte am Grat', NEST_RIDGE.to, NEST_RIDGE.feet - 1, pathCols(slab).x0 + slab.width - 1, NEST_RIDGE.feet],
      ['zweite Säule → senkrechte Platte ganz unten', PILLARS[1]!.x1, PILLARS[1]!.feet - 1, pathCols(lift).x1, pathRows(lift).y1],
      ['zweite Säule → dritte Säule', PILLARS[1]!.x1, PILLARS[1]!.feet - 1, PILLARS[2]!.x0 + 1, PILLARS[2]!.feet],
      ['Grat → Trittstein 1', TRENCH.from - 1, RIDGE_D.feet - 1, STONES[0]! + 1, STONE_FEET],
      ['Trittstein 3 → Grat', STONES[2]! + 2, STONE_FEET - 1, RIDGE_E.from + 1, RIDGE_E.feet],
      ['hoher Absatz → Felsnest', HIGH.to, HIGH.feet - 1, NEST.x1, NEST.top],
      ['dritte Säule → Sattel', PILLARS[2]!.x1, PILLARS[2]!.feet - 1, SADDLE.from + 1, SADDLE.feet],
    );
    for (const [name, cx, cy, tx, ty] of pairs) expect(inView(cx, cy, tx, ty, 256, 1, LANDING_PX), name).toBe(true);
  });

  it('vom Anfang jedes Anlaufstreifens sieht man die lange Grube (hochkant), von der Kante die Landestelle (hochkant)', () => {
    for (const pit of LONG_PITS) {
      const feet = surface(L, pit.from - 1);
      expect(inView(pit.from - 8, feet - 1, pit.from + 1, feet, 256, 1, LANDING_PX), `Grube ${pit.from} vom Anlauf`).toBe(true);
      expect(inView(pit.from - 1, feet - 1, pit.to + 2, feet, 256, 1, LANDING_PX), `Grube ${pit.from} von der Kante`).toBe(true);
    }
  });

  it('von der Grabenkante sieht man den Grabenboden, quer auch zwei Trittsteine; von jedem Trittstein den nächsten (hochkant); vom Polster die Gipfelkante', () => {
    const edge = TRENCH.from - 1;
    expect(inView(edge, RIDGE_D.feet - 1, TRENCH.from + 6, TRENCH.feet - 1, 256), 'Grabenboden hochkant').toBe(true);
    expect(inView(edge, RIDGE_D.feet - 1, STONES[1]! + 2, STONE_FEET, 416, 1, LANDING_PX), 'zweiter Trittstein quer').toBe(true);
    for (let i = 0; i + 1 < STONES.length; i++) {
      expect(inView(STONES[i]! + 2, STONE_FEET - 1, STONES[i + 1]! + 2, STONE_FEET, 256, 1, LANDING_PX), `Trittstein ${STONES[i]} → ${STONES[i + 1]}`).toBe(true);
    }
    expect(inView(PAD.cx - 1, SADDLE.feet - 1, SUMMIT.from + 1, SUMMIT.feet, 256, 1, LANDING_PX), 'Gipfelkante vom Polster').toBe(true);
  });

  it('auf dem Weg hinauf und hinab ist jede nächste Stufe zu sehen (hochkant)', () => {
    const steps: Array<[string, number, number, number, number]> = [
      ['niedriger Grat → Zacken-Grat', LOW_RIDGE.to, LOW_RIDGE.feet - 1, CRAG_RIDGE.from + 1, CRAG_RIDGE.feet],
      ['Steinmännchen-Grat → Stufe 1', STEPS[0]!.from - 1, RIDGE_E.feet - 1, STEPS[0]!.from + 1, STEPS[0]!.feet],
      ['Stufe 1 → hoher Absatz', STEPS[1]!.from - 1, STEPS[0]!.feet - 1, STEPS[1]!.from + 1, STEPS[1]!.feet],
      ['hoher Absatz → Grat unter dem Nest', HIGH.to, HIGH.feet - 1, NEST_RIDGE.from + 1, NEST_RIDGE.feet],
    ];
    for (const [name, cx, cy, tx, ty] of steps) expect(inView(cx, cy, tx, ty, 256, 1, LANDING_PX), name).toBe(true);
  });
});

describe('Level 1-4: Weg von P bis Z', () => {
  it('der Gipfel: das Polster hebt Kraxel vom Sattel hinauf; ohne Polster geht es per Kraxeln, nicht mit Springen', () => {
    const s = calm();
    placePlayer(s, SADDLE.from + 1, SADDLE.feet - 1);
    const p = play(s);
    p.step({}, 2);
    route.summit(s, p, false);
    expect(s.phase).toBe('goal');
    const without = withEmpty(PAD.cx, PAD.cy);
    let up = 0;
    for (let cx = SADDLE.from; cx <= SADDLE.to; cx++) {
      for (const run of [0, 24, 48]) {
        for (const hold of [8, 40]) {
          const t = calm(without);
          placePlayer(t, cx - Math.round(run / 16), SADDLE.feet - 1);
          runGame(t, [[{}, 2], [{ right: true }, run], [{ right: true, jump: true }, hold], [{ right: true, jump: true }, 90], [{}, 30]]);
          if (standsAt(t, SUMMIT.feet)) up++;
        }
      }
    }
    expect(up, 'ohne Polster und ohne Kraxeln').toBe(0);
    const c = calm(without);
    placePlayer(c, SUMMIT.from - 1, SADDLE.feet - 1);
    runGame(c, [[{}, 2], [{ right: true, jump: true }, 10], [{ right: true, up: true, jump: true }, 80], [{ right: true }, 20]]);
    expect(standsAt(c, SUMMIT.feet), 'mit Kraxeln').toBe(true);
  });

  for (const opts of [{}, { helm: true }, { special: 'sling' as const }]) {
    it(`ohne Gegner von P bis Z (Gruben mit Anlauf, Platten abgepasst, Polster hinauf) erreicht das Gipfelkreuz ${JSON.stringify(opts)}`, () => {
      const s = calm(L, opts);
      const p = play(s);
      p.step({}, 2);
      route.start(s, p, false);
      route.pitB(s, p);
      route.trenchCalm(s, p);
      route.checkpointAndNest(s, p, false);
      expect(has(p.events, 'checkpoint')).toBe(true);
      route.slab(s, p);
      route.pitC(s, p);
      route.zacken(s, p, false);
      route.lift(s, p);
      route.summit(s, p, false);
      expect(s.phase).toBe('goal');
      expect(exitOf(p.events)).toBe('normal');
      expect(p.events.filter((e) => e.type === 'goal').length).toBe(1);
      expect(has(p.events, 'death')).toBe(false);
    }, 30_000);
  }

  for (const [name, viewW, sprint] of [['mit dem Enzian durch den Graben, hochkant', 256, true], ['über die Trittsteine, quer', 416, false]] as const) {
    it(`mit wachen Gegnern und echter Kamera von P bis Z, ohne einen Treffer (${name})`, () => {
      const s = createGame(L);
      const p = play(s, viewW, true);
      p.step({}, 2);
      route.start(s, p, true);
      route.pitB(s, p);
      if (sprint) route.enzianSprint(s, p);
      else route.stones(s, p);
      route.checkpointAndNest(s, p, true);
      expect(has(p.events, 'checkpoint')).toBe(true);
      route.slab(s, p);
      route.pitC(s, p);
      route.zacken(s, p, true);
      route.lift(s, p);
      route.summit(s, p, true);
      expect(s.phase).toBe('goal');
      expect(exitOf(p.events)).toBe('normal');
      expect(has(p.events, 'hurt')).toBe(false);
      expect(has(p.events, 'death')).toBe(false);
      expect(s.enemies.filter((e) => e.active).length, 'die Gegner waren wach').toBeGreaterThanOrEqual(10);
    }, 30_000);
  }
});
