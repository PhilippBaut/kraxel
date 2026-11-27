// Alle Sprites als Zeichen-Raster (Stil A, dunkle Umrandung 'o').
// Übernommen aus dem Grafik-Entwurf, neue Kraxel-Bilder in denselben Farben.
// Läuft auch in Node (Icon-Skript): nur Raster, kein DOM.
import {
  type PixelGrid, grid, strs, ell, cap, rect, put, line, outline, each, stamp, recolor, flipX,
} from './grid-ops.ts';

const KRAXEL_NAMES = [
  'kraxel', 'kraxelB', 'kraxelJ', 'kraxelRun1', 'kraxelRun2', 'kraxelFall', 'kraxelSkid', 'kraxelWall',
  'kraxelClimb1', 'kraxelClimb2', 'kraxelPound', 'kraxelHurt', 'kraxelDead', 'kraxelCheer',
] as const;
type KraxelFrame = (typeof KRAXEL_NAMES)[number];

export type SpriteName =
  | KraxelFrame
  | 'crate' | 'crateUsed' | 'crystal' | 'edel' | 'helm' | 'sling' | 'glider' | 'crampon' | 'enzian'
  | 'beetle' | 'beetleFlat' | 'snail' | 'stone' | 'cloud' | 'groundTop' | 'groundFill'
  | 'pebble' | 'leafPad'
  | 'log' | 'log3' | 'log4' | 'stoneSlab' | 'stoneSlab3' | 'stoneSlab4' | 'waterTop1' | 'waterTop2' | 'water'
  | 'iCrystal' | 'iEdel' | 'iEdelOff' | 'iHead' | 'iSling' | 'cross' | 'crossGold' | 'cairn' | 'cairnFlag' | 'debris';

export const KRAXEL_FRAMES: readonly SpriteName[] = KRAXEL_NAMES;

/** Bild einer beweglichen Plattform: `log`/`stoneSlab` 2 Kacheln breit, sonst mit Ziffer (`log3`, `stoneSlab4`). */
export function platformSprite(art: 'stamm' | 'stein', width: number): SpriteName {
  const base = art === 'stamm' ? 'log' : 'stoneSlab';
  return (width === 2 ? base : `${base}${width}`) as SpriteName;
}

/** Bachwasser: Bilder der Oberfläche (zwei Wellenbilder im Wechsel) und der Tiefe. */
export const WATER_TOP_FRAMES: readonly SpriteName[] = ['waterTop1', 'waterTop2'];

export function helmName(frame: SpriteName): string {
  return frame + 'Helm';
}

// ---------------------------------------------------------------- Kraxel
// Jedes Bild besteht aus drei Lagen: Körper, Kopfbedeckung (an Position `hat`) und
// optional einer vorderen Lage (Hände vor der Mütze). Die Helm-Variante tauscht nur
// die Kopfbedeckung, deshalb passen Mütze und Helm in jedem Bild an dieselbe Stelle.

const _ = '................';

/** Mütze mit Bommel, Zeilen 0–6 aus dem Entwurf. */
const BEANIE = strs([
  '......oo........',
  '.....oPPo.......',
  '.....oPPoooo....',
  '.....oHhhHHo....',
  '....oHhHHHHHo...',
  '...oSSSSSSSSSo..',
  '...ossssssssso..',
]);

/** Beim Rennen fliegt der Bommel nach hinten. */
const BEANIE_RUN = strs([
  _,
  '...oo...........',
  '..oPPooooooo....',
  '..oPPoHhhHHo....',
  '...ooHhHHHHHo...',
  '...oSSSSSSSSSo..',
  '...ossssssssso..',
]);

/** Von hinten: Bommel mittig. */
const BEANIE_BACK = strs([
  '.......oo.......',
  '......oPPo......',
  '.....ooPPoo.....',
  '.....oHhHHo.....',
  '....oHhHHHHo....',
  '...oSSSSSSSSo...',
  '...osssssssso...',
]);

/** Kletterhelm wie `helm`: Kuppel Q/q mit Glanz Z und Lampe M, Krempe q. */
function helmet(back: boolean): PixelGrid {
  const g = grid(16, 7);
  const cx = back ? 8 : 8.5;
  ell(g, cx, 5.6, 5.2, 5.0, 'Q', (_x, y) => y <= 4);
  rect(g, back ? 2 : 3, 5, 13, 5, 'q');
  rect(g, back ? 3 : 4, 6, 12, 6, 'q');
  each(g, (c, x, y) => { if (c === 'Q' && x >= (back ? 10 : 11) && y >= 2) g[y][x] = 'q'; });
  put(g, back ? [[5, 1], [4, 2], [4, 3]] : [[6, 1], [5, 2], [4, 3]], 'Z');
  if (!back) { put(g, [[9, 2], [10, 2]], 'M'); put(g, [[9, 3], [10, 3]], 'Z'); }
  return outline(g);
}

interface FrameDef {
  /** 16 Zeilen Körper; die Kopfbedeckung wird darübergelegt. */
  body: readonly string[];
  hat?: readonly [number, number];
  beanie?: PixelGrid;
  /** Rückansicht: Helm mittig und ohne Lampe. */
  back?: boolean;
  /** Lage vor der Kopfbedeckung, z. B. erhobene Hände. */
  front?: readonly string[];
  /** Fertiges Bild (Mütze wie Helm) waagerecht spiegeln. */
  mirror?: boolean;
}

const FACE = [
  '.oooBBBBWWBWWo..',
  '.oKoBBBBWEBWEo..',
  '.oKoBBBBWEBWEo..',
  '.oKoBBBRBBEBRo..',
  '.okoBBBBBBBBBo..',
  '.okobBBBBBBBbo..',
  '.oooobbbbbbbo...',
];
const NO_HAT = [_, _, _, _, _, _, _];

const FRAMES: Record<KraxelFrame, FrameDef> = {
  kraxel: { body: [...NO_HAT, ...FACE, '...oFFFoooFFFo..', '...ooooo.ooooo..'] },
  kraxelB: { body: [...NO_HAT, ...FACE, '....oFFFoFFFo...', '....ooooooooo...'] },
  kraxelJ: { body: [...NO_HAT, ...FACE, '..oFFFo..oFFFo..', '..ooooo..ooooo..'] },
  kraxelRun1: {
    hat: [1, 0], beanie: BEANIE_RUN,
    body: [...NO_HAT,
      '..oooBBBBWWBWWo.',
      '..oKoBBBBWEBWEo.',
      '..oKoBBBBWEBWEo.',
      '..oKoBBBRBBEBRo.',
      '.okoBBBBBBBBBo..',
      '.okobBBBBBBBbo..',
      '.oooobbbbbbbooo.',
      'oFFFo.....oFFFo.',
      'ooooo.....ooooo.'],
  },
  kraxelRun2: {
    // Kopf bleibt auf Höhe von Run1 (der Helm braucht Zeile 0 für seine Umrandung),
    // der Körper ist eine Zeile kürzer: Bein vorn gestreckt, Stiefel hinten angehoben.
    hat: [1, 0], beanie: BEANIE_RUN,
    body: [...NO_HAT,
      '..oooBBBBWWBWWo.',
      '..oKoBBBBWEBWEo.',
      '..oKoBBBBWEBWEo.',
      '..oKoBBBRBBEBRo.',
      '.okobBBBBBBBbo..',
      '.oooobbbbbbbo...',
      '.oFFFoooFFo.....',
      '.oooooooFFFo....',
      '.......ooooo....'],
  },
  kraxelFall: {
    body: [...NO_HAT,
      '.oooBBBBWEBWEo..',
      '.oKoBBBBWEBWEo..',
      '.oKoBBBBWWBWWo..',
      '.oKoBBBRBEBBRo..',
      '.okoBBBBBEBBBo..',
      '.okobBBBBBBBbo..',
      '.oooobbbbbbbo...',
      '....oFFo.oFFo...',
      '....oooo.oooo...'],
    front: [_, _,
      '.oo..........oo.',
      'oBBo........oBBo',
      'oBBo........oBBo',
      '.oo..........oo.'],
  },
  kraxelSkid: {
    hat: [-1, 0],
    body: [...NO_HAT,
      'oooBBBBBBBBBo...',
      'oKoBBBBWEBWEo...',
      'oKoBBBBWEBWEo...',
      'oKoBBBRBBEBRo...',
      '.okoBBBBBBBBBo..',
      '.okobBBBBBBBbo..',
      '.oooobbbbbbbooo.',
      '...oFFFo..oFFFFo',
      '...ooooo..oooooo'],
  },
  kraxelWall: {
    // Gezeichnet mit der Wand links, danach gespiegelt: Im fertigen Bild liegt die Wand
    // rechts ab Spalte 13, Rucksack, Hand und Stiefel tragen dort ihre Umrandung, und
    // Kraxel schaut nach links von ihr weg. Vorn bleibt Spalte 0 frei für die Helmkrempe.
    hat: [1, 0], mirror: true,
    body: [...NO_HAT,
      '..oooBBBBWWBWWo.',
      '..oKoBBBBWEBWEo.',
      '..oKoBBBBWEBWEo.',
      '..oKoBBBRBBEBRo.',
      '..okoBBBBBBBBBo.',
      '..okobBBBBBBBbo.',
      '..oFFobbbbbbbo..',
      '..oFFFo..oFFo...',
      '..ooooo..oooo...'],
    front: [_, _,
      '...oo...........',
      '..oBBo..........',
      '..oBBo..........',
      '...oo...........'],
  },
  kraxelClimb1: {
    beanie: BEANIE_BACK, back: true,
    body: [...NO_HAT,
      '...oBBBBBBBBo...',
      '...oBKKKKKKBo...',
      '...oBkkkkkkBo...',
      '...oBKKKKKKBoo..',
      '...obKKKKKKboBo.',
      '....oKKKKKKooBo.',
      '....obbbbbbo.oo.',
      '....oFFo.oFFo...',
      '....oooo.oooo...'],
    front: [
      '.oo.............',
      'oBBo............',
      'oBBo............',
      '.oo.............'],
  },
  kraxelClimb2: {
    beanie: BEANIE_BACK, back: true, mirror: true,
    body: [...NO_HAT,
      '...oBBBBBBBBo...',
      '...oBKKKKKKBo...',
      '...oBkkkkkkBo...',
      '...oBKKKKKKBoo..',
      '...obKKKKKKboBo.',
      '....oKKKKKKooBo.',
      '....obbbbbbo.oo.',
      '....oFFo.oFFo...',
      '....oooo.oooo...'],
    front: [
      '.oo.............',
      'oBBo............',
      'oBBo............',
      '.oo.............'],
  },
  kraxelPound: {
    hat: [0, 3],
    body: [_, _, _, _, _, _, _, _, _, _,
      '.oooBBBBBBBBBo..',
      '.oKoBBBBEEBEEo..',
      '.oKoBBBRBBBBRo..',
      '.okoBFFFoFFFbo..',
      '.ooooFFFoFFFo...',
      '....ooooooooo...'],
  },
  kraxelHurt: {
    hat: [-1, 0],
    body: [...NO_HAT,
      'oooBBBEBBBBEo...',
      'oKoBBBBEBBEBo...',
      'oKoBBBEBBBBEo...',
      'oKoBBRBBEEBRo...',
      '.okoBBBBEEBBBo..',
      '.okobBBBBBBBbo..',
      '.oooobbbbbbbo...',
      '...oFFFo.oFFFo..',
      '...ooooo.ooooo..'],
  },
  kraxelDead: {
    body: [...NO_HAT,
      '.oooBBEBEBEBEo..',
      '.oKoBBBEBBBEBo..',
      '.oKoBBEBEBEBEo..',
      '.oKoBBBBBBBBBo..',
      '.okoBBBRBEBBRo..',
      '.okobBBBBBBBbo..',
      '.oooobbbbbbbo...',
      '..oFFFo..oFFFo..',
      '..ooooo..ooooo..'],
    front: [_, _,
      '.oo..........oo.',
      'oBBo........oBBo',
      'oBBo........oBBo',
      '.oo..........oo.'],
  },
  kraxelCheer: {
    body: [...NO_HAT,
      '.oooBBBBBBBBBo..',
      '.oKoBBBEBBBEBo..',
      '.oKoBBEBEBEBEo..',
      '.oKoBBBRBBBBRo..',
      '.okoBBBBEEEBBo..',
      '.okobBBBBBBBbo..',
      '.oooobbbbbbbo...',
      '..oFFFo..oFFFo..',
      '..ooooo..ooooo..'],
    front: [
      '.............oo.',
      '............oBBo',
      '............oBBo',
      '.............oBo',
      '.............oBo',
      '.............oBo',
      '.............oBo',
      '.............oBo',
      '.............Bo.'],
  },
};

function buildFrame(def: FrameDef, withHelmet: boolean): PixelGrid {
  const g = strs(def.body);
  const [dx, dy] = def.hat ?? [0, 0];
  const hat = withHelmet ? helmet(def.back ?? false) : (def.beanie ?? BEANIE);
  stamp(g, hat, dx, dy);
  if (def.front) stamp(g, strs(def.front), 0, 0);
  return def.mirror ? flipX(g) : g;
}

// ---------------------------------------------------------------- Gegenstände und Gegner

const CRYSTAL = [
  _, _, _,
  '.......oo.......', '......oZXo......', '.....oZXXxo.....', '....oZXXXxxo....',
  '....oXXXXxxo....', '....oXXXxxxo....', '.....oXXxxo.....', '......oXxo......', '.......oo.......',
  _, _, _, _,
];

function crates(): { crate: PixelGrid; crateUsed: PixelGrid } {
  const g = grid(16, 16);
  rect(g, 0, 0, 15, 15, 'o'); rect(g, 1, 1, 14, 14, 'C');
  for (const y of [3, 7, 11]) rect(g, 1, y, 14, y, 'c');
  rect(g, 1, 14, 14, 14, 'c');
  put(g, [[1, 1], [2, 1], [1, 2], [13, 1], [14, 1], [14, 2], [1, 13], [1, 14], [2, 14], [14, 13], [13, 14], [14, 14]], 'M');
  const used = recolor(g, { C: 'c', M: 'w' });
  rect(used, 1, 1, 14, 14, 'c');
  for (const y of [3, 7, 11]) rect(used, 1, y, 14, y, 'j');
  rect(used, 1, 14, 14, 14, 'j');
  put(used, [[2, 2], [13, 2], [2, 13], [13, 13]], 'w');
  const emblem = strs(['....oo....', '...oZZo...', '..oZZZZo..', '.oYYZYyyo.', 'oYYYYYyyyo', 'oooooooooo']);
  const crate = g.map((r) => r.slice());
  stamp(crate, emblem, 3, 4);
  return { crate, crateUsed: used };
}

function edel(): PixelGrid {
  const g = grid(16, 16);
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4 - Math.PI / 2, r = k % 2 ? 3.3 : 4.2;
    const cx = 8 + Math.cos(a) * r, cy = 8 + Math.sin(a) * r;
    const ru = k % 2 ? 2.0 : 2.9, rv = k % 2 ? 1.2 : 1.5;
    each(g, (_c, x, y) => {
      const px = x + 0.5 - cx, py = y + 0.5 - cy;
      const u = px * Math.cos(a) + py * Math.sin(a), v = -px * Math.sin(a) + py * Math.cos(a);
      if ((u / ru) ** 2 + (v / rv) ** 2 <= 1) g[y][x] = x + y > 16 ? 'v' : 'V';
    });
  }
  ell(g, 8, 8, 2.3, 2.3, 'Y'); put(g, [[8, 8], [9, 9]], 'y');
  return outline(g);
}

function beetles(): { beetle: PixelGrid; beetleFlat: PixelGrid } {
  const g = grid(16, 16);
  ell(g, 9.5, 13, 5.5, 7.5, 'A', (_x, y) => y <= 12);
  each(g, (c, x, y) => { if (c === 'A' && x >= 12 && y >= 9) g[y][x] = 'a'; });
  for (let y = 6; y <= 12; y++) if (g[y][9] !== '.') g[y][9] = 'a';
  put(g, [[6, 7], [7, 7], [6, 8]], 'Z'); put(g, [[11, 8], [12, 8], [7, 10], [6, 11]], 'L');
  ell(g, 3.5, 11, 2.5, 2.5, 'L'); put(g, [[3, 10]], 'W'); put(g, [[2, 10]], 'E');
  put(g, [[2, 7], [3, 8]], 'L');
  put(g, [[5, 13], [9, 13], [13, 13]], 'L');
  const s = grid(16, 16);
  ell(s, 8.5, 15, 6.5, 3.6, 'A', (_x, y) => y <= 14);
  each(s, (c, x, y) => { if (c === 'A' && x >= 11) s[y][x] = 'a'; });
  put(s, [[6, 12], [7, 12]], 'Z'); put(s, [[4, 13]], 'W');
  return { beetle: outline(g), beetleFlat: outline(s) };
}

function snail(): PixelGrid {
  const g = grid(16, 16);
  // Schwanz 1 px kürzer als im Entwurf, damit seine Umrandung in das 16er-Raster passt
  cap(g, 2.5, 13, 13.5, 13, 1.5, 'T'); cap(g, 2.5, 13, 2.5, 9, 1.6, 'T');
  cap(g, 2, 8.5, 1.5, 6, 0.6, 'T'); cap(g, 4, 8.5, 4.5, 6, 0.6, 'T');
  each(g, (c, x, y) => { if (c === 'T' && y === 14) g[y][x] = 't'; });
  ell(g, 9.5, 8.5, 4.6, 4.6, 'U');
  each(g, (c, x, y) => {
    if (c !== 'U') return;
    const d = Math.hypot(x + 0.5 - 9.5, y + 0.5 - 8.5);
    if ((d > 2.1 && d < 3.0 && !(x < 9 && y > 8)) || d < 1) g[y][x] = 'u';
    else if (x + y > 20) g[y][x] = 'u';
  });
  put(g, [[6, 3], [6, 2], [9, 2], [9, 1], [10, 2], [13, 3], [13, 2]], 'I');
  put(g, [[1, 5], [4, 5]], 'W'); put(g, [[1, 6], [4, 6]], 'E');
  return outline(g);
}

function helm(): PixelGrid {
  const g = grid(16, 16);
  ell(g, 8, 10.5, 6, 6.5, 'Q', (_x, y) => y <= 9);
  rect(g, 1, 10, 14, 10, 'q'); rect(g, 3, 11, 12, 11, 'q');
  each(g, (c, x, y) => { if (c === 'Q' && x >= 10 && y >= 6) g[y][x] = 'q'; });
  put(g, [[5, 5], [6, 4], [4, 6], [4, 7]], 'Z');
  put(g, [[7, 5], [8, 5]], 'M'); put(g, [[7, 6], [8, 6]], 'Z');
  return outline(g);
}

function sling(): PixelGrid {
  const g = grid(16, 16);
  cap(g, 5, 3, 6.6, 8.6, 1.1, 'J'); cap(g, 11, 3, 9.4, 8.6, 1.1, 'J');
  ell(g, 8, 9.4, 2.6, 1.6, 'J'); cap(g, 8, 9, 8, 13.6, 1.3, 'J');
  each(g, (c, x, y) => { if (c === 'J' && ((x >= 9 && y >= 9) || x === 11 || (x === 10 && y < 6))) g[y][x] = 'j'; });
  const o = outline(g);
  o[3][6] = 'A'; o[3][10] = 'A'; o[3][7] = 'K'; o[3][8] = 'K'; o[3][9] = 'K';
  o[2][7] = 'o'; o[2][8] = 'o'; o[2][9] = 'o';
  return o;
}

function glider(): PixelGrid {
  const g = grid(16, 16);
  each(g, (_c, x, y) => {
    const dx = x + 0.5 - 8, dy = y + 0.5 - 13, e = Math.hypot(dx / 6.8, dy / 8);
    if (e >= 0.74 && e <= 1 && y <= 8) {
      const seg = Math.floor((x + 1) / 3);
      g[y][x] = e < 0.86 ? (seg % 2 ? 'y' : 'x') : (seg % 2 ? 'Y' : 'X');
    }
  });
  rect(g, 7, 13, 8, 14, 'K');
  const o = outline(g);
  line(o, 3, 9, 7, 12, 'n'); line(o, 12, 9, 8, 12, 'n'); line(o, 6, 8, 7, 12, 'n'); line(o, 9, 8, 8, 12, 'n');
  return o;
}

function crampon(): PixelGrid {
  const g = grid(16, 16);
  rect(g, 4, 2, 8, 10, 'F'); rect(g, 4, 7, 12, 10, 'F'); g[7][12] = '.';
  rect(g, 5, 3, 5, 7, 'K'); rect(g, 9, 8, 11, 8, 'K');
  rect(g, 4, 5, 8, 5, 'A'); put(g, [[7, 5]], 'Y');
  rect(g, 3, 11, 13, 11, 'm');
  for (const sx of [4, 7, 10]) put(g, [[sx, 12], [sx + 1, 12], [sx, 13]], 'M');
  put(g, [[13, 12], [14, 12], [14, 11]], 'M');
  return outline(g);
}

function enzian(): PixelGrid {
  const g = grid(16, 16);
  cap(g, 8, 14.5, 8, 10.5, 0.8, 'g');
  ell(g, 5.3, 12.6, 2.3, 1.1, 'G'); ell(g, 10.7, 12.1, 2.3, 1.1, 'G');
  for (let y = 3; y <= 9; y++) {
    const hw = 1.5 + (y - 3) * 0.48;
    for (let x = 0; x < 16; x++) if (Math.abs(x + 0.5 - 8) <= hw) g[y][x] = x >= 9 ? 'y' : 'Y';
  }
  put(g, [[4, 10], [7, 10], [8, 10], [11, 10]], 'Y'); put(g, [[7, 9], [8, 9]], 'O'); put(g, [[7, 4], [6, 6], [6, 7]], 'Z');
  const o = outline(g);
  put(o, [[2, 3], [13, 5], [12, 1]], 'Z');
  return o;
}

/** Kiesel, 4×4: grauer Stein mit dunklem Rand (so groß wie der Körper im Kern). */
const PEBBLE = ['.oo.', 'oMMo', 'oMno', '.oo.'];

/**
 * Blätterpolster: ein dickes gelbgrünes Blatt füllt die Zelle (Umrandung bis zum Rand, Ecken rund),
 * heller Rand oben, dunklere Adern wie bei einem Seerosenblatt. Bewusst gelbgrün (T/t) statt Grasgrün,
 * damit es sich vom Boden abhebt.
 */
function leafPad(): PixelGrid {
  const g = grid(16, 16);
  rect(g, 1, 1, 14, 14, 'T');
  put(g, [[1, 1], [14, 1], [1, 14], [14, 14]], '.');
  rect(g, 2, 1, 13, 2, 'l');
  rect(g, 1, 12, 14, 14, 't');
  put(g, [[1, 14], [14, 14]], '.');
  rect(g, 7, 3, 8, 11, 'g'); // Mittelrippe
  line(g, 6, 5, 2, 3, 'g'); line(g, 6, 8, 2, 6, 'g'); line(g, 9, 5, 13, 3, 'g'); line(g, 9, 8, 13, 6, 'g');
  put(g, [[3, 9], [12, 10]], 'l');
  const o = outline(g);
  // Umrandung bis an die Zellenränder: oben und unten volle Reihe, Seiten ebenso
  for (let i = 1; i < 15; i++) { o[0][i] = 'o'; o[15][i] = 'o'; o[i][0] = 'o'; o[i][15] = 'o'; }
  return o;
}

/** Treibender Baumstamm, `tiles` Kacheln breit, 16 hoch: Rinde mit hellem Rücken, Jahresringe an beiden Enden. */
function logSprite(tiles: number): PixelGrid {
  const w = tiles * 16;
  const g = grid(w, 16);
  rect(g, 4, 1, w - 5, 14, 'J');
  rect(g, 4, 1, w - 5, 3, 'C');
  rect(g, 4, 4, w - 5, 4, 'c');
  rect(g, 4, 11, w - 5, 14, 'j');
  rect(g, 4, 10, w - 5, 10, 'c');
  // Rindenrillen und Astlöcher, immer nach demselben Muster
  for (let x = 7; x < w - 8; x += 7) {
    const y = 5 + ((x * 5) % 4);
    rect(g, x, y, x + 2, y, 'j');
    put(g, [[x + 1, y + 1]], 'j');
  }
  for (let x = 10; x < w - 10; x += 11) put(g, [[x, 2], [x + 1, 2]], 'I');
  put(g, [[w / 2, 8], [w / 2 + 1, 8], [w / 2, 9], [w / 2 + 1, 9]], 'k');
  for (const cx of [4.5, w - 4.5]) {
    ell(g, cx, 7.5, 3.5, 6.5, 'C');
    ell(g, cx, 7.5, 2.5, 5, 'B');
    ell(g, cx, 7.5, 1.3, 3, 'C');
    put(g, [[Math.floor(cx), 7]], 'c');
  }
  return outline(g);
}

/** Steinplatte, `tiles` Kacheln breit, 16 hoch: behauener Block mit hellem Rand oben links, Fugen, Rissen und Moos auf der Oberkante. */
function slabSprite(tiles: number): PixelGrid {
  const w = tiles * 16;
  const g = grid(w, 16);
  rect(g, 1, 1, w - 2, 14, 'M');
  put(g, [[1, 1], [w - 2, 1], [1, 14], [w - 2, 14]], '.');
  rect(g, 2, 1, w - 3, 2, 'm');
  rect(g, 1, 3, 1, 12, 'm');
  rect(g, 2, 13, w - 3, 14, 'n');
  rect(g, w - 2, 3, w - 2, 12, 'n');
  for (let x = 16; x < w - 4; x += 16) rect(g, x, 3, x, 12, 'n'); // Fugen zwischen den Kacheln
  put(g, [[6, 5], [7, 6], [7, 7], [8, 8], [w - 9, 7], [w - 10, 8], [w - 10, 9], [w - 11, 10]], 'n');
  put(g, [[10, 9], [w - 6, 5], [w / 2 + 3, 10]], 'm');
  // Moos auf der Oberkante
  const moss = [[4, 1], [5, 1], [6, 1], [5, 2], [w - 8, 1], [w - 7, 1], [w - 7, 2], [w - 6, 1]] as const;
  put(g, moss, 'G');
  put(g, [[5, 3], [w - 7, 3]], 'g');
  const o = outline(g);
  rect(o, 2, 0, w - 3, 0, 'o'); rect(o, 2, 15, w - 3, 15, 'o'); rect(o, 0, 2, 0, 13, 'o'); rect(o, w - 1, 2, w - 1, 13, 'o');
  return o;
}

/** Wasseroberfläche: Wellenkamm im Zellenraster, Periode 8 px (zwei Bilder gegeneinander um 4 px verschoben), darunter Schaum, helles und mittleres Blau, unten ins Tiefe verlaufend. */
function waterTop(frame: 0 | 1): PixelGrid {
  const g = grid(16, 16);
  const crest = [1, 0, 0, 1, 2, 2, 1, 1]; // Tiefe der Oberfläche je Spalte
  for (let x = 0; x < 16; x++) {
    const top = crest[(x + frame * 4) % 8];
    for (let y = top; y < 16; y++) {
      g[y][x] = y === top ? 'Z' : y === top + 1 ? 'X' : y >= 12 && (x + y) % 2 === 0 ? 'N' : 'x';
    }
  }
  put(g, [[(3 + frame * 8) % 16, 5], [(4 + frame * 8) % 16, 5], [(11 + frame * 8) % 16, 8]], 'X');
  return g;
}

/** Tiefes Wasser unter der Oberfläche: dunkleres Blau mit hellen Strichen. */
function waterDeep(): PixelGrid {
  const g = grid(16, 16);
  rect(g, 0, 0, 15, 15, 'N');
  for (const [x, y, len] of [[2, 3, 4], [9, 6, 3], [5, 10, 5], [12, 13, 3], [0, 14, 2]] as const) rect(g, x, y, x + len - 1, y, 'x');
  put(g, [[3, 2], [10, 5], [6, 9]], 'X');
  return g;
}

function stone(): PixelGrid {
  const g = grid(16, 16);
  rect(g, 0, 0, 15, 15, 'o'); rect(g, 1, 1, 14, 14, 'M');
  rect(g, 1, 1, 14, 1, 'm'); rect(g, 1, 1, 1, 14, 'm'); rect(g, 1, 14, 14, 14, 'n'); rect(g, 14, 1, 14, 14, 'n');
  put(g, [[5, 2], [5, 3], [6, 4], [6, 5], [5, 6], [9, 9], [10, 10], [11, 10], [12, 11], [3, 10], [4, 11], [9, 4], [10, 4]], 'n');
  put(g, [[6, 3], [7, 5], [10, 9], [4, 10]], 'm');
  return g;
}

/** Gipfelkreuz, 5 Kacheln hoch: Kreuz mit Wimpel oben, Holzmast, Steinsockel unten. */
function cross(): PixelGrid {
  const g = grid(16, 80);
  rect(g, 7, 3, 8, 67, 'J'); rect(g, 8, 3, 8, 67, 'j');
  rect(g, 2, 9, 13, 10, 'J'); rect(g, 2, 10, 13, 10, 'j');
  rect(g, 9, 4, 14, 4, 'h'); rect(g, 9, 5, 13, 5, 'H'); rect(g, 9, 6, 11, 6, 'H'); put(g, [[9, 7]], 'H');
  // Sockel aus behauenen Steinen: Deckplatte und drei Lagen mit versetzten Fugen
  rect(g, 4, 66, 11, 67, 'M'); rect(g, 4, 66, 11, 66, 'm');
  rect(g, 2, 68, 13, 78, 'M');
  for (const y of [68, 72, 76]) rect(g, 2, y, 13, y, 'm');
  for (const y of [71, 75]) rect(g, 2, y, 13, y, 'n');
  for (const [x, y] of [[7, 68], [4, 72], [10, 72], [8, 76]]) rect(g, x, y, x, y + 2, 'n');
  rect(g, 13, 68, 13, 78, 'n'); rect(g, 2, 78, 13, 78, 'n');
  return outline(g);
}

/** Steinmännchen aus vier grauen Steinen, hell oben links, Schatten unten rechts. */
const CAIRN = [
  _, _, _,
  '......oooo......',
  '.....ommMMo.....',
  '.....oMMnno.....',
  '.....ooooooo....',
  '....ommMMMMno...',
  '....oMMMnnnno...',
  '...ooooooooo....',
  '..ommMMMMMno....',
  '..oMMMMnnnno....',
  '..oooooooooooo..',
  '.ommmMMMMMMMMno.',
  '.oMMnnnnnnnnnno.',
  '..oooooooooooo..',
];

/** Türkis-gelbe Fahne, steckt hinter dem obersten Stein. */
const CAIRN_FLAG = [
  '.......oooooooo.',
  '.......ojhhHHHo.',
  '.......ojSSSSso.',
  '.......ojooooo..',
];

function cairnFlag(base: PixelGrid): PixelGrid {
  const g = grid(16, 16);
  stamp(g, strs(CAIRN_FLAG), 0, 0);
  stamp(g, base, 0, 0);
  return g;
}

/** Kantiger Felsbrocken (8×8) für Splitter. */
const DEBRIS = [
  '.ooooo..',
  'ommmMMo.',
  'omMMMMno',
  'oMMMMnno',
  '.oMMnnno',
  '..onnnno',
  '...oooo.',
  '........',
];

// ---------------------------------------------------------------- HUD und Kulisse

const I_CRYSTAL = ['...o...', '..oXo..', '.oZXxo.', 'oZXXxxo', '.oXxxo.', '..oxo..', '...o...'];
const I_EDEL = ['..o.o..', '.oVoVo.', 'oVVYVVo', '.oYYYo.', 'oVVYVVo', '.oVoVo.', '..o.o..'];
const I_SLING = ['.o...o.', 'oAo.oAo', 'oJoooJo', '.oJJJo.', '..oJo..', '..oJo..', '...o...'];
const I_HEAD = ['.oooooo.', 'oHHHHHHo', 'oSSSSSSo', 'oBWEBWEo', 'oBBBBBBo', '.oooooo.'];

function cloud(): PixelGrid {
  const g = grid(36, 20);
  ell(g, 18, 11, 10, 7.5, 'Z'); ell(g, 9, 14, 7, 5, 'Z'); ell(g, 27, 14, 7.5, 5, 'Z'); ell(g, 14, 8, 6, 5, 'Z');
  each(g, (c, x, y) => { if (c === 'Z' && y >= 15) g[y][x] = 'v'; });
  return g;
}

const DEPTH = [5, 5, 6, 6, 5, 4, 4, 5, 6, 6, 6, 5, 4, 4, 5, 5];

function dirtAt(x: number, y: number, seed: boolean): string {
  const pebbles = seed ? [[2, 4], [11, 2], [6, 9], [13, 11], [1, 13]] : [[3, 9], [10, 7], [12, 13], [5, 13], [8, 11]];
  for (const [px, py] of pebbles) {
    if ((x === px || x === px + 1) && y === py) return 'p';
    if ((x === px || x === px + 1) && y === py + 1) return 'd';
  }
  return (x * 7 + y * 3 + (seed ? 5 : 0)) % 23 === 0 ? 'd' : 'D';
}

function groundTop(): PixelGrid {
  const g = grid(16, 16);
  each(g, (_c, x, y) => {
    const d = DEPTH[x];
    g[y][x] = y === 0 ? 'o' : y === 1 ? 'l' : y < d - 1 ? 'G' : y === d - 1 ? 'g' : y === d ? 'o' : dirtAt(x, y, false);
  });
  put(g, [[3, 1], [4, 1], [10, 1]], 'G');
  return g;
}

function groundFill(): PixelGrid {
  const g = grid(16, 16);
  each(g, (_c, x, y) => { g[y][x] = dirtAt(x, y, true); });
  return g;
}

// ---------------------------------------------------------------- Alle zusammen

/** Alle Basis-Sprites und zu jedem Kraxel-Bild die Helm-Variante; jeder Aufruf liefert frische Raster. */
export function buildSprites(): Record<string, PixelGrid> {
  const frames = Object.fromEntries(KRAXEL_NAMES.map((n) => [n, buildFrame(FRAMES[n], false)])) as Record<KraxelFrame, PixelGrid>;
  const helmets = Object.fromEntries(KRAXEL_NAMES.map((n) => [helmName(n), buildFrame(FRAMES[n], true)]));
  const iEdel = strs(I_EDEL);
  const base = strs(CAIRN);
  const crossGrid = cross();
  const sprites: Record<SpriteName, PixelGrid> = {
    ...frames, ...crates(), ...beetles(),
    crystal: strs(CRYSTAL), edel: edel(), helm: helm(), sling: sling(), glider: glider(),
    crampon: crampon(), enzian: enzian(), pebble: strs(PEBBLE), leafPad: leafPad(),
    log: logSprite(2), log3: logSprite(3), log4: logSprite(4), stoneSlab: slabSprite(2), stoneSlab3: slabSprite(3), stoneSlab4: slabSprite(4),
    waterTop1: waterTop(0), waterTop2: waterTop(1), water: waterDeep(), snail: snail(), stone: stone(), cloud: cloud(),
    groundTop: groundTop(), groundFill: groundFill(),
    iCrystal: strs(I_CRYSTAL), iEdel, iEdelOff: recolor(iEdel, { V: 'w', Y: 'w' }), iHead: strs(I_HEAD), iSling: strs(I_SLING),
    cross: crossGrid, crossGold: recolor(crossGrid, { J: 'Q', j: 'q' }), cairn: base, cairnFlag: cairnFlag(base), debris: strs(DEBRIS),
  };
  return { ...sprites, ...helmets };
}
