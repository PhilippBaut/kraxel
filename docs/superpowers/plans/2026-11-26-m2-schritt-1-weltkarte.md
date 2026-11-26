# M2 Schritt 1: Weltkarte und Fortschritt — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Titel → begehbare Weltkarte der Graswelt → Level → zurück zur Karte. Geschaffte Level schalten Wege frei. Game Over und „ZUR KARTE“ führen auf die Karte. Leben, Kristalle und Helm gelten über Level hinweg.

**Architecture:**
- Reine Module in `src/core`: `save.ts` (v2 mit Migration), `worldmap.ts` (Karte, Freischalten, Wegwahl, Route) und `run.ts` (Spielrunde über Level).
- Die Kartendaten der Graswelt liegen in `src/maps/world1.ts`.
- Die Phaser-Szene `MapScene` zeichnet die Karte und bewegt die Kartenfigur. `UiScene` liefert weiter Steuerfeld und Knöpfe.
- Der Ablauf wird in Title/Play/Result/Pause verdrahtet.

**Tech Stack:** Phaser 4.2.1, TypeScript strict, Vite, Vitest (node).

**Spec:** `docs/superpowers/specs/2026-11-26-kraxel-meilenstein-2-design.md` (freigegeben 26.11.2026), Abschnitte 5, 6, 7.6 (geheimer Ausgang, Format-Teil) und 11.1. Dazu das Grund-Design `docs/superpowers/specs/2026-11-23-kraxel-design.md`.

## Global Constraints

- Code:
  - TypeScript strict mit `erasableSyntaxOnly` (keine Parameter-Properties, keine Enums) und `verbatimModuleSyntax`. Relative Importe enden auf `.ts`.
  - `src/core` und `src/maps` bleiben frei von Phaser und DOM.
  - Kommentare und Testnamen auf Deutsch.
- Sichtbare Texte stehen in `src/ui-text.ts`: Deutsch, Großbuchstaben, ß→SS.
- Bewegungswerte (`DEFAULT_TUNING`) und Level 1-1 bleiben unverändert.
- Speicherstand:
  - Neuer Schlüssel `kraxel-save-v2`.
  - Ein v1-Stand (`kraxel-save-v1`) wird übernommen, dabei gilt `completed: true` als normaler Ausgang.
  - Laden und Speichern werfen nie.
  - Die Knopf-Anordnung bleibt unter `kraxel-controls-v1`.
- Leben und Kristalle:
  - Ein App-Start beginnt mit 5 Leben (`START_LIVES`) und 0 Kristallen.
  - Game Over setzt auf 5 Leben und 0 Kristalle zurück, ohne Helm.
- Ziel-Ausgang und Helm:
  - Ein geschafftes Level (normal oder geheim) behält Helm, Leben und Kristalle.
  - Tod verliert den Helm.
  - „ZUR KARTE“ behält Leben, Kristalle und Helm und speichert die gefundenen Edelweiß.
- Karte:
  - Kraxel hält nur auf Punkten.
  - Die Wegwahl richtet sich nach der Richtung, gesperrte Wege sind nicht wählbar.
  - Punkte liegen ≥ 3 Kacheln auseinander. Beim Tipp gewinnt der nächste Punkt, ein zweiter Tipp auf den aktuellen Punkt betritt das Level.
  - Trefferflächen ≥ 44 pt (Rechnung über `layout.scale`, siehe `thumbHeight` in `src/view/thumb.ts`).
- Wege der Graswelt:
  - Hütte → 1-1 → 1-2 → 1-3 → 1-4 → Festung (`1-F`) → Platzhalter „FORTSETZUNG FOLGT“ (nicht betretbar).
  - Dazu die geheime Abkürzung 1-3 → Festung.
  - Die Ausgänge sind unabhängig.
- `?level=…` bleibt Entwickler-Zugang ohne Karte. Nach Ziel oder Game Over geht es zum Titel.
- Commits:
  - Auf Deutsch, letzte Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Dateien einzeln stagen.

## Review Focus

1. **Echter v1-Stand des Inhabers** (1-1 geschafft, Bestzeit, Edelweiß): Er wird übernommen, auf der Karte ist 1-2 offen und die Bestzeit sichtbar. Test in Task 1.
2. **Geheimer Ausgang von 1-3 zuerst gefunden:** Nur die Abkürzung zur Festung öffnet sich, 1-4 bleibt zu, die Festung ist erreichbar. Test in Task 2.
3. **Game Over oder „ZUR KARTE“:** Kraxel landet auf dem Punkt dieses Levels. Bei Game Over gibt es 5 Leben und 0 Kristalle ohne Helm, bei „ZUR KARTE“ bleibt alles. Tests in Task 3, Browser in Task 5.
4. **Drehen des Handys auf der Karte oder im Kartenmenü:** Das Layout passt sich an, Kraxel bleibt auf seinem Punkt, nichts ragt aus dem Bild. Browser in Task 4.
5. **Tipps auf der Karte:**
   - Auf einen gesperrten oder unerreichbaren Punkt läuft Kraxel nicht.
   - Liegt der Tipp zwischen zwei Punkten, gewinnt der nähere.
   - Ein Tipp auf den Pause-Knopf bewegt Kraxel nicht.
   - Tests in Task 2, Browser in Task 4.

---

### Task 1: Speicherstand v2 mit Migration

**Files:**
- Modify: `src/core/save.ts`
- Test: `src/core/save.test.ts`
- Anpassen, falls nötig: Aufrufer von `recordResult` in `src/scenes/PlayScene.ts` (Signatur bleibt kompatibel durch den Default-Parameter).

**Interfaces:**
- Produces:
  ```ts
  export const SAVE_KEY = 'kraxel-save-v2';
  export const SAVE_KEY_V1 = 'kraxel-save-v1';
  export type ExitKind = 'normal' | 'secret';
  export interface LevelRecord { bestTime: number | null; edelweiss: [boolean, boolean, boolean]; completed: boolean; exits: { normal: boolean; secret: boolean } }
  export interface SaveData { version: 2; levels: Record<string, LevelRecord>; muted: boolean; musicMuted: boolean; lastNode: string | null }
  export function defaultSave(): SaveData;                       // levels {}, muted false, musicMuted false, lastNode null
  export function loadSave(store: KeyValueStore | null): SaveData; // v2 → sonst v1 migriert → sonst Standard
  export function writeSave(store: KeyValueStore | null, d: SaveData): void; // schreibt nur v2
  export function recordResult(d: SaveData, levelId: string, time: number, edelweiss: [boolean, boolean, boolean], exit?: ExitKind): { data: SaveData; newBest: boolean };
  export function recordEdelweiss(d: SaveData, levelId: string, edelweiss: [boolean, boolean, boolean]): SaveData;
  export function withLastNode(d: SaveData, node: string): SaveData;
  ```
  `exit` ist standardmäßig `'normal'`. `completed` wird bei jedem Ausgang wahr, `exits[exit]` ebenfalls. `bestTime` zählt für beide Ausgänge.

- [ ] **Step 1: Failing tests**
  ```ts
  it('v1-Stand wird übernommen: completed zählt als normaler Ausgang', () => {
    const v1 = { version: 1, levels: { '1-1': { bestTime: 83.5, edelweiss: [true, false, true], completed: true } }, muted: true };
    const s = mem(); s.setItem('kraxel-save-v1', JSON.stringify(v1));
    const d = loadSave(s);
    expect(d.version).toBe(2); expect(d.muted).toBe(true); expect(d.musicMuted).toBe(false); expect(d.lastNode).toBeNull();
    expect(d.levels['1-1']).toEqual({ bestTime: 83.5, edelweiss: [true, false, true], completed: true, exits: { normal: true, secret: false } });
  });
  it('v2 hat Vorrang vor v1', () => { /* beide Schlüssel gesetzt → v2-Inhalt */ });
  it('kaputter v2 mit gültigem v1 → v1 migriert; beides kaputt → Standard', () => { /* … */ });
  it('geheimer Ausgang setzt exits.secret, nicht exits.normal', () => {
    const r = recordResult(defaultSave(), '1-3', 70, [false, false, false], 'secret');
    expect(r.data.levels['1-3'].exits).toEqual({ normal: false, secret: true }); expect(r.data.levels['1-3'].completed).toBe(true);
  });
  it('withLastNode speichert den Punkt, writeSave schreibt nur v2', () => { /* mem(); writeSave; getItem('kraxel-save-v2') !== null; getItem('kraxel-save-v1') unverändert */ });
  it('falsche Form in v2 (exits fehlt, lastNode keine Zeichenkette) → Standard bzw. v1', () => { /* … */ });
  ```
  Die bestehenden Tests werden auf die v2-Form angepasst. Ihr Verhalten (Bestzeit, Zusammenführen, nie werfen) bleibt.
- [ ] **Step 2:** `npx vitest run src/core/save.test.ts` → FAIL.
- [ ] **Step 3:** Umsetzen. Die gründliche Formprüfung bleibt wie heute, ergänzt um `exits`, `musicMuted` und `lastNode`.
- [ ] **Step 4:** `npm test`, `npm run typecheck` → grün.
- [ ] **Step 5: Commit** `Speicherstand v2: Ausgänge, Musik-Schalter, letzter Kartenpunkt, Übernahme von v1`

### Task 2: Weltkarte als reines Modul und Daten der Graswelt

**Files:**
- Create: `src/core/worldmap.ts`, `src/maps/world1.ts`
- Test: `src/core/worldmap.test.ts`

**Interfaces:**
- Consumes: `SaveData`, `ExitKind` aus Task 1.
- Produces:
  ```ts
  export type NodeKind = 'hut' | 'level' | 'fortress' | 'teaser';
  export type Dir = 'left' | 'right' | 'up' | 'down';
  export interface MapNode { id: string; kind: NodeKind; cx: number; cy: number; levelId: string | null; name: string }
  export interface MapPath { from: string; to: string; via: ExitKind | 'always'; cells: ReadonlyArray<readonly [number, number]> } // von from bis to einschließlich, 4er-Nachbarschaft
  export interface WorldMap { world: number; width: number; height: number; tiles: readonly string[]; nodes: readonly MapNode[]; paths: readonly MapPath[]; start: string }
  export function validateMap(m: WorldMap, levelIds: readonly string[]): string[];
  export function pathOpen(m: WorldMap, p: MapPath, save: SaveData): boolean;   // 'always' oder save.levels[from.levelId]?.exits[via]
  export function nodeOpen(m: WorldMap, id: string, save: SaveData): boolean;   // von start aus über offene Wege erreichbar
  export function pickDirection(m: WorldMap, at: string, dir: Dir, save: SaveData): { to: string; cells: ReadonlyArray<readonly [number, number]> } | null; // Wegzellen in Laufrichtung
  export function route(m: WorldMap, from: string, to: string, save: SaveData): string[] | null;  // Knotenfolge, nur offene Wege, Wege in beide Richtungen begehbar
  export function nodeAtPoint(m: WorldMap, x: number, y: number, radius: number): string | null;   // Kartenpixel, nächster Punkt innerhalb radius
  export function openedBetween(m: WorldMap, before: SaveData, after: SaveData): MapPath[];        // für die Einzeichen-Animation
  export function enterable(m: WorldMap, id: string, save: SaveData): boolean;                     // offen und Art level oder fortress
  ```
  `pickDirection` wählt unter den offenen Wegen am Punkt den, dessen erster Schritt (vom Punkt weg) am besten zur Richtung passt. Gewertet wird das Skalarprodukt mit dem Richtungsvektor, nur Werte > 0 zählen. Gibt es keinen passenden Weg, ist das Ergebnis `null`.
- `src/maps/world1.ts` exportiert `WORLD1: WorldMap`:
  - 16×12 Kacheln (ein Hochkant-Bild).
  - Kachelzeichen nur zur Deko, wie der Bauende sie festlegt (z. B. `.` Wiese, `~` Bach, `T` Baum, `^` Hügel, `f` Blumen).
  - Punkte:
    - `hut`
    - `1-1` (Sonnige Almwiese)
    - `1-2` (Blumenhang)
    - `1-3` (Bachgrund)
    - `1-4` (Gratwanderung)
    - `1-F` (Wurzelburg, fortress)
    - `teaser` (FORTSETZUNG FOLGT, Art `teaser`, levelId null)
  - Wege:
    - hut→1-1 `always`
    - 1-1→1-2 `normal`
    - 1-2→1-3 `normal`
    - 1-3→1-4 `normal`
    - 1-4→1-F `normal`
    - 1-3→1-F `secret`
    - 1-F→teaser `normal`

- [ ] **Step 1: Failing tests**
  ```ts
  const save = (levels: Record<string, Partial<LevelRecord>>) => ({ ...defaultSave(), levels: /* auffüllen */ });
  it('WORLD1 ist gültig', () => { expect(validateMap(WORLD1, ['1-1', '1-2', '1-3', '1-4', '1-F'])).toEqual([]); });
  it('Validator meldet Wege mit Sprüngen, Punkte zu nah (< 3 Kacheln), unbekannte Level, Wege ohne Start/Ziel', () => { /* je ein kaputtes Beispiel → mindestens eine Meldung */ });
  it('neuer Stand: nur Hütte und 1-1 offen', () => { expect(['hut', '1-1'].every((n) => nodeOpen(WORLD1, n, defaultSave()))).toBe(true); expect(nodeOpen(WORLD1, '1-2', defaultSave())).toBe(false); });
  it('1-1 geschafft → 1-2 offen', () => { /* … */ });
  it('geheimer Ausgang von 1-3 zuerst: Festung offen, 1-4 zu', () => {
    const s = save({ '1-1': { exits: { normal: true, secret: false } }, '1-2': { exits: { normal: true, secret: false } }, '1-3': { exits: { normal: false, secret: true } } });
    expect(nodeOpen(WORLD1, '1-F', s)).toBe(true); expect(nodeOpen(WORLD1, '1-4', s)).toBe(false);
  });
  it('pickDirection folgt der Richtung, gesperrte Wege nie, sonst null', () => { /* an 1-3 mit beiden Ausgängen: zwei Richtungen → zwei Ziele; ohne Ausgänge nur zurück zu 1-2 */ });
  it('route läuft nur über offene Wege und auch rückwärts', () => { /* 1-3 → hut über 1-2, 1-1; zu 1-4 ohne Ausgang → null */ });
  it('nodeAtPoint: nächster Punkt gewinnt, außerhalb radius null', () => { /* Punkt genau zwischen zwei Punkten etwas näher an einem */ });
  it('openedBetween liefert genau die neu offenen Wege', () => { /* vorher 1-1 offen, nachher 1-1 normal geschafft → [1-1→1-2] */ });
  it('teaser ist nie betretbar, Hütte auch nicht', () => { /* enterable false */ });
  ```
- [ ] **Step 2:** `npx vitest run src/core/worldmap.test.ts` → FAIL.
- [ ] **Step 3:** Umsetzen. `route` ist eine Breitensuche über offene Wege.
- [ ] **Step 4:** `npm test`, `npm run typecheck` → grün.
- [ ] **Step 5: Commit** `Weltkarte: Punkte, Wege, Freischalten, Wegwahl und Route; Karte der Graswelt`

### Task 3: Spielrunde über Level, geheimes Gipfelkreuz, Platzhalter-Level

**Files:**
- Create: `src/core/run.ts`, `src/levels/1-2.txt`, `src/levels/1-3.txt`, `src/levels/1-4.txt`, `src/levels/1-F.txt`
- Modify: `src/core/game.ts` (Helm beim Start, Ausgangsart im goal-Event), `src/core/level.ts` (Zeichen `G` = geheimes Gipfelkreuz, Validierung), `src/core/types.ts` (goal-Event), `src/render/world-view.ts` (goldenes Gipfelkreuz)
- Test: `src/core/run.test.ts`, `src/core/game.test.ts`, `src/core/level.test.ts`, `src/levels/placeholders.test.ts`

**Interfaces:**
- Consumes: `ExitKind` aus Task 1.
- Produces:
  ```ts
  // run.ts
  export interface RunState { lives: number; crystals: number; helm: boolean }
  export function newRun(): RunState;                                  // START_LIVES, 0, false
  export function sessionFor(run: RunState): Session;                  // lives, crystals, time 0, edelweiss [false,false,false]
  export function runAfterLevel(run: RunState, s: GameState): RunState; // Ziel oder ZUR KARTE: lives/crystals aus s.session, helm aus s.player.helm
  export function runAfterGameOver(): RunState;                        // = newRun()
  // game.ts
  export function createGame(level: LevelData, session?: Session, opts?: { helm?: boolean }): GameState;
  // types.ts: goal-Event bekommt exit
  { type: 'goal'; bonusCrystals: number; extraLife: boolean; exit: ExitKind }
  ```
  - `G` verhält sich wie `Z` (Bonushöhe, Zielphase), meldet aber `exit: 'secret'`. Ein Level darf höchstens ein `G` haben.
  - Wird der Helm aus `opts.helm` getragen, geht er beim Tod verloren, wie heute.
  - `restartLevel` setzt auf den Stand vom Levelstart zurück, einschließlich des Helms vom Start.
- Platzhalter-Level, jeweils ca. 40–60 Kacheln, gültig, mit Gipfelkreuz, kurz und flach mit ein paar Sprüngen:
  - `1-2` Blumenhang
  - `1-3` Bachgrund, mit erreichbarem `G` auf einem kurzen Seitenweg, damit die Abkürzung testbar ist
  - `1-4` Gratwanderung
  - `1-F` Wurzelburg, mit `world: 1`
  - Der Name steht im Kopf. Bis die echten Level in Schritt 3 und 4 kommen, endet er mit dem Zusatz ` (BAUSTELLE)`.

- [ ] **Step 1: Failing tests**
  ```ts
  it('neue Runde: 5 Leben, 0 Kristalle, kein Helm', () => { expect(newRun()).toEqual({ lives: START_LIVES, crystals: 0, helm: false }); });
  it('Helm aus der Runde: createGame mit helm, nach Tod weg', () => { const s = createGame(L, sessionFor({ ...newRun(), helm: true }), { helm: true }); expect(s.player.helm).toBe(true); /* killPlayer, Respawn → false */ });
  it('runAfterLevel übernimmt Leben, Kristalle, Helm', () => { /* s.session.lives=3, crystals=42, player.helm=true → {3,42,true} */ });
  it('geheimes Gipfelkreuz meldet exit secret, normales exit normal', () => { /* gameFrom mit G bzw. Z; runGame → goal-Event mit exit */ });
  it('zwei G sind ungültig', () => { /* validateLevel meldet */ });
  it('Platzhalter-Level sind gültig, 1-3 hat ein erreichbares G', () => { /* parseLevel+validateLevel für 1-2,1-3,1-4,1-F; 1-3: Eingabe-Skript erreicht G → goal exit secret */ });
  ```
- [ ] **Step 2:** Fokussierte Tests laufen lassen → FAIL.
- [ ] **Step 3:** Umsetzen. Das goldene Gipfelkreuz entsteht als Tönung oder Variante des Sprites `cross`. Die Galerie zeigt es.
- [ ] **Step 4:** `npm test`, `npm run typecheck` → grün.
- [ ] **Step 5: Commit** `Spielrunde über Level, geheimes Gipfelkreuz, Platzhalter für 1-2 bis 1-4 und Festung`

### Task 4: Kartenszene

**Files:**
- Create: `src/scenes/MapScene.ts`, Karten-Grafik in `src/gfx/` (z. B. `map-tiles.ts`: Kacheln, Wegstücke voll/gepunktet, Punkt offen/grau/geschafft, Hütte, Festung, Platzhalter-Schild, Kartenfigur)
- Modify: `src/main.ts` (Szene registrieren), `src/scenes/UiScene.ts` (Kartenmodus), `src/scenes/PauseScene.ts` (Zusammenhang Karte/Level), `src/ui-text.ts`, `src/scenes/GalleryScene.ts` (neue Sprites)
- Test: `src/gfx/map-tiles.test.ts` (Raster-Maße und Randtest wie bei den bestehenden Sprites)

**Interfaces:**
- Consumes: Task 2 (alles aus `worldmap.ts`, `WORLD1`), Task 1 (`loadSave`, `writeSave`, `withLastNode`), Task 3 (`RunState` über Registry `'run'`), `thumbHeight`/`layout.scale`, `formatTime`.
- Produces:
  - Szene `'map'` mit `init(data?: { arriveAt?: string; opened?: MapPath[] })`.
  - Registry `'run'` (RunState). Fehlt sie, setzt die Szene `newRun()`.
  - Game-Event `'ui-mode'` mit dem Wert `'map' | 'play'`: `UiScene` blendet die Spiel-Info-Leiste im Kartenmodus aus. Steuerfeld, Steuerkreuz und Sprungknopf bleiben.
  - `PauseScene.init(data?: { context: 'play' | 'map' })`. Karte: WEITER, TON, STEUERUNG, TITEL. Level: WEITER, NEU STARTEN, ZUR KARTE, TON, STEUERUNG. Die Menühöhe passt über `fitButtonHeight`.
  - Neue Texte: `TEXT.TO_MAP = 'ZUR KARTE'`, `TEXT.TO_TITLE = 'TITEL'`, `TEXT.COMING_SOON = 'FORTSETZUNG FOLGT'`, `TEXT.NO_TIME = '-:--'`.

Verhalten:
- **Bild:**
  - Hochkant liegt die Karte im Spielbild-Bereich (256×192 = 16×12 Kacheln).
  - Quer wird sie mittig gezeichnet. Seitlich füllt Wiese, oben bleibt die Info-Leiste frei.
- **Infos zum Punkt:** Name, Bestzeit (`formatTime` oder `TEXT.NO_TIME`) und 3 × `iEdel`/`iEdelOff` des aktuellen Punkts. Hochkant stehen sie im Steuerfeld über dem Steuerkreuz, quer in einer Leiste oben.
- **Steuerkreuz:**
  - Ein Druck auf eine Richtung ruft `pickDirection` auf. Kraxel läuft die Wegzellen mit ca. 5 Kacheln/s ab, die Kartenfigur ist animiert.
  - Während er läuft, wird keine neue Richtung angenommen. Ein Sprung-Druck nach der Ankunft zählt.
- **Sprung oder zweiter Tipp:** Ist `enterable`, wird das Level betreten. Die eigentliche Verdrahtung macht Task 5. Hier ruft die Szene eine Methode `enterLevel(levelId)` auf, die vorerst `scene.start('play', { levelId, fromMap: true })` ausführt.
- **Tipp auf die Karte:**
  - `nodeAtPoint` mit einem Radius von 22 pt, umgerechnet in Kartenpixel.
  - Ist der Punkt erreichbar, läuft Kraxel die `route` Punkt für Punkt ab.
  - Ein Tipp auf `layout.pauseHit` öffnet das Kartenmenü und bewegt Kraxel nicht.
- **Freischalt-Animation:** Ist `opened` übergeben, zeichnen sich diese Wege Zelle für Zelle ein (ca. 0,6 s pro Weg). Erst danach nimmt die Szene Eingaben an.
- **`lastNode`:** Bei jeder Ankunft auf einem Punkt wird er gespeichert. Beim Start steht Kraxel auf `arriveAt`, sonst auf `lastNode`, wenn dieser offen ist, sonst auf `start`.
- **Drehen:** Auf das Event `'layout'` hin wird neu angeordnet. Die Kartenposition bleibt, ein laufender Weg läuft weiter.

- [ ] **Step 1: Failing test** für die Grafik-Raster (neue Sprites mit gültigen Maßen und Rand), wie die bestehenden Sprite-Tests.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Szene, Grafik, Kartenmodus der `UiScene` und Pause-Zusammenhänge bauen.
- [ ] **Step 4:** `npm test`, `npm run typecheck`, `npm run build` → grün.
- [ ] **Step 5: Browser-Check** (`.claude/launch.json` „kraxel-dev“, vorläufig über `?map`, falls der Titel noch nicht verdrahtet ist; diesen Zugang darf der Bauende in `BootScene` ergänzen). Hochkant 375×812 und quer 812×375:
  - Neuer Stand: Nur Hütte und 1-1 sind offen, der Rest grau oder gepunktet.
  - Mit dem Steuerkreuz hin und her laufen. Den gesperrten Punkt antippen: Es passiert nichts.
  - Mit vorbereitetem `localStorage` (1-1 bis 1-3 geheim geschafft) sieht man Abkürzung und Festung offen, 1-4 zu.
  - Drehen, während Kraxel läuft.
  - Kartenmenü öffnen (TON, STEUERUNG, TITEL).
  - Screenshots, Konsole ohne Fehler.
- [ ] **Step 6: Commit** `Weltkarte: Kartenszene mit Laufen, Tippen, Freischalt-Animation und Kartenmenü`

### Task 5: Ablauf verdrahten

**Files:**
- Modify: `src/scenes/TitleScene.ts`, `src/scenes/PlayScene.ts`, `src/scenes/ResultScene.ts`, `src/scenes/PauseScene.ts`, `src/scenes/BootScene.ts`, `src/scenes/MapScene.ts`, `src/levels/index.ts` (`START_LEVEL` nur noch für den Entwickler-Zugang), `src/ui-text.ts`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: `PlayScene.init(data: { levelId: string; fromMap?: boolean })`. Liegt `fromMap` vor, startet sie mit `createGame(level, sessionFor(run), { helm: run.helm })`.

Ablauf:
- **Titel:** Ein Tipp oder eine Taste führt zur Karte (`'map'` plus `UiScene`). Der STEUERUNG-Knopf bleibt.
- **Levelstart:** Eine Titelkarte „1-2 BLUMENHANG“ steht ca. 1 s groß in der Mitte des Spielbilds. Solange ist das Spiel eingefroren und die Eingaben werden geschluckt.
- **Ziel:**
  - `recordResult(…, exit)` und `writeSave`, dann wird die Runde mit `runAfterLevel` aktualisiert.
  - Der Ergebnisbildschirm zeigt NOCHMAL und WEITER.
  - WEITER führt zur Karte mit `arriveAt` = der Punkt dieses Levels und `opened` = `openedBetween(vorher, nachher)`.
  - NOCHMAL startet das Level mit der Runde vom Levelbeginn neu.
- **Game Over:** „GAME OVER“ 2 s, dann `runAfterGameOver()` und die Karte mit `arriveAt` = dieser Punkt. Gefundene Edelweiß werden wie heute gespeichert.
- **Pause ZUR KARTE:** Edelweiß speichern, `runAfterLevel`, dann die Karte mit `arriveAt` = dieser Punkt.
- **Entwickler-Zugang `?level=`:** `fromMap` ist falsch. Nach Ziel oder Game Over geht es zum Titel, ZUR KARTE fehlt im Pausenmenü.
- **Neue Texte:** `TEXT.GAME_OVER` bleibt. Die Level-Titelkarte nutzt den Levelnamen in Großbuchstaben, ß→SS über eine kleine Hilfsfunktion mit Test.

- [ ] **Step 1: Failing test** für die Hilfsfunktion der Titelkarte (`levelTitle('1-2', 'Blumenhang') === '1-2 BLUMENHANG'`, `ß`→`SS`) und für einen reinen Ablauf-Helfer, falls einer entsteht.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Verdrahten.
- [ ] **Step 4:** `npm test`, `npm run typecheck`, `npm run build` → grün.
- [ ] **Step 5: Browser-Check** hochkant und quer:
  - Titel → Karte → 1-1 → Ziel → WEITER: Der Weg zu 1-2 zeichnet sich ein, Kraxel steht auf 1-1.
  - 1-2 betreten: Titelkarte, dann absichtlich alle Leben verlieren → Karte auf 1-2, 5 Leben.
  - 1-2 mit Helm beginnen (Helm in 1-1 holen und das Ziel erreichen) → Helm in 1-2 vorhanden.
  - ZUR KARTE aus 1-3: Leben bleiben.
  - Geheimes `G` in 1-3 → Abkürzung offen, 1-4 zu.
  - Neu laden: `lastNode` stimmt.
  - `?level=uebungsplatz`: Nach dem Ziel geht es zum Titel.
  - Konsole ohne Fehler.
- [ ] **Step 6: Commit** `Ablauf: Titel → Karte → Level → Karte, Game Over und ZUR KARTE auf die Karte, Level-Titelkarte`
