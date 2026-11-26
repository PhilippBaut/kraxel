# M2 Schritt 2: Steinschleuder, Goldener Enzian, Blätterpolster — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kraxel kann eine Steinschleuder tragen und mit dem Aktionsknopf Kiesel schießen. Der Goldene Enzian macht ihn ca. 8 s unverwundbar. Blätterpolster federn ihn hoch. Alles ist auf dem Übungsplatz ausprobierbar.

**Architecture:**
- Die Regeln liegen im reinen Spielkern: Items und Treffer in `game.ts`/`pickups.ts`, Kiesel in `src/core/pebbles.ts`, Polster als neue Zellenart.
- Grafik, Ton, Aktionsknopf und Übungsplatz kommen in der letzten Aufgabe.

**Tech Stack:** Phaser 4.2.1, TypeScript strict, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-26-kraxel-meilenstein-2-design.md` Abschnitte 7.1–7.3 und 11.2. Item-Regeln aus `docs/superpowers/specs/2026-11-23-kraxel-design.md` Abschnitt 5.4.

## Global Constraints

- **Code:**
  - TS strict mit `erasableSyntaxOnly` und `verbatimModuleSyntax`, Importe mit `.ts`.
  - `src/core` ohne Phaser und DOM.
  - Kommentare und Tests auf Deutsch.
  - Bewegungswerte unverändert.
- **Spezial-Item:**
  - Kraxel trägt höchstens eins, in diesem Schritt nur `'sling'`.
  - Es schließt den Helmschutz ein: Wer die Schleuder aufnimmt, hat auch den Helm.
  - Ein Treffer nimmt das Spezial-Item und lässt den Helm. Der nächste Treffer nimmt den Helm, der dritte tötet.
  - Spezial-Item und Helm gehen über Level hinweg mit (RunState), beim Tod gehen sie verloren.
- **Kisten:**
  - Neues Zeichen `J` für die Schleuder-Kiste: Sie gibt den Helm, wenn Kraxel keinen trägt, sonst die Schleuder. Trägt Kraxel die Schleuder schon, gibt es +10 Kristalle wie beim doppelten Helm.
  - Neues Zeichen `E` für die Enzian-Kiste: Sie gibt immer den Enzian.
- **Kiesel:**
  - Nur mit Schleuder, Auslöser ist `actionPressed`.
  - Höchstens 2 gleichzeitig, Abklingzeit 0,2 s.
  - Start in Blickrichtung auf Körpermitte, `vx = ±180 px/s`, `vy = −60 px/s`, Schwerkraft 300 px/s², Lebensdauer 1,2 s, Größe 4×4.
  - Zerplatzt an festen Zellen.
  - Besiegt Käfer und Schnecke (Event `enemyDefeated`).
  - Öffnet keine Kisten und zerschlägt keine Felsblöcke.
- **Enzian:**
  - Wirkt 8 s.
  - Kraxel nimmt keinen Schaden. Berührt er einen Gegner, ist der besiegt.
  - Er endet mit dem Level und geht nicht mit.
  - Er ändert nichts an Helm und Spezial-Item.
- **Blätterpolster:**
  - Neues Zeichen `L` mit neuer Zellenart. Seitlich und von unten ist es fest wie Boden.
  - Landet Kraxel von oben darauf, gilt `vy = −√(2·g·96)`, mit gehaltenem Sprung `−√(2·g·112)`. Dabei ist `g = jumpGravity(t)`. Das ergibt ca. 6 bzw. 7 Kacheln.
  - Wer auf ein Polster stampft, federt mit dem hohen Wert hoch.
  - Event `bounce`.
- **Texte und Commits:**
  - Texte stehen in `src/ui-text.ts`.
  - Commits auf Deutsch mit der Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, Dateien einzeln stagen.

## Review Focus

1. **Treffer-Reihenfolge mit Schleuder:** Kraxel verliert die Schleuder und behält den Helm, beim nächsten Treffer verliert er den Helm. Er stirbt nie direkt. Test in Task 1.
2. **Dauerfeuer:** Wer den Aktionsknopf hämmert, bekommt höchstens 2 Kiesel, nie mehr, und es entstehen keine Kiesel ohne Schleuder. Test in Task 2.
3. **Kiesel an Wand oder Decke direkt vor Kraxel:** Der Kiesel zerplatzt sofort. Er steckt nicht fest und fliegt nicht durch. Test in Task 2.
4. **Enzian-Ende mitten im Gegner:** Kraxel bekommt danach die gewohnte Schonzeit, keinen Sofort-Treffer. Test in Task 1.
5. **Blätterpolster am Rand oder schräg angesprungen:** Es federt nur von oben. Seitlich verhält es sich wie eine Wand, man bleibt nicht hängen. Test in Task 3.

---

### Task 1: Spezial-Item, Kisten J/E, Enzian, Treffer-Reihenfolge

**Files:**
- Modify: `src/core/types.ts` (ItemKind `'helm' | 'sling' | 'enzian'`, CrateContent), `src/core/level.ts` (Zeichen J und E), `src/core/blocks.ts` (Kisten-Inhalt nach Regel), `src/core/pickups.ts` (Aufnahme), `src/core/player.ts` (Felder `special: 'sling' | null`, `enzian: number`), `src/core/game.ts` (Schaden, Enzian-Kontakt, `createGame`-Option `special`), `src/core/enemies.ts` (Enzian-Berührung besiegt), `src/core/run.ts` (`special` in RunState)
- Test: `src/core/items.test.ts`, Anpassungen in `run.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type SpecialItem = 'sling';
  // PlayerState: special: SpecialItem | null; enzian: number (Restzeit s)
  export const ENZIAN_TIME = 8;
  export interface RunState { lives: number; crystals: number; helm: boolean; special: SpecialItem | null }
  export function createGame(level: LevelData, session?: Session, opts?: { helm?: boolean; special?: SpecialItem | null }): GameState;
  // Events: { type: 'powerUp'; item: ItemKind } (vorhanden), neu { type: 'enzianStart' } und { type: 'enzianEnd' }
  ```
- `damagePlayer`: Erst Enzian (kein Schaden), dann Schonzeit, dann `special` → `null` (Helm bleibt, Event `hurt`, Schonzeit), dann Helm, dann Tod.
- `restartLevel` stellt `special` vom Levelstart wieder her, wie den Helm.

- [ ] **Step 1: Failing tests**
  ```ts
  it('J ohne Helm gibt Helm, mit Helm Schleuder, mit Schleuder +10 Kristalle', () => { /* drei Spiele, Kiste von unten anstoßen, Item einsammeln */ });
  it('E gibt immer den Enzian', () => { /* auch ohne Helm */ });
  it('Schleuder aufnehmen setzt auch den Helm', () => { /* special 'sling' und helm true */ });
  it('Treffer-Reihenfolge: Schleuder, dann Helm, dann Tod', () => { /* drei Seitenkontakte nach Ablauf der Schonzeit */ });
  it('Enzian: kein Schaden, Gegner bei Berührung besiegt, nach 8 s vorbei', () => { /* enemyDefeated, kein hurt; nach 8 s enzian 0 */ });
  it('Enzian endet im Gegner: Schonzeit statt Sofort-Treffer', () => { /* Enzian läuft ab, während Kraxel einen Gegner berührt → invuln > 0, kein hurt im selben Schritt */ });
  it('Runde trägt Schleuder ins nächste Level, Tod nimmt sie', () => { /* runAfterLevel → special; createGame mit special; killPlayer + respawn → null */ });
  ```
- [ ] **Step 2:** → FAIL. **Step 3:** umsetzen. **Step 4:** `npm test`, `npm run typecheck` grün.
- [ ] **Step 5: Commit** `Items: Steinschleuder als Spezial-Item, Goldener Enzian, Kisten J und E, Treffer-Reihenfolge`

### Task 2: Kiesel

**Files:**
- Create: `src/core/pebbles.ts`
- Modify: `src/core/game.ts` (Kiesel im `GameState`, Schießen in `stepGame`, Treffer gegen Gegner), `src/core/types.ts` (Events `shoot`, `pebblePop`)
- Test: `src/core/pebbles.test.ts`

**Interfaces:**
- Consumes: `special` aus Task 1.
- Produces:
  ```ts
  export interface Pebble { body: Body; age: number }
  export const PEBBLE_MAX = 2, PEBBLE_COOLDOWN = 0.2, PEBBLE_SPEED = 180, PEBBLE_LIFT = 60, PEBBLE_GRAVITY = 300, PEBBLE_LIFE = 1.2, PEBBLE_SIZE = 4;
  export function shoot(s: GameState): GameEvent[];            // prüft Schleuder, Anzahl, Abklingzeit
  export function stepPebbles(s: GameState, dt: number): GameEvent[]; // Bewegung, Wände, Lebensdauer, Gegner
  // GameState: pebbles: Pebble[]; pebbleCooldown: number
  ```
- Kiesel zählen nur, solange die Phase `'playing'` ist. Tod und Respawn räumen sie weg.

- [ ] **Step 1: Failing tests**
  ```ts
  it('ohne Schleuder kein Kiesel', () => { /* actionPressed → pebbles.length 0 */ });
  it('Dauerfeuer: höchstens 2 gleichzeitig, Abklingzeit 0,2 s', () => { /* 30 Schritte action an/aus → nie > 2 */ });
  it('Kiesel fliegt in Blickrichtung mit leichtem Bogen', () => { /* nach 0,5 s x um ca. 90 px weiter, y etwas tiefer als der Start */ });
  it('Wand direkt vor Kraxel: Kiesel zerplatzt sofort', () => { /* gameFrom mit Wand eine Kachel vor Kraxel → pebblePop, pebbles leer */ });
  it('Kiesel besiegt Käfer und Schnecke, öffnet keine Kiste, zerschlägt keinen Felsblock', () => { /* … */ });
  it('Kiesel verschwindet nach 1,2 s', () => { /* freie Fläche */ });
  ```
- [ ] **Step 2:** → FAIL. **Step 3:** umsetzen. **Step 4:** grün.
- [ ] **Step 5: Commit** `Kiesel: Schleuder schießt höchstens zwei, Bogen, Wände, Gegner`

### Task 3: Blätterpolster

**Files:**
- Modify: `src/core/types.ts` (`Cell.LeafPad`), `src/core/level.ts` (Zeichen L), `src/core/grid.ts`/`collide.ts` (fest wie Boden), `src/core/player.ts` oder `game.ts` (Federn beim Landen von oben, auch aus dem Stampfen), Event `bounce`
- Test: `src/core/leafpad.test.ts`

**Interfaces:**
- Produces: `Cell.LeafPad`, `LEAF_BOUNCE_TILES = 6`, `LEAF_BOUNCE_HELD_TILES = 7`, Event `{ type: 'bounce'; cx: number; cy: number }`.

- [ ] **Step 1: Failing tests**
  ```ts
  it('Draufspringen federt ca. 6 Kacheln, mit gehaltenem Sprung ca. 7', () => { /* Scheitel über dem Polster: 96±8 px bzw. 112±8 px */ });
  it('Stampfen auf ein Polster federt hoch (hoher Wert) und beendet das Stampfen', () => { /* … */ });
  it('seitlich ist das Polster eine Wand, von unten eine Decke', () => { /* kein bounce-Event, normales Anstoßen */ });
  it('am Rand landen: federt, wenn die Füße auf dem Polster stehen', () => { /* nur Teilüberlappung zählt, wenn die Zelle unter der Körpermitte oder ein Fuß das Polster ist (Regel festlegen und testen) */ });
  ```
- [ ] **Step 2:** → FAIL. **Step 3:** umsetzen. **Step 4:** grün.
- [ ] **Step 5: Commit** `Blätterpolster: federt von oben, seitlich fest`

### Task 4: Grafik, Ton, Aktionsknopf, Übungsplatz

**Files:**
- Modify: `src/gfx/sprites.ts` (Schleuder-Item, Enzian, Kiesel, Blätterpolster-Kachel, HUD-Symbol `iSling`), `src/render/world-view.ts` (Kiesel, Enzian-Glitzern bzw. Blinken, Polster), `src/scenes/UiScene.ts` (Aktionsknopf nur mit Schleuder; `iSling` in der Info-Leiste), `src/scenes/PlayScene.ts` (`controls.setActionVisible`, Runde mit `special`, nichts sonst), `src/audio/sfx.ts` (Klänge `shoot`, `sparkle`, `bounce` und EVENT_SOUND), `src/levels/uebungsplatz.txt` (neuer Abschnitt am Ende vor dem Ziel: J- und E-Kiste, 3 Blätterpolster, Käfer und Schnecken zum Schießen), `src/scenes/GalleryScene.ts`
- Test: Sprite-Raster-Test, Übungsplatz bleibt gültig, `soundsForEvents` mappt die neuen Events

**Interfaces:**
- Consumes: Tasks 1–3.
- Dem Bauenden überlassen: Aussehen im Stil A, Tonfolgen. Sie dürfen nicht an Mario erinnern, also kein Feuerball-Zischen und kein Stern-Motiv.

- [ ] **Step 1: Failing tests** (Raster der neuen Sprites, Übungsplatz gültig mit J, E und L, `soundsForEvents` für `shoot`/`bounce`/`enzianStart`).
- [ ] **Step 2:** → FAIL. **Step 3:** umsetzen. PlayScene soll dabei nicht über ca. 400 Zeilen wachsen. Wird es mehr, kommt die Level-Ablauf-Logik in einen Helfer `src/scenes/level-flow.ts`.
- [ ] **Step 4:** `npm test`, `npm run typecheck`, `npm run build` grün.
- [ ] **Step 5: Browser-Check** (`?level=uebungsplatz` hochkant und quer):
  - Schleuder holen, der Aktionsknopf erscheint, Kiesel schießen, Käfer und Schnecke besiegen.
  - Getroffen werden: Die Schleuder ist weg, der Helm bleibt, der Aktionsknopf verschwindet.
  - Enzian holen: Kraxel glitzert, läuft durch Gegner, nach ca. 8 s ist es vorbei.
  - Polster: Federn normal und mit gehaltenem Sprung.
  - Auf der Karte: Die Schleuder geht ins nächste Level mit.
  - Konsole ohne Fehler, Screenshots.
- [ ] **Step 6: Commit** `Schleuder, Enzian, Blätterpolster: Grafik, Ton, Aktionsknopf, Übungsplatz`
