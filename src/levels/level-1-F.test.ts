// Festung 1-F „Wurzelburg“: Aufbau, Gruben, Steinschlag, Steinplatten, die Kiste vor der Tür, Kamera, der Weg von P in die Arena
// und der Kampf gegen den Murmelkönig bis zum Gipfelkreuz.
// Alle Wege laufen über echte Eingabe-Skripte mit durchgehendem Eingabe-Takt, nichts wird in die Arena oder zum Kreuz teleportiert.
import { describe, expect, it } from 'vitest';
import { STEP, TILE, VIEW_H } from '../config.ts';
import { BOSS_LIE } from '../core/boss.ts';
import { createCamera, stepCamera } from '../core/camera.ts';
import type { CameraLock } from '../core/camera.ts';
import { platformSupports } from '../core/collide.ts';
import { createGame, stepGame } from '../core/game.ts';
import type { GameState } from '../core/game.ts';
import { InputSampler } from '../core/input-frame.ts';
import { parseLevel, validateLevel } from '../core/level.ts';
import type { LevelData } from '../core/level.ts';
import type { PlatformState } from '../core/platforms.ts';
import type { FallingRock } from '../core/rockfall.ts';
import { held, placePlayer, runGame } from '../core/test-helpers.ts';
import type { Script } from '../core/test-helpers.ts';
import { DEFAULT_TUNING } from '../core/tuning.ts';
import { Cell } from '../core/types.ts';
import type { GameEvent, Held, SpecialItem } from '../core/types.ts';
import { LEVELS } from './index.ts';

const L = parseLevel('1-F', LEVELS['1-F']);

// Stellen aus 1-F.txt als (Spalte, Reihe). „Füße“ meint die Reihe, auf deren Oberkante Kraxel steht.
const FEET = 13;                                          // Burgboden, auch in der Arena
const START = { from: 0, to: 14 };                        // Burgtor mit dem ersten Brocken unter der Torwand
const GATE = { x0: 9, x1: 13, bottom: 7 };                // Torwand: hängt bis Reihe 7 herab, darunter der Durchgang
const PIT_1 = { from: 15, to: 17 };
const HALL = { from: 18, to: 33 };                        // Halle mit dem Käfer-Pferch, zugleich Anlauf zur langen Grube
const LONG_PIT = { from: 34, to: 39 };                    // lange Grube, nur mit Anlauf
const LANDING = { from: 40, to: 44 };                     // Absatz vor der Pfeilerhalle
const PILLARS = [{ x0: 47, x1: 48 }, { x0: 51, x1: 52 }, { x0: 56, x1: 57 }]; // Pfeiler über dem Dunkel
const LEDGE = { from: 60, to: 62 };                       // Steg vor dem Abgrund
const FAR = { from: 75, to: 91 };                         // Halle hinter dem Abgrund mit zwei Pferchen, endet am Schacht
const GALLERY = { from: 97, to: 106, feet: 5 };           // Galerie über dem Schacht
const STEPS = [{ from: 107, to: 109, feet: 8 }, { from: 110, to: 111, feet: 11 }]; // zwei Stufen hinab in den Fallraum
const DROP = { from: 112, to: 121 };                      // Fallraum mit dem Pferch der Kiste
const KIT_HUMPS = [113, 121];                             // Höcker um die Kiste
const KIT = { cx: 117, cy: 9 };                           // Kiste: Helm, mit Helm die Schleuder
const CHECKPOINT = { cx: 124, cy: FEET - 1 };             // Steinmännchen direkt vor der Tür
const ARENA = { x0: 126, x1: 141 };
const DOOR = ARENA.x0 - 1;
const BOSS = { cx: 137, cy: FEET - 1 };                   // Zelle unten links des Murmelkönigs
const PENS = [21, 77, 84];                                // linke Höcker der Gegner-Pferche; der rechte steht 4 Spalten weiter
const PLAT = { slab: 0, lift: 1 } as const;               // Steinplatte über dem Abgrund, senkrechte Platte im Schacht
// Brocken: unter der Torwand, über der rechten Hälfte jedes Pfeilers, über der Stegkante, zwei in der Galeriedecke.
const ROCK = {
  gate: { cx: 11, cy: 8 },
  pillars: [{ cx: 48, cy: 5 }, { cx: 52, cy: 5 }, { cx: 57, cy: 5 }],
  ledge: { cx: 62, cy: 5 },
  gallery: [{ cx: 99, cy: 1 }, { cx: 104, cy: 1 }],
};
const ALL_ROCKS = [ROCK.gate, ...ROCK.pillars, ROCK.ledge, ...ROCK.gallery];

const feetRow = (s: GameState) => (s.player.body.y + s.player.body.h) / TILE;
const midX = (s: GameState) => s.player.body.x + s.player.body.w / 2;
const midCol = (s: GameState) => midX(s) / TILE;
const cellAt = (l: LevelData, cx: number, cy: number) => l.cells[cy * l.width + cx];
const solidCell = (l: LevelData, cx: number, cy: number) => {
  const c = cellAt(l, cx, cy);
  return c === Cell.Ground || c === Cell.Rock || c === Cell.Crate || c === Cell.CrateUsed || c === Cell.LeafPad;
};
type Opts = { helm?: boolean; special?: SpecialItem | null };
/** Ohne Gegner: für Wege, bei denen es um Sprünge, Platten, Brocken und den Kampf geht. */
const calm = (l: LevelData = L, opts: Opts = {}) => {
  const s = createGame(l, undefined, opts);
  s.enemies = [];
  return s;
};
/** Ohne Gegner und ohne Brocken: für reine Sprungphysik. */
const still = (l: LevelData = L, opts: Opts = {}) => {
  const s = calm(l, opts);
  s.rocks = [];
  return s;
};
const standsAt = (s: GameState, feet: number) => s.player.grounded && Math.abs(feetRow(s) - feet) < 1e-6;
const has = (ev: GameEvent[], type: GameEvent['type']) => ev.some((e) => e.type === type);
const count = (ev: GameEvent[], type: GameEvent['type']) => ev.filter((e) => e.type === type).length;
const exitOf = (ev: GameEvent[]) => ev.find((e) => e.type === 'goal')?.exit ?? null;
const foes = (l: LevelData = L) => l.spawns.filter((s) => s.kind === 'beetle' || s.kind === 'snail');
const itemCrates = (l: LevelData = L) => [...l.crates]
  .filter(([, c]) => c.kind === 'item')
  .map(([i, c]) => ({ cx: i % l.width, cy: Math.floor(i / l.width), item: c.kind === 'item' ? c.item : null }));
const rockAt = (s: GameState, r: { cx: number; cy: number }): FallingRock => s.rocks.find((k) => k.cx === r.cx && k.cy === r.cy)!;
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
  expect(LEVELS['1-F'].includes(line), 'Kopfzeile gefunden').toBe(true);
  return parseLevel('1-F', LEVELS['1-F'].replace(line, ''));
};

/**
 * Spielt mit einem durchgehenden Eingabe-Takt (Sprung gilt nur beim ersten gehaltenen Schritt als gedrückt).
 * `camera`: echte Kamera mit Bildbreite `viewW`, mit der Arena-Sperre wie in PlayScene; Gegner werden dann nur im Bild aktiv.
 */
function play(s: GameState, viewW = 512, camera = false) {
  const sampler = new InputSampler();
  const view = { w: viewW, h: VIEW_H };
  const levelPx = { w: s.level.width * TILE, h: s.level.height * TILE };
  const cam = createCamera(s.player, view, levelPx);
  const lock = (): CameraLock | null => {
    const a = s.arena;
    return a?.closed ? { x0: a.x0 * TILE, x1: (a.x1 + 1) * TILE, floorY: s.boss?.floorY ?? levelPx.h } : null;
  };
  const events: GameEvent[] = [];
  const step = (input: Partial<Held> = {}, n = 1): GameEvent[] => {
    const out: GameEvent[] = [];
    for (let i = 0; i < n; i++) {
      const ev = stepGame(s, sampler.sample(held(input)), DEFAULT_TUNING, camera ? { x: cam.x, w: viewW } : { x: 0, w: 512 }, STEP);
      if (ev.some((e) => e.type === 'respawn')) Object.assign(cam, createCamera(s.player, view, levelPx)); // wie PlayScene
      stepCamera(cam, s.player, view, levelPx, STEP, lock());
      out.push(...ev);
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

/** Eine Eingabe hin zu `x` (px, Körpermitte), mit Bremsweg: drücken, solange er nicht reicht, sonst loslassen. */
function steer(s: GameState, x: number): Partial<Held> {
  const b = s.player.body, dx = x - (b.x + b.w / 2);
  const stop = (b.vx * b.vx) / (2 * DEFAULT_TUNING.groundDecel);
  if (dx > 1 && (b.vx <= 0 || dx > stop + 1)) return { right: true };
  if (dx < -1 && (b.vx >= 0 || -dx > stop + 1)) return { left: true };
  return {};
}
/** Geht gesteuert, bis die Körpermitte höchstens 1 px neben `x` (px) liegt, und bleibt stehen. Springt nicht. */
function goToX(s: GameState, p: Play, x: number): void {
  for (let i = 0; i < 900 && s.phase === 'playing'; i++) {
    const b = s.player.body;
    if (Math.abs(x - (b.x + b.w / 2)) <= 1 && Math.abs(b.vx) < 1 && s.player.grounded) return;
    p.step(steer(s, x));
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
function jumpTo(s: GameState, p: Play, target: () => number, hold = 20, settle = 10): void {
  const brakeAccel = DEFAULT_TUNING.airAccel;
  for (let i = 0; i < 150 && s.phase === 'playing' && (i === 0 || !s.player.grounded); i++) {
    const b = s.player.body, dx = target() - (b.x + b.w / 2);
    const brake = (b.vx * Math.abs(b.vx)) / (2 * brakeAccel);
    const dir = dx - brake > 3 ? { right: true } : dx - brake < -3 ? { left: true } : {};
    p.step({ ...dir, jump: i < hold });
  }
  p.step({}, settle);
}

/** Über einen Gegner-Pferch: auf den linken Höcker, von dort auf den rechten. Der Gegner im Pferch reicht an keinen Höcker heran. */
function hopPen(s: GameState, p: Play, left: number): void {
  goTo(s, p, left - 1);
  jumpTo(s, p, () => (left + 0.5) * TILE, 8);
  expect(standsAt(s, FEET - 1) && Math.floor(midCol(s)) === left, `auf dem linken Höcker ${left}`).toBe(true);
  jumpTo(s, p, () => (left + 4.5) * TILE, 20);
  expect(Math.floor(midCol(s)), `auf dem rechten Höcker ${left + 4}`).toBe(left + 4);
}

/** Läuft (rechts gehalten, also mit Anlauf) bis an die Kante vor `pit` und springt mit vollem Sprung über die Grube. */
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
/** Fährt mit, bis die Platte an der Fläche ab Spalte `bank` anliegt, und geht hinüber. */
function alightRight(s: GameState, p: Play, pl: PlatformState, bank: number): void {
  p.until({}, () => platRight(pl) >= bank * TILE - 2, 900);
  p.until({ right: true }, () => s.player.grounded && !onPlat(s, pl) && midCol(s) > bank + 0.5, 240);
  p.step({}, 12);
}

/** Öffnet die Kiste vor der Tür mit einem Kopfstoß und holt das Item, das herauskommt. */
function takeKit(s: GameState, p: Play): GameEvent[] {
  const ev: GameEvent[] = [];
  goTo(s, p, KIT.cx);
  ev.push(...p.step({ jump: true }, 10), ...p.step({}, 40));
  const item = s.pickups.find((it) => it.kind === 'item' && !it.taken)!;
  expect(item, 'Item aus der Kiste').toBeDefined();
  for (let i = 0; i < 400 && !item.taken; i++) {
    const dx = item.body.x + item.body.w / 2 - midX(s);
    ev.push(...p.step(dx > 2 ? { right: true } : dx < -2 ? { left: true } : {}));
  }
  expect(item.taken, 'Item geholt').toBe(true);
  return ev;
}

// Abschnitte des Hauptwegs. Jeder beginnt dort, wo der vorige endet; zusammen ergeben sie den Weg von P in die Arena.
// `foes`: Gegner sind wach, Pferche werden von Höcker zu Höcker übersprungen.
const route = {
  /** Durchs Burgtor (unter dem ersten Brocken durch, ohne stehen zu bleiben), über Grube 1, durch die Halle, mit Anlauf über die lange Grube. */
  gate(s: GameState, p: Play, foes: boolean) {
    walkRight(s, p, GATE.x1 + 0.5);
    toEdge(s, p, START.to);
    jumpTo(s, p, () => (HALL.from + 1.5) * TILE);
    expect(standsAt(s, FEET) && midCol(s) > HALL.from, 'hinter Grube 1').toBe(true);
    if (foes) hopPen(s, p, PENS[0]!);
    else walkRight(s, p, PENS[0]! + 4.5);
    runAndJump(s, p, LONG_PIT);
    expect(standsAt(s, FEET) && midCol(s) > LANDING.from, 'hinter der langen Grube').toBe(true);
  },
  /** Von Pfeiler zu Pfeiler, ohne zu trödeln: die Brocken darüber fallen hinter Kraxel. */
  pillars(s: GameState, p: Play) {
    toEdge(s, p, LANDING.to);
    for (const [i, pl] of PILLARS.entries()) {
      if (i > 0) toEdge(s, p, PILLARS[i - 1]!.x1);
      jumpTo(s, p, () => pl.x1 * TILE);
      expect(standsAt(s, FEET) && midCol(s) > pl.x0 && midCol(s) < pl.x1 + 1, `auf dem Pfeiler ${pl.x0}`).toBe(true);
    }
    toEdge(s, p, PILLARS[2]!.x1);
    jumpTo(s, p, () => (LEDGE.from + 0.5) * TILE);
    expect(standsAt(s, FEET) && midCol(s) > LEDGE.from, 'auf dem Steg').toBe(true);
  },
  /** Zur Kante, bis es über ihr rieselt; einen Schritt zurück, bis der Brocken zerplatzt ist; dann mit der Steinplatte über den Abgrund. */
  slab(s: GameState, p: Play) {
    const rock = rockAt(s, ROCK.ledge);
    p.until({ right: true }, () => rock.state !== 'idle', 120);
    expect(rock.state, 'es rieselt über der Kante').toBe('warn');
    goTo(s, p, LEDGE.from);
    p.until({}, () => rock.state === 'gone', 200);
    expect(rock.state, 'der Brocken ist zerplatzt').toBe('gone');
    const pl = s.platforms[PLAT.slab]!;
    boardRight(s, p, pl, LEDGE.to);
    alightRight(s, p, pl, FAR.from);
    expect(standsAt(s, FEET) && midCol(s) > FAR.from, 'hinter dem Abgrund').toBe(true);
  },
  /** Durch die Halle (zwei Pferche), an die Schachtkante, auf die senkrechte Platte, wenn sie unten ist, oben hinüber auf die Galerie. */
  lift(s: GameState, p: Play, foes: boolean) {
    if (foes) {
      hopPen(s, p, PENS[1]!);
      hopPen(s, p, PENS[2]!);
    } else walkRight(s, p, PENS[2]! + 4.5);
    const pl = s.platforms[PLAT.lift]!;
    toEdge(s, p, FAR.to);
    p.until({}, () => pl.dir > 0 && pl.y >= FEET * TILE - 8, 900);
    jumpTo(s, p, () => pl.x + pl.spec.width * TILE / 2, 12);
    expect(onPlat(s, pl), 'auf der senkrechten Platte').toBe(true);
    // Kurz vor Galeriehöhe rechts halten: an der Galeriewand entlang, und sobald die Platte darüber ist, hinüber.
    p.until({}, () => pl.y <= (GALLERY.feet + 1) * TILE, 600);
    p.until({ right: true }, () => s.player.grounded && !onPlat(s, pl) && midCol(s) > GALLERY.from + 0.5, 120);
    p.step({}, 6);
    expect(standsAt(s, GALLERY.feet), 'auf der Galerie').toBe(true);
  },
  /** Über die Galerie unter den Brocken durch, hinab in den Fallraum, über den Kisten-Pferch zum Steinmännchen und durch die Tür. */
  door(s: GameState, p: Play) {
    walkRight(s, p, CHECKPOINT.cx + 0.5);
    expect(s.checkpoint, 'Steinmännchen').toBe(0);
    walkRight(s, p, ARENA.x0 + 1.5);
    expect(s.arena!.closed, 'die Tür ist zu').toBe(true);
  },
};

/** Der ganze Weg von P durch die Tür. */
function toArena(s: GameState, p: Play, foes: boolean): void {
  route.gate(s, p, foes);
  route.pillars(s, p);
  route.slab(s, p);
  route.lift(s, p, foes);
  route.door(s, p);
}

/**
 * Kampf-Skript wie ein Spieler, der nur sieht, was das Bild zeigt (Phase, Hügel, Körper):
 * - Hügel: zur Arenamitte gehen und stehen bleiben; dort holt er Kraxel ein und springt mitten in der Arena heraus.
 * - Beben: 40 px ausweichen, vom Hügel weg (steht Kraxel auf ihm: zur Mitte hin, bebt er in der Mitte: zur Seite `side`).
 * - Benommen: ihm auf den Kopf springen (Sprung `hold` Schritte gehalten), nach dem Treffer zurück auf die Seite, von der aus gesprungen wurde.
 * - Steinwurf: von ihm weglaufen; die Steine fliegen dorthin, wo Kraxel beim Wurf stand. Sonst Abstand halten.
 * Endet beim Sieg, bei Tod oder nach `maxSec` Sekunden.
 */
function fight(s: GameState, p: Play, opts: { side?: -1 | 1; hold?: number; maxSec?: number } = {}): void {
  const lo = ARENA.x0 * TILE, hi = (ARENA.x1 + 1) * TILE, center = (lo + hi) / 2;
  const hold = opts.hold ?? 20;
  let dodgeTo: number | null = null;
  let jumpAt = -1, jumpSide: -1 | 1 = 1, hitsBefore = 0;
  for (let i = 0; i < 60 * (opts.maxSec ?? 40) && s.phase === 'playing' && s.boss!.phase !== 'defeated'; i++) {
    const b = s.boss!, x = midX(s), bx = b.body.x + b.body.w / 2, pb = s.player.body;
    const side = (dir: number): Partial<Held> => (dir < 0 ? { left: true } : { right: true });
    if (b.phase !== 'tremble' && b.phase !== 'pop') dodgeTo = null;
    if (b.phase !== 'stunned') jumpAt = -1;
    let input: Partial<Held> = {};
    switch (b.phase) {
      case 'wait': case 'dig': case 'throw':
        if (b.phase === 'throw' || Math.abs(x - bx) < 56) input = side(x - bx);
        break;
      case 'mound':
        input = steer(s, center);
        break;
      case 'tremble': case 'pop':
        if (dodgeTo === null) {
          const m = b.moundX;
          let dir: number = Math.abs(x - m) > 12 ? Math.sign(x - m) : Math.abs(m - center) < 8 ? (opts.side ?? 1) : Math.sign(center - m);
          if (m + dir * 40 < lo + 8 || m + dir * 40 > hi - 8) dir = -dir;
          dodgeTo = m + dir * 40;
        }
        input = steer(s, dodgeTo);
        break;
      case 'stunned': {
        if (jumpAt >= 0 && b.hits > hitsBefore) {
          input = { ...side(jumpSide), jump: i - jumpAt < hold };
          break;
        }
        if (jumpAt < 0 || (s.player.grounded && i - jumpAt > hold)) {
          jumpAt = i;
          jumpSide = x < bx ? -1 : 1;
          hitsBefore = b.hits;
        }
        const brake = (pb.vx * Math.abs(pb.vx)) / (2 * DEFAULT_TUNING.airAccel);
        const dx = bx - x - brake;
        input = { ...(dx > 3 ? { right: true } : dx < -3 ? { left: true } : {}), jump: i - jumpAt < hold };
        break;
      }
      case 'defeated':
        break;
    }
    p.step(input);
  }
}

/** Nach dem Sieg zum Gipfelkreuz mitten auf dem Arenaboden. */
function toCross(s: GameState, p: Play): void {
  goTo(s, p, ARENA.x0 + 8);
  // Das Kreuz erscheint erst nach der Liegezeit des Murmelkönigs: auf der Stelle warten, bis es das Ziel auslöst.
  for (let i = 0; i < 300 && s.phase === 'playing'; i++) p.step(steer(s, (ARENA.x0 + 8.5) * TILE));
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
/** Wohin man über die Grube springt (px): Mitte der Landefläche, höchstens 1,5 Kacheln hinter der Kante. */
function landingX(pit: { to: number }): number {
  const top = surface(L, pit.to + 1);
  let w = 0;
  while (w < 3 && surface(L, pit.to + 1 + w) === top) w++;
  return (pit.to + 1 + w / 2) * TILE;
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

describe('Festung 1-F: Aufbau', () => {
  it('ist gültig ohne Edelweiß, heißt Wurzelburg, im Burgstil, rund 120 Kacheln plus Arena', () => {
    expect(validateLevel(L, { requireEdelweiss: false, requireGoal: true })).toEqual([]);
    expect(L.name).toBe('Wurzelburg');
    expect(L.world).toBe(1);
    expect(L.style).toBe('burg');
    expect(L.arena).toEqual(ARENA);
    expect(ARENA.x0).toBeGreaterThanOrEqual(110); expect(ARENA.x0).toBeLessThanOrEqual(135);
    expect(L.height).toBeGreaterThanOrEqual(14); expect(L.height).toBeLessThanOrEqual(20);
  });

  it('kein Edelweiß, kein Z, kein geheimes Gipfelkreuz: das Kreuz erscheint erst nach dem Sieg', () => {
    for (const kind of ['edelweiss', 'goal', 'secretGoal'] as const) expect(L.spawns.filter((s) => s.kind === kind), kind).toEqual([]);
  });

  it('die Arena ist 16 breit, eben, oben frei; genau ein Murmelkönig steht in ihrer rechten Hälfte auf dem Boden', () => {
    expect(ARENA.x1 - ARENA.x0 + 1).toBe(16);
    const bosses = L.spawns.filter((s) => s.kind === 'boss');
    expect(bosses).toEqual([{ kind: 'boss', ...BOSS, index: 0 }]);
    expect(BOSS.cx).toBeGreaterThan(ARENA.x0 + 8);
    for (let cx = ARENA.x0; cx <= ARENA.x1; cx++) {
      expect(surface(L, cx), `Arenaboden ${cx}`).toBe(FEET);
      for (let cy = FEET - 7; cy < FEET; cy++) expect(solidCell(L, cx, cy), `frei über dem Boden ${cx},${cy}`).toBe(false);
    }
  });

  it('rechts der Arena stehen mindestens 8 Spalten Burgmauer bis zum Levelrand (quer sieht man links und rechts Mauer)', () => {
    expect(L.width - 1 - ARENA.x1).toBeGreaterThanOrEqual(8);
    for (let cx = ARENA.x1 + 1; cx < L.width; cx++) {
      for (let cy = 0; cy < L.height; cy++) expect(solidCell(L, cx, cy), `Mauer ${cx},${cy}`).toBe(true);
    }
  });

  it('genau ein Steinmännchen, direkt vor der Tür; die Tür ist offen, bis Kraxel in der Arena ist', () => {
    const cps = L.spawns.filter((s) => s.kind === 'checkpoint');
    expect(cps).toEqual([{ kind: 'checkpoint', ...CHECKPOINT, index: 0 }]);
    expect(CHECKPOINT.cx).toBe(DOOR - 1);
    for (let cy = FEET - 3; cy < FEET; cy++) expect(solidCell(L, DOOR, cy), `Türspalte ${cy}`).toBe(false);
    expect(surface(L, DOOR)).toBe(FEET);
  });

  it('mindestens vier Brocken, jeder hängt direkt unter fester Decke; darunter ist bis zum Boden frei', () => {
    const rocks = L.spawns.filter((s) => s.kind === 'fallingRock');
    expect(rocks.length).toBeGreaterThanOrEqual(4);
    expect(rocks.map(({ cx, cy }) => ({ cx, cy })).sort((a, b) => a.cx - b.cx)).toEqual(ALL_ROCKS);
    for (const r of rocks) {
      expect(solidCell(L, r.cx, r.cy - 1), `Decke über ${r.cx}`).toBe(true);
      let cy = r.cy;
      while (!solidCell(L, r.cx, cy)) cy++;
      expect(cy - r.cy, `Fallhöhe unter ${r.cx}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('zwei Steinplatten: waagerecht über dem Abgrund, senkrecht im Schacht; der Fahrweg ist frei und darunter geht es in die Tiefe', () => {
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
    expect(pathCols(L.platforms[PLAT.slab]!)).toEqual({ x0: LEDGE.to + 1, x1: FAR.from - 1 });
    expect(L.platforms[PLAT.slab]!.cy).toBe(FEET);
    // Die senkrechte Platte fährt vom Burgboden bis eine Reihe über die Galerie; links zwei Spalten Schacht, rechts die Galeriewand.
    expect(pathRows(L.platforms[PLAT.lift]!)).toEqual({ y0: GALLERY.feet - 1, y1: FEET });
    expect(pathCols(L.platforms[PLAT.lift]!).x0 - FAR.to - 1).toBe(2);
    expect(pathCols(L.platforms[PLAT.lift]!).x1 + 1).toBe(GALLERY.from);
  });

  it('über jeder Platte und eine Spalte daneben sind auf dem ganzen Weg zwei Reihen frei: kein Fahrer wird eingeklemmt', () => {
    for (const [i, pl] of L.platforms.entries()) {
      const { x0, x1 } = pathCols(pl), { y0 } = pathRows(pl);
      for (let cx = x0 - 1; cx <= x1 + 1; cx++) {
        for (let cy = y0 - 2; cy < y0; cy++) expect(solidCell(L, cx, cy), `Platte ${i + 1}, Zelle ${cx},${cy}`).toBe(false);
      }
    }
  });

  it('drei Gegner, Käfer und Schnecke, jeder in einem Pferch zwischen zwei Höckern', () => {
    const list = foes();
    expect(list.length).toBe(3);
    expect(new Set(list.map((f) => f.kind)).size).toBe(2);
    expect(list.map((f) => f.cx - 2).sort((a, b) => a - b)).toEqual(PENS);
    for (const f of list) {
      expect(solidCell(L, f.cx - 2, f.cy) && solidCell(L, f.cx + 2, f.cy), `Höcker um ${f.kind} ${f.cx}`).toBe(true);
      for (let cx = f.cx - 1; cx <= f.cx + 1; cx++) {
        expect(solidCell(L, cx, f.cy), `${f.kind} ${f.cx}: Zelle ${cx}`).toBe(false);
        expect(solidCell(L, cx, f.cy + 1), `${f.kind} ${f.cx}: Boden unter ${cx}`).toBe(true);
      }
      for (const hx of [f.cx - 2, f.cx + 2]) expect(solidCell(L, hx, f.cy - 1), `über dem Höcker ${hx}`).toBe(false);
    }
  });

  it('genau eine Item-Kiste: die Helm-/Schleuder-Kiste im Pferch im Fallraum, vor dem Steinmännchen', () => {
    expect(itemCrates()).toEqual([{ ...KIT, item: 'sling' }]);
    expect(KIT.cx).toBeGreaterThan(KIT_HUMPS[0]!); expect(KIT.cx).toBeLessThan(KIT_HUMPS[1]!);
    for (const hx of KIT_HUMPS) expect(solidCell(L, hx, FEET - 1) && !solidCell(L, hx, FEET - 2), `Höcker ${hx}`).toBe(true);
    expect(KIT_HUMPS[0]!).toBeGreaterThanOrEqual(DROP.from);
    expect(KIT_HUMPS[1]!).toBeLessThanOrEqual(DROP.to);
    expect(KIT.cy).toBe(FEET - 4); // per Kopfstoß vom Boden aus
  });
});

describe('Festung 1-F: Gruben', () => {
  it('jede Grube ohne Platte ist höchstens 6 breit; die lange ist 6 breit, mit mindestens 8 Kacheln freiem Anlauf ohne Gegner', () => {
    const widths = plainPits().map((p) => p.to - p.from + 1);
    expect(widths.length).toBeGreaterThanOrEqual(5);
    expect(Math.max(...widths)).toBeLessThanOrEqual(6);
    expect(plainPits().filter((p) => p.to - p.from + 1 >= 5)).toEqual([LONG_PIT]);
    expect(surface(L, LONG_PIT.from - 1)).toBe(surface(L, LONG_PIT.to + 1));
    expect(LONG_PIT.from - runUp(LONG_PIT, 12)).toBeGreaterThanOrEqual(8);
    expect(foes().filter((f) => f.cx >= LONG_PIT.from - 8 && f.cx < LONG_PIT.from)).toEqual([]);
    expect(pits(L).filter(hasPlat).length).toBe(2);
    expect(pits(L).filter((p) => p.from >= PILLARS[0]!.x0 - 2 && p.to <= LEDGE.from - 1).length, 'Lücken zwischen den Pfeilern').toBe(4);
  });

  it('jede Grube ohne Platte ist überspringbar: mit dem Anlauf, den die Fläche davor hergibt, und gezielter Landung', () => {
    for (const pit of plainPits()) {
      const s = still();
      placePlayer(s, runUp(pit, 8), surface(L, pit.from - 1) - 1);
      const p = play(s);
      p.step({}, 2);
      p.until({ right: true }, () => s.player.body.x + s.player.body.w >= pit.from * TILE - 2, 300);
      jumpTo(s, p, () => landingX(pit), 40);
      const name = `Grube ${pit.from}-${pit.to}`;
      expect(has(p.events, 'death'), name).toBe(false);
      expect(standsAt(s, surface(L, pit.to + 1)), name).toBe(true);
      expect(midX(s), name).toBeGreaterThan((pit.to + 1) * TILE);
    }
  });

  it('die lange Grube geht nicht aus dem Stand und nicht im Gehen', () => {
    let tries = 0, overPit = 0;
    const top = surface(L, LONG_PIT.from - 1);
    for (let back = 0; back <= 2; back++) {
      for (const early of [0, 2, 4]) {
        for (const hold of [1, 10, 20, 40]) {
          for (const upAfter of [-1, 10, 30]) {
            const s = still();
            placePlayer(s, LONG_PIT.from - 1 - back, top - 1);
            const p = play(s);
            p.step({}, 2);
            p.until({ right: true }, () => s.player.body.x + s.player.body.w >= LONG_PIT.from * TILE - 2 - early, 120);
            const vx = s.player.body.vx;
            p.step({ right: true, jump: true });
            expect(vx, 'kein Renntempo beim Absprung').toBeLessThanOrEqual(DEFAULT_TUNING.walkSpeed + 1);
            let across = false;
            for (let i = 1; i < 600 && s.phase === 'playing'; i++) {
              p.step({ right: true, jump: i < hold, up: upAfter >= 0 && i >= upAfter });
              if (s.player.body.x > LONG_PIT.from * TILE + TILE) overPit++;
              across ||= s.player.grounded && feetRow(s) <= top + 1e-6 && s.player.body.x + s.player.body.w > (LONG_PIT.to + 1) * TILE;
            }
            tries++;
            const name = `${back} zurück, früh ${early}, halten ${hold}, oben ${upAfter}`;
            expect(across, name).toBe(false);
            expect(has(p.events, 'death'), name).toBe(true);
          }
        }
      }
    }
    expect(tries).toBeGreaterThanOrEqual(100);
    expect(overPit).toBeGreaterThan(0);
  }, 30_000);

  it('die lange Grube geht mit Anlauf, ab 6 Kacheln vor der Kante losgerannt', () => {
    const top = surface(L, LONG_PIT.from - 1);
    for (let back = 6; back <= 8; back++) {
      const s = still();
      placePlayer(s, LONG_PIT.from - back, top - 1);
      const p = play(s);
      p.step({}, 2);
      p.until({ right: true }, () => s.player.body.x + s.player.body.w >= LONG_PIT.from * TILE - 2, 300);
      expect(s.player.body.vx, `${back} Kacheln Anlauf: Renntempo`).toBeGreaterThan(DEFAULT_TUNING.walkSpeed + 1);
      p.step({ right: true, jump: true }, 40);
      p.until({ right: true }, () => s.player.grounded, 200);
      expect(standsAt(s, top) && s.player.body.x > (LONG_PIT.to + 1) * TILE, `${back} Kacheln Anlauf`).toBe(true);
      expect(has(p.events, 'death')).toBe(false);
    }
  });

  it('kein Gegner steht direkt an einer Landestelle, auch nicht dort, wo man von einer Platte absteigt', () => {
    for (const pit of pits(L)) {
      const ground = surface(L, pit.to + 1);
      const close = foes().filter((e) => e.cx > pit.to && e.cx <= pit.to + 3 && e.cy >= ground - 2);
      expect(close, `Grube ${pit.from}-${pit.to}`).toEqual([]);
    }
  });

  it('Gegner nehmen niemandem die Landung, mit echter Kamera und wartendem Spieler (alle Gruben, hochkant und quer)', () => {
    const levelPx = { w: L.width * TILE, h: L.height * TILE };
    function tryPit(pit: { from: number; to: number }, viewW: number, mode: 'run' | 'stand', wait: number): { events: GameEvent[]; landed: boolean } {
      const top = surface(L, pit.from - 1);
      const s = createGame(L); // mit Gegnern; die Brocken prüft ein eigener Abschnitt
      s.rocks = [];
      placePlayer(s, mode === 'run' ? runUp(pit, 8) : pit.from - 1, top - 1);
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
        for (let i = 0; i < Math.round(wait * 60); i++) step({});
        for (let n = 0; n < 300 && !edge(); n++) step({ right: true });
      } else {
        for (let n = 0; n < 300 && !edge(); n++) step({ right: true });
        for (let i = 0; i < 40 + Math.round(wait * 60); i++) step({});
      }
      recording = true;
      // Absprung mit vollem Sprung, in der Luft auf die Landestelle gesteuert (die Pfeiler sind nur 2 breit).
      for (let i = 0; i < 200 && s.phase === 'playing' && (i === 0 || !s.player.grounded); i++) {
        const b = s.player.body, dx = landingX(pit) - (b.x + b.w / 2), brake = (b.vx * Math.abs(b.vx)) / (2 * DEFAULT_TUNING.airAccel);
        step({ ...(dx - brake > 3 ? { right: true } : dx - brake < -3 ? { left: true } : {}), jump: i < 40 });
      }
      const landed = s.player.grounded && midX(s) > (pit.to + 1) * TILE;
      for (let i = 0; i < 6; i++) step({ right: true });
      return { events, landed };
    }
    for (const pit of plainPits()) {
      for (const viewW of [256, 416, 512]) {
        for (const wait of [0, 0.5, 1, 2, 3]) {
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

  it('Gegner bleiben in ihren Pferchen, mit echter Kamera über 20 s', () => {
    for (const f of foes()) {
      const s = createGame(L);
      s.rocks = [];
      placePlayer(s, f.cx - 4, surface(L, f.cx - 4) - 1);
      const p = play(s, 256, true);
      const e = s.enemies.find((en) => Math.abs(en.body.x - f.cx * TILE) < TILE)!;
      for (let i = 0; i < 20 * 60; i++) {
        p.step({});
        expect(e.alive, `${f.kind} ${f.cx}`).toBe(true);
        expect(e.body.x >= (f.cx - 1) * TILE - 1e-6 && e.body.x + e.body.w <= (f.cx + 2) * TILE + 1e-6, `${f.kind} ${f.cx} nach ${i} Schritten`).toBe(true);
      }
      expect(e.active, `${f.kind} ${f.cx}`).toBe(true);
      expect(has(p.events, 'hurt'), `${f.kind} ${f.cx}`).toBe(false);
    }
  });
});

describe('Festung 1-F: Steinschlag', () => {
  /** Kraxel steht direkt unter dem Brocken (mit Helm, damit ein Treffer als hurt sichtbar wird) und bleibt stehen. */
  function standUnder(r: { cx: number; cy: number }) {
    const s = calm(L, { helm: true });
    let floor = r.cy;
    while (!solidCell(L, r.cx, floor)) floor++;
    placePlayer(s, r.cx, floor - 1);
    const p = play(s);
    p.step({}, 2 * 60);
    return { s, p };
  }

  it('wer unter einem Brocken stehen bleibt, wird nach der Warnung getroffen; der Brocken zerplatzt', () => {
    for (const r of ALL_ROCKS) {
      const { s, p } = standUnder(r);
      const warn = p.events.findIndex((e) => e.type === 'rockWarn');
      const hurt = p.events.findIndex((e) => e.type === 'hurt');
      expect(warn, `Brocken ${r.cx}: Warnung`).toBeGreaterThanOrEqual(0);
      expect(hurt, `Brocken ${r.cx}: Treffer nach der Warnung`).toBeGreaterThan(warn);
      expect(rockAt(s, r).state, `Brocken ${r.cx}`).toBe('gone');
      expect(s.player.helm, `Brocken ${r.cx}: Helm weg`).toBe(false);
    }
  });

  it('wer bei der Warnung einen Schritt zur Seite tritt, wird nicht getroffen, unter jedem Brocken', () => {
    for (const r of ALL_ROCKS) {
      const s = calm(L, { helm: true });
      let floor = r.cy;
      while (!solidCell(L, r.cx, floor)) floor++;
      placePlayer(s, r.cx, floor - 1);
      const p = play(s);
      p.until({}, () => rockAt(s, r).state === 'warn', 10);
      expect(rockAt(s, r).state, `Brocken ${r.cx}: Warnung`).toBe('warn');
      goToX(s, p, r.cx * TILE - 6); // Körpermitte 14 px links der Brockenmitte: Brocken (12 px) und Kraxel (10 px) berühren sich nicht
      p.until({}, () => rockAt(s, r).state === 'gone', 120);
      p.step({}, 10);
      expect(rockAt(s, r).state, `Brocken ${r.cx}: zerplatzt`).toBe('gone');
      expect(has(p.events, 'hurt'), `Brocken ${r.cx}`).toBe(false);
      expect(p.events).toContainEqual({ type: 'rockBreak', cx: r.cx, cy: floor - 1 });
    }
  });

  it('durchs Burgtor und über die Galerie: wer im Gehen unter den Brocken durchgeht, wird nicht getroffen', () => {
    for (const [start, end, feet] of [[START.from + 2, START.to, FEET], [GALLERY.from, GALLERY.to, GALLERY.feet]] as const) {
      for (const wait of [0, 0.5, 1.3]) {
        const s = calm(L, { helm: true });
        placePlayer(s, start, feet - 1);
        const p = play(s);
        p.step({}, 2 + Math.round(wait * 60));
        toEdge(s, p, end);
        p.step({}, 2 * 60);
        const name = `ab ${start}, nach ${wait} s`;
        expect(has(p.events, 'rockWarn'), name).toBe(true);
        expect(count(p.events, 'rockBreak'), `${name}: alle Brocken gefallen`).toBe(ALL_ROCKS.filter((r) => r.cx > start && r.cx <= end).length);
        expect(has(p.events, 'hurt'), name).toBe(false);
      }
    }
  });

  it('auf den Pfeilern: wer zügig weiterspringt, wird nicht getroffen, egal wann er losgeht', () => {
    for (const wait of [0, 0.5, 1, 2]) {
      const s = calm(L, { helm: true });
      placePlayer(s, LANDING.from + 1, FEET - 1);
      const p = play(s);
      p.step({}, 2 + Math.round(wait * 60));
      route.pillars(s, p);
      p.step({}, 60);
      expect(count(p.events, 'rockWarn'), `nach ${wait} s: alle drei Brocken gewarnt`).toBeGreaterThanOrEqual(3);
      expect(has(p.events, 'hurt'), `nach ${wait} s`).toBe(false);
    }
  });

  it('wer auf einem Pfeiler wartet, findet auf der linken Hälfte Schutz vor dem Brocken über der rechten', () => {
    for (const pl of PILLARS) {
      const s = calm(L, { helm: true });
      placePlayer(s, pl.x0, FEET - 1);
      s.player.body.x = pl.x0 * TILE; // ganz links auf dem Pfeiler
      const p = play(s);
      p.step({}, 3 * 60);
      const r = ROCK.pillars.find((k) => k.cx === pl.x1)!;
      expect(rockAt(s, r).state, `Pfeiler ${pl.x0}: der Brocken ist gefallen`).toBe('gone');
      expect(has(p.events, 'hurt'), `Pfeiler ${pl.x0}`).toBe(false);
      expect(standsAt(s, FEET), `Pfeiler ${pl.x0}: steht noch`).toBe(true);
    }
  });

  it('über der Stegkante: wer dort auf die Platte wartet, wird getroffen; wer zurücktritt, steigt danach heil auf', () => {
    const s = calm(L, { helm: true });
    const pl = s.platforms[PLAT.slab]!;
    placePlayer(s, LEDGE.from, FEET - 1);
    const p = play(s);
    p.step({}, 2);
    toEdge(s, p, LEDGE.to);
    p.until({}, () => has(p.events, 'hurt') || pl.x <= (LEDGE.to + 1) * TILE + 2, 900);
    expect(has(p.events, 'hurt'), 'an der Kante gewartet').toBe(true);

    for (const wait of [0, 1, 2.5, 4, 5.5]) {
      const t = calm(L, { helm: true });
      placePlayer(t, LEDGE.from, FEET - 1);
      const q = play(t);
      q.step({}, 2 + Math.round(wait * 60));
      route.slab(t, q);
      expect(has(q.events, 'hurt'), `nach ${wait} s`).toBe(false);
    }
  });
});

describe('Festung 1-F: Steinplatten', () => {
  it('die Steinplatte über dem Abgrund: aufsteigen, mitfahren, absteigen, egal wann Kraxel ankommt', () => {
    const spec = L.platforms[PLAT.slab]!;
    expect((2 * Math.abs(spec.travel)) / spec.speed).toBeLessThanOrEqual(8);
    for (const wait of [0, 1, 2.5, 4, 5.5]) {
      const s = still();
      placePlayer(s, LEDGE.from, FEET - 1);
      const p = play(s);
      p.step({}, 2 + Math.round(wait * 60));
      const pl = s.platforms[PLAT.slab]!;
      boardRight(s, p, pl, LEDGE.to);
      alightRight(s, p, pl, FAR.from);
      expect(standsAt(s, FEET) && midCol(s) > FAR.from, `nach ${wait} s`).toBe(true);
      expect(has(p.events, 'death'), `nach ${wait} s`).toBe(false);
    }
  });

  it('die senkrechte Platte: abgepasst aufsteigen, hinauffahren, oben auf die Galerie, egal wann Kraxel ankommt', () => {
    const spec = L.platforms[PLAT.lift]!;
    const period = (2 * Math.abs(spec.travel)) / spec.speed;
    expect(period).toBeLessThanOrEqual(8);
    for (let wait = 0; wait < period; wait += 0.8) {
      const s = calm();
      placePlayer(s, PENS[2]! + 5, FEET - 1);
      const p = play(s);
      p.step({}, 2 + Math.round(wait * 60));
      route.lift(s, p, false);
      expect(has(p.events, 'death'), `nach ${wait} s`).toBe(false);
    }
  });

  it('ohne die senkrechte Platte kommt niemand auf die Galerie, auch nicht mit Anlauf und Kraxeln', () => {
    const without = withoutPlatform(PLAT.lift);
    let overShaft = 0, tries = 0;
    // Anlauf ab dem rechten Höcker des letzten Pferchs (oben drauf oder dahinter) bis zur Schachtkante.
    for (const [cx, cy] of [[PENS[2]! + 4, FEET - 2], [PENS[2]! + 5, FEET - 1], [FAR.to - 1, FEET - 1], [FAR.to, FEET - 1]] as const) {
      for (const run of [0, 8, 16, 30]) {
        for (const hold of [8, 20, 40]) {
          for (const climb of [false, true]) {
            const s = still(without);
            placePlayer(s, cx, cy);
            const script: Script = [[{}, 2], [{ right: true }, run], [{ right: true, jump: true }, hold],
              [{ right: true, up: climb, jump: hold >= 40 }, 120], [{}, 30]];
            const sm = new InputSampler();
            for (const [input, n] of script) {
              for (let k = 0; k < n; k++) {
                stepGame(s, sm.sample(held(input)), DEFAULT_TUNING, { x: 0, w: 512 }, STEP);
                if (s.player.body.x + s.player.body.w >= GALLERY.from * TILE - 1) overShaft++;
              }
            }
            tries++;
            expect(standsAt(s, GALLERY.feet), `Start ${cx}, Anlauf ${run}, halten ${hold}, kraxeln ${climb}`).toBe(false);
          }
        }
      }
    }
    expect(tries).toBeGreaterThanOrEqual(90);
    expect(overShaft, 'manche Läufe erreichen die Galeriewand').toBeGreaterThan(0);
  }, 30_000);

  it('wer über den Rand einer Platte hinaussteht, fährt zwei ganze Runden mit und wird nirgends eingeklemmt', () => {
    let tried = 0;
    for (const i of [PLAT.slab, PLAT.lift]) {
      const spec = L.platforms[i]!;
      const period = (2 * Math.abs(spec.travel)) / spec.speed;
      for (const side of [-1, 1] as const) {
        const s = still();
        const pl = s.platforms[i]!, b = s.player.body;
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

describe('Festung 1-F: Kiste vor der Tür', () => {
  /** Kraxel steht im Pferch unter der Kiste und holt das Item. */
  function kit(opts: Opts) {
    const s = calm(L, opts);
    placePlayer(s, KIT.cx, FEET - 1);
    const p = play(s);
    p.step({}, 2);
    const ev = takeKit(s, p);
    return { s, ev };
  }

  it('ohne Item gibt die Kiste den Helm', () => {
    const { s, ev } = kit({});
    expect(ev).toContainEqual(expect.objectContaining({ type: 'itemSpawn', item: 'helm' }));
    expect([s.player.helm, s.player.special]).toEqual([true, null]);
  });

  it('wer den Helm mitbringt, bekommt aus ihr die Schleuder', () => {
    const { s, ev } = kit({ helm: true });
    expect(ev).toContainEqual(expect.objectContaining({ type: 'itemSpawn', item: 'sling' }));
    expect([s.player.helm, s.player.special]).toEqual([true, 'sling']);
  });

  it('wer mit der Schleuder kommt, behält sie; die Kiste gibt dann 10 Kristalle', () => {
    const s = calm(L, { special: 'sling' });
    const before = s.session.crystals;
    placePlayer(s, KIT.cx, FEET - 1);
    const p = play(s);
    p.step({}, 2);
    const ev = takeKit(s, p);
    expect(has(ev, 'powerUp')).toBe(false);
    expect(s.session.crystals - before - count(ev, 'crystal')).toBe(10);
    expect([s.player.helm, s.player.special]).toEqual([true, 'sling']);
  });

  it('das Item bleibt im Pferch und läuft nicht zur Tür', () => {
    const s = calm();
    placePlayer(s, KIT.cx, FEET - 1);
    const p = play(s);
    p.step({}, 2);
    p.step({ jump: true }, 10);
    placePlayer(s, DROP.from, FEET - 1); // aus dem Weg
    p.step({}, 10 * 60);
    const item = s.pickups.find((it) => it.kind === 'item')!;
    expect(item.taken).toBe(false);
    expect(item.body.x).toBeGreaterThan((KIT_HUMPS[0]! + 1) * TILE - 1);
    expect(item.body.x + item.body.w).toBeLessThan(KIT_HUMPS[1]! * TILE + 1);
  });
});

describe('Festung 1-F: Kamera', () => {
  const levelPx = { w: L.width * TILE, h: L.height * TILE };
  /** Steht Kraxel an (cx, cy) und schaut nach rechts, liegt die Zelle (tx, ty) ganz im Bild und unter der Info-Leiste (12 px)? */
  function inView(cx: number, cy: number, tx: number, ty: number, w: number, minPx = TILE): boolean {
    const s = still();
    placePlayer(s, cx, cy);
    runGame(s, [[{}, 5]]);
    const view = { w, h: VIEW_H };
    const c = createCamera(s.player, view, levelPx);
    c.look = 32;
    for (let i = 0; i < 120; i++) stepCamera(c, s.player, view, levelPx, STEP);
    const x = tx * TILE, y = ty * TILE;
    return x >= c.x && x + TILE <= c.x + w && y >= c.y + 12 && y + minPx <= c.y + VIEW_H;
  }
  const LANDING_PX = TILE / 2;

  it('von jeder Absprungstelle ist die Landestelle zu sehen (hochkant)', () => {
    const pairs: Array<[string, number, number, number, number]> = [];
    for (const pit of plainPits()) pairs.push([`Grube ${pit.from}-${pit.to}`, pit.from - 1, surface(L, pit.from - 1) - 1, pit.to + 2, surface(L, pit.to + 1)]);
    const slab = L.platforms[PLAT.slab]!, lift = L.platforms[PLAT.lift]!;
    pairs.push(
      ['Steg → Steinplatte am Steg', LEDGE.to, FEET - 1, slab.cx + slab.width - 1, FEET],
      ['Schachtkante → senkrechte Platte unten', FAR.to, FEET - 1, pathCols(lift).x1, pathRows(lift).y1],
      ['Galerie → Stufe 1', GALLERY.to, GALLERY.feet - 1, STEPS[0]!.from + 1, STEPS[0]!.feet],
      ['Stufe 1 → Stufe 2', STEPS[0]!.to, STEPS[0]!.feet - 1, STEPS[1]!.from + 1, STEPS[1]!.feet],
      ['Stufe 2 → Fallraum', STEPS[1]!.to, STEPS[1]!.feet - 1, DROP.from + 1, FEET],
    );
    for (const [name, cx, cy, tx, ty] of pairs) expect(inView(cx, cy, tx, ty, 256, LANDING_PX), name).toBe(true);
  });

  it('die Brocken hängen im Bild, bevor Kraxel sie auslöst (hochkant)', () => {
    for (const r of ALL_ROCKS) {
      let floor = r.cy;
      while (!solidCell(L, r.cx, floor)) floor++;
      expect(inView(r.cx - 3, floor - 1, r.cx, r.cy, 256), `Brocken ${r.cx}`).toBe(true);
    }
  });

  it('nach dem Schließen der Tür steht die Kamera mittig auf der Arena, hochkant und quer; rechts davon sieht man nur Mauer', () => {
    for (const w of [256, 416, 512]) {
      const s = still();
      placePlayer(s, CHECKPOINT.cx, FEET - 1);
      const p = play(s, w, true);
      p.step({}, 2);
      walkRight(s, p, ARENA.x0 + 1.5);
      expect(s.arena!.closed, `Bild ${w}`).toBe(true);
      p.step({}, 90);
      const centred = (ARENA.x0 * TILE + (ARENA.x1 + 1) * TILE) / 2 - w / 2;
      expect(Math.abs(p.cam.x - centred), `Bild ${w}`).toBeLessThan(1);
      for (let cx = ARENA.x1 + 1; cx * TILE < p.cam.x + w; cx++) {
        for (let cy = Math.floor(p.cam.y / TILE); cy * TILE < p.cam.y + VIEW_H && cy < L.height; cy++) {
          expect(solidCell(L, cx, cy), `Bild ${w}: Mauer ${cx},${cy}`).toBe(true);
        }
      }
      // Der Arenaboden und der Platz für das Gipfelkreuz (5 Kacheln) liegen im Bild.
      expect(FEET * TILE + LANDING_PX).toBeLessThanOrEqual(p.cam.y + VIEW_H);
      expect((FEET - 5) * TILE).toBeGreaterThanOrEqual(p.cam.y + 12);
    }
  });
});

describe('Festung 1-F: Weg von P in die Arena', () => {
  for (const opts of [{}, { helm: true }, { special: 'sling' as const }]) {
    it(`ohne Gegner von P durch die Tür (Brocken, Gruben mit Anlauf, Platten abgepasst) ${JSON.stringify(opts)}`, () => {
      const s = calm(L, opts);
      const p = play(s);
      p.step({}, 2);
      toArena(s, p, false);
      expect(has(p.events, 'checkpoint')).toBe(true);
      expect(has(p.events, 'arenaClose')).toBe(true);
      expect(has(p.events, 'hurt')).toBe(false);
      expect(has(p.events, 'death')).toBe(false);
      expect([s.player.helm, s.player.special]).toEqual([opts.helm === true || 'special' in opts, opts.special ?? null]);
    }, 30_000);
  }

  for (const viewW of [256, 416]) {
    it(`mit wachen Gegnern und echter Kamera von P durch die Tür, ohne einen Treffer (Bild ${viewW})`, () => {
      const s = createGame(L);
      const p = play(s, viewW, true);
      p.step({}, 2);
      toArena(s, p, true);
      expect(has(p.events, 'hurt')).toBe(false);
      expect(has(p.events, 'death')).toBe(false);
      expect(s.enemies.filter((e) => e.active).length, 'die Gegner waren wach').toBe(3);
    }, 30_000);
  }
});

describe('Festung 1-F: Kampf gegen den Murmelkönig', () => {
  /** Kraxel startet am Steinmännchen (wie nach einem Neustart dort) und geht durch die Tür. */
  function atDoor(opts: Opts = {}, viewW = 256) {
    const s = calm(L, opts);
    placePlayer(s, CHECKPOINT.cx, FEET - 1);
    const p = play(s, viewW, true);
    p.step({}, 2);
    walkRight(s, p, ARENA.x0 + 1.5);
    expect(s.arena!.closed, 'die Tür ist zu').toBe(true);
    return { s, p };
  }

  for (const [name, opts, fo] of [
    ['ohne Item', {}, {}],
    ['mit Helm, Ausweichen nach links', { helm: true }, { side: -1 as const }],
    ['mit Schleuder, Abprall mit gehaltenem Sprung', { special: 'sling' as const }, { hold: 60 }],
  ] as const) {
    it(`Kampf-Skript: drei Treffer, Sieg, Gipfelkreuz, kein Treffer für Kraxel (${name})`, () => {
      const { s, p } = atDoor(opts);
      fight(s, p, fo);
      expect(s.boss!.phase, 'besiegt').toBe('defeated');
      expect(p.events.filter((e) => e.type === 'bossHit').map((e) => (e.type === 'bossHit' ? e.hits : 0))).toEqual([1, 2, 3]);
      expect(count(p.events, 'bossDefeated')).toBe(1);
      expect(count(p.events, 'bossPop')).toBe(3);
      expect(count(p.events, 'bossThrow'), 'zwei Steinwürfe vor dem Sieg, je 2 Steine (der Wurf folgt auf den Treffer)').toBe(4);
      // Sieg und Ziel liegen nie im selben Schritt: das Kreuz erscheint erst, wenn er BOSS_LIE gelegen hat.
      expect(has(p.events, 'goal'), 'noch kein Ziel im Siegschritt').toBe(false);
      expect(s.phase, 'noch im Spiel').toBe('playing');
      toCross(s, p);
      expect(s.boss!.t, 'Ziel frühestens nach der Liegezeit').toBeGreaterThanOrEqual(BOSS_LIE - 1e-6);
      expect(s.phase).toBe('goal');
      expect(exitOf(p.events)).toBe('normal');
      expect(has(p.events, 'hurt')).toBe(false);
      expect(has(p.events, 'death')).toBe(false);
      expect([s.player.helm, s.player.special]).toEqual(['helm' in opts || 'special' in opts, 'special' in opts ? 'sling' : null]);
    }, 30_000);
  }

  it('Kiesel prallen ab: mit der Schleuder auf den Murmelkönig geschossen, bleibt er unversehrt', () => {
    const { s, p } = atDoor({ special: 'sling' });
    let bounced = 0;
    for (let i = 0; i < 80; i++) {
      const b = s.boss!.body;
      const ev = p.step({ action: i % 15 === 0 });
      bounced += ev.filter((e) => e.type === 'pebblePop' && e.x >= b.x - 4 && e.x <= b.x + b.w + 4 && e.y >= b.y - 4 && e.y <= b.y + b.h + 4).length;
    }
    expect(bounced, 'Kiesel am Murmelkönig abgeprallt').toBeGreaterThan(0);
    expect(s.boss!.hits).toBe(0);
    expect(has(p.events, 'bossHit')).toBe(false);
  });

  it('wer in der Arena stirbt, steht wieder am Steinmännchen; Tür offen, Murmelkönig voll; dann klappt der Kampf', () => {
    const { s, p } = atDoor({}, 416);
    p.until({ right: true }, () => s.phase !== 'playing', 600); // in den Murmelkönig hinein
    expect(has(p.events, 'death')).toBe(true);
    for (let i = 0; i < 200 && !has(p.events, 'respawn'); i++) p.step({});
    expect(has(p.events, 'respawn')).toBe(true);
    expect(s.arena!.closed).toBe(false);
    expect(s.boss).toMatchObject({ phase: 'wait', hits: 0 });
    expect(Math.floor(midCol(s))).toBe(CHECKPOINT.cx);
    expect(s.grid.isSolid(DOOR, FEET - 1)).toBe(false);
    p.step({}, 2);
    walkRight(s, p, ARENA.x0 + 1.5);
    expect(s.arena!.closed).toBe(true);
    fight(s, p);
    toCross(s, p);
    expect(s.phase).toBe('goal');
    expect(exitOf(p.events)).toBe('normal');
  }, 30_000);

  it('der ganze Weg in einem Zug: mit wachen Gegnern von P in die Arena, Helm aus der Kiste, Kampf, Gipfelkreuz', () => {
    const s = createGame(L);
    const p = play(s, 256, true);
    p.step({}, 2);
    route.gate(s, p, true);
    route.pillars(s, p);
    route.slab(s, p);
    route.lift(s, p, true);
    walkRight(s, p, KIT_HUMPS[0]! + 1.5);
    takeKit(s, p);
    expect(s.player.helm, 'Helm aus der Kiste').toBe(true);
    route.door(s, p);
    fight(s, p);
    toCross(s, p);
    expect(s.phase).toBe('goal');
    expect(exitOf(p.events)).toBe('normal');
    expect(count(p.events, 'goal')).toBe(1);
    expect(has(p.events, 'hurt')).toBe(false);
    expect(has(p.events, 'death')).toBe(false);
  }, 30_000);
});
