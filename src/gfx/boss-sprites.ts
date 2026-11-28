// Murmelkönig Grummel (32×32) und Arena-Bilder: Hügel, Stein, Sterne, Tor, Burgkacheln.
// Ein riesiges braunes Murmeltier mit kleiner Goldkrone; alles eigen gezeichnet. Läuft auch in Node: nur Raster.
import { type PixelGrid, grid, ell, cap, rect, put, outline, each, stamp, line } from './grid-ops.ts';

const S = 32;

interface Pose {
  /** Arme: unten, hoch (Sprung), Wurfarm (rechter Arm über dem Kopf), eingegraben (Schaufeln). */
  arms: 'down' | 'up' | 'throw' | 'dig';
  /** Augen: böse, zugekniffen X (benommen oder besiegt). */
  eyes: 'angry' | 'x';
  mouth: 'closed' | 'open' | 'tongue';
  /** Füße eingezogen (Sprung). */
  feet: 'stand' | 'tucked';
}

/** Rumpf, Kopf, Krone, Gesicht, Arme und Füße; noch ohne Umrandung. Fell D, Schatten d, Bauch und Schnauze p. */
function marmot(pose: Pose): PixelGrid {
  const g = grid(S, S);
  // Füße (zuerst, der Rumpf liegt davor)
  const fx = pose.feet === 'stand' ? 10 : 12, fw = pose.feet === 'stand' ? 4.5 : 3.5; // im Sprung rücken die Füße zusammen
  ell(g, fx, 28.5, fw, 2.5, 'd'); ell(g, 32 - fx, 28.5, fw, 2.5, 'd');
  for (const x of [fx - 3, fx - 1, fx + 1, 32 - fx - 3, 32 - fx - 1, 32 - fx + 1]) put(g, [[x, 29]], 'W');
  // Rumpf mit Schatten rechts unten und hellem Bauch
  ell(g, 16, 20, 12, 9.5, 'D');
  ell(g, 16, 20, 12, 9.5, 'd', (x, y) => x + y > 38 || x > 25);
  ell(g, 16, 22, 6.5, 6.5, 'p');
  // Arme
  const paw = 'k';
  if (pose.arms === 'down') {
    cap(g, 5.5, 16, 4.5, 24, 2.4, 'D'); cap(g, 26.5, 16, 27.5, 24, 2.4, 'd');
    ell(g, 4.5, 25.5, 2.4, 2, paw); ell(g, 27.5, 25.5, 2.4, 2, paw);
  } else if (pose.arms === 'up') {
    cap(g, 6.5, 15, 4.5, 6, 2.4, 'D'); cap(g, 25.5, 15, 27.5, 6, 2.4, 'd');
    ell(g, 4.5, 5, 2.4, 2.2, paw); ell(g, 27.5, 5, 2.4, 2.2, paw);
  } else if (pose.arms === 'throw') {
    cap(g, 5.5, 16, 4.5, 24, 2.4, 'D'); ell(g, 4.5, 25.5, 2.4, 2, paw);
    cap(g, 25.5, 15, 27, 6, 2.4, 'd'); ell(g, 27, 5, 2.4, 2.2, paw);
  } else {
    // Schaufeln: beide Arme schräg nach unten-außen, Krallen scharren
    cap(g, 6, 18, 3.5, 26, 2.4, 'D'); cap(g, 26, 18, 28.5, 26, 2.4, 'd');
    ell(g, 3.5, 27.5, 2.4, 2, paw); ell(g, 28.5, 27.5, 2.4, 2, paw);
  }
  // Kopf mit Ohren
  ell(g, 7, 5.5, 3, 3, 'd'); ell(g, 25, 5.5, 3, 3, 'd');
  ell(g, 7, 6, 1.5, 1.5, 'R'); ell(g, 25, 6, 1.5, 1.5, 'R');
  ell(g, 16, 11, 10.5, 8, 'D');
  ell(g, 16, 11, 10.5, 8, 'd', (x, y) => x > 22 && y > 10);
  // Schnauze, Nase, Zähne
  ell(g, 16, 14.5, 6, 4, 'p');
  rect(g, 15, 12, 16, 13, 'E');
  put(g, [[14, 12], [17, 12]], 'E');
  if (pose.mouth === 'closed') {
    rect(g, 15, 16, 16, 17, 'W'); line(g, 12, 16, 14, 17, 'E'); line(g, 19, 16, 17, 17, 'E');
    rect(g, 15, 15, 16, 15, 'E');
  } else {
    rect(g, 12, 15, 19, 18, 'E');
    rect(g, 14, 15, 17, 16, 'W'); put(g, [[15, 15], [15, 16]], 'E');
    if (pose.mouth === 'tongue') rect(g, 14, 18, 17, 19, 'R');
  }
  // Augen und Brauen
  if (pose.eyes === 'angry') {
    rect(g, 10, 8, 12, 10, 'W'); rect(g, 20, 8, 22, 10, 'W');
    rect(g, 11, 9, 12, 10, 'E'); rect(g, 20, 9, 21, 10, 'E');
    line(g, 9, 6, 13, 8, 'k'); line(g, 22, 8, 26, 6, 'k');
    put(g, [[9, 7], [10, 7], [25, 7], [26, 7]], 'k');
  } else {
    for (const ox of [10, 20]) put(g, [[ox, 8], [ox + 2, 8], [ox + 1, 9], [ox, 10], [ox + 2, 10]], 'E');
  }
  // Krone: goldener Reif mit drei Zacken und rotem Stein, sitzt zwischen den Ohren
  rect(g, 12, 2, 12, 2, 'Y'); rect(g, 16, 1, 16, 2, 'Y'); rect(g, 19, 2, 19, 2, 'Y'); put(g, [[15, 2], [17, 2]], 'Y');
  rect(g, 12, 3, 19, 4, 'Y'); rect(g, 12, 4, 19, 4, 'y');
  put(g, [[15, 3], [16, 3]], 'A');
  return g;
}

/** Zeichnet das Murmeltier um `dy` Reihen nach unten verschoben (eingegraben) und deckt den Schnitt mit Erde. */
function buried(sink: number, pose: Pose): PixelGrid {
  const full = marmot(pose);
  const g = grid(S, S);
  stamp(g, full, 0, sink);
  // Erdhaufen vorn: deckt Rumpf und Beine ab
  const top = S - 2 - Math.round((28 - sink) / 2.2);
  ell(g, 16, S - 2, 15, S - 2 - top + 1, 'D');
  ell(g, 16, S - 2, 15, S - 2 - top + 1, 'd', (x, y) => y > top + 3 && (x + y) % 5 === 0);
  for (const [x, y] of [[2, 29], [4, 28], [27, 28], [30, 29], [8, 26], [24, 26]] as const) put(g, [[x, y]], 'D');
  for (let x = 0; x < S; x++) g[S - 1][x] = '.'; // unterste Reihe bleibt der Umrandung vorbehalten
  return g;
}

/** Besiegt: flach am Boden, Augen X, Zunge raus, Krone daneben. */
function defeated(): PixelGrid {
  const g = grid(S, S);
  ell(g, 16, 25, 14, 5.5, 'D');
  ell(g, 16, 25, 14, 5.5, 'd', (x, y) => y > 26 || x > 26);
  ell(g, 16, 26, 8, 3.5, 'p');
  ell(g, 12, 21, 9, 6, 'D'); ell(g, 12, 21, 9, 6, 'd', (x, y) => y > 24);
  ell(g, 5, 17, 2.6, 2.6, 'd'); ell(g, 19, 17, 2.6, 2.6, 'd');
  ell(g, 12, 23, 5, 3, 'p');
  put(g, [[11, 21], [12, 21]], 'E');
  rect(g, 11, 24, 13, 25, 'W'); rect(g, 12, 26, 14, 27, 'R');
  for (const ox of [6, 14]) put(g, [[ox, 18], [ox + 2, 18], [ox + 1, 19], [ox, 20], [ox + 2, 20]], 'E');
  // Krone liegt schief daneben
  rect(g, 24, 26, 30, 28, 'Y'); rect(g, 24, 28, 30, 28, 'y'); put(g, [[24, 25], [27, 24], [30, 25], [27, 27]], 'Y'); put(g, [[27, 27]], 'A');
  rect(g, 3, 28, 7, 29, 'k'); rect(g, 25, 29, 29, 29, 'k');
  const low = grid(S, S); // eine Reihe tiefer, damit er wie alle Bilder bis Reihe 30 reicht
  stamp(low, g, 0, 1);
  return low;
}

function framed(g: PixelGrid): PixelGrid {
  return outline(g);
}

export const BOSS_NAMES = ['bossStand', 'bossDig1', 'bossDig2', 'bossPop', 'bossStun', 'bossThrow', 'bossDown'] as const;

export function buildBossSprites(): Record<string, PixelGrid> {
  return {
    bossStand: framed(marmot({ arms: 'down', eyes: 'angry', mouth: 'closed', feet: 'stand' })),
    bossDig1: framed(buried(10, { arms: 'dig', eyes: 'angry', mouth: 'closed', feet: 'stand' })),
    bossDig2: framed(buried(20, { arms: 'dig', eyes: 'angry', mouth: 'closed', feet: 'stand' })),
    bossPop: framed(marmot({ arms: 'up', eyes: 'angry', mouth: 'open', feet: 'tucked' })),
    bossStun: framed(marmot({ arms: 'down', eyes: 'x', mouth: 'tongue', feet: 'stand' })),
    bossThrow: framed(marmot({ arms: 'throw', eyes: 'angry', mouth: 'open', feet: 'stand' })),
    bossDown: framed(defeated()),
    bossMound: framed(mound()),
    bossStone: framed(stone()),
    bossStars: framed(stars()),
    arenaDoor: gate(),
    burgTop: burgTile(true),
    burgFill: burgTile(false),
  };
}

/** Wandernder Erdhügel, 24 breit, 10 hoch (nach Umrandung): Haufen mit Furchen und Krümeln. */
function mound(): PixelGrid {
  const g = grid(24, 10);
  ell(g, 12, 8.5, 10.5, 7, 'D');
  ell(g, 12, 8.5, 10.5, 7, 'd', (x, y) => (x - y) % 4 === 0 && y > 3);
  ell(g, 9, 5, 4, 2, 'p');
  put(g, [[3, 3], [20, 4], [14, 1]], 'D');
  for (let x = 0; x < 24; x++) g[9][x] = '.';
  return g;
}

/** Wurfstein, 8×8: rundlich, hell oben links. */
function stone(): PixelGrid {
  const g = grid(8, 8);
  ell(g, 4, 4, 3, 3, 'M');
  put(g, [[2, 2], [3, 2], [2, 3]], 'm');
  put(g, [[5, 5], [4, 6], [5, 4], [6, 4]], 'n');
  return g;
}

/** Drei Sternchen für den benommenen Murmelkönig, 24×8 (nach Umrandung). */
function stars(): PixelGrid {
  const g = grid(24, 8);
  for (const [cx, cy] of [[4, 4], [12, 3], [20, 4]] as const) {
    rect(g, cx - 1, cy, cx + 1, cy, 'Y'); rect(g, cx, cy - 1, cx, cy + 1, 'Y');
    put(g, [[cx, cy]], 'I');
  }
  return g;
}

/** Arenatür: schwere Holzplanken mit Eisennieten; füllt die Zelle (Kachel). */
function gate(): PixelGrid {
  const g = grid(16, 16);
  rect(g, 0, 0, 15, 15, 'J');
  for (const x of [0, 5, 10, 15]) rect(g, x, 0, x, 15, 'j');
  for (const x of [1, 6, 11]) rect(g, x, 0, x, 15, 'D');
  rect(g, 0, 0, 0, 15, 'o'); rect(g, 15, 0, 15, 15, 'o');
  // Eisennieten auf den Fugen, kein durchgehendes Band (das wirkte wie Leitersprossen)
  for (const x of [5, 10]) put(g, [[x, 3], [x, 12]], 'w');
  return g;
}

/**
 * Burg-Kachel aus Quadern in den Platzhalter-Farben des Bodens: G Oberfläche, g Schatten, l Glanz,
 * D Stein, d Fuge, p Stein hell. Die Oberkante der oberen Kachel ist ein glatter Mauerabsatz.
 */
function burgTile(top: boolean): PixelGrid {
  const g = grid(16, 16);
  // Quader: Reihen 4 hoch, Fugen versetzt
  each(g, (_c, x, y) => {
    const row = Math.floor(y / 4), off = row % 2 ? 4 : 0;
    const seam = y % 4 === 3 || (x + off) % 8 === 7;
    const lit = !seam && (y % 4 === 0 || (x + off) % 8 === 0);
    g[y][x] = seam ? 'd' : lit ? 'p' : 'D';
  });
  if (top) {
    rect(g, 0, 0, 15, 0, 'o'); rect(g, 0, 1, 15, 1, 'l'); rect(g, 0, 2, 15, 3, 'G'); rect(g, 0, 3, 15, 3, 'g');
  }
  return g;
}
