# Kraxel – Design

Stand: 23.11.2026 · Status: freigegeben am 23.11.2026

Kennzeichnung im Text:
- **[entschieden]**: vom Spieleentwickler (Repo-Inhaber) ausdrücklich so gewollt.
- **[bestätigt]**: von Claude vorgeschlagen, vom Repo-Inhaber mit „passt so“ abgenickt (Spielkonzept, Grafikstil).
- **[Festlegung]**: Claudes eigene Entscheidung beim Schreiben dieses Dokuments. Kann jederzeit geändert werden.

Grafik-Referenz: [2026-11-23-kraxel-grafik-entwurf.html](2026-11-23-kraxel-grafik-entwurf.html). Die Datei enthält alle bisher gezeichneten Sprites als Zeichen-Raster, die Farbpaletten, Stil A und die sechs Welt-Paletten. Sie ist ein HTML-Fragment aus der Entwurfsphase und dient als Vorlage, nicht als Spielcode.

---

## 1. Worum es geht

Kraxel ist ein 2D-Jump-'n'-Run für den Handy-Browser. Es wird über GitHub Pages veröffentlicht, ohne App Store, und lässt sich über „Zum Home-Bildschirm“ wie eine App im Vollbild starten. **[entschieden]**

**Für wen:** den Repo-Inhaber und Freunde, die alte Plattformspiele gut kennen. **[entschieden]**
**Warum:** Spaß haben und ausprobieren, was man mit Claude bauen kann. Ausdrücklicher Wunsch: „streng dich an“. **[entschieden]**
**Gefühl:** im Geist des alten Nintendo-DS-Jump-'n'-Runs mit Mario. Kein Nachbau: Figur, Grafik, Musik, Namen und Symbole sind komplett eigen. **[entschieden]**

Erfolg heißt: Man startet das Spiel am eigenen Handy vom Home-Bildschirm, die Steuerung reagiert sofort, das Springen fühlt sich richtig gut an, und man will das Level nochmal spielen, um alle Edelweiß zu finden oder schneller zu sein.

**Herkunft:** Dieses Dokument baut auf der ursprünglichen Projektidee des Repo-Inhabers auf (nicht im Repo). Alles daraus, was für die Umsetzung zählt, ist hier übernommen. Ihr Fahrplan **[entschieden]** lautete:
1. Prototyp lokal: eine Figur, ein Level in der Graslandschaft, Steuerung hochkant und quer. Ziel: Springen muss sich gut anfühlen.
2. Graslandschaft ausbauen: mehrere Level, Gegner, erste Gimmicks.
3. Weitere Welten nacheinander: Eis, Sand, Sumpf, Wolken, Vulkan, jede mit eigenen Gimmicks.
4. Feinschliff lokal: Grafiken, Sounds, Menü, Speicherstand, Bestzeiten.
5. Multiplayer: Online-Wettrennen zu zweit per Raumcode.
6. Optional später: eigener Server, mehr Spieler, Bestenliste.

Die Meilensteine in Abschnitt 9 folgen diesem Fahrplan. Einige Punkte aus Schritt 2 und 4 ziehen dabei schon in Meilenstein 1 vor.

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**
- Präzise, sofort reagierende Touch-Steuerung, hochkant und quer. **[entschieden]**
- Springen und Bewegung fühlen sich so gut an wie in den großen Vorbildern (Coyote Time, Sprungpuffer, variable Sprunghöhe usw., siehe 5.2). **[entschieden]** (Fahrplan: „Springen muss sich gut anfühlen“)
- Kisten, aus denen beim Anstoßen Kristalle oder Items kommen. **[entschieden]**
- Sechs Welten in fester Reihenfolge: Gras, Eis, Wüste, Sumpf, Wolken, Vulkan (Finale mit Endgegner). **[entschieden]**
- Anspruchsvoll für erfahrene Spieler, wenig Erklärtext. **[bestätigt]**
- Ein Look aus einem Guss, eigene Pixelgrafik in Stil A. **[entschieden]**

**Nicht-Ziele (jetzt nicht)**
- Multiplayer. Kommt erst, wenn der Einzelspieler Spaß macht. Nur vormerken, siehe Abschnitt 10. **[entschieden]**
- Eigener Server, Konten, Bestenlisten online.
- App-Store-Versionen.
- Level-Editor im Spiel.

**Anti-Ziele (wäre ein Fehlschlag, selbst wenn alles technisch läuft)**
- Irgendetwas, das wie Nintendo aussieht oder klingt: keine Fragezeichen-Blöcke, keine Röhren, keine Pilze, Feuerblumen oder Sterne, keine Melodien oder Soundeffekte, die an Mario erinnern.
- Schwammige oder verzögerte Steuerung, Knöpfe, die man verfehlt, Zoomen oder Scrollen der Seite beim Spielen.
- Lange Tutorials, Textwände, Werbung, Tracking, Login.

## 3. Rahmenbedingungen

- **Plattform:** Safari auf iPhone und Chrome auf Android, aktuelle Versionen. Desktop-Browser mit Tastatur sollen zum Entwickeln und Testen funktionieren.
- **Hosting:** GitHub Pages, also nur statische Dateien und kein Server. Adresse: `philippdererbauer.github.io/kraxel/`. **[entschieden]** (GitHub Pages) / **[Festlegung]** (Repo-Name `kraxel`)
- **Kosten:** alles kostenlos.
- **Rechte:** keine fremden Grafiken, Sounds oder Musik, die nicht frei nutzbar sind. Alles Eigene entsteht im Code.
- **iPhone-Besonderheiten:** Webseiten haben dort keine Fullscreen-API und keine feste Ausrichtung. Vollbild gibt es nur über „Zum Home-Bildschirm“. Das Spiel muss sich beim Drehen live umstellen. Vibration gibt es auf dem iPhone nicht. Ton darf erst nach einer Berührung starten.
- **Sprache:** Deutsch, auch alle Texte im Spiel. **[Festlegung]**

## 4. Ansätze

### 4.1 Grafik **[entschieden]**
| Weg | Vorteile | Nachteile |
|---|---|---|
| Kenney „Pixel Platformer“ (CC0) als Basis | sofort professionell, schnell | Figur ist nicht Kraxel; Eis, Wüste, Sumpf, Wolken und Vulkan unklar abgedeckt, gemischte Pakete wirken zusammengewürfelt; sehr verbreitet |
| **Eigene Pixelgrafik, Stil A „bunt und knackig“** | ein Look für alle sechs Welten, Kraxel wie entworfen, jederzeit erweiterbar, keine Lizenzfragen | mehr Arbeit, Animationen Bild für Bild; wirkt eher liebevoll-schlicht als nach Profi-Pixelkunst |
| Eigene Pixelgrafik, Stil B „weich und warm“ | sanfter Look | auf dem kleinen Bildschirm schlechter lesbar, weiter weg vom DS-Gefühl |

Gewählt: **eigene Pixelgrafik in Stil A.**

### 4.2 Technik **[Festlegung]**, aufbauend auf der Empfehlung aus der Projektidee
| Weg | Bewertung |
|---|---|
| **Phaser 4 (aktuell 4.2.x) mit eigener Bewegungs- und Kollisionslogik** | Gewählt. Phaser übernimmt Darstellung, Kamera, Szenen, Partikel und Skalierung. Bewegung und Kollision schreiben wir selbst in reinem TypeScript, damit sich das Sprunggefühl genau einstellen und automatisch testen lässt und der Spielerzustand später fürs Online-Rennen leicht übertragbar ist. |
| Phaser 4 mit eingebauter Arcade-Physik | Weniger Code, aber Sonderbewegungen wie Kraxeln, Wandsprung und Stampfen kämpfen gegen die Engine, und Tests brauchen dann die ganze Engine. |
| Phaser 3 mit den Plugins aus der Projektidee | Die Joystick-Plugins sind für Phaser 3 gebaut, ein analoger Joystick fühlt sich in einem Jump-'n'-Run aber schwammig an. Wir bauen Steuerkreuz und Knöpfe selbst. Phaser 3.90 bleibt Notfall-Ausweg, falls Phaser 4 an einer Stelle blockiert, die APIs sind sehr ähnlich. |
| Eigene Engine auf reinem Canvas | Volle Kontrolle, aber Kamera, Szenen, Partikel und Skalierung müssten wir alles selbst bauen. Lohnt sich nicht. |

## 5. Das Spiel

### 5.1 Grundidee und Welt **[bestätigt]**
Kraxel ist ein kleiner Bergsteiger: ein rundes Wesen mit Mütze samt Bommel und Rucksack. Die Reise führt durch sechs Welten und endet auf dem Gipfel des Vulkans. Die Bergsteiger-Idee zieht sich durch alles: Items sind Kletterausrüstung, das Levelziel ist ein Gipfelkreuz, Sammelobjekte sind Kristalle und Edelweiß.

### 5.2 Kraxels Bewegung **[bestätigt]**, Details **[Festlegung]**
Alle Zahlen sind Startwerte zum Feintunen am echten Handy. Einheit: Kacheln (16 Pixel) pro Sekunde.

- **Laufen und Rennen:** Kraxel beschleunigt auf Gehtempo (ca. 6 K/s). Hält man die Richtung auf dem Boden länger als ca. 0,6 s, steigert sich das Tempo auf Renntempo (ca. 9,5 K/s). Ein eigener Rennknopf entfällt, das wäre am Handy zu fummelig. Umdrehen oder Loslassen bremst mit kurzer Rutsch-Animation ab.
- **Springen:** Je länger gedrückt, desto höher: von ca. 1,5 Kacheln (kurz getippt) bis ca. 4 Kacheln (gehalten), mit Renntempo ca. 5 Kacheln.
  - Coyote Time: Springen geht noch ca. 0,1 s, nachdem man von einer Kante gelaufen ist.
  - Sprungpuffer: Drückt man ca. 0,12 s vor der Landung, springt Kraxel bei der Landung sofort.
  - Am Scheitelpunkt kurz weniger Schwerkraft, beim Fallen etwas mehr. Die Fallgeschwindigkeit ist begrenzt.
  - In der Luft lässt sich die Richtung steuern, etwas träger als am Boden.
  - Stößt Kraxel knapp an einer Kistenkante mit dem Kopf an, rutscht Kraxel ein paar Pixel zur Seite und springt weiter (Kantenkorrektur).
- **Wandrutschen und Wandsprung:** Drückt man in der Luft gegen eine Wand, rutscht Kraxel langsam daran herunter. Springen stößt Kraxel schräg von der Wand weg. Kurz danach lässt sich die Richtung nur gedämpft zurücksteuern, damit Ketten zwischen zwei Wänden gut gelingen.
- **Kraxeln:** Steuerkreuz nach oben (auch schräg oben) an einer Wand: Kraxel klettert bis zu ca. 2 Kacheln hoch und rutscht danach ab. Die Kraft dafür füllt sich bei Bodenkontakt wieder auf.
- **Stampfen:** Steuerkreuz nach unten in der Luft: kurzes Innehalten, dann schneller Fall. Stampfen öffnet Kisten von oben, zerschlägt Felsblöcke von oben und besiegt Gegner, auf die man stampft.
- **Treffer:** Danach ca. 1,5 s blinken und unverwundbar.
- **Tod:** Sturz in eine Grube oder ein Treffer ohne Helm. Kurze Animation, danach Neustart am letzten Zwischenspeicherpunkt mit einem Leben weniger.

### 5.3 Kraxelkisten und Felsblöcke **[bestätigt]**
- **Kraxelkiste:** leuchtende Holzkiste mit Metallecken und Bergsymbol (siehe Entwurf). Ein Stoß von unten oder Stampfen von oben lässt den Inhalt herausspringen, danach ist die Kiste leer und matt.
  - Inhalt laut Level: ein Kristall, mehrere Kristalle (wiederholt anstoßen, solange sie noch leuchtet) oder ein Item.
  - Item-Kisten geben einen Helm, wenn Kraxel noch keinen trägt, sonst das im Level eingetragene Item. **[Festlegung]**
  - Versteckte Kisten sind unsichtbar, bis man sie von unten trifft. **[Festlegung]**
- **Felsblock:** Mit Helm zerschlägt Kraxel ihn von unten mit dem Kopf, ohne Helm prallt Kraxel ab. Stampfen zerschlägt ihn von oben auch ohne Helm. Manche Felsblöcke enthalten Kristalle. **[bestätigt]** / Stampfen und Inhalt **[Festlegung]**

### 5.4 Items **[bestätigt]**
| Item | Wirkung |
|---|---|
| **Helm** | hält einen Treffer aus und erlaubt Felsblöcke mit dem Kopf zu zerschlagen. Ohne Helm reicht ein Treffer. |
| **Steinschleuder** | Aktionsknopf schießt Kiesel. Sie fliegen flach mit leichtem Bogen, höchstens zwei gleichzeitig, und besiegen die meisten Gegner. **[Festlegung]** für die Flugbahn |
| **Gleitschirm** | Sprung in der Luft gedrückt halten: langsames Schweben mit voller Seitensteuerung. **[Festlegung]** für die Bedienung |
| **Steigeisen** | kein Rutschen auf Eis. Zusätzlich reicht Kraxeln doppelt so hoch, damit sie auch außerhalb der Eiswelt nützen. **[Festlegung]** für den Zusatz |
| **Goldener Enzian** | ca. 8 s unverwundbar, Gegner werden bei Berührung besiegt. |

Regeln **[Festlegung]**: Kraxel trägt immer höchstens ein Spezial-Item (Steinschleuder, Gleitschirm oder Steigeisen), ein neues ersetzt das alte. Ein Spezial-Item schließt den Helmschutz ein. Ein Treffer nimmt das Spezial-Item und lässt den Helm, der nächste Treffer nimmt den Helm. Der Enzian wirkt zusätzlich und ändert nichts am Item.

Items springen aus der Kiste und gleiten dann über den Boden, wie im Genre üblich. Kraxel sammelt sie durch Berührung ein. **[Festlegung]**

### 5.5 Sammeln **[bestätigt]**
- **Kristalle:** 100 ergeben ein Extraleben.
- **Edelweiß:** drei pro Level, gut versteckt. Gefundene bleiben gespeichert und schalten Geheimlevel frei (Details später, siehe 9).
- **Leben:** Start mit 5 Leben. **[Festlegung]** Bei Game Over geht es zurück auf die Weltkarte, nicht ganz an den Anfang. **[bestätigt]**

### 5.6 Aufbau des Spiels **[bestätigt]**
- Weltkarte mit Wegen und geheimen Abzweigungen.
- Pro Welt 4 Level und eine Festung mit Zwischengegner. Im Vulkan wartet am Ende der große Endgegner. Zusammen 30 Level, die nach und nach entstehen.
- Pro Level ein Zwischenspeicherpunkt etwa in der Mitte und ein Gipfelkreuz als Ziel. Der Zwischenspeicherpunkt ist ein **Steinmännchen**, das beim Berühren eine Fahne bekommt. **[Festlegung]**
- Die Bestzeit pro Level wird gespeichert. Es gibt kein Zeitlimit, die Uhr zählt hoch, passend zum späteren Wettrennen. **[Festlegung]**
- Springt Kraxel weit oben ans Gipfelkreuz, gibt es Bonus-Kristalle, ganz oben ein Extraleben. **[Festlegung]**

### 5.7 Gegner **[bestätigt]**
Eigene Gegner, die zu jeder Welt passen. Fest für den Anfang:
- **Krabbelkäfer:** läuft geradeaus, dreht an Wänden um und läuft über Kanten. Draufspringen oder Stampfen besiegt ihn, seitliche Berührung ist ein Treffer.
- **Stachelschnecke:** langsam, stachliges Haus. Draufspringen ist ein Treffer. Besiegen geht mit Kiesel, Enzian oder einem Kopfstoß gegen den Block, auf dem sie sitzt. **[Festlegung]**

Weitere Ideen: rutschende Pinguine (Eis) und je Welt eigene Gegner. Sie werden beim Ausarbeiten der jeweiligen Welt festgelegt.

### 5.8 Welten und Gimmicks
Reihenfolge **[entschieden]**. Die Gimmicks sind Ideen aus der Projektidee und werden pro Welt beim Ausarbeiten festgelegt:
1. **Graslandschaft:** Einstieg. Ideen: einfache Gegner, Sprungpilze (bei uns besser: Sprungfedern oder Blätterpolster, keine Pilze), versteckte Abkürzungen.
2. **Eislandschaft:** rutschiger Boden, herabfallende Eiszapfen, gefrorene Seen. Hier kommen die Steigeisen ins Spiel.
3. **Wüste:** Treibsand, schiebende Sandstürme, zerfallende Sandplattformen.
4. **Sumpf:** giftiges Wasser, sinkende Plattformen, Lianen zum Schwingen.
5. **Wolkenwelt:** Wolken, die sich auflösen, Windböen, Sprungfedern. Hier kommt der Gleitschirm ins Spiel.
6. **Vulkan:** Lava, Lavafontänen, einstürzende Brücken, Endgegner.

Zwischengegner und Endgegner werden mit der jeweiligen Welt entworfen.

## 6. Grafik: Stil A **[entschieden]**, Regeln **[Festlegung]**

- **Kachelgröße 16×16 Pixel.** Kraxel ist 16×16, Kisten und Blöcke 16×16.
- **Stil A:** 1 Pixel dunkle Umrandung um Figuren, Items und Gegner. Kräftige, helle Farben, Himmel in Farbstreifen, Hintergrund in zwei bis drei Parallax-Ebenen (ferne Formen, Hügel, Wolken).
- **Welten durch Paletten:** Alle Welten nutzen dieselben Bausteine, je Welt mit eigener Palette, eigener Hintergrundform und eigenem Grubeninhalt (Wasser, Eiswasser, Sand, Gift, Himmel, Lava). Werte siehe `WORLDS` im Entwurf.
- **Entstehung im Code:** Sprites werden wie im Entwurf als Zeichen-Raster mit Palette definiert und beim Start in Texturen umgewandelt, inklusive automatischer Umrandung. So gibt es keine Bilddateien, und neue Paletten oder Figuren sind schnell ergänzt.
- **Pixelgenau:** Kein Weichzeichnen, Positionen auf ganze Pixel gerundet.
- **Kraxel:** türkise Mütze mit Bommel, gelber Umschlag, apricotfarbener Körper, Rucksack, Stiefel, so wie im Entwurf. Benötigte Animationen: stehen, gehen (2–4 Bilder), rennen, springen, fallen, rutschen (Wand), kraxeln, stampfen, abbremsen, Treffer, Tod, jubeln (Ziel). Varianten mit Helm und mit sichtbarem Spezial-Item (z. B. Schleuder am Gürtel, Schirm am Rucksack).
- **Schrift:** eigene Pixelschrift wie im Entwurf (`FONT`), für HUD und Menüs.

## 7. Bildschirm und Steuerung **[entschieden]** (Grundaufteilung), Details **[Festlegung]**

### 7.1 Sichtfeld
- Sichtbar sind immer **12 Kacheln Höhe (192 Spielpixel)**. Die Breite ergibt sich aus dem Bildschirm.
- Die Darstellung wird ohne Weichzeichnen hochskaliert. Ganzzahlige Faktoren in Geräte-Pixeln sind schön, aber kein Muss.

### 7.2 Hochkant: zwei Bildschirme wie beim DS
```
┌──────────────────────┐
│     Spielwelt 4:3    │  256 × 192 Spielpixel (16 × 12 Kacheln),
│                      │  über die volle Breite skaliert
├──────────────────────┤
│ ✦ 24   ♥ 5   ❀❀·  ⏸ │  Info-Leiste: Kristalle, Leben, Edelweiß, Zeit, Pause
│                      │
│   ┌─┐                │
│ ┌─┼─┼─┐        (B)   │  Steuerkreuz links,
│ └─┼─┼─┘    (A)       │  Sprung (A) groß rechts,
│   └─┘                │  Aktion (B) kleiner, nur mit Schleuder sichtbar
└──────────────────────┘
```
- Das Spielbild hat 4:3, wie der obere DS-Bildschirm. Darunter liegt das Steuerfeld wie der untere Bildschirm. Die Info-Leiste sitzt im Steuerfeld, damit das Spielbild frei bleibt.
- Die Knöpfe sitzen unten im Daumenbereich, oberhalb der Home-Leiste (Safe Areas beachten). Auf langen Handys bleibt Platz zwischen Spielbild und Knöpfen, den die Info-Leiste und ein ruhiges Muster füllen.

### 7.3 Quer: Vollbild
- Spielwelt über den ganzen Bildschirm, 192 Spielpixel hoch, auf einem typischen Handy ca. 26 Kacheln breit.
- Halbtransparente Knöpfe: Steuerkreuz links unten, Sprung und Aktion rechts unten. Safe Areas (Notch, abgerundete Ecken) beachten.
- Schmale Info-Leiste oben als Einblendung, Pause oben in der Mitte.
- Sehr breite Bildschirme (Desktop): Breite auf ca. 32 Kacheln begrenzen, Rest mit Rand füllen.

### 7.4 Touch-Steuerung (Anforderungen)
- Reagiert beim ersten Berühren, nicht beim Loslassen, ohne Verzögerung.
- Mehrere Finger gleichzeitig: Steuerkreuz und Sprung zusammen.
- Steuerkreuz mit 8 Richtungen. Der Finger darf von links nach rechts gleiten, ohne abzusetzen. Die Trefferfläche ist deutlich größer als die Grafik, mit kleiner toter Zone in der Mitte.
- Sprung- und Aktionsknopf mit großzügiger Trefferfläche. Gedrückte Knöpfe leuchten auf.
- Kein Zoomen, Scrollen, Markieren, Lupe oder Kontextmenü beim Spielen (auch kein Doppeltipp-Zoom).
- Knöpfe im Pixel-Stil passend zu Stil A (siehe Entwurf).

### 7.5 Weitere Eingaben
- **Tastatur:** Pfeiltasten oder WASD, Sprung mit Leertaste, Z oder K, Aktion mit X oder J, Pause mit Escape oder P. Auf Geräten ohne Touch werden die Bildschirmknöpfe ausgeblendet und beim ersten Berühren eingeblendet.
- Ein Gamepad wäre einfach nachzurüsten, ist aber nicht Teil des ersten Meilensteins.

### 7.6 Ablauf und Bildschirme
- **Titelbild:** Schriftzug „Kraxel“, Kraxel läuft durchs Bild, „Tippen zum Starten“ (gibt gleichzeitig den Ton frei). Auf dem iPhone im Browser (nicht vom Home-Bildschirm) gibt es einen kleinen Hinweis: „Für Vollbild: Teilen → Zum Home-Bildschirm“.
- **Pause:** Weiter, Level neu starten, Ton an oder aus. Das Spiel pausiert auch automatisch, wenn die App in den Hintergrund geht.
- **Ziel erreicht:** kurzer Jubel, danach Zeit, Bestzeit, gefundene Edelweiß und Kristalle, Knöpfe „Nochmal“ und „Weiter“.

### 7.7 Kamera
- Schaut in Laufrichtung etwas voraus und dreht sanft mit.
- Vertikal folgt sie ruhig: Sie zieht nach, wenn Kraxel auf einer neuen Höhe landet oder dem Rand zu nahe kommt, und wackelt nicht bei jedem Sprung mit.
- Bleibt in den Levelgrenzen.

## 8. Technik **[Festlegung]**

- **Stack:** Phaser 4, TypeScript, Vite. Tests mit Vitest.
- **Aufteilung:**
  - **Spiellogik in reinem TypeScript ohne Phaser:** Bewegung, Kollision mit dem Kachelraster, Kisten, Items, Gegner, Leben und Kristalle, Level einlesen, Speicherstand. Sie läuft mit festem Takt (60 Schritte pro Sekunde, auch auf 120-Hz-Bildschirmen gleich schnell) und ist mit Vitest testbar.
  - **Phaser:** Darstellung, Kamera, Szenen, Partikel, Skalierung, Wechsel hochkant/quer.
  - **Eingabe:** Touch und Tastatur werden pro Schritt zu einem einfachen Eingabe-Objekt (`links, rechts, oben, unten, springen, aktion`) zusammengefasst. Die Spiellogik kennt nur dieses Objekt. Das macht später Wiederholungen und Geister fürs Wettrennen leicht.
  - **Spielerzustand** als einfaches, kopierbares Objekt (Position, Tempo, Zustand, Item), damit er sich später übertragen lässt.
- **Level-Format:** Textdateien mit Zeichen-Raster und Legende (z. B. `#` Boden, `K` Kiste, `c` Kristall, `k` Käfer …), dazu Kopfdaten wie Name, Welt und Hintergrund. Gründe: Claude baut die Level, Unterschiede sind im Git-Verlauf lesbar, und Tests können Level prüfen. Bodenkacheln wählen ihre Rand- und Eckvarianten automatisch. Tiled lässt sich später ergänzen, falls der Repo-Inhaber selbst Level bauen möchte.
- **Ton:** Soundeffekte werden im Browser per Web Audio im Chip-Stil erzeugt, ohne Audiodateien: springen, Kristall, Kiste, Item erscheint, Item eingesammelt, stampfen, Gegner besiegt, Treffer, Tod, Zwischenspeicher, Ziel. Musik kommt in einem späteren Meilenstein, als eigene Melodien in Notenform. Auf dem iPhone soll der Ton auch bei stummgeschaltetem Handy nach Möglichkeit laufen; falls das nicht geht, ist das kein Blocker.
- **Speicherstand:** `localStorage` mit Versionsnummer im Schlüssel: Bestzeiten, gefundene Edelweiß, freigeschaltete Level, Toneinstellung.
- **Debug-Modus:** Mit `?debug` in der Adresse erscheinen Trefferboxen, Bildrate und Regler für die Bewegungswerte, damit wir das Sprunggefühl gemeinsam am Handy feintunen können. Alle Bewegungswerte liegen an einer Stelle.
- **Home-Bildschirm (PWA):** Web-App-Manifest (Name „Kraxel“, Vollbild, beide Ausrichtungen), Icons aus Kraxels Kopf in 180, 192 und 512 Pixeln, passende Apple-Meta-Tags, `viewport-fit=cover`. Offline-Spielen per Service Worker kommt erst beim Feinschliff, damit beim Entwickeln keine alten Versionen hängen bleiben.
- **Repo und Veröffentlichung:** öffentliches GitHub-Repo `PhilippderErbauer/kraxel`. GitHub Actions baut bei jedem Push auf `main` und veröffentlicht auf GitHub Pages. Für Tests am echten Handy im selben WLAN läuft der Entwicklungsserver auch im Netzwerk.
- **Leistung:** flüssige 60 Bilder pro Sekunde auf einem Mittelklasse-Handy der letzten Jahre.

## 9. Meilensteine

Jeder Meilenstein bekommt einen eigenen Umsetzungsplan. **Der erste Plan umfasst nur Meilenstein 1.**

### Meilenstein 1: Erster spielbarer Level **[Festlegung]** (erweitert Schritt 1 aus der Projektidee um Kisten und Helm)
Ziel: Man spielt auf dem eigenen Handy über die GitHub-Pages-Adresse einen kompletten Graslevel, und das Springen fühlt sich gut an.
- Projekt aufsetzen, Repo anlegen, automatische Veröffentlichung auf GitHub Pages, Manifest und Icons.
- Pixelgrafik aus dem Entwurf übernehmen (Kraxel, Kiste, Kristall, Edelweiß, Helm, Krabbelkäfer, Stachelschnecke, Felsblock, Gipfelkreuz, Steinmännchen, Graskacheln, Hintergrund) und um die Animationen aus Abschnitt 6 ergänzen.
- Kraxel mit dem kompletten Bewegungsumfang aus 5.2.
- Touch-Steuerung hochkant und quer, Tastatur, Wechsel beim Drehen ohne Neustart.
- **Level 1-1 in der Graswelt**, ca. 180–220 Kacheln lang, an manchen Stellen höher als ein Bildschirm. Enthält: Kisten mit Kristallen, eine Kiste mit Helm, Felsblöcke, eine versteckte Kiste, Kristalle, Gruben, Krabbelkäfer und Stachelschnecken, Stellen, die Wandsprung, Kraxeln und Stampfen beibringen, ohne Text. Dazu ein Steinmännchen in der Mitte, das Gipfelkreuz am Ende und drei Edelweiß: eins hinter Felsblöcken (braucht den Helm oder Stampfen), eins nur per Kraxeln oder Wandsprung erreichbar, eins in einem versteckten Bereich.
- Leben, Kristalle, Treffer, Tod und Neustart am Steinmännchen. Bei Game Over geht es zurück zum Titelbild, weil die Weltkarte noch fehlt.
- Info-Leiste, Titelbild, Pause, Ziel-Bildschirm mit Bestzeit und Edelweiß, Speicherstand.
- Soundeffekte.
- Debug-Modus zum Feintunen.
- Tests für Bewegung, Kollision, Kisten und Level-Einlesen.

Nicht in Meilenstein 1: Weltkarte, weitere Level, Steinschleuder, Gleitschirm, Steigeisen, Enzian, Musik, Offline-Modus.

**Reihenfolge mit Testhalt** **[Festlegung]**: Level 1-1 hängt an den Bewegungswerten. Grubenbreiten, Wandsprung-Schächte und das Edelweiß, das man nur per Kraxeln erreicht, passen nur zu bestimmten Sprung- und Kletterhöhen. Deshalb:
1. Zuerst Projekt, Veröffentlichung, Steuerung und Kraxels Bewegung auf einem **Übungsplatz**: einer kleinen Testfläche mit Stufen, Gruben verschiedener Breite, einem Wandschacht, einer Kletterwand, Kisten und Felsblöcken. Er wird auf GitHub Pages veröffentlicht.
2. **Testhalt:** Der Repo-Inhaber probiert den Übungsplatz am eigenen Handy aus, hochkant und quer, und gibt Rückmeldung. Gemeinsam werden die Werte im Debug-Modus eingestellt und danach festgeschrieben. Kommt keine Rückmeldung, geht es mit den Startwerten weiter, und der Level wird später angepasst.
3. Danach Level 1-1, Gegner, Bildschirme, Ton und Speicherstand auf Basis der festen Werte. Am Ende folgt ein zweiter Test am Handy.

Abnahme: Es läuft auf dem Handy des Repo-Inhabers vom Home-Bildschirm aus. Vorher wird es im eingebauten Browser in Handy-Größe geprüft, hochkant und quer.

### Spätere Meilensteine (Grobplan)
2. **Graswelt komplett:** Weltkarte, Level 1-2 bis 1-4, Festung mit Zwischengegner, Steinschleuder und Enzian, Game Over auf der Weltkarte, Musik.
3. **–7. Welten 2 bis 6**, je mit eigenen Gimmicks, Gegnern, Festung. Steigeisen kommen mit der Eiswelt, der Gleitschirm mit der Wolkenwelt, der Endgegner mit dem Vulkan. Jede Welt bekommt vorher eine kurze eigene Abstimmung.
8. **Feinschliff:** Geheimlevel über Edelweiß (z. B. eins pro Welt), Offline-Modus, Einstellungen, Abspann.
9. **Multiplayer** (siehe 10).

## 10. Später: Multiplayer (nur vorgemerkt) **[entschieden]**
Online-Wettrennen zu zweit im selben Level per Raumcode, der Gegner läuft als Geist mit. Optionen: Peer-to-Peer über einen kostenlosen öffentlichen Vermittler (z. B. PeerJS oder Trystero), passend zu GitHub Pages, oder ein eigener Server (z. B. Colyseus) mit Azure-Guthaben aus dem GitHub Student Pack. Jetzt wird kein Netzwerkcode eingebaut. Die Architektur hält sich nur die Tür offen (Eingabe-Objekt, kopierbarer Spielerzustand, Bestzeiten).

## 11. Dem Umsetzer überlassen
- Ordnerstruktur, Namen, genaue Aufteilung in Module und Szenen.
- Genaue Physikwerte innerhalb der Richtwerte aus 5.2. Das Feintuning passiert gemeinsam am Handy.
- Ob die Bildschirmknöpfe als HTML-Elemente über dem Spiel oder in Phaser gezeichnet werden, solange 7.4 erfüllt ist.
- Genaues Zeichen-Alphabet des Level-Formats.
- Wie viele Animationsbilder je Bewegung, solange es flüssig wirkt.
- Konkreter Aufbau von Level 1-1 innerhalb der Vorgaben aus Meilenstein 1.
- Werkzeug für die Soundeffekte (eigener kleiner Synthesizer oder ein freies Mini-Werkzeug wie jsfxr unter MIT-Lizenz).
