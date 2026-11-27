# M2 Schritt 3: Level 1-2 bis 1-4 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Platzhalter 1-2, 1-3 und 1-4 werden zu echten Leveln. Dafür kommen bewegliche Plattformen (treibende Baumstämme) und Bachwasser dazu.

**Architecture:**
- Plattformen und Wasser sind reine Kern-Logik mit Tests.
- Die Level sind Textdateien mit Erreichbarkeits-Tests wie bei 1-1: echte Eingabe-Skripte, kein Teleportieren zum Ziel.
- Das Zeichnen geschieht in `world-view.ts`.

**Tech Stack:** Phaser 4.2.1, TypeScript strict, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-26-kraxel-meilenstein-2-design.md`, Abschnitte 7.4, 7.6, 8 und 11.3. Regeln für Level 1-1 und Edelweiß stehen in `docs/superpowers/specs/2026-11-23-kraxel-design.md`, Abschnitt 9, Meilenstein 1.

## Global Constraints

**Code**
- TypeScript strict mit `erasableSyntaxOnly` und `verbatimModuleSyntax`, Importe enden auf `.ts`.
- `src/core` bleibt ohne Phaser und DOM.
- Kommentare und Testnamen auf Deutsch.
- Die Bewegungswerte bleiben unverändert.

**Bewegliche Plattformen**
- Waagerecht oder senkrecht, 2 bis 4 Kacheln breit, 1 Kachel hoch, wobei nur die Oberseite trägt.
- Von unten und von der Seite kann man hindurchspringen (One-Way).
- Die Bewegung ist deterministisch: Hin und her (Ping-Pong) zwischen Start und Start + Weg, mit festem Tempo.
- Wer darauf steht, fährt mit. Das gilt für Kraxel, Gegner und Pickups.
- Sie werden nie als Falle eingesetzt, die zerquetscht. Der Validator weist Plattformen ab, deren Weg feste Zellen schneidet.
- Angegeben werden sie im Levelkopf mit einer Zeile pro Plattform: `plattform: cx cy breite achse weg tempo art`. Dabei ist `achse` `h` oder `v`, `weg` in Kacheln (positiv: nach rechts bzw. unten), `tempo` in Kacheln/s und `art` `stamm` oder `stein`.

**Bachwasser**
- Neues Zeichen `W`, nicht fest. Wer es berührt, stirbt wie in einer Grube.
- Gegner und Pickups, die hineinfallen, verschwinden.
- Gezeichnet wird es animiert. Die Oberfläche liegt an der Oberkante der Zelle.

**Level**
- Jedes Level hat:
  - ca. 180–240 Kacheln Breite und 14–24 Kacheln Höhe;
  - genau ein `Z` und ein Steinmännchen `S` etwa in der Mitte (40–65 % der Breite);
  - drei Edelweiß nach den Regeln aus M1 (eins hinter Felsblöcken, eins nur per Kraxeln oder Wandsprung, eins in einem versteckten Bereich);
  - Gruben höchstens 4 Kacheln ohne Rennen und höchstens 6 mit Rennen;
  - keine blinden Sprünge, keinen Gegner direkt an einer Landestelle und keinen Tod ohne Vorwarnung.
- Namen ohne „(BAUSTELLE)“: `Blumenhang`, `Bachgrund`, `Gratwanderung`.
- Das Design verlangt pro Level:
  - **1-2 Blumenhang:** viel nach oben, mit Abschnitten höher als ein Bildschirm. Führt die Blätterpolster ein. Die Steinschleuder liegt in einer Kiste `J` (vorher ein `H`, damit der Helm schon da ist). Danach Schnecken auf Plattformen, die man mit Kieseln besiegt.
  - **1-3 Bachgrund:** treibende Baumstämme über einem Bach (waagerechte und senkrechte Plattformen, Art `stamm`, über `W`). Oben hinter einer Felswand liegt der geheime Ausgang `G`, erreichbar mit Helm von unten oder per Stampfen. Wer stur nach rechts rennt, kommt zum normalen Ziel `Z`.
  - **1-4 Gratwanderung:** das schwerste Graswelt-Level, mit langen Gruben (bis zur Grenze), vielen Gegnern und einer Kiste `E` mit dem Goldenen Enzian für einen Sprint durch eine Gegnerreihe.
- Zielgruppe sind erfahrene Plattformspieler: anspruchsvoll, aber fair. Alles ist eigen; nichts darf Nintendo-Levels nachbauen.

**Commits**
- Auf Deutsch, mit der Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Dateien einzeln stagen.

## Review Focus

1. **Kraxel steht auf einer Plattform, die an einer Wand vorbeifährt:** Er wird nicht in die Wand geschoben und nicht hindurchgeschoben. Er bleibt an der Wand stehen und rutscht von der Plattform. Test in Task 1.
2. **Kraxel springt von unten durch eine Plattform und landet darauf:** Er steht danach stabil darauf, ohne Zittern oder Durchfallen. Das gilt auch, wenn sie sich senkrecht nach unten bewegt. Test in Task 1.
3. **Kraxel steht auf einer abwärts fahrenden Plattform:** Er bleibt darauf, statt in der Luft zu hängen. Fährt sie nach oben, wird er nicht in eine Decke gedrückt (der Validator verhindert das). Test in Task 1.
4. **Wasser am Rand einer Grube:** Der Tod kommt erst bei wirklicher Berührung, nicht schon durch die Kachel darüber. Test in Task 1.
5. **Jedes Level ist auch ohne Wissen machbar:** Die Gruben sind mit Renntempo zu schaffen, und mit echter Kamera und wartendem Spieler steht kein Gegner an einer Landestelle. Tests wie bei 1-1, in Task 2–4.

---

### Task 1: Bewegliche Plattformen und Bachwasser

**Files:**
- Create: `src/core/platforms.ts`
- Modify:
  - `src/core/level.ts`: Kopfzeile `plattform:`, Zeichen `W`, Validierung
  - `src/core/types.ts`: `Cell.Water`
  - `src/core/game.ts`: Plattformen im `GameState`, Schritt vor dem Spieler, Mitfahren, Wasser-Tod
  - `src/core/player.ts` bzw. `collide.ts`: One-Way-Oberseite als Boden
  - `src/core/enemies.ts` und `src/core/pickups.ts`: Mitfahren, Wasser
  - `src/render/world-view.ts`: Stämme, Steinplatten, Wasser
  - `src/gfx/sprites.ts`: Grafik `log`, `stoneSlab`, Wasserkachel
  - `src/scenes/GalleryScene.ts`
- Test: `src/core/platforms.test.ts`, `src/core/water.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface PlatformSpec { cx: number; cy: number; width: number; axis: 'h' | 'v'; travel: number; speed: number; art: 'stamm' | 'stein' }
  export interface PlatformState { spec: PlatformSpec; x: number; y: number; dir: 1 | -1; dx: number; dy: number } // dx/dy: Bewegung im letzten Schritt
  // LevelData: platforms: PlatformSpec[]
  export function createPlatforms(specs: readonly PlatformSpec[]): PlatformState[];
  export function stepPlatforms(list: PlatformState[], dt: number): void;
  export function standingOn(body: Body, list: readonly PlatformState[]): PlatformState | null; // Füße auf der Oberkante, waagerecht überlappend
  ```
- Der Spieler gilt auf einer Plattform als `grounded`. Coyote-Zeit, Springen und Rennen funktionieren dort wie auf Boden.
- Mitfahren funktioniert so:
  1. Vor der eigenen Bewegung wird der Körper um `dx/dy` der Plattform verschoben.
  2. Diese Verschiebung läuft über `moveBody`, damit Wände und Decken blocken.
  3. Fährt die Plattform nach unten, bleibt der Fahrer auf der Oberkante.

- [ ] **Step 1: Failing tests**
  ```ts
  it('Kopfzeile plattform wird gelesen, ungültige Werte und Wege durch feste Zellen werden gemeldet', () => { /* parseLevel + validateLevel */ });
  it('Plattform pendelt deterministisch zwischen Start und Start+Weg', () => { /* nach travel/speed s am Ende, dann zurück */ });
  it('Kraxel landet von oben und fährt waagerecht mit', () => { /* x ändert sich mit der Plattform */ });
  it('von unten hindurchspringen und oben stabil landen, auch bei abwärts fahrender Plattform', () => { /* kein Durchfallen über 120 Schritte */ });
  it('Plattform fährt an einer Wand vorbei: Kraxel wird nicht hineingeschoben', () => { /* body bleibt außerhalb der Wandzelle */ });
  it('Springen und Rennen von der Plattform wie vom Boden, Coyote-Zeit gilt', () => { /* … */ });
  it('Gegner und Items fahren mit', () => { /* Käfer auf Plattform */ });
  it('Wasser: Berührung tötet, die Kachel darüber nicht; Gegner und Items verschwinden darin', () => { /* … */ });
  ```
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** umsetzen.
- [ ] **Step 4:** `npm test`, `npm run typecheck`, `npm run build` grün.
- [ ] **Step 5: Browser-Check** auf einem kleinen Prüf-Level. Dieses darf nicht im Repo landen oder muss vor dem Commit gelöscht werden. Danach den Übungsplatz um zwei Stämme über Wasser vor dem Ziel ergänzen; die Übungsplatz-Tests bleiben gültig.
- [ ] **Step 6: Commit** `Bewegliche Plattformen und Bachwasser`

### Task 2: Level 1-2 Blumenhang

**Files:**
- Modify: `src/levels/1-2.txt` (ersetzt den Platzhalter vollständig)
- Create: `src/levels/level-1-2.test.ts`
- Modify: `src/levels/placeholders.test.ts` (1-2 dort herausnehmen)

**Interfaces:**
- Consumes: Task 1 (Plattformen), Items und Polster aus Schritt 2.
- Tests nach dem Muster von `src/levels/level-1-1.test.ts`:
  - gültig, Maße, ein Steinmännchen in der Mitte, Name
  - `H` vor `J`, mindestens 3 `L`, mindestens 3 `s` auf Plattformen
  - die Lehrstellen (Polster nach oben, Schnecke mit Kieseln besiegbar)
  - die drei Edelweiß jeweils mit und ohne die nötige Technik
  - alle Gruben mit Renntempo, Landestellen mit echter Kamera und wartendem Spieler

- [ ] **Step 1:** Tests schreiben → FAIL.
- [ ] **Step 2:** Level bauen, bis alle Tests grün sind.
- [ ] **Step 3: Browser-Durchlauf** hochkant und quer mit `?level=1-2&debug`. Unfaire Stellen bessern.
- [ ] **Step 4: Commit** `Level 1-2: Blumenhang`

### Task 3: Level 1-3 Bachgrund

**Files:**
- Modify: `src/levels/1-3.txt`
- Create: `src/levels/level-1-3.test.ts`
- Modify: `src/levels/placeholders.test.ts`

**Interfaces:**
- Wie Task 2, zusätzlich:
  - mindestens 4 Plattformen der Art `stamm` über `W`, davon mindestens eine senkrecht
  - `G` hinter einer Felswand, erreichbar mit Helm oder Stampfen, ohne beides nicht
  - Dauerlauf nach rechts erreicht `Z` und nicht `G`

- [ ] Steps wie Task 2. **Commit** `Level 1-3: Bachgrund`

### Task 4: Level 1-4 Gratwanderung

**Files:**
- Modify: `src/levels/1-4.txt`
- Create: `src/levels/level-1-4.test.ts`
- Modify: `src/levels/placeholders.test.ts` (dort bleibt nur noch `1-F`)

**Interfaces:**
- Wie Task 2, zusätzlich:
  - mindestens zwei Gruben mit 5–6 Kacheln, nur mit Anlauf zu schaffen
  - mindestens 10 Gegner
  - eine `E`-Kiste vor einer Gegnerreihe, die mit dem Enzian in einem Lauf durchquerbar ist (Test: Enzian holen, nach rechts rennen, alle Gegner der Reihe besiegt, kein `hurt`)

- [ ] Steps wie Task 2. **Commit** `Level 1-4: Gratwanderung`
