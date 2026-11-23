# Kraxel Meilenstein 1 – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein kompletter, auf GitHub Pages veröffentlichter Graslevel (1-1), den man am Handy hochkant und quer spielt und in dem sich das Springen gut anfühlt. Davor gibt es einen Übungsplatz mit Testhalt.

**Architecture:** Die Spiellogik ist reines TypeScript in `src/core/`, ohne Phaser und ohne DOM. Sie läuft mit festem 60-Hz-Takt, ist mit Vitest getestet und bekommt pro Schritt ein Eingabe-Objekt. Phaser 4 zeichnet nur: Kachelkarte, Sprites, Kamera, Szenen. Touch und Tastatur laufen über eigene DOM-Listener, nicht über Phaser-Input. Alle Grafiken entstehen beim Start aus Zeichen-Rastern, alle Töne per Web Audio.

**Tech Stack:** Phaser 4.2.x, TypeScript (strict), Vite, Vitest, Node 26, GitHub Actions und GitHub Pages.

**Spec:** [docs/superpowers/specs/2026-11-23-kraxel-design.md](../specs/2026-11-23-kraxel-design.md). Grafik-Vorlage: [2026-11-23-kraxel-grafik-entwurf.html](../specs/2026-11-23-kraxel-grafik-entwurf.html). Spec und Vorlage vor jedem Task lesen.

## Global Constraints

- Abhängigkeiten zur Laufzeit: nur `phaser@^4.2.1`. Zum Entwickeln: `typescript`, `vite`, `vitest`. Mehr nur mit Begründung im Commit.
- TypeScript: `strict`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `allowImportingTsExtensions`, `noEmit`. Relative Importe immer mit `.ts`-Endung. Keine `enum`s, keine Parameter-Properties, keine Namespaces. So läuft `src/core` und `src/gfx/sprites.ts` auch direkt in Node (für das Icon-Skript).
- `src/core/**` importiert weder `phaser` noch DOM-Typen wie `window` oder `document`.
- Einheiten in `core`: Positionen in Spielpixeln, Geschwindigkeit in px/s, Zeit in Sekunden. Fester Schritt `STEP = 1/60`.
- Feste Werte aus der Spec: Kachel 16 px, Sichthöhe 192 px (12 Kacheln), Hochkant-Spielbild 256×192, Breite höchstens 512 px (32 Kacheln), Start mit 5 Leben, 100 Kristalle ergeben ein Extraleben, drei Edelweiß pro Level.
- Alle sichtbaren Texte stehen auf Deutsch in Großbuchstaben in `src/ui-text.ts`. „ß“ wird „SS“.
- Nichts, was an Nintendo erinnert: keine Fragezeichen, Röhren, Pilze, Blumen oder Sterne, keine Mario-Melodien oder -Töne. Der Kristall-Ton ist kein Quartsprung aufwärts wie die Münze.
- Keine fremden Grafik-, Ton- oder Schriftdateien. Alles entsteht im Code.
- Phaser 4 unterscheidet sich von Phaser 3. Vor jeder Phaser-API in `node_modules/phaser/skills/<thema>/SKILL.md` oder `node_modules/phaser/types/phaser.d.ts` nachsehen. Wichtig: `roundPixels` ist standardmäßig aus, `setTintFill` gibt es nicht mehr (`setTint(...).setTintMode(Phaser.TintModes.FILL)`), Canvas-Renderer veraltet (WebGL nutzen).
- Build-Basispfad `/kraxel/`. Seite: `https://philippdererbauer.github.io/kraxel/`.
- Gearbeitet wird auf `main`, weil jeder Push dort veröffentlicht. Gepusht wird nur in Task 1, 10, 11 und 18.
- Jeder Commit endet mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Handy drehen mitten im Spiel**, auch während ein Finger auf dem Steuerkreuz liegt: Das Layout baut sich neu auf, kein Knopf bleibt „hängen“, die Spielfigur läuft nicht von allein weiter. Test in Task 8: `PointerBook.reset()` leert alle Punkte, `Controls.setLayout` ruft es auf.
2. **Finger rutscht über den Rand des Steuerkreuzes hinaus oder ein zweiter Finger kommt dazu:** Die Richtung bleibt am ersten Finger, Springen klappt parallel. Tests in Task 8 (`resolveTouch`).
3. **App im Hintergrund, danach zurück, und 120-Hz-Bildschirme:** kein Zeitsprung, keine Raserei. Tests in Task 9 (`FixedStepper` mit 1000 ms und 8,33 ms). Automatische Pause in Task 16.
4. **Speicher nicht verfügbar** (privater Modus in Safari, voller Speicher, kaputter Eintrag): Das Spiel startet trotzdem mit Standardwerten und stürzt beim Speichern nicht ab. Tests in Task 14 und Task 10 (`loadTuning`).
5. **Ton vor der ersten Berührung oder mit gesperrtem Audio:** `Sfx.play` wirft nie einen Fehler. Test in Task 15.

---

## Dateistruktur

```
index.html                     Meta-Tags, CSS gegen Zoom/Scroll, #game
package.json  tsconfig.json  vite.config.ts
public/manifest.webmanifest  public/icons/icon-180.png icon-192.png icon-512.png
scripts/make-icons.ts          erzeugt die Icons aus Kraxels Sprite (Node, ohne Pakete)
.github/workflows/deploy.yml
src/main.ts                    Phaser.Game, Layout bei Größenänderung, Controls
src/config.ts                  feste Werte (TILE, STEP, VIEW_H …)
src/ui-text.ts                 alle Texte
src/core/types.ts              Cell, Held, InputFrame, Rect, Body, GameEvent, KeyValueStore …
src/core/input-frame.ts        InputSampler (Flanken)
src/core/tuning.ts             Tuning, DEFAULT_TUNING, Ableitungen, loadTuning/saveTuning
src/core/grid.ts               TileGrid
src/core/collide.ts            moveBody, isOnGround, wallAt, overlaps
src/core/level.ts              parseLevel, validateLevel
src/core/player.ts             PlayerState, stepPlayer
src/core/blocks.ts             hitCell, primaryCell
src/core/pickups.ts            Kristalle, Edelweiß, Items
src/core/enemies.ts            Krabbelkäfer, Stachelschnecke
src/core/game.ts               GameState, stepGame, Session, Tod, Ziel
src/core/camera.ts             stepCamera
src/core/stepper.ts            FixedStepper
src/core/save.ts               Speicherstand
src/core/format.ts             formatTime
src/core/test-helpers.ts       nur für Tests
src/input/keyboard.ts          KeyboardSource
src/input/touch.ts             PointerBook, PointerTracker, resolveTouch
src/input/controls.ts          Controls: fasst Tastatur und Touch zusammen
src/view/layout.ts             computeLayout, readSafeInsets
src/gfx/grid-ops.ts            Raster-Helfer aus dem Entwurf
src/gfx/palette.ts             BASE, WORLDS
src/gfx/sprites.ts             alle Sprites als Raster
src/gfx/bake.ts                Raster → RGBA → Canvas
src/gfx/tiles.ts               Boden-Varianten (Autotiling)
src/gfx/background.ts          Parallax-Ebenen
src/gfx/buttons.ts             Steuerkreuz und Knöpfe
src/gfx/font.ts                Pixelschrift 5×7
src/gfx/pixel-text.ts          PixelText (Phaser)
src/gfx/textures.ts            registerTextures (Phaser)
src/render/world-view.ts       Sprites zum GameState, playerFrame
src/audio/sfx.ts               Soundeffekte
src/debug/debug-panel.ts       Debug-Regler (DOM)
src/scenes/BootScene.ts  TitleScene.ts  PlayScene.ts  UiScene.ts  PauseScene.ts  ResultScene.ts  GalleryScene.ts
src/levels/index.ts  src/levels/uebungsplatz.txt  src/levels/1-1.txt
```
Tests liegen jeweils neben der Datei als `*.test.ts`.

---

# Phase A: bis zum Übungsplatz und Testhalt

### Task 1: Projektgerüst, Repo und Veröffentlichung

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `src/config.ts`, `src/config.test.ts`, `.github/workflows/deploy.yml`
- Modify: `.gitignore` (bleibt wie er ist, prüfen)

**Interfaces:**
- Produces: `src/config.ts` mit
  `TILE = 16`, `STEP = 1/60`, `VIEW_H = 192`, `PORTRAIT_VIEW_W = 256`, `MAX_VIEW_W = 512`, `START_LIVES = 5`, `CRYSTALS_PER_LIFE = 100`.
- Produces: npm-Skripte `dev` (`vite --host`), `build` (`vite build`), `preview`, `test` (`vitest run`), `typecheck` (`tsc --noEmit`), `icons` (`node scripts/make-icons.ts`, ab Task 10).

- [ ] **Step 1: Projekt anlegen.** `package.json` (`"type": "module"`, `"engines": {"node": ">=26"}`), Abhängigkeiten aus den Global Constraints installieren. `tsconfig.json` mit den Optionen aus den Global Constraints sowie `"lib": ["ES2023", "DOM"]`, `"types": ["vite/client"]`, `"moduleResolution": "bundler"`. `vite.config.ts`: `base: '/kraxel/'`, `server.host: true`, Vitest mit `environment: 'node'`.
- [ ] **Step 2: Failing test schreiben** in `src/config.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TILE, VIEW_H, PORTRAIT_VIEW_W, MAX_VIEW_W, START_LIVES, CRYSTALS_PER_LIFE } from './config.ts';
describe('config', () => {
  it('hält die Werte aus der Spec', () => {
    expect(TILE).toBe(16);
    expect(VIEW_H / TILE).toBe(12);
    expect(PORTRAIT_VIEW_W / VIEW_H).toBeCloseTo(4 / 3);
    expect(MAX_VIEW_W / TILE).toBe(32);
    expect(START_LIVES).toBe(5);
    expect(CRYSTALS_PER_LIFE).toBe(100);
  });
});
```
- [ ] **Step 3:** `npm test`. Erwartet: FAIL (Modul fehlt).
- [ ] **Step 4: `src/config.ts` schreiben.** `npm test`. Erwartet: PASS.
- [ ] **Step 5: `index.html` und `src/main.ts`.** Meta-Tags:
  `viewport` = `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`, `apple-mobile-web-app-capable=yes`, `mobile-web-app-capable=yes`, `apple-mobile-web-app-status-bar-style=black-translucent`, `apple-mobile-web-app-title=Kraxel`, `theme-color=#1b1230`, `<title>Kraxel</title>`, `lang="de"`.
  CSS: `html,body{margin:0;height:100%;background:#1b1230;overflow:hidden;overscroll-behavior:none;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}` und `#game{position:fixed;inset:0}`. In `main.ts` zusätzlich `gesturestart`, `dblclick` und `contextmenu` per `preventDefault` blocken.
  `main.ts` startet erst einmal ein `Phaser.Game` mit `type: Phaser.WEBGL`, `parent: 'game'`, `pixelArt: true`, `roundPixels: true`, `backgroundColor: '#1b1230'`, `scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 256, height: 192 }`, `input: { keyboard: false, mouse: false, touch: false, gamepad: false }`, `audio: { noAudio: true }` und einer leeren Szene.
- [ ] **Step 6: Prüfen.** `npm run typecheck && npm run build`. Erwartet: keine Fehler, `dist/index.html` verweist auf `/kraxel/assets/…`.
- [ ] **Step 7: Workflow** `.github/workflows/deploy.yml`: bei Push auf `main` und `workflow_dispatch`. Job `build` mit `actions/checkout`, `actions/setup-node` (Node 26, npm-Cache), `npm ci`, `npm test`, `npm run build`, `actions/configure-pages`, `actions/upload-pages-artifact` (`path: dist`). Job `deploy` mit `actions/deploy-pages`, `environment: github-pages`. Rechte: `contents: read, pages: write, id-token: write`, `concurrency: pages`. Die jeweils aktuelle Major-Version der Actions verwenden.
- [ ] **Step 8: Commit.**
```bash
git add -A && git commit -m "Projektgerüst: Vite, TypeScript, Phaser 4, Vitest, Pages-Workflow"
```
- [ ] **Step 9: Repo anlegen, Pages einschalten, pushen.**
```bash
gh repo create PhilippderErbauer/kraxel --public --description "Kraxel – ein Jump'n'Run fürs Handy" --source . --remote origin --push
gh api -X POST repos/PhilippderErbauer/kraxel/pages -f build_type=workflow
gh workflow run deploy.yml
```
- [ ] **Step 10: Prüfen.** Wenn `gh run list --limit 1` „completed success“ meldet: `curl -sI https://philippdererbauer.github.io/kraxel/ | head -1`. Erwartet: `HTTP/2 200`.

---

### Task 2: Pixelgrafik: Werkzeuge, Sprites, Schrift, Kacheln, Galerie

**Files:**
- Create: `src/gfx/grid-ops.ts`, `src/gfx/palette.ts`, `src/gfx/sprites.ts`, `src/gfx/bake.ts`, `src/gfx/background.ts`, `src/gfx/buttons.ts`, `src/gfx/font.ts`, `src/gfx/pixel-text.ts`, `src/gfx/textures.ts`, `src/ui-text.ts`, `src/scenes/BootScene.ts`, `src/scenes/GalleryScene.ts`
- Test: `src/gfx/grid-ops.test.ts`, `src/gfx/bake.test.ts`, `src/gfx/sprites.test.ts`, `src/gfx/font.test.ts`
- Hinweis: `registerTextures` registriert das Tileset erst ab Task 3, wenn `tiles.ts` existiert. Bis dahin zeigt die Galerie die Rohkacheln `groundTop` und `groundFill`.
- Modify: `src/main.ts` (Szenen eintragen)

**Interfaces:**
- Produces (`grid-ops.ts`): `type PixelGrid = string[][]`, `grid(w,h)`, `strs(rows: string[])`, `rect`, `put`, `ell`, `cap`, `line`, `each`, `outline(g): PixelGrid`. Sie übernehmen die Logik aus dem Entwurf, nur typisiert und rein funktional.
- Produces (`palette.ts`): `BASE: Readonly<Record<string,string>>` (Werte aus dem Entwurf), `interface WorldPalette { name; sky: [string,string]; far; farHi; shape: 'mountains'|'icepeaks'|'mesas'|'swamp'|'cloudbanks'|'volcano'; h1; h2; hl; cl; cs; tiles: Record<'G'|'g'|'l'|'D'|'d'|'p', string>; pit?: 'ice'|'sand'|'poison'|'sky'|'lava' }`, `WORLDS: readonly WorldPalette[]` (6 Einträge aus dem Entwurf), `DARK = '#1b1230'`.
- Produces (`sprites.ts`): `type SpriteName` (Union aller Basis-Namen unten), `KRAXEL_FRAMES: readonly SpriteName[]`, `helmName(frame: SpriteName): string` (liefert `frame + 'Helm'`), `buildSprites(): Record<string, PixelGrid>` (alle Basis-Sprites plus je eine Helm-Variante unter `helmName(f)` für jedes `KRAXEL_FRAMES`-Bild).
- Produces (`bake.ts`): `interface RGBAImage { width: number; height: number; data: Uint8ClampedArray }`, `bakeGrid(g: PixelGrid, pal: Readonly<Record<string,string>>): RGBAImage`, `toCanvas(img: RGBAImage): HTMLCanvasElement`.
- Produces (`tiles.ts`): `GROUND_TILES = ['top','topL','topR','topLR','fill','fillL','fillR','fillLR'] as const`, `groundTileIndex(grid: TileGrid, cx, cy): number` (Index in `GROUND_TILES` oder `-1`), `buildGroundTileset(w: WorldPalette): PixelGrid` (128×16, Kacheln in Reihenfolge von `GROUND_TILES`). `TileGrid` kommt aus Task 3. Deshalb werden `tiles.ts`, `groundTileIndex` und ihr Test erst in Task 3 geschrieben.
- Produces (`font.ts`): `GLYPH_W = 5`, `GLYPH_H = 7`, `ADVANCE = 6`, `FONT5: Record<string, readonly string[]>` (7 Zeilen aus `#`/`.` je Zeichen), `FONT3_DIGITS` (aus dem Entwurf), `textWidth(s: string): number`, `missingGlyphs(s: string): string[]`.
- Produces (`pixel-text.ts`): `class PixelText extends Phaser.GameObjects.Container { constructor(scene, x, y, text: string, color: 'white'|'dark'); setText(t: string): this }`. Ein Image pro Zeichen aus dem Font-Atlas.
- Produces (`textures.ts`): `registerTextures(scene: Phaser.Scene, world: number): void`. Registriert jedes Sprite (und für jedes `KRAXEL_FRAMES`-Bild die Helm-Variante) per `scene.textures.addCanvas(name, canvas)`, dazu das Tileset `tiles-w<world>`, die Hintergrund-Ebenen `bg-sky`, `bg-far`, `bg-hills`, `bg-clouds`, die Font-Atlanten `font-white` und `font-dark` (ein Frame pro Zeichen über `texture.add(char, 0, x, y, 5, 7)`) und die Knopf-Texturen.
- Produces (`ui-text.ts`): `TEXT` mit `TAP_TO_START: 'TIPPEN ZUM STARTEN'`, `IOS_HINT: ['FÜR VOLLBILD: TEILEN →', 'ZUM HOME-BILDSCHIRM']`, `PAUSE: 'PAUSE'`, `RESUME: 'WEITER'`, `RESTART: 'NEU STARTEN'`, `SOUND_ON: 'TON: AN'`, `SOUND_OFF: 'TON: AUS'`, `GOAL: 'GIPFEL ERREICHT!'`, `TIME: 'ZEIT'`, `BEST: 'BESTZEIT'`, `NEW_RECORD: 'NEUER REKORD!'`, `AGAIN: 'NOCHMAL'`, `NEXT: 'WEITER'`, `GAME_OVER: 'GAME OVER'`, `CRYSTALS: 'KRISTALLE'`, `EDELWEISS: 'EDELWEISS'`.

**Sprites (alle 16×16, Stil A mit dunkler Umrandung `o`, sofern nicht anders angegeben):**
- Aus dem Entwurf übernehmen: `kraxel`, `kraxelB`, `kraxelJ`, `crate`, `crateUsed`, `crystal`, `edel`, `helm`, `sling`, `glider`, `crampon`, `enzian`, `beetle`, `beetleFlat`, `snail`, `stone` (Felsblock), `cloud` (36×20), `groundTop`, `groundFill`, `iCrystal`, `iEdel`, `iEdelOff`, `iHead`.
- `cross` von 16×32 auf **16×80** verlängern: Kreuz oben wie im Entwurf, Holzmast, Steinsockel unten. Das Ziel ist 5 Kacheln hoch.
- Neu zeichnen, gleiche Proportionen und Farben wie `kraxel`: `kraxelRun1`, `kraxelRun2` (nach vorn gelehnt, weiter Schritt), `kraxelFall` (Füße hängen, Arme hoch), `kraxelSkid` (nach hinten gelehnt), `kraxelWall` (von der Wand weg schauend, eine Hand an der Wand), `kraxelClimb1`, `kraxelClimb2` (Rücken mit Rucksack sichtbar, Hände abwechselnd oben), `kraxelPound` (zusammengerollt), `kraxelHurt`, `kraxelDead` (Augen als Kreuzchen), `kraxelCheer` (ein Arm hoch).
- `KRAXEL_FRAMES` = alle `kraxel*`-Bilder. Für jedes entsteht eine Helm-Variante: Die Mützenzeilen werden durch den Helm aus `helm` ersetzt, in denselben Farben.
- Neu: `cairn` (Steinmännchen aus 4 grauen Steinen, Farben `M`, `m`, `n`), `cairnFlag` (dasselbe mit türkis-gelber Fahne), `debris` (8×8 Felsbrocken für Splitter).

**Hintergrund (`background.ts`, nur Browser):** `buildBackgroundLayers(w: WorldPalette): { sky: HTMLCanvasElement; far: HTMLCanvasElement; hills: HTMLCanvasElement; clouds: HTMLCanvasElement }`. Himmel in Farbstreifen (Stil A) 8×192. Die anderen Ebenen sind 512 px breit, nahtlos wiederholbar und aus `drawBackground` im Entwurf übernommen. Scroll-Faktoren (in Task 9): far 0,15, clouds 0,25 plus langsames Treiben, hills 0,4.

**Knöpfe (`buttons.ts`, nur Browser):** `drawDpad(r: number, held: Pick<Held,'left'|'right'|'up'|'down'>): HTMLCanvasElement` und `drawRoundButton(r: number, kind: 'jump'|'action', pressed: boolean): HTMLCanvasElement`, nach `dpad`, `jumpBtn` und `actBtn` aus dem Entwurf. Gedrückte Richtungen und Knöpfe leuchten auf.

- [ ] **Step 1: Failing tests schreiben.**

```ts
// grid-ops.test.ts
it('outline umrandet nur leere Nachbarn von Farbpixeln', () => {
  const g = strs(['...', '.X.', '...']);
  expect(outline(g).map(r => r.join(''))).toEqual(['.o.', 'oXo', '.o.']);
});
// bake.test.ts
it('bakeGrid setzt Farben und lässt "." transparent', () => {
  const img = bakeGrid(strs(['W.']), { W: '#ffffff' });
  expect([...img.data]).toEqual([255, 255, 255, 255, 0, 0, 0, 0]);
});
it('unbekanntes Zeichen wird magenta', () => {
  expect([...bakeGrid(strs(['?']), {}).data.slice(0, 3)]).toEqual([255, 0, 255]);
});
// sprites.test.ts
const S = buildSprites();
it('alle Sprites sind rechteckig und nutzen nur Zeichen aus BASE', () => {
  for (const [name, g] of Object.entries(S)) {
    expect(new Set(g.map(r => r.length)).size, name).toBe(1);
    for (const ch of g.flat()) expect(ch === '.' || ch in BASE, `${name}: ${ch}`).toBe(true);
  }
});
it('Kraxel-Bilder sind 16×16 und haben eine Helm-Variante', () => {
  for (const f of KRAXEL_FRAMES) {
    expect([S[f].length, S[f][0].length]).toEqual([16, 16]);
    expect([S[helmName(f)].length, S[helmName(f)][0].length]).toEqual([16, 16]);
  }
  expect(KRAXEL_FRAMES).toContain('kraxelPound');
});
it('Gipfelkreuz ist 5 Kacheln hoch', () => { expect(S.cross.length).toBe(80); });
// font.test.ts
it('jeder Text aus ui-text hat Glyphen', () => {
  const all = Object.values(TEXT).flat().join('') + '0123456789:.×';
  expect(missingGlyphs(all)).toEqual([]);
});
it('textWidth = 6 px pro Zeichen minus 1', () => { expect(textWidth('ABC')).toBe(17); });
```
- [ ] **Step 2:** `npm test`. Erwartet: FAIL.
- [ ] **Step 3: Implementieren:** `grid-ops.ts`, `palette.ts`, `bake.ts`, `sprites.ts` (Raster aus dem Entwurf übernehmen, neue zeichnen), `font.ts` (Glyphen für `A–Z`, `ÄÖÜ`, `0–9`, `. , : ! ? - + / ' ( ) × →` und Leerzeichen entwerfen), `ui-text.ts`.
- [ ] **Step 4:** `npm test`. Erwartet: PASS.
- [ ] **Step 5: Browser-Teile:** `background.ts`, `buttons.ts`, `pixel-text.ts`, `textures.ts`, `BootScene` (ruft `registerTextures(this, 1)`, startet danach die nächste Szene) und `GalleryScene`. Die Galerie zeigt jedes Sprite und jede Helm-Variante mit Namen, dazu Tileset, Knöpfe und Schriftprobe. Mit `?galerie` in der Adresse startet `BootScene` die Galerie.
- [ ] **Step 6: Im Browser prüfen.** `npm run dev`, im eingebauten Browser `http://localhost:5173/kraxel/?galerie` öffnen und einen Screenshot machen. Erwartet: alle Sprites scharf, ohne Magenta, Umrandungen dunkel, Konsole ohne Fehler. Neue Kraxel-Bilder mit dem Entwurf vergleichen und Ausreißer nachbessern.
- [ ] **Step 7: Commit.** `git add -A && git commit -m "Pixelgrafik: Sprites, Schrift, Hintergrund, Knöpfe, Galerie"`

---

### Task 3: Level-Format, Raster und Übungsplatz

**Files:**
- Create: `src/core/types.ts`, `src/core/grid.ts`, `src/core/level.ts`, `src/levels/index.ts`, `src/levels/uebungsplatz.txt`, `src/gfx/tiles.ts` (Interfaces siehe Task 2)
- Modify: `src/gfx/textures.ts` (Tileset `tiles-w1` registrieren), `src/scenes/GalleryScene.ts` (Tileset zeigen)
- Test: `src/core/grid.test.ts`, `src/core/level.test.ts`, `src/gfx/tiles.test.ts`

**Interfaces:**
- Produces (`types.ts`):
```ts
export const Cell = { Empty: 0, Ground: 1, Rock: 2, Crate: 3, CrateUsed: 4, HiddenCrate: 5 } as const;
export type Cell = (typeof Cell)[keyof typeof Cell];
export interface Held { left: boolean; right: boolean; up: boolean; down: boolean; jump: boolean; action: boolean }
export interface InputFrame extends Held { jumpPressed: boolean; jumpReleased: boolean; downPressed: boolean; actionPressed: boolean }
export interface Rect { x: number; y: number; w: number; h: number }
export interface Body extends Rect { vx: number; vy: number }
export type ItemKind = 'helm';
export type CrateContent = { kind: 'crystal' } | { kind: 'multi' } | { kind: 'item'; item: ItemKind };
export interface KeyValueStore { getItem(k: string): string | null; setItem(k: string, v: string): void }
export type GameEvent =
  | { type: 'jump' } | { type: 'wallJump' } | { type: 'land' }
  | { type: 'pound' } | { type: 'poundLand'; x: number; y: number }
  | { type: 'bump'; cx: number; cy: number } | { type: 'crateOpen'; cx: number; cy: number }
  | { type: 'rockBreak'; cx: number; cy: number }
  | { type: 'crystal'; x: number; y: number; fromCrate: boolean }
  | { type: 'itemSpawn'; item: ItemKind; cx: number; cy: number } | { type: 'powerUp'; item: ItemKind }
  | { type: 'stomp'; x: number; y: number } | { type: 'enemyDefeated'; x: number; y: number }
  | { type: 'hurt' } | { type: 'death' } | { type: 'respawn' } | { type: 'gameOver' }
  | { type: 'checkpoint'; index: number } | { type: 'edelweiss'; index: number }
  | { type: 'extraLife' } | { type: 'goal'; bonusCrystals: number; extraLife: boolean };
```
- Produces (`grid.ts`): `class TileGrid { readonly width; readonly height; readonly cells: Uint8Array; constructor(width, height, cells?); static fromLevel(l: LevelData): TileGrid; index(cx, cy): number; get(cx, cy): Cell; set(cx, cy, c: Cell): void; isSolid(cx, cy): boolean }`.
  `get` liefert außerhalb links und rechts `Ground` (unsichtbare Levelwand), oben und unten `Empty`. `isSolid` gilt für Ground, Rock, Crate und CrateUsed, **nicht** für HiddenCrate.
- Produces (`level.ts`):
```ts
export type SpawnKind = 'crystal' | 'edelweiss' | 'beetle' | 'snail' | 'checkpoint' | 'goal';
export interface EntitySpawn { kind: SpawnKind; cx: number; cy: number; index: number }
export interface LevelData { id: string; name: string; world: number; width: number; height: number;
  cells: Uint8Array; crates: Map<number, CrateContent>; spawns: EntitySpawn[]; start: { cx: number; cy: number } }
export class LevelError extends Error { line: number }
export function parseLevel(id: string, text: string): LevelData;
export function validateLevel(l: LevelData, o: { requireEdelweiss: boolean; requireGoal: boolean }): string[];
```
- Produces (`levels/index.ts`): `LEVELS: Record<string, string>` (ID → Text, über `import.meta.glob('./*.txt', { query: '?raw', import: 'default', eager: true })`, ID = Dateiname ohne `.txt`).

**Level-Format:** Kopfzeilen `name: …` und `world: …`, dann eine Zeile `---`, dann das Raster. Kürzere Zeilen werden mit `.` aufgefüllt.
| Zeichen | Bedeutung |
|---|---|
| `.` | leer |
| `#` | Boden |
| `B` | Felsblock |
| `K` | Kiste mit Kristall |
| `M` | Mehrfach-Kiste |
| `H` | Kiste mit Item (in M1 immer Helm) |
| `V` | versteckte Kiste mit Kristall |
| `c` | Kristall |
| `1` `2` `3` | Edelweiß (index 0, 1, 2) |
| `k` | Krabbelkäfer |
| `s` | Stachelschnecke |
| `P` | Start |
| `S` | Steinmännchen (index = Reihenfolge von links) |
| `Z` | Gipfelkreuz (Fuß des Mastes) |

`validateLevel` meldet: nicht genau ein `P`; `requireGoal` und nicht genau ein `Z`; `requireEdelweiss` und nicht genau `1`, `2`, `3`; Edelweiß-Nummer doppelt; Spawn oder Start in einer festen Zelle; Gegner ohne festen Boden direkt darunter.

**Übungsplatz** (`uebungsplatz.txt`, ca. 100×16, ohne Ziel und ohne Edelweiß, von links nach rechts): flacher Start; Stufen mit 1, 2, 3 und 4 Kacheln Höhe; Gruben mit 2, 3, 4, 5 und 6 Kacheln Breite und je 3 Kacheln Boden dazwischen; ein Schacht 3 Kacheln breit und 10 hoch für Wandsprünge; Kletterwände mit 2, 3 und 4 Kacheln Höhe; eine Reihe `K M H V` mit Kristallen; Felsblöcke `B` mit einem Kristall darüber, den man nur durch Zerschlagen erreicht; eine Plattform 4 Kacheln über einer `K`-Kiste und einem `B` zum Stampfen.

- [ ] **Step 1: Failing tests.**
```ts
// grid.test.ts
it('außerhalb links/rechts ist Boden, oben/unten leer', () => {
  const g = new TileGrid(4, 3);
  expect(g.get(-1, 1)).toBe(Cell.Ground); expect(g.get(4, 1)).toBe(Cell.Ground);
  expect(g.get(1, -1)).toBe(Cell.Empty); expect(g.get(1, 3)).toBe(Cell.Empty);
});
it('versteckte Kiste ist nicht fest', () => {
  const g = new TileGrid(2, 2); g.set(0, 0, Cell.HiddenCrate);
  expect(g.isSolid(0, 0)).toBe(false);
});
// level.test.ts
const TXT = 'name: Test\nworld: 1\n---\n..K.H.\n.P..1S\n######';
it('liest Raster, Kisten, Spawns und Start', () => {
  const l = parseLevel('t', TXT);
  expect([l.width, l.height, l.name, l.world]).toEqual([6, 3, 'Test', 1]);
  expect(l.cells[2]).toBe(Cell.Crate);
  expect(l.crates.get(4)).toEqual({ kind: 'item', item: 'helm' });
  expect(l.start).toEqual({ cx: 1, cy: 1 });
  expect(l.spawns).toContainEqual({ kind: 'edelweiss', cx: 4, cy: 1, index: 0 });
  expect(l.spawns).toContainEqual({ kind: 'checkpoint', cx: 5, cy: 1, index: 0 });
});
it('unbekanntes Zeichen wirft LevelError mit Zeilennummer', () => {
  expect(() => parseLevel('t', 'name: x\nworld: 1\n---\n..\n.?')).toThrowError(LevelError);
  try { parseLevel('t', 'name: x\nworld: 1\n---\n..\n.?'); } catch (e) { expect((e as LevelError).line).toBe(5); }
});
it('validateLevel meldet fehlendes Ziel und Edelweiß', () => {
  const p = validateLevel(parseLevel('t', TXT), { requireEdelweiss: true, requireGoal: true });
  expect(p.length).toBeGreaterThanOrEqual(2);
});
it('Übungsplatz ist gültig', () => {
  expect(validateLevel(parseLevel('uebungsplatz', LEVELS.uebungsplatz), { requireEdelweiss: false, requireGoal: false })).toEqual([]);
});
// tiles.test.ts
it('Boden mit Luft darüber und links ist topL, darunter fillL', () => {
  const g = TileGrid.fromLevel(parseLevel('t', 'name: t\nworld: 1\n---\nP.....\n..###.\n..###.'));
  expect(GROUND_TILES[groundTileIndex(g, 2, 1)]).toBe('topL');
  expect(GROUND_TILES[groundTileIndex(g, 3, 2)]).toBe('fill');
  expect(GROUND_TILES[groundTileIndex(g, 4, 2)]).toBe('fillR');
  expect(groundTileIndex(g, 0, 0)).toBe(-1);
});
```
- [ ] **Step 2:** `npm test`. Erwartet: FAIL.
- [ ] **Step 3: Implementieren:** `types.ts`, `grid.ts`, `level.ts`, `levels/index.ts`, `uebungsplatz.txt`, `groundTileIndex` und `buildGroundTileset`. Seitenränder entstehen nur dort, wo der Nachbar kein Boden ist. Außerhalb des Levels zählt als Boden, damit es am Levelrand keine Kante gibt.
- [ ] **Step 4:** `npm test`. Erwartet: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "Level-Format, Kachelraster, Übungsplatz"`

---

### Task 4: Kollision

**Files:**
- Create: `src/core/collide.ts`
- Test: `src/core/collide.test.ts`

**Interfaces:**
- Consumes: `TileGrid`, `Body`, `Cell` (Task 3)
- Produces:
```ts
export interface MoveResult { left: boolean; right: boolean; up: boolean; down: boolean; headCells: Array<[number, number]> }
export function moveBody(body: Body, dt: number, grid: TileGrid, cornerCorrection?: number): MoveResult;
export function isOnGround(body: Body, grid: TileGrid): boolean;      // 1 px darunter fest
export function wallAt(body: Body, grid: TileGrid, dir: -1 | 1): boolean; // 1 px seitlich fest
export function overlaps(a: Rect, b: Rect): boolean;
```
Ablauf: erst X, dann Y bewegen. Bei mehr als 8 px Weg pro Achse in Teilschritten. Bei Kontakt bündig an die Zellkante setzen und die Geschwindigkeit dieser Achse auf 0. `HiddenCrate` ist nur fest, wenn sich der Körper nach oben bewegt und seine Oberkante vor dem Schritt auf oder unter der Unterkante der Zelle lag. Kopfkontakt: `headCells` enthält alle festen (bzw. versteckten) Zellen der Reihe darüber, die der Körper waagerecht überlappt.
Kantenkorrektur: Überlappt der Körper beim Aufwärtsstoß eine feste Zelle nur auf einer Seite um höchstens `cornerCorrection` px, und ist die Zelle daneben frei, wird er seitlich verschoben. Er steigt dann weiter, und es gibt keinen Kopfkontakt.

- [ ] **Step 1: Failing tests.** `gridFrom` kommt in Step 3 nach `src/core/test-helpers.ts`: `gridFrom(rows: string[]): TileGrid` mit `#` Ground, `B` Rock, `K` Crate, `U` CrateUsed, `V` HiddenCrate, alles andere leer.
```ts
const b = (x: number, y: number, vx = 0, vy = 0): Body => ({ x, y, w: 10, h: 14, vx, vy });
it('landet bündig auf dem Boden', () => {
  const g = gridFrom(['....', '....', '####']); const body = b(3, 16, 0, 300);
  const r = moveBody(body, 1 / 60, g);
  expect(r.down).toBe(true); expect(body.y).toBe(32 - 14); expect(body.vy).toBe(0);
});
it('Wand stoppt seitlich', () => {
  const g = gridFrom(['..#', '..#', '###']); const body = b(18, 18, 300, 0);
  expect(moveBody(body, 1 / 60, g).right).toBe(true); expect(body.x).toBe(32 - 10);
});
it('linker Levelrand blockiert', () => {
  const g = gridFrom(['....', '####']); const body = b(1, 2, -300, 0);
  moveBody(body, 1 / 60, g); expect(body.x).toBe(0);
});
it('schnelles Fallen tunnelt nicht durch eine Kachel', () => {
  const g = gridFrom(['....', '....', '....', '####', '....']); const body = b(3, 0, 0, 1200);
  for (let i = 0; i < 10; i++) moveBody(body, 1 / 60, g);
  expect(body.y + body.h).toBe(48);
});
it('Kopfstoß meldet Zelle', () => {
  const g = gridFrom(['.K..', '....', '....', '####']); const body = b(18, 20, 0, -300);
  let hit: MoveResult | undefined;
  for (let i = 0; i < 10 && !hit?.up; i++) hit = moveBody(body, 1 / 60, g);
  expect(hit!.headCells).toEqual([[1, 0]]);
});
it('versteckte Kiste: seitlich und von oben durchlässig, von unten fest', () => {
  const g = gridFrom(['....', '.V..', '....', '####']);
  const side = b(4, 16, 300, 0); moveBody(side, 1 / 60, g); expect(side.x).toBe(9);
  const fall = b(18, 0, 0, 200); for (let i = 0; i < 20; i++) moveBody(fall, 1 / 60, g);
  expect(fall.y + fall.h).toBe(48);
  const up = b(18, 34, 0, -300); let r: MoveResult | undefined;
  for (let i = 0; i < 10 && !r?.up; i++) r = moveBody(up, 1 / 60, g);
  expect(r!.headCells).toEqual([[1, 1]]);
});
it('Kantenkorrektur bei 3 px, Kopfstoß bei 6 px', () => {
  const g = gridFrom(['.....K....', '..........', '..........', '##########']);
  const a = b(96 - 3, 20, 0, -300); let ra: MoveResult | undefined;
  for (let i = 0; i < 8; i++) ra = moveBody(a, 1 / 60, g, 4);
  expect(a.x).toBe(96); expect(a.y).toBeLessThan(16);
  const c = b(96 - 6, 20, 0, -300); let rc: MoveResult | undefined;
  for (let i = 0; i < 8 && !rc?.up; i++) rc = moveBody(c, 1 / 60, g, 4);
  expect(rc!.headCells).toEqual([[5, 0]]);
});
```
- [ ] **Step 2:** `npm test`. Erwartet: FAIL.
- [ ] **Step 3: `collide.ts` und `gridFrom` in `test-helpers.ts` schreiben.**
- [ ] **Step 4:** `npm test`. Erwartet: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "Kollision mit dem Kachelraster"`

---

### Task 5: Kraxels Grundbewegung

**Files:**
- Create: `src/core/tuning.ts`, `src/core/input-frame.ts`, `src/core/player.ts`
- Modify: `src/core/test-helpers.ts`
- Test: `src/core/input-frame.test.ts`, `src/core/player.test.ts`

**Interfaces:**
- Produces (`tuning.ts`):
```ts
export interface Tuning {
  walkSpeed: number; runSpeed: number; runDelay: number; runRamp: number;
  groundAccel: number; groundDecel: number; skidDecel: number; airAccel: number; airDecel: number;
  jumpHeight: number; runJumpHeight: number; timeToApex: number; jumpCutSpeed: number;
  fallGravityMul: number; apexGravityMul: number; apexThreshold: number; maxFallSpeed: number;
  coyoteTime: number; jumpBuffer: number; cornerCorrection: number;
  wallSlideSpeed: number; wallJumpSpeedX: number; wallJumpSpeedY: number; wallJumpLock: number;
  climbSpeed: number; climbBudget: number; mantleSpeedY: number;
  poundHang: number; poundSpeed: number; poundRecover: number;
  stompBounce: number; stompBounceHeld: number; hurtInvuln: number;
}
export const DEFAULT_TUNING: Readonly<Tuning>;
export function jumpGravity(t: Tuning): number;                    // 2 * jumpHeight / timeToApex²
export function jumpVelocity(t: Tuning, running: boolean): number; // sqrt(2 * g * (running ? runJumpHeight : jumpHeight))
```
  Startwerte (aus Spec 5.2 in px umgerechnet): `walkSpeed 96, runSpeed 152, runDelay 0.6, runRamp 0.4, groundAccel 600, groundDecel 900, skidDecel 1400, airAccel 450, airDecel 200, jumpHeight 64, runJumpHeight 80, timeToApex 0.38, jumpCutSpeed 206, fallGravityMul 1.6, apexGravityMul 0.5, apexThreshold 40, maxFallSpeed 270, coyoteTime 0.1, jumpBuffer 0.12, cornerCorrection 4, wallSlideSpeed 60, wallJumpSpeedX 140, wallJumpSpeedY 300, wallJumpLock 0.15, climbSpeed 80, climbBudget 32, mantleSpeedY 150, poundHang 0.15, poundSpeed 420, poundRecover 0.12, stompBounce 250, stompBounceHeld 340, hurtInvuln 1.5`.
- Produces (`input-frame.ts`): `emptyHeld(): Held`, `class InputSampler { sample(h: Held): InputFrame }`. `jumpPressed`, `downPressed` und `actionPressed` sind nur im ersten Schritt nach dem Drücken wahr, `jumpReleased` nur im ersten Schritt nach dem Loslassen.
- Produces (`player.ts`):
```ts
export type PlayerMode = 'normal' | 'wallSlide' | 'climb' | 'poundHang' | 'pound' | 'poundRecover' | 'dead' | 'goal';
export type PlayerAnim = 'idle' | 'walk' | 'run' | 'skid' | 'jump' | 'fall' | 'wallSlide' | 'climb' | 'pound' | 'hurt' | 'dead' | 'cheer';
export const PLAYER_W = 10, PLAYER_H = 14;
export interface PlayerState {
  body: Body; facing: -1 | 1; mode: PlayerMode; modeTimer: number;
  grounded: boolean; coyote: number; jumpBuffer: number; jumpRising: boolean;
  runTimer: number; speedCap: number;
  wallDir: -1 | 0 | 1; wallLock: number; climbLeft: number;
  helm: boolean; invuln: number; anim: PlayerAnim; animTime: number;
}
export interface PlayerStepResult { events: GameEvent[]; headCells: Array<[number, number]>; poundCells: Array<[number, number]> }
export function createPlayer(cx: number, cy: number): PlayerState;  // Füße auf Unterkante der Zelle, waagerecht mittig
export function stepPlayer(p: PlayerState, input: InputFrame, grid: TileGrid, t: Tuning, dt: number): PlayerStepResult;
```
- Produces (`test-helpers.ts`): `held(p?: Partial<Held>): Held`, `type Script = Array<[Partial<Held>, number]>` (Eingabe, Anzahl Schritte), `runPlayer(p, grid, script, t?): { events: GameEvent[]; headCells: Array<[number, number]>; minY: number; maxVy: number }`.

Verhalten in diesem Task (nur `mode: 'normal'`):
- Boden: Ziel-Tempo `speedCap`. Es ist `walkSpeed`, steigt nach `runDelay` s ununterbrochenem Halten am Boden in `runRamp` s linear auf `runSpeed` und fällt beim Loslassen oder Umdrehen zurück. Beschleunigen mit `groundAccel`, ohne Eingabe bremsen mit `groundDecel`. Gegen die Laufrichtung bremsen mit `skidDecel` und `anim = 'skid'`, solange |vx| > 30.
- Luft: `airAccel` auf höchstens `max(walkSpeed, |vx beim Absprung|)`, ohne Eingabe `airDecel`.
- Springen: bei `jumpPressed` oder offenem Puffer (`jumpBuffer` > 0), wenn `grounded` oder `coyote` > 0. Dann `vy = -jumpVelocity(t, |vx| > walkSpeed + 1)`, Event `jump`, `jumpRising = true`. Bei `jumpReleased` und `vy < -jumpCutSpeed`: `vy = -jumpCutSpeed`. Wird ein gepufferter Sprung ausgeführt, obwohl Springen schon losgelassen ist, gilt der Cut sofort (kurz getippt heißt kurz gesprungen).
- Schwerkraft `g = jumpGravity(t)`. Beim Fallen (`vy > 0`) mal `fallGravityMul`. Bei |vy| < `apexThreshold` mit gehaltenem Sprung mal `apexGravityMul`. `vy` höchstens `maxFallSpeed`.
- `moveBody(..., t.cornerCorrection)`. Landung erzeugt Event `land`. `anim` passend: `idle`, `walk`, `run`, `skid`, `jump`, `fall`.

- [ ] **Step 1: Failing tests.**
```ts
// input-frame.test.ts
it('Flanken nur im ersten Schritt', () => {
  const s = new InputSampler();
  expect(s.sample(held({ jump: true })).jumpPressed).toBe(true);
  expect(s.sample(held({ jump: true })).jumpPressed).toBe(false);
  expect(s.sample(held()).jumpReleased).toBe(true);
});
// player.test.ts – Boden: Reihe 10, Kraxel startet bei Zelle (3, 9)
const FLAT = gridFrom([...Array(10).fill('.'.repeat(40)), '#'.repeat(40)]);
const start = () => createPlayer(3, 9);
it('Gehtempo nach 0,3 s', () => { const p = start(); runPlayer(p, FLAT, [[{ right: true }, 18]]); expect(p.body.vx).toBeCloseTo(96, 0); });
it('Renntempo erst nach runDelay + runRamp', () => {
  const p = start(); runPlayer(p, FLAT, [[{ right: true }, 30]]); expect(p.body.vx).toBeLessThanOrEqual(96.5);
  runPlayer(p, FLAT, [[{ right: true }, 42]]); expect(p.body.vx).toBeCloseTo(152, 0);
});
it('Loslassen bremst in 0,2 s auf 0', () => { const p = start(); runPlayer(p, FLAT, [[{ right: true }, 18], [{}, 12]]); expect(p.body.vx).toBe(0); });
it('Umdrehen aus vollem Lauf zeigt skid', () => { const p = start(); runPlayer(p, FLAT, [[{ right: true }, 72], [{ left: true }, 2]]); expect(p.anim).toBe('skid'); });
it('voller Sprung aus dem Stand: ca. 4 Kacheln', () => {
  const p = start(); const y0 = p.body.y; const r = runPlayer(p, FLAT, [[{ jump: true }, 60]]);
  expect(y0 - r.minY).toBeGreaterThanOrEqual(58); expect(y0 - r.minY).toBeLessThanOrEqual(70);
  expect(r.events).toContainEqual({ type: 'jump' });
});
it('Sprung mit Renntempo: ca. 5 Kacheln', () => {
  const p = start(); runPlayer(p, FLAT, [[{ right: true }, 72]]); const y0 = p.body.y;
  const r = runPlayer(p, FLAT, [[{ right: true, jump: true }, 60]]);
  expect(y0 - r.minY).toBeGreaterThanOrEqual(74); expect(y0 - r.minY).toBeLessThanOrEqual(86);
});
it('kurz getippt: 1,3 bis 2,2 Kacheln', () => {
  const p = start(); const y0 = p.body.y; const r = runPlayer(p, FLAT, [[{ jump: true }, 1], [{}, 60]]);
  expect(y0 - r.minY).toBeGreaterThanOrEqual(21); expect(y0 - r.minY).toBeLessThanOrEqual(35);
});
// Kante: Boden nur bis Spalte 5, danach Abgrund
const LEDGE = gridFrom([...Array(10).fill('.'.repeat(40)), '######' + '.'.repeat(34), '.'.repeat(40)]);
function walkOffThenJump(wait: number): GameEvent[] {
  const p = createPlayer(3, 9); let n = 0;
  while (p.grounded && n++ < 120) runPlayer(p, LEDGE, [[{ right: true }, 1]]);
  return runPlayer(p, LEDGE, [[{ right: true }, wait], [{ right: true, jump: true }, 1]]).events;
}
it('Coyote: nach 5 Schritten geht Springen, nach 8 nicht', () => {
  expect(walkOffThenJump(4)).toContainEqual({ type: 'jump' });
  expect(walkOffThenJump(8)).not.toContainEqual({ type: 'jump' });
});
it('Sprungpuffer: 6 Schritte vor der Landung ja, 10 nicht', () => {
  const landStep = (() => { const p = createPlayer(3, 2); let i = 0; while (!p.grounded) { runPlayer(p, FLAT, [[{}, 1]]); i++; } return i; })();
  const tryAt = (before: number) => { const p = createPlayer(3, 2);
    return runPlayer(p, FLAT, [[{}, landStep - before], [{ jump: true }, 1], [{}, before + 2]]).events; };
  expect(tryAt(6)).toContainEqual({ type: 'jump' });
  expect(tryAt(10)).not.toContainEqual({ type: 'jump' });
});
it('Fallen ist auf maxFallSpeed begrenzt', () => {
  const deep = gridFrom([...Array(30).fill('.'.repeat(8)), '#'.repeat(8)]);
  expect(runPlayer(createPlayer(3, 0), deep, [[{}, 120]]).maxVy).toBeLessThanOrEqual(270);
});
it('Kopfstoß unter Kiste meldet headCells', () => {
  const g = gridFrom(['..........', '...K......', '..........', '..........', '..........', '##########']);
  const p = createPlayer(3, 4); expect(runPlayer(p, g, [[{ jump: true }, 30]]).headCells).toContainEqual([3, 1]);
});
```
- [ ] **Step 2:** `npm test`. Erwartet: FAIL.
- [ ] **Step 3: Implementieren:** `tuning.ts`, `input-frame.ts`, `player.ts` (nur `normal`), Helfer in `test-helpers.ts`. `runPlayer` füttert je Schritt `InputSampler.sample(held(...))` und `STEP`.
- [ ] **Step 4:** `npm test`. Erwartet: PASS. Liegen die Sprunghöhen knapp daneben, `stepPlayer` korrigieren (Reihenfolge Schwerkraft/Bewegung), nicht die Testgrenzen.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "Kraxel: Laufen, Rennen, Springen mit Coyote Time und Sprungpuffer"`

---

### Task 6: Wand, Kraxeln, Stampfen

**Files:**
- Modify: `src/core/player.ts`
- Test: `src/core/player-moves.test.ts`

**Interfaces:**
- Consumes/Produces: wie Task 5. Neue Modi werden aktiv, die Signatur bleibt gleich.

Verhalten:
- **Wandrutschen:** in der Luft, `vy > 0`, `wallAt(body, dir)` und Richtung `dir` gedrückt ergibt `mode = 'wallSlide'`, `wallDir = dir`, `vy` höchstens `wallSlideSpeed`. Endet ohne Wand, ohne Eingabe oder am Boden.
- **Wandsprung:** `jumpPressed` (oder Puffer) bei `wallSlide` oder `climb` ergibt `vx = -wallDir * wallJumpSpeedX`, `vy = -wallJumpSpeedY`, `wallLock = wallJumpLock`, Event `wallJump`, `facing = -wallDir`. Die Werte überschreiben die Beschleunigung dieses Schritts (vx ist danach exakt `-wallDir * wallJumpSpeedX`), danach wirkt die Schwerkraft. Solange `wallLock > 0`, wirkt Eingabe zur alten Wand nur mit 30 % von `airAccel`.
- **Kraxeln:** `up` gedrückt, `wallAt(body, dir)`, Richtung oder Blick zur Wand und `climbLeft > 0` ergibt `mode = 'climb'`, `vy = -climbSpeed`. `climbLeft` sinkt um den gekletterten Weg. Bei 0 folgt `wallSlide` (falls zur Wand gedrückt), sonst `normal`. Am Boden wird `climbLeft = climbBudget`. Ist die Wandzelle auf Höhe der Körpermitte frei, ist die Wand zu Ende: `vy = -mantleSpeedY`, `vx = wallDir * 60`, `mode = 'normal'`.
- **Stampfen:** `downPressed` in der Luft in `normal` (nicht `wallSlide`, nicht `climb`) ergibt `mode = 'poundHang'` für `poundHang` s mit vx = vy = 0, Event `pound`. Der Wechsel passiert vor der Bewegung, Kraxel steht also schon im Schritt des Drückens still. Danach `mode = 'pound'`, `vy = poundSpeed`, ohne Fall-Begrenzung, ohne Seitensteuerung. Landung: Event `poundLand` (Mitte der Füße), `poundCells` = feste Zellen direkt unter dem Körper, `mode = 'poundRecover'` für `poundRecover` s, danach `normal`.

- [ ] **Step 1: Failing tests.**
```ts
// Wand rechts ab Spalte 6 (hoch), Boden Reihe 15
const WALL = gridFrom([...Array(15).fill('......#####'), '###########']);
it('Wandrutschen begrenzt das Fallen', () => {
  const p = createPlayer(4, 3); p.body.x = 96 - PLAYER_W; p.grounded = false;
  runPlayer(p, WALL, [[{ right: true }, 40]]);
  expect(p.mode).toBe('wallSlide'); expect(p.body.vy).toBeLessThanOrEqual(60);
});
it('Wandsprung stößt weg und sperrt kurz das Zurücksteuern', () => {
  const p = createPlayer(4, 3); p.body.x = 96 - PLAYER_W;
  const r = runPlayer(p, WALL, [[{ right: true }, 30], [{ right: true, jump: true }, 1]]);
  expect(r.events).toContainEqual({ type: 'wallJump' });
  expect(p.body.vx).toBe(-140); expect(p.body.vy).toBeGreaterThanOrEqual(-300); expect(p.body.vy).toBeLessThan(-280);
  runPlayer(p, WALL, [[{ right: true, jump: true }, 5]]); expect(p.body.vx).toBeLessThan(0);
});
it('Kraxeln: höchstens climbBudget hoch, dann abrutschen', () => {
  const p = createPlayer(4, 14); p.body.x = 96 - PLAYER_W; const y0 = p.body.y;
  const r = runPlayer(p, WALL, [[{ right: true, up: true }, 90]]);
  expect(y0 - r.minY).toBeGreaterThanOrEqual(30); expect(y0 - r.minY).toBeLessThanOrEqual(34);
});
it('Kraft füllt sich erst am Boden wieder', () => {
  const p = createPlayer(4, 14); p.body.x = 96 - PLAYER_W;
  runPlayer(p, WALL, [[{ right: true, up: true }, 40]]); const yMid = p.body.y;
  const r = runPlayer(p, WALL, [[{ right: true }, 2], [{ right: true, up: true }, 20]]);
  expect(r.minY).toBeGreaterThanOrEqual(yMid);
  runPlayer(p, WALL, [[{}, 120]]); expect(p.climbLeft).toBe(32);
});
it('über die Wandkante klettern hievt Kraxel hinauf', () => {
  const g = gridFrom(['....................', '....................', '......##############', '......##############', '####################']);
  const p = createPlayer(4, 3); p.body.x = 96 - PLAYER_W;
  runPlayer(p, g, [[{ right: true, up: true }, 60], [{ right: true }, 20]]);
  expect(p.grounded).toBe(true); expect(p.body.y + PLAYER_H).toBe(32);
});
it('Stampfen: Innehalten, schneller Fall, poundLand mit Zellen', () => {
  const p = createPlayer(3, 9); runPlayer(p, FLAT, [[{ jump: true }, 20]]);
  const pos = { x: p.body.x, y: p.body.y };
  const r1 = runPlayer(p, FLAT, [[{ down: true }, 1], [{}, 8]]);
  expect(r1.events).toContainEqual({ type: 'pound' });
  expect(p.body.x).toBe(pos.x); expect(p.body.y).toBeCloseTo(pos.y, 5);
  const r2 = runPlayer(p, FLAT, [[{}, 40]]);
  expect(r2.events.some(e => e.type === 'poundLand')).toBe(true);
});
it('kein Stampfen am Boden', () => {
  const p = createPlayer(3, 9); expect(runPlayer(p, FLAT, [[{ down: true }, 5]]).events).not.toContainEqual({ type: 'pound' });
});
```
  `FLAT` aus Task 5 in `test-helpers.ts` verschieben und exportieren. `runPlayer` sammelt `poundCells` mit ein (zusätzliches Rückgabefeld `poundCells`), für Task 7.
- [ ] **Step 2:** `npm test`. Erwartet: FAIL.
- [ ] **Step 3: `player.ts` erweitern.**
- [ ] **Step 4:** `npm test`. Erwartet: PASS, auch alle Tests aus Task 5.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "Kraxel: Wandrutschen, Wandsprung, Kraxeln, Stampfen"`

---

### Task 7: Kisten, Felsblöcke, Kristalle und Helm

**Files:**
- Create: `src/core/blocks.ts`, `src/core/pickups.ts`, `src/core/game.ts`
- Modify: `src/core/test-helpers.ts`
- Test: `src/core/blocks.test.ts`, `src/core/pickups.test.ts`

**Interfaces:**
- Consumes: `stepPlayer`, `PlayerStepResult` (Task 5/6), `parseLevel`, `TileGrid`, `moveBody`, `overlaps`
- Produces (`game.ts`, in Task 12/13 erweitert):
```ts
export type Phase = 'playing' | 'dying' | 'goal' | 'gameOver';
export interface Session { lives: number; crystals: number; time: number; edelweiss: [boolean, boolean, boolean] }
export interface GameState {
  level: LevelData; grid: TileGrid; crates: Map<number, CrateContent>;
  multi: Map<number, { left: number; timer: number }>;
  player: PlayerState; pickups: PickupState[];
  checkpoint: number; phase: Phase; phaseTimer: number; session: Session; startSession: Session;
}
export interface ViewWindow { x: number; w: number }
export function createSession(): Session;  // lives START_LIVES, crystals 0, time 0, edelweiss [false,false,false]
export function createGame(level: LevelData, session?: Session): GameState;
export function stepGame(s: GameState, input: InputFrame, t: Tuning, view: ViewWindow, dt: number): GameEvent[];
export function addCrystals(s: GameState, n: number): GameEvent[];
```
- Produces (`blocks.ts`): `primaryCell(body: Body, cells: Array<[number, number]>): [number, number] | null` (die Zelle unter der Körpermitte, sonst die mit der größten Überlappung), `hitCell(s: GameState, cx: number, cy: number, from: 'below' | 'above'): GameEvent[]`, `stepBlocks(s: GameState, dt: number): void` (lässt Mehrfach-Fenster ablaufen).
- Produces (`pickups.ts`):
```ts
export type PickupKind = 'crystal' | 'edelweiss' | 'item';
export interface PickupState { kind: PickupKind; body: Body; index: number; item: ItemKind | null; emerge: number; taken: boolean; dir: -1 | 1 }
export function createPickup(sp: EntitySpawn): PickupState;              // für 'crystal' und 'edelweiss'
export function spawnItem(item: ItemKind, cx: number, cy: number): PickupState; // taucht in 0,5 s aus der Kiste auf
export function stepPickups(list: PickupState[], grid: TileGrid, dt: number): void;
export function collectPickups(s: GameState): GameEvent[];
```
- Produces (`test-helpers.ts`): `gameFrom(rows: string[], session?: Session): GameState` (setzt Kopfzeilen davor), `runGame(s, script, t?): GameEvent[]` (Sichtfenster `{ x: 0, w: 512 }`).

Regeln:
- `stepGame`: Ist `phase !== 'playing'`, bleibt alles stehen (Task 13 ergänzt). Sonst laufen nacheinander `stepPlayer`, Treffer auf `primaryCell(headCells)` von unten und auf `primaryCell(poundCells)` von oben, `stepBlocks`, `stepPickups`, `collectPickups`, `session.time += dt`. **Vorläufig:** Ist der Körper unterhalb des Levels, kommt Kraxel zurück an den Start. Task 13 ersetzt das.
- `hitCell` von unten: Crate oder HiddenCrate mit `crystal` wird CrateUsed, dazu `addCrystals(1)`, `crateOpen` und `crystal` mit `fromCrate: true`. Mit `multi`: Beim ersten Stoß startet ein Fenster von 4 s. Jeder Stoß gibt 1 Kristall, höchstens 10. Nach dem 10. Kristall oder nach Ablauf des Fensters wird die Kiste CrateUsed. Mit `item`: Ist `player.helm` falsch, erscheint ein Helm. Sonst erscheint das eingetragene Item, in M1 also ebenfalls ein Helm. Die Kiste wird CrateUsed, Events `crateOpen` und `itemSpawn`. Rock mit Helm wird Empty (`rockBreak`), ohne Helm gibt es nur `bump`. Ground und CrateUsed geben `bump`.
- `hitCell` von oben (Stampfen): Kisten wie von unten. Rock wird immer Empty (`rockBreak`). Ground und CrateUsed lösen nichts aus.
- Items: Sie tauchen in 0,5 s 16 px nach oben aus der Kiste auf und haben dabei keine Kollision. Danach laufen sie mit 50 px/s und Schwerkraft, drehen an Wänden um und starten nach rechts.
- Einsammeln (Überlappung mit dem Spielerkörper): Kristall gibt `addCrystals(1)` und `crystal` mit `fromCrate: false`. Helm ohne Helm setzt `player.helm = true` (`powerUp`). Helm mit Helm gibt `addCrystals(10)`. Edelweiß setzt `session.edelweiss[index] = true` (`edelweiss`).
- `addCrystals`: Bei ≥ 100 Kristallen werden 100 abgezogen, dazu `lives + 1` und `extraLife`.

- [ ] **Step 1: Failing tests.**
```ts
const CRATE = ['..........', '....K.H...', '..........', '..........', '....P.....', '##########'];
it('Kiste mit Kristall: Kopfstoß öffnet sie', () => {
  const s = gameFrom(CRATE); const ev = runGame(s, [[{ jump: true }, 30]]);
  expect(s.grid.get(4, 1)).toBe(Cell.CrateUsed); expect(s.session.crystals).toBe(1);
  expect(ev.map(e => e.type)).toEqual(expect.arrayContaining(['crateOpen', 'crystal']));
});
it('Mehrfach-Kiste: höchstens 10 Kristalle', () => {
  const s = gameFrom(CRATE.map(r => r.replace('K', 'M')));
  for (let i = 0; i < 12; i++) hitCell(s, 4, 1, 'below');
  expect(s.session.crystals).toBe(10); expect(s.grid.get(4, 1)).toBe(Cell.CrateUsed);
});
it('Mehrfach-Kiste: Fenster läuft nach 4 s ab', () => {
  const s = gameFrom(CRATE.map(r => r.replace('K', 'M')));
  hitCell(s, 4, 1, 'below'); runGame(s, [[{}, 246]]);
  expect(s.grid.get(4, 1)).toBe(Cell.CrateUsed);
});
it('Item-Kiste ohne Helm gibt Helm, Einsammeln setzt helm', () => {
  const s = gameFrom(CRATE); const ev = hitCell(s, 6, 1, 'below');
  expect(ev).toContainEqual({ type: 'itemSpawn', item: 'helm', cx: 6, cy: 1 });
  const item = s.pickups.find(p => p.kind === 'item')!; runGame(s, [[{}, 31]]);
  s.player.body.x = item.body.x; s.player.body.y = item.body.y;
  expect(collectPickups(s)).toContainEqual({ type: 'powerUp', item: 'helm' }); expect(s.player.helm).toBe(true);
});
it('Helm mit Helm einsammeln gibt 10 Kristalle', () => {
  const s = gameFrom(CRATE); s.player.helm = true; hitCell(s, 6, 1, 'below'); runGame(s, [[{}, 31]]);
  const item = s.pickups.find(p => p.kind === 'item')!; s.player.body.x = item.body.x; s.player.body.y = item.body.y;
  collectPickups(s); expect(s.session.crystals).toBe(10);
});
it('Felsblock: ohne Helm bump, mit Helm zerbrochen, Stampfen bricht immer', () => {
  const s = gameFrom(CRATE.map(r => r.replace('K', 'B')));
  expect(hitCell(s, 4, 1, 'below')).toEqual([{ type: 'bump', cx: 4, cy: 1 }]); expect(s.grid.get(4, 1)).toBe(Cell.Rock);
  s.player.helm = true; hitCell(s, 4, 1, 'below'); expect(s.grid.get(4, 1)).toBe(Cell.Empty);
  const s2 = gameFrom(CRATE.map(r => r.replace('K', 'B'))); hitCell(s2, 4, 1, 'above'); expect(s2.grid.get(4, 1)).toBe(Cell.Empty);
});
it('versteckte Kiste wird beim Treffer sichtbar und gibt Kristall', () => {
  const s = gameFrom(CRATE.map(r => r.replace('K', 'V'))); runGame(s, [[{ jump: true }, 30]]);
  expect(s.grid.get(4, 1)).toBe(Cell.CrateUsed); expect(s.session.crystals).toBe(1);
});
it('Stampfen auf eine Kiste öffnet sie', () => {
  const s = gameFrom(CRATE); expect(hitCell(s, 4, 1, 'above').map(e => e.type)).toContain('crateOpen');
});
it('100 Kristalle ergeben ein Extraleben', () => {
  const s = gameFrom(CRATE); s.session.crystals = 99;
  expect(addCrystals(s, 1)).toContainEqual({ type: 'extraLife' });
  expect([s.session.crystals, s.session.lives]).toEqual([0, 6]);
});
it('Kristall im Level einsammeln', () => {
  const s = gameFrom(['......', '.Pc...', '######']); runGame(s, [[{ right: true }, 30]]);
  expect(s.session.crystals).toBe(1);
});
```
- [ ] **Step 2:** `npm test`. Erwartet: FAIL.
- [ ] **Step 3: Implementieren:** `blocks.ts`, `pickups.ts`, `game.ts`, Helfer.
- [ ] **Step 4:** `npm test`. Erwartet: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "Kisten, Felsblöcke, Kristalle und Helm"`

---

### Task 8: Eingabe und Bildschirm-Aufteilung

**Files:**
- Create: `src/view/layout.ts`, `src/input/keyboard.ts`, `src/input/touch.ts`, `src/input/controls.ts`
- Test: `src/view/layout.test.ts`, `src/input/touch.test.ts`, `src/input/keyboard.test.ts`

**Interfaces:**
- Produces (`layout.ts`):
```ts
export interface Insets { top: number; right: number; bottom: number; left: number }   // CSS-Pixel
export interface Circle { cx: number; cy: number; r: number; hitR: number }
export interface Layout {
  orientation: 'portrait' | 'landscape'; gameW: number; gameH: number; scale: number;
  view: Rect; panel: Rect | null; hud: Rect; pause: Rect;
  dpad: Circle; jump: Circle; action: Circle; controlsAlpha: number;
}
export function computeLayout(cssW: number, cssH: number, insets: Insets): Layout;
export function readSafeInsets(): Insets;  // DOM-Sonde mit env(safe-area-inset-*)
```
- Produces (`touch.ts`):
```ts
export type Zone = 'dpad' | 'jump' | 'action' | null;
export interface TouchPoint { id: number; x: number; y: number; zone: Zone }
export function zoneAt(x: number, y: number, l: Layout, actionVisible: boolean): Zone;
export function resolveTouch(points: readonly TouchPoint[], l: Layout): Held;
export class PointerBook { down(id, x, y, zone: Zone): void; move(id, x, y): void; up(id): void; reset(): void; points(): TouchPoint[] }
export class PointerTracker {  // DOM-Hülle um PointerBook
  constructor(el: HTMLElement, toGame: (clientX: number, clientY: number) => { x: number; y: number },
              zoneFor: (x: number, y: number) => Zone);
  readonly book: PointerBook; onTap(cb: (x: number, y: number) => void): void; onFirstTouch(cb: () => void): void; dispose(): void;
}
```
- Produces (`keyboard.ts`): `KEYMAP: Readonly<Record<string, keyof Held | 'pause'>>`, `class KeyboardSource { constructor(target: Window, onPause: () => void); read(): Held; dispose(): void }`.
- Produces (`controls.ts`): `class Controls { constructor(canvasParent: HTMLElement); setLayout(l: Layout, toGame: (cx: number, cy: number) => { x: number; y: number }): void; setActionVisible(v: boolean): void; sample(): InputFrame; held(): Held; onTap(cb): void; onPause(cb: () => void): void; readonly touchSeen: boolean }`. Verknüpft Tastatur und Touch per ODER, nutzt `InputSampler`. `setLayout` ruft `book.reset()`.

Aufteilung (Startwerte, alle in Spielpixeln, `ceil` für Insets / scale):
- `portrait` wenn `cssH > cssW`. Dann `gameW = 256`, `scale = cssW / 256`, `gameH = floor(cssH / scale)`. `view = {0, T, 256, 192}` mit `T = ceil(insets.top / scale)`. `panel` = Rest unterhalb. `hud = {0, panel.y, 256, 16}`. `pause = {236, panel.y + 2, 16, 12}`. Mit `B = gameH - ceil(insets.bottom / scale) - 8`: `dpad = {58, B-44, r 36, hitR 54}`, `jump = {204, B-52, r 24, hitR 40}`, `action = {144, B-14, r 14, hitR 24}`. `controlsAlpha = 1`.
- Ist `panel.h < 140`, gelten stattdessen die Quer-Regeln (sehr kurze Fenster).
- `landscape`: `gameH = 192`, `scale = cssH / 192`, `gameW = min(Math.round(cssW / scale), 512)`. `view = {0, 0, gameW, 192}`, `panel = null`. Mit `L`, `R`, `T` aus den Insets und `B = 192 - ceil(insets.bottom / scale) - 6`: `hud = {L, T, gameW-L-R, 12}`, `pause = {gameW/2-8, T+2, 16, 12}`, `dpad = {L+40, B-34, r 28, hitR 44}`, `jump = {gameW-R-34, B-36, r 18, hitR 32}`, `action = {jump.cx-48, B-12, r 12, hitR 20}`. `controlsAlpha = 0.45`.

Touch-Regeln: Die Zone eines Fingers wird beim Aufsetzen festgelegt und bleibt bis zum Abheben. Ein `dpad`-Finger bestimmt die Richtung immer aus seiner aktuellen Position, auch außerhalb von `hitR`. Unter 25 % von `r` (tote Zone) gibt es keine Richtung. Sonst gilt einer von 8 Sektoren zu je 45°, mittig auf den Achsen (z. B. 22,5° bis 67,5° = rechts + oben). Ein Finger in `jump` setzt `jump`, ein Finger in `action` setzt `action`. Die Aktion-Zone gibt es nur, wenn sie sichtbar ist (in M1 nie).

Tastatur: `ArrowLeft/KeyA` links, `ArrowRight/KeyD` rechts, `ArrowUp/KeyW` oben, `ArrowDown/KeyS` unten. `Space`, `KeyZ`, `KeyY` und `KeyK` springen (`KeyY`, weil auf deutschen Tastaturen dort das Z liegt). `KeyX` und `KeyJ` lösen die Aktion aus, `Escape` und `KeyP` pausieren. Ausgewertet wird `event.code`.

- [ ] **Step 1: Failing tests.**
```ts
// layout.test.ts
const none = { top: 0, right: 0, bottom: 0, left: 0 };
const inside = (c: Circle, r: Rect) => c.cx - c.r >= r.x && c.cx + c.r <= r.x + r.w && c.cy - c.r >= r.y && c.cy + c.r <= r.y + r.h;
const apart = (a: Circle, b: Circle) => Math.hypot(a.cx - b.cx, a.cy - b.cy) >= a.hitR + b.hitR;
it('iPhone hochkant: 4:3-Spielbild oben, Steuerfeld darunter', () => {
  const l = computeLayout(390, 844, { top: 47, right: 0, bottom: 34, left: 0 });
  expect(l.orientation).toBe('portrait');
  expect([l.gameW, l.gameH]).toEqual([256, 554]);
  expect(l.view).toEqual({ x: 0, y: 31, w: 256, h: 192 });
  expect(l.panel).toEqual({ x: 0, y: 223, w: 256, h: 331 });
  for (const c of [l.dpad, l.jump]) expect(inside(c, l.panel!)).toBe(true);
  expect(apart(l.dpad, l.jump) && apart(l.dpad, l.action) && apart(l.jump, l.action)).toBe(true);
  expect(l.jump.cy + l.jump.r).toBeLessThanOrEqual(l.gameH - Math.ceil(34 / l.scale));
});
it('iPhone quer: 192 hoch, Knöpfe in der Safe Area', () => {
  const l = computeLayout(844, 390, { top: 0, right: 47, bottom: 21, left: 47 });
  expect([l.orientation, l.gameH, l.gameW]).toEqual(['landscape', 192, 416]);
  expect(l.panel).toBeNull();
  expect(l.dpad.cx - l.dpad.r).toBeGreaterThanOrEqual(24);
  expect(l.jump.cx + l.jump.r).toBeLessThanOrEqual(416 - 24);
  expect(apart(l.jump, l.action)).toBe(true);
});
it('sehr breiter Bildschirm: höchstens 32 Kacheln', () => { expect(computeLayout(3440, 1080, none).gameW).toBe(512); });
it('iPad hochkant hat ein Steuerfeld', () => { expect(computeLayout(768, 1024, none).panel!.h).toBeGreaterThanOrEqual(140); });
it('zu kurzes Hochkant-Fenster nutzt Quer-Regeln', () => {
  const l = computeLayout(400, 500, none); expect(l.panel).toBeNull(); expect(l.gameH).toBe(192);
});
// touch.test.ts
const L = computeLayout(844, 390, none);
const at = (dx: number, dy: number, zone: Zone = 'dpad', id = 1): TouchPoint => ({ id, x: L.dpad.cx + dx, y: L.dpad.cy + dy, zone });
it('Sektoren des Steuerkreuzes', () => {
  expect(resolveTouch([at(20, 0)], L)).toMatchObject({ right: true, left: false, up: false, down: false });
  expect(resolveTouch([at(15, -15)], L)).toMatchObject({ right: true, up: true });
  expect(resolveTouch([at(0, 20)], L)).toMatchObject({ down: true, right: false });
  expect(resolveTouch([at(2, 1)], L)).toMatchObject({ left: false, right: false, up: false, down: false });
});
it('Finger außerhalb des Steuerkreuzes behält die Richtung', () => {
  expect(resolveTouch([at(200, 0)], L).right).toBe(true);
});
it('Steuerkreuz und Sprung gleichzeitig', () => {
  const j: TouchPoint = { id: 2, x: L.jump.cx, y: L.jump.cy, zone: 'jump' };
  expect(resolveTouch([at(-20, 0), j], L)).toMatchObject({ left: true, jump: true });
});
it('Aktion-Zone nur wenn sichtbar', () => {
  expect(zoneAt(L.action.cx, L.action.cy, L, false)).not.toBe('action');
  expect(zoneAt(L.action.cx, L.action.cy, L, true)).toBe('action');
});
it('PointerBook.reset vergisst alle Finger', () => {
  const b = new PointerBook(); b.down(1, 10, 10, 'dpad'); b.down(2, 20, 20, 'jump'); b.reset();
  expect(b.points()).toEqual([]);
});
it('PointerBook: Zone bleibt beim Verschieben', () => {
  const b = new PointerBook(); b.down(1, 10, 10, 'jump'); b.move(1, 300, 300);
  expect(b.points()[0]).toEqual({ id: 1, x: 300, y: 300, zone: 'jump' });
});
// keyboard.test.ts
it('Y springt (deutsche Tastatur)', () => { expect(KEYMAP.KeyY).toBe('jump'); expect(KEYMAP.Space).toBe('jump'); expect(KEYMAP.Escape).toBe('pause'); });
```
- [ ] **Step 2:** `npm test`. Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** `PointerTracker` nutzt `pointerdown/move/up/cancel` auf dem Element, `setPointerCapture` und `preventDefault`. Bei `pointerdown` wird `onTap` ausgelöst. `KeyboardSource` hört auf `keydown`/`keyup`, setzt bei `blur` alles zurück und ignoriert `repeat` für `pause`.
- [ ] **Step 4:** `npm test`. Erwartet: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "Touch, Tastatur und Bildschirm-Aufteilung hochkant/quer"`

---

### Task 9: Spielszene, Kamera, Knöpfe am Bildschirm

**Files:**
- Create: `src/core/camera.ts`, `src/core/stepper.ts`, `src/render/world-view.ts`, `src/scenes/PlayScene.ts`, `src/scenes/UiScene.ts`
- Modify: `src/main.ts`, `src/scenes/BootScene.ts`
- Test: `src/core/camera.test.ts`, `src/core/stepper.test.ts`, `src/render/player-frame.test.ts`

**Interfaces:**
- Produces (`stepper.ts`): `class FixedStepper { constructor(stepMs?: number /* 1000/60 */, maxSteps?: number /* 5 */); advance(deltaMs: number): number }`. Wären mehr als `maxSteps` Schritte fällig, wird der Rest verworfen. Verglichen wird mit einer Toleranz von 1e-6 ms, damit zwei 120-Hz-Frames sicher einen Schritt ergeben.
- Produces (`camera.ts`):
```ts
export interface CameraState { x: number; y: number; look: number; targetY: number }
export function createCamera(p: PlayerState, view: { w: number; h: number }, levelPx: { w: number; h: number }): CameraState;
export function stepCamera(c: CameraState, p: PlayerState, view: { w: number; h: number }, levelPx: { w: number; h: number }, dt: number): void;
```
  Regeln: `look` geht mit 90 px/s auf `facing * 32`, solange |vx| > 10, sonst bleibt der Wert. `x = Körpermitte + look - w/2`. Am Boden ist `targetY = Füße - 0,7·h`, und `y` nähert sich `targetY` mit `1 - exp(-6·dt)` pro Schritt. Liegt der Kopf höher als 32 px unter dem oberen Bildrand oder liegen die Füße tiefer als `h - 24`, werden `y` und `targetY` sofort so verschoben, dass Kraxel genau an dieser Grenze liegt (harte Grenze, kein Nachziehen). Am Ende wird auf `[0, levelW - w]` × `[0, levelH - h]` begrenzt (0, falls das Level kleiner ist).
- Produces (`world-view.ts`): `playerFrame(p: PlayerState, time: number): string` (Texturname, inklusive Helm-Variante), `class WorldView { constructor(scene: Phaser.Scene, s: GameState); handle(events: GameEvent[]): void; sync(s: GameState, time: number): void; rebuild(s: GameState): void }`.
- Produces (`PlayScene`): Szenen-Schlüssel `'play'`, `init(data: { levelId: string })`, öffentlich `state: GameState`, `controls: Controls`.
- Produces (`main.ts`): `game.registry` enthält `'layout': Layout` und `'controls': Controls`. Nach jeder Neuberechnung kommt `game.events.emit('layout', layout)`.

Umsetzung:
- `main.ts`: `applyLayout()` berechnet `computeLayout(innerWidth, innerHeight, readSafeInsets())` und ruft `game.scale.setGameSize(gameW, gameH)` sowie `controls.setLayout(layout, toGame)` auf. `toGame` rechnet über `canvas.getBoundingClientRect()` um. Auslöser: `resize`, `orientationchange` und `visualViewport.resize`, gebündelt pro Animation-Frame.
- `BootScene` startet `PlayScene` mit `levelId` aus `?level=` in der Adresse (Standard in Phase A: `'uebungsplatz'`) und dazu parallel `UiScene`.
- `PlayScene.create`: `createGame(parseLevel(...))`. Bodenkacheln als Tilemap mit `this.make.tilemap({ data, tileWidth: 16, tileHeight: 16 })` und `addTilesetImage('tiles-w1')`, Layer über `createLayer(0, tileset, 0, 0)`. `data[y][x] = groundTileIndex(...)`, leer = `-1`. Hintergrund: `TileSprite`s mit `setScrollFactor(0)`, `tilePositionX = cam.scrollX * Faktor`. Gruben bekommen unten einen dunklen Verlauf wie im Entwurf. Die Kamera nutzt `setViewport(view)`.
- `PlayScene.update(time, delta)`: Für jeden fälligen Schritt laufen `controls.sample()`, `stepGame(...)`, `worldView.handle(events)` und `stepCamera(...)`. Danach `cam.setScroll(Math.round(c.x), Math.round(c.y))` und `worldView.sync`.
- `WorldView`: Sprites für Kraxel (Unterkante mittig am Körper, gespiegelt nach `facing`, blinkt bei `invuln`), Felsblöcke und Kisten als Einzel-Sprites, Pickups (Kristall dreht sich wie `drawCrystal` im Entwurf). Events: `bump` und `crateOpen` heben die Kiste 4 px für 0,15 s an, `crystal` mit `fromCrate` lässt einen Kristall 24 px aufsteigen und mit Funkeln verschwinden, `rockBreak` erzeugt 4 `debris`-Splitter mit Schwerkraft, `poundLand` lässt die Kamera kurz wackeln. Sichtbar werdende versteckte Kisten bekommen ein Sprite.
- `UiScene`: zeichnet in Phase A nur das Steuerfeld hochkant (Muster wie im Entwurf) sowie Steuerkreuz und Sprungknopf an den Positionen aus `Layout`, mit Leuchten nach `controls.held()`. Hochkant mit Alpha 1, quer mit `controlsAlpha`. Ohne Touch-Gerät bleiben die Knöpfe ausgeblendet, bis `touchSeen` wahr wird.

- [ ] **Step 1: Failing tests.**
```ts
// stepper.test.ts
it('60 Hz: ein Schritt pro Frame', () => { expect(new FixedStepper().advance(1000 / 60)).toBe(1); });
it('120 Hz: jeder zweite Frame', () => { const s = new FixedStepper(); expect(s.advance(1000 / 120)).toBe(0); expect(s.advance(1000 / 120)).toBe(1); });
it('nach Hintergrund höchstens 5 Schritte, Rest verworfen', () => {
  const s = new FixedStepper(); expect(s.advance(1000)).toBe(5); expect(s.advance(1)).toBe(0);
});
// camera.test.ts
const view = { w: 256, h: 192 }, level = { w: 1600, h: 384 };
it('bleibt am linken Levelrand', () => {
  const p = createPlayer(1, 22); const c = createCamera(p, view, level); stepCamera(c, p, view, level, 1 / 60); expect(c.x).toBe(0);
});
it('wackelt beim Sprung von flachem Boden nicht senkrecht', () => {
  const p = createPlayer(20, 22); p.grounded = true; const c = createCamera(p, view, level);
  for (let i = 0; i < 120; i++) stepCamera(c, p, view, level, 1 / 60); const y0 = c.y;
  p.grounded = false; p.body.y -= 50; stepCamera(c, p, view, level, 1 / 60); expect(c.y).toBe(y0);
});
it('zieht nach, wenn Kraxel tiefer fällt als der Bildrand', () => {
  const p = createPlayer(20, 10); const c = createCamera(p, view, level);
  p.grounded = false; p.body.y = c.y + 190; stepCamera(c, p, view, level, 1 / 60);
  expect(p.body.y + PLAYER_H - c.y).toBeLessThanOrEqual(192 - 24 + 0.001);
});
it('schaut in Laufrichtung voraus', () => {
  const p = createPlayer(40, 22); p.body.vx = 96; p.facing = 1; const c = createCamera(p, view, level);
  for (let i = 0; i < 60; i++) stepCamera(c, p, view, level, 1 / 60);
  expect(c.x).toBeCloseTo(p.body.x + PLAYER_W / 2 + 32 - 128, 0);
});
// player-frame.test.ts
it('wählt Bild nach anim und Helm', () => {
  const p = createPlayer(1, 1); p.anim = 'pound'; expect(playerFrame(p, 0)).toBe('kraxelPound');
  p.helm = true; expect(playerFrame(p, 0)).toBe('kraxelPoundHelm');
  p.anim = 'walk'; p.helm = false; expect(['kraxel', 'kraxelB']).toContain(playerFrame(p, 0.1));
});
```
  `playerFrame` kommt in eine eigene Datei `src/render/player-frame.ts` ohne Phaser-Import, damit der Test in Node läuft. `world-view.ts` importiert sie.
- [ ] **Step 2:** `npm test`. Erwartet: FAIL.
- [ ] **Step 3: Implementieren:** `stepper.ts`, `camera.ts`, `player-frame.ts`.
- [ ] **Step 4:** `npm test`. Erwartet: PASS.
- [ ] **Step 5: Szenen und `main.ts` verdrahten.** `npm run typecheck`. Erwartet: keine Fehler.
- [ ] **Step 6: Im eingebauten Browser prüfen.** `npm run dev`, `http://localhost:5173/kraxel/` mit `resize_window` auf `mobile` (375×812), danach 812×375. Je ein Screenshot. Erwartet: hochkant 4:3-Bild oben und Knöpfe unten, quer Vollbild mit halbtransparenten Knöpfen. Mit der Tastatur laufen, springen, an der Wand rutschen, kraxeln, stampfen, Kisten öffnen, mit Helm einen Felsblock zerschlagen. Fenstergröße während des Laufens ändern: kein Neustart, kein Hängenbleiben. Konsole ohne Fehler.
- [ ] **Step 7: Commit.** `git add -A && git commit -m "Spielszene: Kachelkarte, Kamera, Parallax, Knöpfe, fester Takt"`

---

### Task 10: Debug-Modus, Home-Bildschirm, Übungsplatz online

**Files:**
- Create: `src/debug/debug-panel.ts`, `public/manifest.webmanifest`, `scripts/make-icons.ts`, `public/icons/icon-180.png`, `public/icons/icon-192.png`, `public/icons/icon-512.png`
- Modify: `src/core/tuning.ts` (laden/speichern), `src/scenes/PlayScene.ts` (Trefferboxen, FPS), `src/main.ts`, `index.html`
- Test: `src/core/tuning.test.ts`

**Interfaces:**
- Produces (`tuning.ts`): `TUNING_KEY = 'kraxel-tuning-v1'`, `isDebug(search: string): boolean`, `loadTuning(store: KeyValueStore | null): Tuning` (übernimmt nur bekannte Schlüssel mit endlichen Zahlen, sonst `DEFAULT_TUNING`; Fehler beim Lesen ergeben ebenfalls `DEFAULT_TUNING`), `saveTuning(store: KeyValueStore | null, t: Tuning): void` (schluckt Fehler).
- Produces (`debug-panel.ts`): `class DebugPanel { constructor(tuning: Tuning, store: KeyValueStore | null); destroy(): void }`. Einklappbares DOM-Panel oben rechts. Je Wert ein Schieberegler von 25 % bis 250 % des Standardwerts mit Zahlenanzeige, dazu die Knöpfe „Zurücksetzen“ und „Werte kopieren“ (JSON in die Zwischenablage). Das Panel ändert das übergebene `Tuning`-Objekt direkt und speichert es.

Nur bei `?debug`: Tuning aus dem Speicher laden, Panel anzeigen, Trefferboxen (Spieler grün, Pickups gelb, ab Task 12 Gegner rot) und FPS als `PixelText`. Ohne `?debug` gilt immer `DEFAULT_TUNING`.

- [ ] **Step 1: Failing tests.**
```ts
it('isDebug', () => { expect(isDebug('?debug')).toBe(true); expect(isDebug('?level=x&debug')).toBe(true); expect(isDebug('?level=x')).toBe(false); });
it('loadTuning übernimmt nur gültige bekannte Werte', () => {
  const store = { getItem: () => JSON.stringify({ walkSpeed: 100, foo: 1, runSpeed: 'x' }), setItem: () => {} };
  const t = loadTuning(store); expect(t.walkSpeed).toBe(100); expect(t.runSpeed).toBe(DEFAULT_TUNING.runSpeed); expect('foo' in t).toBe(false);
});
it('kaputter oder fehlender Speicher ergibt Standardwerte', () => {
  expect(loadTuning({ getItem: () => '{kaputt', setItem: () => {} })).toEqual(DEFAULT_TUNING);
  expect(loadTuning({ getItem: () => { throw new Error('privat'); }, setItem: () => {} })).toEqual(DEFAULT_TUNING);
  expect(loadTuning(null)).toEqual(DEFAULT_TUNING);
  expect(() => saveTuning({ getItem: () => null, setItem: () => { throw new Error('voll'); } }, DEFAULT_TUNING)).not.toThrow();
});
```
- [ ] **Step 2:** `npm test`. Erwartet: FAIL.
- [ ] **Step 3: Implementieren:** `tuning.ts` erweitern und `debug-panel.ts` schreiben.
- [ ] **Step 4:** `npm test`. Erwartet: PASS.
- [ ] **Step 5: Manifest und Icons.** `manifest.webmanifest`: `name` und `short_name` „Kraxel“, `start_url "."`, `scope "."`, `display "fullscreen"`, `orientation "any"`, `background_color` und `theme_color` `#1b1230`, Icons 192 und 512 (512 zusätzlich `"purpose": "maskable"`). In `index.html` `<link rel="manifest" href="manifest.webmanifest">` und `<link rel="apple-touch-icon" href="icons/icon-180.png">`. `scripts/make-icons.ts` importiert `buildSprites` und `bakeGrid` und zeichnet Kraxels Kopf (die oberen 13 Zeilen von `kraxel`) ganzzahlig vergrößert und mittig auf türkisem Grund (`#2ec4b6`, 15 % Rand). Gespeichert wird als PNG über `node:zlib` mit eigener CRC32. `npm run icons`. Erwartet: drei PNGs mit 180, 192 und 512 px, im Browser angesehen scharf.
- [ ] **Step 6: Bauen und lokal prüfen.** `npm test && npm run build && npm run preview`, `http://localhost:4173/kraxel/?debug` im eingebauten Browser öffnen. Erwartet: Panel sichtbar, Regler ändern das Sprungverhalten sofort, Trefferboxen sichtbar, Konsole ohne Fehler.
- [ ] **Step 7: Commit und Push.**
```bash
git add -A && git commit -m "Debug-Modus, Manifest und Icons, Übungsplatz"
git push
```
- [ ] **Step 8: Online prüfen.** Wenn `gh run list --limit 1` „completed success“ meldet: `curl -s https://philippdererbauer.github.io/kraxel/manifest.webmanifest | head -3`. Erwartet: JSON mit `"name": "Kraxel"`.

---

### Task 11: Testhalt am Handy

**Files:**
- Modify: `src/core/tuning.ts` (`DEFAULT_TUNING` festschreiben), bei Bedarf `src/view/layout.ts`

- [ ] **Step 1: Den Repo-Inhaber bitten zu testen.** Nachricht auf Deutsch mit der Adresse `https://philippdererbauer.github.io/kraxel/?debug` und der Anleitung „Teilen → Zum Home-Bildschirm“ für das Vollbild. Bitte um Rückmeldung zu: Sprunghöhe und -weite, Tempo und Rennen, Wandsprung, Kraxeln, Stampfen, Lage und Größe der Knöpfe hochkant und quer, und ob etwas hakt. Hinweis: Mit „Werte kopieren“ im Debug-Panel lassen sich eingestellte Werte direkt schicken. **Hier anhalten und auf die Antwort warten.**
- [ ] **Step 2: Rückmeldung umsetzen.** Werte in `DEFAULT_TUNING` übernehmen. Layout-Wünsche in `computeLayout` umsetzen und dabei die Tests aus Task 8 anpassen, nur bei begründeten neuen Positionen. Ändern sich Sprung-Werte, die Grenzen der Bewegungstests aus Task 5 und 6 nachziehen und den Grund im Commit nennen.
- [ ] **Step 3:** `npm test`. Erwartet: PASS.
- [ ] **Step 4: Commit und Push.** `git commit -am "Bewegungswerte nach Handy-Test festgeschrieben" && git push`
- [ ] **Step 5:** Kommt keine Rückmeldung, mit den Startwerten weitermachen und das in Task 18 noch einmal ansprechen.

---

# Phase B: Level 1-1 und alles drumherum

### Task 12: Gegner

**Files:**
- Create: `src/core/enemies.ts`
- Modify: `src/core/game.ts` (`enemies` in `GameState`, in `stepGame` und `hitCell`), `src/core/blocks.ts`, `src/render/world-view.ts`, `src/scenes/PlayScene.ts` (Debug-Boxen)
- Test: `src/core/enemies.test.ts`

**Interfaces:**
- Produces:
```ts
export type EnemyKind = 'beetle' | 'snail';
export interface EnemyState { kind: EnemyKind; body: Body; dir: -1 | 1; active: boolean; alive: boolean; defeatTimer: number }
export const ENEMY_SPEC: Readonly<Record<EnemyKind, { speed: number; w: number; h: number; stompable: boolean; turnAtEdges: boolean }>>;
  // beetle: 30 px/s, 12×12, stompable, läuft über Kanten; snail: 15 px/s, 14×12, nicht stompable, dreht an Kanten
export function createEnemy(sp: EntitySpawn): EnemyState;   // dir = -1 (läuft zum Spieler)
export function stepEnemies(list: EnemyState[], grid: TileGrid, view: ViewWindow, dt: number): void;
export function resolvePlayerEnemies(s: GameState, input: InputFrame, t: Tuning): GameEvent[];
```
- Modifies: `GameState` bekommt `enemies: EnemyState[]`, `createGame` füllt es aus den Spawns. `damagePlayer(s: GameState, t: Tuning): GameEvent[]` in `game.ts`: Mit Helm wird `helm = false`, `invuln = t.hurtInvuln`, `anim = 'hurt'` für 0,3 s, Event `hurt`. Ohne Helm Event `hurt` und Weiterleitung an `killPlayer` (Task 13, bis dahin vorläufig: zurück an den Start).

Regeln: Gegner werden aktiv, sobald ihr Körper näher als 32 px am Sichtfenster ist, und bleiben dann aktiv. Gegner untereinander ignorieren sich. Fällt ein Gegner unter das Level, gilt `alive = false`. Besiegte Gegner stehen 0,5 s als `beetleFlat` und verschwinden dann.
Kontakt (nur wenn beide Körper überlappen und `alive`):
- Draufspringen gilt, wenn `vy > 0` und die Füße des Spielers im vorigen Schritt höchstens 4 px unter der Oberkante des Gegners lagen. Beim Käfer: besiegt, `vy = -(input.jump ? stompBounceHeld : stompBounce)`, Events `stomp` und `enemyDefeated`. Bei der Schnecke: `damagePlayer`.
- Stampfen (`mode === 'pound'`): Käfer besiegt, das Stampfen geht weiter. Schnecke: `damagePlayer`.
- Sonst: `damagePlayer`, außer während `invuln > 0`.
- `hitCell` von unten besiegt jeden Gegner, der auf der getroffenen Zelle steht (Füße auf deren Oberkante, waagerecht überlappend), Event `enemyDefeated`.

- [ ] **Step 1: Failing tests.**
```ts
const ROW = (s: string) => gameFrom(['..........', s, '##########']);  // s enthält immer ein 'P'
it('Käfer läuft 30 px/s und dreht an der Wand', () => {
  const s = gameFrom(['..........', '#k......P.', '##########']); const e = s.enemies[0]; const x0 = e.body.x;
  runGame(s, [[{}, 30]]); expect(e.dir).toBe(1); expect(e.body.x).toBeGreaterThanOrEqual(x0 - 16);
});
it('Käfer läuft über Kanten, Schnecke dreht um', () => {
  const s = gameFrom(['..........', '..k.....P.', '###.....##', '..........']); runGame(s, [[{}, 300]]);
  expect(s.enemies[0].alive).toBe(false);
  const s2 = gameFrom(['..........', '..s.....P.', '.###....##', '..........']); runGame(s2, [[{}, 240]]);
  expect(s2.enemies[0].alive).toBe(true); expect(s2.enemies[0].body.y + 12).toBe(32);
});
it('inaktiv außerhalb des Sichtfensters', () => {
  const s = gameFrom(['P' + '.'.repeat(58) + 'k', '#'.repeat(60)]); const x0 = s.enemies[0].body.x;
  stepGame(s, new InputSampler().sample(held()), DEFAULT_TUNING, { x: 0, w: 256 }, 1 / 60);
  expect(s.enemies[0].body.x).toBe(x0);
});
it('Draufspringen besiegt Käfer und federt', () => {
  const s = ROW('.P..k.....'); const e = s.enemies[0];
  s.player.body.x = e.body.x; s.player.body.y = e.body.y - PLAYER_H - 2; s.player.body.vy = 120; s.player.grounded = false;
  const ev = runGame(s, [[{}, 3]]);
  expect(ev.map(x => x.type)).toEqual(expect.arrayContaining(['stomp', 'enemyDefeated'])); expect(s.player.body.vy).toBeLessThan(-200);
});
it('seitlich in den Käfer laufen: ohne Helm Tod, mit Helm Helm weg', () => {
  const s = gameFrom(['..........', '.P..k.....', '##########']); s.player.helm = true;
  expect(runGame(s, [[{ right: true }, 40]])).toContainEqual({ type: 'hurt' }); expect(s.player.helm).toBe(false);
  expect(s.player.invuln).toBeGreaterThan(0);
});
it('Draufspringen auf die Schnecke tut weh', () => {
  const s = ROW('.P..s.....'); const e = s.enemies[0];
  s.player.body.x = e.body.x; s.player.body.y = e.body.y - PLAYER_H - 2; s.player.body.vy = 120; s.player.helm = true;
  expect(runGame(s, [[{}, 3]])).toContainEqual({ type: 'hurt' });
});
it('Kopfstoß gegen den Block unter einem Gegner besiegt ihn', () => {
  const s = gameFrom(['....s.....', '....K.....', '..........', '..........', '....P.....', '##########']);
  expect(runGame(s, [[{ jump: true }, 30]]).map(e => e.type)).toContain('enemyDefeated');
});
```
- [ ] **Step 2:** `npm test`. Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** `WorldView` bekommt Gegner-Sprites (Käfer mit 2 Laufbildern durch Spiegeln im Rhythmus, Schnecke, `beetleFlat`).
- [ ] **Step 4:** `npm test`. Erwartet: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "Gegner: Krabbelkäfer und Stachelschnecke"`

---

### Task 13: Leben, Tod, Steinmännchen, Edelweiß, Ziel, Zeit

**Files:**
- Modify: `src/core/game.ts`, `src/core/pickups.ts`, `src/render/world-view.ts`
- Test: `src/core/game.test.ts`

**Interfaces:**
- Produces (`game.ts`): `killPlayer(s: GameState): GameEvent[]`, `respawn(s: GameState): void`, `restartLevel(s: GameState): void`, `GOAL_HEIGHT_TILES = 5`, `DYING_TIME = 1.2`, `GOAL_TIME = 1.5`. Ab jetzt gibt es `phase === 'goal'` mit `phaseTimer` (die Szene wartet `GOAL_TIME` bis zum Ergebnis).

Regeln:
- `killPlayer`: `phase = 'dying'`, `phaseTimer = DYING_TIME`, `player.mode = 'dead'` (`vy = -300`, danach nur Schwerkraft ohne Kollision), `lives - 1`, Event `death`. Nach Ablauf: bei `lives === 0` folgt `phase = 'gameOver'` mit Event `gameOver`, sonst `respawn` mit Event `respawn`.
- Unter dem Level (`body.y > grid.height * 16 + 16`) folgt `killPlayer`. Das ersetzt das vorläufige Zurücksetzen aus Task 7 und 12.
- `respawn`: Raster, Kisten, Gegner und Pickups wie beim Levelstart. Bereits gesammelte Edelweiß (`session.edelweiss[i]`) erscheinen nicht wieder. Kraxel steht am Steinmännchen `checkpoint` (oder am Start), ohne Helm. `session` bleibt erhalten, die Zeit läuft weiter.
- Steinmännchen: Berührt Kraxel ein Steinmännchen mit höherem Index als `checkpoint`, wird `checkpoint = index` gesetzt (Event `checkpoint`). Die Fahne erscheint.
- Ziel: Berührt Kraxels Körper die Zielzone (Spalte des `Z`, von der Unterkante der Zelle 5 Kacheln hoch), wird `h = (Zellunterkante - Füße) / 16` berechnet. Bei `h >= 4.5` gibt es ein Extraleben (`bonusCrystals: 0, extraLife: true`, `lives + 1`), sonst `bonusCrystals = 1 + floor(h)` über `addCrystals`. Danach `phase = 'goal'`, `player.mode = 'goal'`, `anim = 'cheer'`, Event `goal`. Die Zeit bleibt stehen.
- `session.time` läuft nur in `playing`.
- `restartLevel`: `session = copy(startSession)`, `checkpoint = -1`, danach `respawn`, Zeit auf 0.

- [ ] **Step 1: Failing tests.**
```ts
const PIT = ['............', '.P....S.....', '####..####..', '............'];
it('Sturz in die Grube: Tod, ein Leben weniger, Neustart am Start', () => {
  const s = gameFrom(PIT); const ev = runGame(s, [[{ right: true }, 40], [{}, 90]]);
  expect(ev).toContainEqual({ type: 'death' }); expect(ev).toContainEqual({ type: 'respawn' });
  expect(s.session.lives).toBe(4); expect(s.player.body.x).toBe(createPlayer(1, 1).body.x);
});
it('Steinmännchen wird Neustartpunkt', () => {
  const s = gameFrom(PIT); s.player.body.x = 6 * 16 + 3; const ev = runGame(s, [[{}, 2]]);
  expect(ev).toContainEqual({ type: 'checkpoint', index: 0 }); s.player.body.y = 999; runGame(s, [[{}, 90]]);
  expect(s.player.body.x).toBe(createPlayer(6, 1).body.x);
});
it('letztes Leben verloren: Game Over', () => {
  const s = gameFrom(PIT); s.session.lives = 1; s.player.body.y = 999;
  expect(runGame(s, [[{}, 90]])).toContainEqual({ type: 'gameOver' }); expect(s.phase).toBe('gameOver');
});
it('Edelweiß bleibt nach Tod gesammelt, Kristalle erscheinen neu', () => {
  const s = gameFrom(['............', '.P1c........', '############']); runGame(s, [[{ right: true }, 30]]);
  expect(s.session.edelweiss[0]).toBe(true); s.player.body.y = 999; runGame(s, [[{}, 90]]);
  expect(s.pickups.some(p => p.kind === 'edelweiss')).toBe(false); expect(s.pickups.some(p => p.kind === 'crystal' && !p.taken)).toBe(true);
});
it('Gipfelkreuz unten: 1 Bonus-Kristall, Zeit steht', () => {
  const s = gameFrom(['............', '.P...Z......', '############']); const ev = runGame(s, [[{ right: true }, 60]]);
  expect(ev).toContainEqual({ type: 'goal', bonusCrystals: 1, extraLife: false });
  const t = s.session.time; runGame(s, [[{}, 30]]); expect(s.session.time).toBe(t);
});
it('Gipfelkreuz ganz oben: Extraleben', () => {
  const s = gameFrom([...Array(6).fill('............'), '.P...Z......', '############']);
  s.player.body.x = 5 * 16 - 8; s.player.body.y = 22; s.player.grounded = false; // Füße bei 36, Zellunterkante 112 → h = 4,75
  expect(runGame(s, [[{ right: true }, 4]])).toContainEqual({ type: 'goal', bonusCrystals: 0, extraLife: true });
});
it('Level neu starten setzt Sitzung auf den Levelstart zurück', () => {
  const s = gameFrom(['......', '.Pc...', '######']); runGame(s, [[{ right: true }, 30]]); restartLevel(s);
  expect([s.session.crystals, s.session.time]).toEqual([0, 0]);
});
```
- [ ] **Step 2:** `npm test`. Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** `WorldView`: Steinmännchen (`cairn`/`cairnFlag`), Gipfelkreuz, Edelweiß, Todes-Animation, Jubel. `rebuild` nach `respawn`.
- [ ] **Step 4:** `npm test`. Erwartet: PASS, alle bisherigen Tests ebenfalls.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "Leben, Tod, Steinmännchen, Edelweiß, Gipfelkreuz, Zeit"`

---

### Task 14: Speicherstand

**Files:**
- Create: `src/core/save.ts`
- Test: `src/core/save.test.ts`

**Interfaces:**
```ts
export const SAVE_KEY = 'kraxel-save-v1';
export interface LevelRecord { bestTime: number | null; edelweiss: [boolean, boolean, boolean]; completed: boolean }
export interface SaveData { version: 1; levels: Record<string, LevelRecord>; muted: boolean }
export function defaultSave(): SaveData;
export function loadSave(store: KeyValueStore | null): SaveData;
export function writeSave(store: KeyValueStore | null, d: SaveData): void;
export function recordResult(d: SaveData, levelId: string, time: number, edelweiss: [boolean, boolean, boolean]): { data: SaveData; newBest: boolean };
export function safeStorage(): KeyValueStore | null;  // window.localStorage oder null, falls der Zugriff wirft
```
- [ ] **Step 1: Failing tests.**
```ts
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
it('fehlend, kaputt oder falsche Version ergibt Standard', () => {
  expect(loadSave(mem())).toEqual(defaultSave());
  expect(loadSave({ getItem: () => '{x', setItem: () => {} })).toEqual(defaultSave());
  expect(loadSave({ getItem: () => JSON.stringify({ version: 9 }), setItem: () => {} })).toEqual(defaultSave());
  expect(loadSave({ getItem: () => { throw new Error(); }, setItem: () => {} })).toEqual(defaultSave());
});
it('Schreiben wirft nie', () => { expect(() => writeSave({ getItem: () => null, setItem: () => { throw new Error('voll'); } }, defaultSave())).not.toThrow(); });
it('Bestzeit und Edelweiß zusammenführen', () => {
  let r = recordResult(defaultSave(), '1-1', 90, [true, false, false]); expect(r.newBest).toBe(true);
  r = recordResult(r.data, '1-1', 95, [false, true, false]); expect(r.newBest).toBe(false);
  expect(r.data.levels['1-1']).toEqual({ bestTime: 90, edelweiss: [true, true, false], completed: true });
});
it('speichern und wieder laden', () => { const s = mem(); const d = recordResult(defaultSave(), '1-1', 80, [true, true, true]).data; writeSave(s, d); expect(loadSave(s)).toEqual(d); });
```
- [ ] **Step 2:** `npm test`. Erwartet: FAIL.
- [ ] **Step 3: `save.ts` schreiben.**
- [ ] **Step 4:** `npm test`. Erwartet: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "Speicherstand mit Bestzeit und Edelweiß"`

---

### Task 15: Soundeffekte

**Files:**
- Create: `src/audio/sfx.ts`
- Modify: `src/scenes/PlayScene.ts` (Events an `Sfx`), `src/main.ts` (`Sfx` in `game.registry` als `'sfx'`)
- Test: `src/audio/sfx.test.ts`

**Interfaces:**
```ts
export type SoundName = 'jump' | 'wallJump' | 'bump' | 'crate' | 'crystal' | 'item' | 'powerUp' | 'stomp' | 'pound' | 'rockBreak'
  | 'hurt' | 'death' | 'checkpoint' | 'edelweiss' | 'extraLife' | 'goal' | 'select';
export interface SoundDef { wave: 'square' | 'triangle' | 'sawtooth' | 'sine' | 'noise'; notes: ReadonlyArray<{ f: number; f2?: number; d: number }>; vol: number }
export const SOUND_DEFS: Readonly<Record<SoundName, SoundDef>>;
export const EVENT_SOUND: Readonly<Partial<Record<GameEvent['type'], SoundName>>>;
export class Sfx { constructor(createContext: () => AudioContext | null); unlock(): void; play(n: SoundName): void; setMuted(m: boolean): void; readonly muted: boolean }
```
`EVENT_SOUND`: jump→jump, wallJump→wallJump, bump→bump, crateOpen→crate, crystal→crystal, itemSpawn→item, powerUp→powerUp, stomp→stomp, enemyDefeated→stomp, poundLand→pound, rockBreak→rockBreak, hurt→hurt, death→death, checkpoint→checkpoint, edelweiss→edelweiss, extraLife→extraLife, goal→goal.
`unlock()` erzeugt den `AudioContext` und ruft `resume()` auf. Falls vorhanden, wird vorher `navigator.audioSession.type = 'playback'` gesetzt, damit der Ton auf dem iPhone auch bei Stummschaltung läuft. `play` vor `unlock` oder bei `muted` tut nichts. Jede Note: Oszillator (oder Rausch-Puffer) mit Frequenzrampe `f → f2` und kurzer Hüllkurve. Klang: knackige Chip-Töne, eigene Tonfolgen. Kristall zum Beispiel als schnelle Dur-Terz plus Oktave, kein Quartsprung aufwärts.

- [ ] **Step 1: Failing tests.**
```ts
it('jedes zugeordnete Event hat einen Klang', () => { for (const n of Object.values(EVENT_SOUND)) expect(SOUND_DEFS[n!]).toBeDefined(); });
it('play vor unlock wirft nicht und erzeugt keinen Kontext', () => {
  let created = 0; const sfx = new Sfx(() => { created++; return null; });
  expect(() => sfx.play('jump')).not.toThrow(); expect(created).toBe(0);
});
it('unlock ohne Audio-Unterstützung wirft nicht', () => { const sfx = new Sfx(() => null); expect(() => { sfx.unlock(); sfx.play('crystal'); }).not.toThrow(); });
it('stumm: keine Oszillatoren', () => {
  let started = 0;
  const fake = { currentTime: 0, state: 'running', resume: () => Promise.resolve(), destination: {},
    createOscillator: () => ({ type: '', frequency: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: () => ({ connect() {} }), start: () => { started++; }, stop() {} }),
    createGain: () => ({ gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(1) }), createBufferSource: () => ({ connect() {}, start: () => { started++; }, stop() {} }), sampleRate: 44100 };
  const sfx = new Sfx(() => fake as unknown as AudioContext); sfx.unlock(); sfx.setMuted(true); sfx.play('jump'); expect(started).toBe(0);
  sfx.setMuted(false); sfx.play('jump'); expect(started).toBeGreaterThan(0);
});
```
- [ ] **Step 2:** `npm test`. Erwartet: FAIL.
- [ ] **Step 3: `sfx.ts` schreiben, in `PlayScene` jedes Event über `EVENT_SOUND` abspielen.**
- [ ] **Step 4:** `npm test`. Erwartet: PASS.
- [ ] **Step 5: Anhören** im eingebauten Browser (Übungsplatz, nach einem Klick). Keine Töne, die an Mario erinnern.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "Soundeffekte per Web Audio"`

---

### Task 16: Titelbild, Info-Leiste, Pause, Ergebnis

**Files:**
- Create: `src/core/format.ts`, `src/scenes/TitleScene.ts`, `src/scenes/PauseScene.ts`, `src/scenes/ResultScene.ts`
- Modify: `src/scenes/UiScene.ts` (Info-Leiste, Pause-Knopf), `src/scenes/PlayScene.ts`, `src/scenes/BootScene.ts` (Start mit Titelbild), `src/main.ts`
- Test: `src/core/format.test.ts`

**Interfaces:**
- Produces: `formatTime(seconds: number): string` im Format `m:ss.cc`, auf Hundertstel abgerundet.
- Produces: Szenen `'title'`, `'pause'`, `'result'` (`init(data: { levelId: string; time: number; edelweiss: [boolean, boolean, boolean]; crystals: number; newBest: boolean; bestTime: number | null })`).

Ablauf:
- `BootScene` → `TitleScene`. Mit `?level=` oder `?galerie` geht es direkt dorthin.
- **Titel:** großer Schriftzug „KRAXEL“ (Pixelschrift 3-fach vergrößert, Umrandung dunkel), Graslandschaft als Hintergrund, Kraxel läuft durchs Bild. „TIPPEN ZUM STARTEN“ blinkt. Auf iOS im Browser (iOS erkannt über `/iPhone|iPad|iPod/` im User-Agent oder `navigator.maxTouchPoints > 1` mit `Macintosh`; nicht gestartet vom Home-Bildschirm, also weder `navigator.standalone` noch `display-mode: standalone|fullscreen`) erscheint `TEXT.IOS_HINT`. Ein Tipp oder eine Taste ruft `sfx.unlock()` auf und startet `play` mit `'1-1'` sowie `UiScene`.
- **Info-Leiste:** `iCrystal` mit dreistelliger Zahl, `iHead` mit Leben, 3 × `iEdel`/`iEdelOff`, Zeit über `formatTime` (ohne Hundertstel während des Spiels: `m:ss`) und Pause-Knopf. Hochkant sitzt sie in `layout.hud` im Steuerfeld, quer als dunkle halbtransparente Leiste oben.
- **Pause:** Pause-Knopf, `Escape`/`P` oder `visibilitychange` auf `hidden` startet `PauseScene` über `play` (`scene.pause('play')`). Knöpfe: `WEITER`, `NEU STARTEN` (`restartLevel`), `TON: AN`/`TON: AUS` (in `SaveData.muted` gespeichert). Bedienung per Tipp (`controls.onTap`) und Tastatur (hoch/runter, Sprung bestätigt).
- **Ziel:** Nach `goal` und `GOAL_TIME` werden `recordResult`, `writeSave` und `ResultScene` aufgerufen. Angezeigt werden `TEXT.GOAL`, Zeit, Bestzeit (mit `NEUER REKORD!`, falls neu), drei Edelweiß und Kristalle. Knöpfe `NOCHMAL` (startet das Level neu) und `WEITER` (in M1 zum Titel).
- **Game Over:** `TEXT.GAME_OVER` für 2 s, danach Titel. Die Leben stehen wieder auf `START_LIVES`.

- [ ] **Step 1: Failing test.**
```ts
it('formatTime', () => { expect(formatTime(83.456)).toBe('1:23.45'); expect(formatTime(5)).toBe('0:05.00'); expect(formatTime(600)).toBe('10:00.00'); });
```
- [ ] **Step 2:** `npm test`. Erwartet: FAIL.
- [ ] **Step 3: `format.ts` und Szenen schreiben.**
- [ ] **Step 4:** `npm test`. Erwartet: PASS.
- [ ] **Step 5: Im eingebauten Browser prüfen**, hochkant (375×812) und quer (812×375): Titel → Spiel → Pause (Knopf und Escape) → Ton aus → weiter. Danach Tab wechseln und zurück (pausiert), Ziel erreichen (Übungsplatz mit `?level=…` reicht nicht, ein kleines Test-Level genügt) → Ergebnis → Nochmal. Screenshots. Konsole ohne Fehler.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "Titelbild, Info-Leiste, Pause und Ergebnis"`

---

### Task 17: Level 1-1

**Files:**
- Create: `src/levels/1-1.txt`
- Modify: `src/core/test-helpers.ts` (`placePlayer`)
- Test: `src/levels/level-1-1.test.ts`

**Interfaces:**
- Produces (`test-helpers.ts`): `placePlayer(s: GameState, cx: number, cy: number): void` (setzt Kraxel mit den Füßen auf die Unterkante der Zelle, `grounded` wird im nächsten Schritt erkannt).

Vorgaben (Spec, Meilenstein 1): ca. 180–220 Kacheln lang, an manchen Stellen höher als ein Bildschirm (Höhe 18–24 Kacheln). Name zum Beispiel „Sonnige Almwiese“. Der Aufbau bringt ohne Text bei, in dieser Reihenfolge: laufen und springen, die erste Kiste (Kristall), die Helm-Kiste vor den ersten Felsblöcken, Käfer, Gruben, einen Wandschacht (Wandsprung), eine Kletterwand (Kraxeln), Stampfen auf Felsblöcke. Das Steinmännchen steht etwa in der Mitte. Danach wird es schwerer, mit Stachelschnecken auf Plattformen und Gruben mit Gegnern, und am Ende steht das Gipfelkreuz. Enthält mindestens: 4 `K`, 1 `M`, 1 `H`, 1 `V`, 6 `B`, 30 `c`, 6 `k`, 3 `s`.
Edelweiß: `1` hinter Felsblöcken (Helm oder Stampfen nötig), `2` nur per Kraxeln oder Wandsprung erreichbar, `3` in einem versteckten Bereich (über einer versteckten Kiste `V` als Treppe oder über einen Durchgang, der nur von oben sichtbar ist). Die Kamera muss es zeigen, wenn man an der richtigen Stelle sucht.
Sprungweiten: Gruben höchstens 4 Kacheln ohne Rennen, höchstens 6 mit Rennen, nach den in Task 11 festgeschriebenen Werten.

- [ ] **Step 1: Failing tests.**
```ts
const L = parseLevel('1-1', LEVELS['1-1']);
it('ist gültig und hat die Pflicht-Bausteine', () => {
  expect(validateLevel(L, { requireEdelweiss: true, requireGoal: true })).toEqual([]);
  expect(L.width).toBeGreaterThanOrEqual(180); expect(L.width).toBeLessThanOrEqual(220);
  const kinds = [...L.crates.values()].map(c => c.kind);
  expect(kinds.filter(k => k === 'item').length).toBe(1); expect(kinds).toContain('multi');
  expect([...L.cells].includes(Cell.HiddenCrate)).toBe(true);
  expect([...L.cells].filter(c => c === Cell.Rock).length).toBeGreaterThanOrEqual(6);
  expect(L.spawns.filter(s => s.kind === 'checkpoint').length).toBe(1);
});
it('Edelweiß 2 ist per Kraxeln oder Wandsprung erreichbar', () => {
  const s = createGame(L); /* placePlayer an den Fuß der Kletterstelle, Eingabe-Skript, das das Edelweiß einsammelt */
  // Beispiel: placePlayer(s, X, Y); runGame(s, [[{ right: true, up: true }, 40], [{ left: true, jump: true }, 1], …]);
  expect(s.session.edelweiss[1]).toBe(true);
});
it('Edelweiß 1 ist mit Helm erreichbar', () => { /* wie oben: placePlayer, helm = true, Skript */ });
it('Edelweiß 3 ist über den versteckten Weg erreichbar', () => { /* wie oben */ });
it('jede Grube ist mit Renntempo überspringbar', () => {
  /* für jede Lücke im Bodenprofil der untersten festen Reihe: placePlayer 8 Kacheln davor,
     runGame(s, [[{ right: true }, 50], [{ right: true, jump: true }, 40]]), danach: kein 'death' in den Events */
});
```
  Die Skripte mit den echten Koordinaten aus `1-1.txt` füllen. Die Platzhalter-Kommentare oben stehen nur hier im Plan, im Test steht echter Code.
- [ ] **Step 2:** `npm test`. Erwartet: FAIL (Level fehlt).
- [ ] **Step 3: `1-1.txt` bauen.** Danach `npm test`, Level so lange anpassen, bis alles grün ist.
- [ ] **Step 4: Im eingebauten Browser durchspielen** (`?level=1-1&debug`), quer und hochkant. Liegt etwas zu weit oben oder unten im Bild, oder gibt es eine unfaire Stelle (Gegner direkt nach einer Landung, blinder Sprung), wird nachgebessert.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "Level 1-1: Sonnige Almwiese"`

---

### Task 18: Abschluss und zweiter Handy-Test

**Files:**
- Modify: nach Bedarf

- [ ] **Step 1: Alles prüfen.** `npm run typecheck && npm test && npm run build`. Erwartet: keine Fehler, alle Tests grün.
- [ ] **Step 2: Im eingebauten Browser** mit `npm run preview` das ganze Spiel hochkant und quer durchspielen. Dabei: Drehen im Spiel, Drehen in der Pause, Tab wechseln, Ton an und aus, nach dem Neuladen bleibt die Bestzeit. Konsole ohne Fehler. Bildrate im Debug-Modus stabil bei ca. 60.
- [ ] **Step 3: Push.** `git push`, danach mit `gh run list --limit 1` den Erfolg abwarten und `curl -sI https://philippdererbauer.github.io/kraxel/ | head -1`. Erwartet: `HTTP/2 200`.
- [ ] **Step 4: Zweiter Handy-Test.** Den Repo-Inhaber bitten, `https://philippdererbauer.github.io/kraxel/` vom Home-Bildschirm zu spielen und Rückmeldung zu geben. Falls Task 11 ohne Antwort blieb, die Bewegungswerte hier noch einmal ansprechen.
- [ ] **Step 5:** Rückmeldung umsetzen (mit Tests, falls Logik betroffen), committen, pushen.
