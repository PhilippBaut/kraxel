# M2 Schritt 4: Wurzelburg und Murmelkönig Grummel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Festung 1-F „Wurzelburg“ ersetzt den Platzhalter. Sie hat Steinschlag, Steinplatten und am Ende den Zwischengegner Murmelkönig Grummel in einer festen Arena. Wer ihn besiegt, schafft die Graswelt.

**Architecture:**
- Steinschlag und Murmelkönig sind Zustandsautomaten im reinen Spielkern und werden getestet.
- Die Arena ist ein Bereich im Levelformat. Darin bleibt die Kamera fest.
- Zeichnen und Ton übernehmen `world-view.ts` und `sfx.ts`.
- Auf der Karte erscheint ein Band „GRASWELT GESCHAFFT!“.

**Tech Stack:** Phaser 4.2.1, TypeScript strict, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-26-kraxel-meilenstein-2-design.md`, Abschnitte 7.5, 9 und 11.4.

## Global Constraints

**Code**
- TypeScript strict mit `erasableSyntaxOnly` und `verbatimModuleSyntax`, Importe enden auf `.ts`.
- `src/core` bleibt ohne Phaser und DOM.
- Kommentare und Testnamen auf Deutsch.
- Die Bewegungswerte bleiben unverändert.

**Steinschlag**
- Neues Zeichen `R` für einen Brocken an der Decke.
- Kommt Kraxel waagerecht innerhalb von 1,5 Kacheln darunter, rieselt ca. 0,6 s Staub und es rumpelt.
- Danach fällt der Brocken mit Schwerkraft. Er trifft wie ein Gegner, also mit `damagePlayer`.
- Am Boden zerplatzt er.
- Nach Tod oder Respawn ist er wieder da.
- Events: `rockWarn`, `rockFall`, `rockBreak`.

**Arena**
- Kopfzeile `arena: x0 x1`, wobei x0..x1 die Kachelspalten sind, genau 16 breit.
- Betritt Kraxel die Arena (Körpermitte zwischen x0 und x1), schließt sich hinter ihm eine Tür.
  - Die Tür ist die Zelle in Spalte x0−1, die ab dann fest ist.
  - Die Kamera steht fest mittig auf der Arena.
  - Quer sieht man links und rechts Burgmauer.
- Nach dem Sieg erscheint das Gipfelkreuz mittig auf dem Arenaboden.

**Murmelkönig Grummel**
- 32×32 px, Zeichen `X`, steht in der Arena.
- Phasen:
  1. **Warten:** 1,0 s.
  2. **Eingraben:** 0,4 s, danach ist er weg.
  3. **Hügel:** Ein Erdhügel wandert mit 3 Kacheln/s auf Kraxel zu, höchstens 2,5 s lang. Danach bebt er 0,5 s an der Stelle.
  4. **Herausspringen:** Sprung mit ca. 3 Kacheln Höhe. Wer beim Herausspringen in seinem Körper steht, wird getroffen.
  5. **Benommen:** 1,2 s nach der Landung, mit Sternchen.
  6. **Steinwurf:** 1 Stein, nach dem ersten Treffer 2 Steine. Ein Bogen auf Kraxels Position, im Abstand von 0,4 s.
  7. Zurück zu Warten.
- Treffer:
  - Ein Treffer zählt nur in „Benommen“, durch Landen auf dem Kopf (Stampfregel wie beim Käfer) oder durch Stampfen.
  - Nach jedem Treffer gibt es 0,8 s Schonzeit und das Tempo steigt: Warten −0,25 s, Hügel +0,75 Kacheln/s.
  - Drei Treffer besiegen ihn.
- Berührung außerhalb von „Benommen“ kostet einen Treffer (`damagePlayer`).
- Kiesel prallen ab, ohne Wirkung.
- Der Enzian schützt Kraxel, besiegt den Murmelkönig aber nicht.
- Respawn setzt den Murmelkönig auf voll zurück.
- Events: `bossDig`, `bossPop`, `bossHit {hits}`, `bossDefeated`, `bossThrow`.

**Festung 1-F „Wurzelburg“**
- Kopfzeile `stil: burg`: dunkle Steinkacheln und Burg-Hintergrund. Der Bauende entscheidet, wie das umgesetzt wird.
- Ca. 120 Kacheln plus Arena.
- Steinplatten (`plattform … stein`) und mindestens 4 `R`.
- Keine Edelweiß. Die Validierung erlaubt das mit `requireEdelweiss: false`.
- Ein Steinmännchen `S` direkt vor dem Arenaeingang.
- Faire Sprünge nach denselben Regeln wie in den anderen Leveln.

**Karte**
- Nach dem Sieg über die Festung (normaler Ausgang von `1-F`) erscheint beim ersten Mal auf der Karte das Band „GRASWELT GESCHAFFT!“ (ca. 3 s).
- Dazu läuft eine eigene kurze Melodie, die zu Schritt 5 gehört. Bis dahin genügt der Klang `goal`.
- Danach zeichnet sich der Weg zu „FORTSETZUNG FOLGT“ ein. Das läuft über die vorhandene Freischalt-Animation.

**Commits**
- Commits auf Deutsch mit der Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Dateien einzeln stagen.

## Review Focus

1. Jeder Murmelkönig-Angriff ist mit Vorwarnung ausweichbar. Ein Test zeigt für Hügel, Herausspringen und Steinwurf, dass ein Ausweichskript ohne `hurt` durchkommt (Task 2).
2. Ein Treffer auf den Kopf außerhalb von „Benommen“ schadet Kraxel. Der Murmelkönig darf dabei keinen Treffer bekommen (Task 2).
3. Stirbt Kraxel in der Arena, startet er am Steinmännchen davor. Die Tür ist offen, und der Murmelkönig hat wieder volle Kraft (Task 2/3).
4. Steinschlag vor dem Steinmännchen: Wer stehen bleibt, sieht die Warnung lange genug (0,6 s) und kann ausweichen. Ein Test mit Ausweichen nach der Warnung (Task 1).
5. Drehen des Handys in der Arena ändert nichts am Kampf, weil die Arena fest 16 Kacheln breit ist (Task 3, Browser).

---

### Task 1: Steinschlag

**Files:**
- Create: `src/core/rockfall.ts`
- Modify: `src/core/level.ts` (Zeichen `R`), `src/core/game.ts`, `src/core/types.ts` (Events), `src/render/world-view.ts`, `src/gfx/sprites.ts` (Brocken, Staub), `src/audio/sfx.ts` (Rumpeln)
- Test: `src/core/rockfall.test.ts`

**Interfaces:**
```ts
export interface FallingRock { cx: number; cy: number; state: 'idle' | 'warn' | 'fall' | 'gone'; t: number; body: Body }
export const ROCK_TRIGGER_TILES = 1.5, ROCK_WARN_TIME = 0.6;
export function createRocks(spawns: readonly EntitySpawn[]): FallingRock[];
export function stepRocks(s: GameState, dt: number): GameEvent[];
```

- [ ] **Step 1:** Write failing tests:
  - Trigger distance.
  - 0.6 s warning before the fall.
  - A hit equals `damagePlayer`.
  - The rock breaks on the ground.
  - After respawn it is back.
  - Dodging after the warning gives no hit.
- [ ] **Step 2:** Run the tests → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests → green.
- [ ] **Step 5: Commit** `Steinschlag mit Vorwarnung`

### Task 2: Murmelkönig Grummel (Kern) und Arena (Kern)

**Files:**
- Create: `src/core/boss.ts`
- Modify: `src/core/level.ts` (Kopfzeile `arena:`, Zeichen `X`), `src/core/game.ts` (Arena-Tür, Murmelkönig im Schritt, Gipfelkreuz nach dem Sieg), `src/core/types.ts`, `src/core/pebbles.ts` (Kiesel prallen am Murmelkönig ab)
- Test: `src/core/boss.test.ts`

**Interfaces:**
```ts
export type BossPhase = 'wait' | 'dig' | 'mound' | 'tremble' | 'pop' | 'stunned' | 'throw' | 'defeated';
export interface BossState { phase: BossPhase; t: number; hits: number; body: Body; moundX: number; invuln: number; throwsLeft: number; rocks: Body[] }
export function createBoss(sp: EntitySpawn): BossState;
export function stepBoss(s: GameState, dt: number): GameEvent[];
// GameState: boss: BossState | null; arena: { x0: number; x1: number; closed: boolean } | null
```

- [ ] **Step 1:** Write failing tests:
  - The phase sequence with the times from the Global Constraints.
  - The mound follows Kraxel.
  - Pop-out hits only on the spot.
  - In "Benommen", a head hit counts; outside it, a head hit hurts Kraxel.
  - Pebbles bounce off.
  - Three hits give `bossDefeated` and the summit cross appears.
  - Speed rises per hit.
  - The arena door closes on entry.
  - Respawn opens the door and resets the boss.
  - A dodge script stays without `hurt` through mound, pop-out and rock throw.
  - Enzian: Kraxel takes no damage, and the boss is not defeated.
- [ ] **Step 2:** Run the tests → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests → green.
- [ ] **Step 5: Commit** `Murmelkönig Grummel und Arena`

### Task 3: Darstellung, Ton und Kamera für Arena und Murmelkönig

**Files:**
- Modify: `src/render/world-view.ts`, `src/gfx/sprites.ts`, `src/core/camera.ts` (Arena-Sperre), `src/scenes/PlayScene.ts` (falls nötig), `src/audio/sfx.ts`, `src/scenes/GalleryScene.ts`
- Test: `src/core/camera.test.ts` (Arena-Sperre in beiden Breiten)

**Graphics (style A, the builder decides the look):**
- The Murmelkönig: an original giant marmot with a small crown, 32×32 px, with frames for standing, digging, jumping, stunned and defeated.
- The mound, the thrown rock, the stars and the arena door.
- `stil: burg`: dark stone tiles and a castle background, using the existing background mechanism.

**Sound:**
- Digging, pop-out, hit, defeat and throw.
- Original sounds, nothing that resembles Nintendo.

- [ ] **Step 1:** Write a failing test for the camera lock: centred on the arena, unchanged at 256 and 416 px width.
- [ ] **Step 2:** Run the test → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests → green.
- [ ] **Step 5: Browser check** with a temporary test level that must not be committed. Check portrait and landscape, a whole fight, rotating during the fight, and no console errors.
- [ ] **Step 6: Commit** `Murmelkönig: Grafik, Ton, Arena-Kamera`

### Task 4: Festung 1-F Wurzelburg und Band „GRASWELT GESCHAFFT!“

**Files:**
- Modify: `src/levels/1-F.txt`, `src/levels/placeholders.test.ts` (it is removed or emptied), `src/scenes/MapScene.ts` (band on the first fortress clear), `src/ui-text.ts` (`TEXT.WORLD_CLEAR = 'GRASWELT GESCHAFFT!'`)
- Create: `src/levels/level-1-F.test.ts`

**Tests**, following the pattern of the other levels:
- The level is valid with `requireEdelweiss: false`.
- Size about 120 plus 16.
- At least 4 `R`, platforms of type `stein`, `S` directly before the arena, exactly one `X`, `arena` 16 wide.
- Pits doable with a run-up, landing spots fair.
- A full P→arena run.
- A full fight with a script to `bossDefeated` and the goal.
- Carry-in with helm and sling.

**Map:**
- Show the band when the 1-F normal exit is newly set, i.e. through `openedBetween` with a path from `1-F`.

- [ ] **Step 1:** Write the tests → FAIL.
- [ ] **Step 2:** Build the level until everything is green.
- [ ] **Step 3: Browser run** of the whole fortress and the fight, plus the band on the map.
- [ ] **Step 4: Commit** `Festung 1-F: Wurzelburg mit Murmelkönig`
