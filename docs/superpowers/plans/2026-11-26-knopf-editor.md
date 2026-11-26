# Knopf-Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spieler legen Lage und Größe von Steuerkreuz, Sprung- und Aktionsknopf selbst fest, getrennt für hochkant und quer, über „STEUERUNG“ im Pausenmenü und auf dem Titelbild.

**Architecture:** Ein reines Modul `src/view/controls-config.ts` beschreibt die Anordnung als Anteile am erlaubten Bereich plus Größe, prüft sie und wendet sie auf das Standard-Layout an. `computeLayout` nimmt die Anordnung als optionalen Parameter. `main.ts` hält die geladene Anordnung und wendet sie bei jeder Messung an. Ein neuer `ControlsScene` bearbeitet einen Arbeitsstand und meldet ihn per Game-Event zurück. Knopf-Texturen werden pro Radius bei Bedarf gebacken.

**Tech Stack:** Phaser 4.2.1, TypeScript strict, Vite, Vitest (node).

**Spec:** `docs/superpowers/specs/2026-11-26-knopf-editor-design.md` (freigegeben 26.11.2026), dazu `docs/superpowers/specs/2026-11-23-kraxel-design.md` Abschnitt 7 (Bildschirm und Steuerung).

## Global Constraints

- TypeScript strict mit `erasableSyntaxOnly` (keine Parameter-Properties, keine Enums) und `verbatimModuleSyntax`. Relative Importe enden auf `.ts`.
- `src/core` bleibt frei von Phaser und DOM. `src/view/controls-config.ts` ist ebenfalls rein (kein DOM, kein Phaser).
- Alle sichtbaren Texte stehen in `src/ui-text.ts`: Deutsch, Großbuchstaben, ß→SS. Die Pixelschrift kann `-` und `+`.
- Speicherschlüssel `kraxel-controls-v1`. Laden und Speichern werfen nie. Fehlt der Speicher oder ist er kaputt, gilt der Standard.
- Größe 0,75 bis 1,5 in Schritten von 0,125. Zwischen zwei gezeichneten Knöpfen bleiben mindestens 4 px frei.
- Erlaubter Bereich hochkant: Steuerfeld unter der Info-Zeile bis 4 px über dem unteren Safe-Area-Rand. Quer: Safe Area unter der 12 px hohen Info-Leiste bis 2 px über dem unteren Safe-Area-Rand, ohne die Pause-Fläche `pauseHit`.
- Die Trefferregel aus `zoneAt` bleibt unverändert. `hitR` wächst mit der Größe.
- Commits auf Deutsch, Zeilenende `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Dateien einzeln stagen, kein `git add -A`.

## Review Focus

1. **Gespeicherte Anordnung auf einem anderen Bildschirm** (anderes Handy, Seitenverhältnis, Safe Area): Knöpfe bleiben im Bereich und überlappen nicht, sonst gilt für diese Ansicht der Standard. Getestet in Task 1.
2. **Knopf auf einen anderen oder über den Rand ziehen:** Der Rand klemmt, eine Überlappung wird nicht übernommen, der Knopf bleibt stehen. Getestet in Task 1.
3. **Drehen bei offenem Editor:** Der Editor wechselt die bearbeitete Ansicht, der Arbeitsstand der anderen Ansicht bleibt erhalten. Getestet in Task 1 (`withOrientation`), Browser-Check in Task 3.
4. **Finger oder Taste, die den Editor schließen,** kommen im Spiel nicht als Sprung oder Richtung an. Geprüft in Task 3 (Browser, `controls.sample()` schlucken).
5. **Kaputter oder fremder Speicherinhalt** führt zum Standard, ohne Absturz. Getestet in Task 1.

---

### Task 1: Anordnung als reines Modul und im Layout

**Files:**
- Create: `src/view/controls-config.ts`
- Modify: `src/view/layout.ts` (Basisgrößen als exportierte Konstanten, neues Feld `controlsArea`, optionaler Parameter in `computeLayout`)
- Test: `src/view/controls-config.test.ts`, `src/view/layout.test.ts`

**Interfaces:**
- Produces in `layout.ts`:
  ```ts
  export const BASE_RADII: Readonly<Record<'portrait' | 'landscape', Readonly<Record<ButtonId, { r: number; hitR: number }>>>>;
  // hochkant: dpad 42/60, jump 28/44, action 16/24 · quer: dpad 32/60, jump 21/38, action 14/24 (die heutigen Werte)
  export interface Layout { /* … wie bisher … */ controlsArea: Rect }
  export function computeLayout(cssW: number, cssH: number, insets: Insets, controls?: ControlsConfig): Layout;
  ```
  `ButtonId` und `ControlsConfig` werden aus `controls-config.ts` als Typen importiert. Die Typ-Importe zwischen den beiden Dateien sind erlaubt, Laufzeit-Importe nur in Richtung layout → controls-config.
- Produces in `controls-config.ts`:
  ```ts
  export type ButtonId = 'dpad' | 'jump' | 'action';
  export const BUTTON_IDS: readonly ButtonId[];
  export interface ButtonPlace { fx: number; fy: number; scale: number }
  export type OrientationConfig = Record<ButtonId, ButtonPlace>;
  export interface ControlsConfig { version: 1; portrait: OrientationConfig | null; landscape: OrientationConfig | null } // null = Standard
  export const CONTROLS_KEY = 'kraxel-controls-v1';
  export const SCALE_MIN = 0.75, SCALE_MAX = 1.5, SCALE_STEP = 0.125, BUTTON_GAP = 4;
  export function defaultControlsConfig(): ControlsConfig;
  export function loadControlsConfig(store: KeyValueStore | null): ControlsConfig;
  export function saveControlsConfig(store: KeyValueStore | null, c: ControlsConfig): void;
  export function applyControls(base: Layout, o: OrientationConfig | null): Layout;    // ungültig → base unverändert
  export function configFromLayout(l: Layout): OrientationConfig;
  export function moveButton(l: Layout, id: ButtonId, cx: number, cy: number): Layout | null; // klemmt in den Bereich; Überlappung → null
  export function resizeButton(l: Layout, id: ButtonId, scale: number): Layout | null;        // klemmt die Größe; Überlappung → null
  export function pickButton(l: Layout, x: number, y: number): ButtonId | null;               // Punkt im gezeichneten Kreis + 4 px, nächster Mittelpunkt gewinnt
  export function withOrientation(c: ControlsConfig, o: 'portrait' | 'landscape', oc: OrientationConfig | null): ControlsConfig;
  ```
  Die Lage wird so umgerechnet: `cx = a.x + r + fx * (a.w - 2r)`, `cy = a.y + r + fy * (a.h - 2r)` mit `a = controlsArea`. `r = round(BASE_R * scale)` und `hitR = round(BASE_HIT * scale)`. Gültig ist eine Anordnung, wenn jeder Kreis ganz in `controlsArea` liegt, je zwei Kreise mindestens `rA + rB + BUTTON_GAP` Abstand haben und quer kein Kreis `pauseHit` schneidet. Das gilt für alle drei Knöpfe, auch den Aktionsknopf.

- [ ] **Step 1: Failing tests** (`controls-config.test.ts`, Geräte wie in `layout.test.ts`):
  ```ts
  const P = (c?: ControlsConfig) => computeLayout(390, 844, { top: 47, right: 0, bottom: 34, left: 0 }, c);
  const Q = (c?: ControlsConfig) => computeLayout(844, 390, { top: 0, right: 47, bottom: 21, left: 47 }, c);
  it('Standard ergibt das heutige Layout', () => { expect(P(defaultControlsConfig())).toEqual(P()); expect(Q(defaultControlsConfig())).toEqual(Q()); });
  it('Standard-Knöpfe liegen in controlsArea', () => { for (const l of [P(), Q()]) for (const id of BUTTON_IDS) expect(circleInside(l[id], l.controlsArea)).toBe(true); });
  it('Hin und zurück: configFromLayout(applyControls(base, oc)) ≈ oc', () => { /* oc mit fx 0.2/0.8, fy 0.5, scale 1.25 für dpad; Werte auf 1e-6 gleich */ });
  it('Ziehen über den Rand klemmt', () => { const l = moveButton(P(), 'jump', 9999, 9999)!; expect(l.jump.cx + l.jump.r).toBeLessThanOrEqual(l.controlsArea.x + l.controlsArea.w); });
  it('Ziehen auf einen anderen Knopf wird abgelehnt', () => { const l = P(); expect(moveButton(l, 'jump', l.dpad.cx, l.dpad.cy)).toBeNull(); });
  it('Größe wird auf 0,75 bis 1,5 geklemmt, Überlappung abgelehnt', () => {
    expect(resizeButton(P(), 'jump', 9)!.jump.r).toBe(Math.round(28 * 1.5));
    expect(resizeButton(P(), 'jump', 0)!.jump.r).toBe(Math.round(28 * 0.75));
    /* jump direkt neben dpad schieben, dann vergrößern → null */
  });
  it('quer schneidet kein Knopf die Pause-Fläche', () => { const l = Q(); expect(moveButton(l, 'jump', l.pauseHit.x + 16, l.pauseHit.y + 30)).toBeNull(); });
  it('gespeicherte Anordnung auf anderem Bildschirm: im Bereich oder Standard', () => {
    // auf 430×932 eine große Anordnung (alle scale 1.5, weit auseinander) speichern, auf 375×667 und 667×375 anwenden:
    // jeder Knopf in controlsArea und kein Paar zu nah, oder das Ergebnis ist gleich dem Standard-Layout
  });
  it('withOrientation ändert nur die genannte Ansicht', () => { /* portrait setzen, landscape bleibt; null setzt zurück */ });
  it('pickButton trifft den Kreis + 4 px, sonst null', () => { const l = P(); expect(pickButton(l, l.dpad.cx + l.dpad.r + 3, l.dpad.cy)).toBe('dpad'); expect(pickButton(l, l.view.x + 10, l.view.y + 10)).toBeNull(); });
  it('Laden: fehlend, kaputt, falsche Version, werfender Speicher, falsche Form → Standard; Speichern wirft nie', () => { /* wie save.test.ts, inkl. fx außerhalb 0..1 und scale außerhalb der Grenzen */ });
  it('Speichern und Laden ergibt dieselbe Anordnung', () => { /* mem()-Speicher wie in save.test.ts */ });
  ```
  In `layout.test.ts` kommt ein Test für `controlsArea` dazu: hochkant beginnt der Bereich bei `hud.y + hud.h`, quer bei `T + 12`. Auf allen sechs Geräten aus dem bestehenden `it.each` liegt er in der Safe Area.
- [ ] **Step 2:** `npx vitest run src/view` — erwartet FAIL (Modul fehlt).
- [ ] **Step 3: Umsetzen.** `BASE_RADII` in `layout.ts` ersetzt die festen Radien in `computeLayout`. `controlsArea` kommt dazu, danach wird `applyControls` mit `controls?.[orientation] ?? null` aufgerufen. `loadControlsConfig` prüft die Form gründlich: Zahlen endlich, `fx` und `fy` in 0..1, `scale` in den Grenzen, sonst gilt der Standard für diese Ansicht.
- [ ] **Step 4:** `npm test`, `npm run typecheck` — erwartet alles grün, alte Layout- und Touch-Tests unverändert.
- [ ] **Step 5: Commit** `git commit -m "Knopf-Anordnung: Modul mit Bereich, Prüfung, Speicher; Layout nimmt sie an"`

### Task 2: Anordnung live anwenden, Knopf-Texturen in jeder Größe, rohe Zeiger-Ereignisse

**Files:**
- Modify: `src/main.ts`, `src/gfx/textures.ts`, `src/scenes/UiScene.ts`, `src/scenes/GalleryScene.ts` (falls `BUTTON_RADII` wegfällt), `src/input/touch.ts`, `src/input/controls.ts`
- Test: `src/gfx/textures.test.ts` (neu oder vorhanden), `src/input/touch.test.ts`

**Interfaces:**
- Consumes: alles aus Task 1.
- Produces:
  ```ts
  // textures.ts
  export function buttonTextureKeys(kind: ButtonId, r: number): string[]; // alle Schlüssel für einen Radius (Steuerkreuz 16 Varianten, runde Knöpfe 2)
  export function ensureButtonTextures(scene: Phaser.Scene, kind: ButtonId, r: number): void; // backt fehlende Schlüssel einmal
  // controls.ts / touch.ts
  export interface PointerEventInfo { type: 'down' | 'move' | 'up'; id: number; x: number; y: number } // Spielpixel; cancel und lostpointercapture → 'up'
  Controls.onPointer(cb: (e: PointerEventInfo) => void): () => void;
  ```
  Game-Registry: `'controlsConfig'` (aktuelle `ControlsConfig`), `'layoutBase'` (Layout mit Standard-Anordnung), `'layout'` (angewendetes Layout, wie bisher).
  Game-Events: `'controls-config'` (neue `ControlsConfig`, main übernimmt sie und wendet das Layout sofort neu an) und `'controls-editing'` (boolean, `UiScene` blendet Steuerkreuz, Sprung- und Aktionsknopf aus, solange `true`).

- [ ] **Step 1: Failing tests:**
  ```ts
  it('buttonTextureKeys: 16 Schlüssel fürs Steuerkreuz, 2 für runde Knöpfe, alle verschieden', () => {
    expect(new Set(buttonTextureKeys('dpad', 50)).size).toBe(16); expect(buttonTextureKeys('jump', 33)).toEqual([roundButtonKey('jump', 33, false), roundButtonKey('jump', 33, true)]);
  });
  it('PointerBook bleibt unverändert, rohe Ereignisse kommen in Spielpixeln', () => { /* falls PointerTracker in node testbar ist: Fake-Element mit addEventListener; sonst nur den reinen Umrechnungs-Helfer testen */ });
  ```
- [ ] **Step 2:** Fokussierte Tests laufen lassen — erwartet FAIL.
- [ ] **Step 3: Umsetzen.**
  - `main.ts` lädt die Anordnung mit `loadControlsConfig(safeStorage())` und berechnet bei jeder Messung `layoutBase` und `layout`. Auf `'controls-config'` übernimmt es die neue Anordnung, setzt die Registry und wendet das Layout an, auch wenn sich nur die Anordnung geändert hat.
  - `UiScene.applyLayout` ruft `ensureButtonTextures` für die aktuellen Radien auf und hört auf `'controls-editing'`.
  - `registerTextures` backt beim Start die Radien aus `BASE_RADII`.
  - `PointerTracker` gibt down/move/up an `onPointer`-Abonnenten weiter, zusätzlich zu Buch und Tipp.
- [ ] **Step 4:** `npm test`, `npm run typecheck`, `npm run build` — grün. Browser-Check: `localStorage['kraxel-controls-v1']` mit einer hochkant größeren und verschobenen Sprung-Taste setzen, neu laden. Die Taste sitzt dort, Treffer funktionieren, quer gilt weiter der Standard. Konsole ohne Fehler.
- [ ] **Step 5: Commit** `git commit -m "Knopf-Anordnung live anwenden, Knopf-Texturen in jeder Größe, rohe Zeiger-Ereignisse"`

### Task 3: Editor-Bildschirm und Einstiege

**Files:**
- Create: `src/scenes/ControlsScene.ts`
- Modify: `src/scenes/PauseScene.ts` (vierter Punkt), `src/scenes/TitleScene.ts` (kleiner Knopf), `src/main.ts` (Szene registrieren), `src/ui-text.ts`, bei Bedarf `src/scenes/UiScene.ts` (Muster `panel-pattern` als exportierte Funktion für die Wiederverwendung)

**Interfaces:**
- Consumes: Task 1 (`applyControls`, `configFromLayout`, `moveButton`, `resizeButton`, `pickButton`, `withOrientation`, `saveControlsConfig`, `SCALE_STEP`) und Task 2 (`onPointer`, `ensureButtonTextures`, Registry `'controlsConfig'`/`'layoutBase'`, Events `'controls-config'`/`'controls-editing'`).
- Produces: Szene `'controls'` mit `init(data: { returnTo: 'pause' | 'title' })`. Neue Texte: `TEXT.CONTROLS = 'STEUERUNG'`, `TEXT.CONTROLS_HINT = 'KNOPF ZIEHEN ZUM VERSCHIEBEN'`, `TEXT.DEFAULTS = 'STANDARD'`, `TEXT.DONE = 'FERTIG'`.

Ablauf:
- **Öffnen:**
  - Pausenmenü → `STEUERUNG` → `scene.launch('controls', { returnTo: 'pause' })`, Pause schläft.
  - Titelbild → kleiner Knopf `STEUERUNG` unten → Titel schläft. Ein Tipp außerhalb des Knopfs startet das Spiel wie bisher.
  - Der Editor sendet `'controls-editing'` mit `true`.
- **Bild:**
  - Alles abgedunkelt. Hochkant das Steuerfeld mit seinem Muster, darauf die drei Knöpfe in der Arbeitsanordnung. Der gewählte Knopf ist hervorgehoben.
  - Werkzeugleiste mit Titel, Hinweis und den Knöpfen `-`, `+`, `STANDARD`, `FERTIG`. Hochkant liegt sie im Spielbild-Bereich, quer oben mittig unter der Info-Leiste.
  - Die Werkzeugleiste ist über den Knöpfen gezeichnet. Ein Tipp auf die Leiste gewinnt.
- **Bedienen:**
  - Finger runter auf einem Knopf (`pickButton`) wählt ihn und startet das Ziehen mit gleichem Abstand zum Finger.
  - Bewegen ruft `moveButton` auf. Bei `null` bleibt der letzte gültige Stand.
  - `-`/`+` ruft `resizeButton(l, sel, scale ∓ SCALE_STEP)` auf.
  - `STANDARD` setzt die aktuelle Ansicht mit `withOrientation(work, o, null)` zurück.
- **Drehen:** Auf `'layout'` hin nimmt der Editor `layoutBase` und wendet `work[orientation]` darauf an.
- **Schließen** mit `FERTIG` oder Escape:
  - `saveControlsConfig(safeStorage(), work)`, dann `'controls-config'` mit `work` und `'controls-editing'` mit `false`.
  - `controls.sample()` schluckt die Flanken.
  - Die Rückkehr-Szene wird geweckt, der Editor gestoppt.

- [ ] **Step 1: Failing test** in `ui-text.test.ts` oder einem vorhandenen Text-Test: Die neuen Texte gibt es, sie sind großgeschrieben und die Pixelschrift kann jedes Zeichen darstellen (vorhandene Prüfung `FONT5`).
- [ ] **Step 2:** Test laufen lassen — FAIL.
- [ ] **Step 3: Szene und Einstiege bauen.**
- [ ] **Step 4:** `npm test`, `npm run typecheck`, `npm run build` — grün.
- [ ] **Step 5: Browser-Check** (`.claude/launch.json`, Konfiguration `kraxel-dev`, http://localhost:5199/kraxel/) hochkant 375×812 und quer 812×375:
  - Titel → STEUERUNG → Sprung-Knopf ziehen, vergrößern → FERTIG → Spiel starten. Der Knopf sitzt neu und trifft.
  - Pause → STEUERUNG → Steuerkreuz auf den Sprung-Knopf ziehen: Es wird abgelehnt.
  - STANDARD → FERTIG → weiter. Kraxel springt beim Schließen nicht.
  - Im Editor drehen: Die andere Ansicht wird bearbeitet, die erste ist danach unverändert.
  - Neu laden: Die Anordnung bleibt.
  - Konsole ohne Fehler. Screenshots.
- [ ] **Step 6: Commit** `git commit -m "Knopf-Editor: STEUERUNG im Pausenmenü und auf dem Titelbild"`
