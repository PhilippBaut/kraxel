# Kraxel Meilenstein 2: Graswelt komplett, Design

**Status:** Entwurf, im Gespräch am 26.11.2026 abgestimmt. Wartet auf Freigabe.
**Baut auf:** `docs/superpowers/specs/2026-11-23-kraxel-design.md` (Grund-Design, hier „Spec M1“) und dem fertigen Meilenstein 1 samt Knopf-Editor.
Kennzeichnung: **[Inhaber]** hat der Repo-Inhaber so gesagt. **[Vorschlag, bestätigt]** stammt von mir und wurde mit „Passt so“ angenommen. **[Festlegung]** ist meine Entscheidung im Rahmen des Abgestimmten.

## 1. Worum es geht

Nach Meilenstein 1 gibt es nur Level 1-1. Wer das Gipfelkreuz erreicht, landet wieder auf dem Titelbild. Der Repo-Inhaber hat einen Auswahlbereich erwartet, in dem er Level und Welten sieht. Meilenstein 2 macht daraus ein Spiel mit Fortschritt:
- eine begehbare Weltkarte der Graswelt
- vier Level und eine Festung mit Zwischengegner
- Steinschleuder und Goldener Enzian
- Musik

Zielgruppe sind weiterhin der Inhaber und Freunde, die alte Plattformspiele gut kennen. Das Gefühl darf sich am DS-Jump'n'Run orientieren. Figuren, Namen, Grafik, Musik und Levelaufbau bleiben eigen.

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**
- Titel → Weltkarte → Level → zurück zur Karte. Geschaffte Level schalten Wege frei.
- Die Graswelt ist komplett spielbar: 1-1 bis 1-4, ein geheimer Ausgang mit Abkürzung, die Festung „Wurzelburg“ und der Zwischengegner „Murmelkönig Grummel“.
- Die Steinschleuder (Aktionsknopf) und der Goldene Enzian funktionieren, wie in Spec M1 Abschnitt 5.4 beschrieben.
- Eigene Chip-Musik für Titel, Karte, Graswelt, Festung und Zwischengegner, dazu kurze Melodien. Die Musik lässt sich getrennt vom Ton abschalten.

**Nicht-Ziele (später)**
- Welten 2 bis 6
- Gleitschirm und Steigeisen
- Geheimlevel über Edelweiß
- Offline-Modus
- Multiplayer

**Anti-Ziele**
- Eine Karte, die sich fummelig bedienen lässt oder Knöpfe hat, die man verfehlt. Das ist dieselbe Lehre wie beim Knopf-Editor: Ziele mindestens ca. 44 pt.
- Ein Zwischengegner mit Treffern, denen man nicht ausweichen kann, oder ohne erkennbare Vorwarnung.
- Musik, die an Nintendo-Melodien erinnert.
- Ein Speicherstand, der beim Update verloren geht. Bestzeiten und Edelweiß aus Meilenstein 1 bleiben erhalten.

## 3. Rahmenbedingungen

Es gelten alle technischen Vorgaben aus Meilenstein 1:
- Phaser 4, TypeScript strict, Vite, Vitest, GitHub Pages.
- `src/core` ohne Phaser und ohne DOM, fester 60-Hz-Schritt.
- Texte stehen in `src/ui-text.ts`, auf Deutsch und in Großbuchstaben.
- Grafik nach Stil A aus dem Grafik-Entwurf.
- Die Bewegungswerte bleiben unverändert. Der Inhaber hat sie bestätigt.

Die Grafik wird wie bisher aus Zeichen-Rastern gebacken. Ton und Musik entstehen ohne Audiodateien.

## 4. Ansätze

| Frage | Gewählt | Verworfen und warum |
|---|---|---|
| Umfang | Ein Design für den ganzen Meilenstein, dazu **ein Plan pro Schritt** (siehe 11). | Ein einziger Riesenplan würde zu lange dauern, bis der Inhaber etwas sieht. |
| Weltkarte | Aus denselben Pixel-Kacheln wie die Level gebaut. Punkte, Wege und Freischalt-Regeln stehen als Daten in einer Datei. | Ein großes gemaltes Bild wäre schneller, müsste aber für jede Welt neu entstehen. |
| Musik | Eigener kleiner Abspieler. Die Noten stehen im Code und werden per Web Audio gespielt, wie die Soundeffekte. | Fertige Musikdateien sind größer, und es müsste jemand komponieren. Außerdem legt Spec M1 fest: ohne Audiodateien. |
| Zwischengegner, Plattformen, Steinschlag | Verhalten im reinen Spielkern mit Tests. | Nur in der Szene gescriptet wäre es schneller, aber nicht prüfbar. |

Der Inhaber hat mir das Wie überlassen („mach weiter“). Die Wahl in der Tabelle ist meine.

## 5. Weltkarte [Inhaber: herumlaufen wie beim DS, Level als Punkte auf Wegen]

- **Aussehen** [Vorschlag, bestätigt]:
  - Draufsicht im Pixel-Stil mit Hügeln, Bäumen, einem Bach und Wiesenkacheln.
  - Die Hütte ist der Startpunkt, die Festung steht am Ende.
  - Kraxel ist als kleine Kartenfigur zu sehen.
- **Bedienung** [Vorschlag, bestätigt]:
  - Steuerkreuz: Kraxel läuft entlang der Wege von Punkt zu Punkt.
  - Sprungknopf: Level betreten.
  - Einen Punkt antippen: Kraxel läuft selbst über die freigeschalteten Wege dorthin. Ein zweiter Tipp auf denselben Punkt betritt das Level [Festlegung].
  - Die Trefferfläche eines Punkts ist mindestens ca. 44 pt groß [Festlegung].
- **Anzeige** [Vorschlag, bestätigt]:
  - Geschaffte Level tragen ein kleines Gipfelkreuz.
  - Wege, die gerade freigeschaltet wurden, zeichnen sich kurz ein.
  - Gesperrte Wege sind gepunktet zu sehen. Gesperrte Punkte sind grau und lassen sich nicht betreten.
- **Hochkant:** Die Karte liegt oben im Spielbild-Bereich. Das Steuerfeld unten zeigt Name, Bestzeit und gefundene Edelweiß (✿/○) des gewählten Punkts, dazu Steuerkreuz und Sprungknopf.
- **Quer:** Eine schmale Leiste zeigt dieselben Infos [Vorschlag, bestätigt].
- **Kamera:** Ist die Karte größer als das Bild, scrollt sie mit Kraxel. Die Graswelt-Karte darf auch genau ein Bild groß sein [Festlegung].
- **Menü auf der Karte** [Vorschlag, bestätigt]:
  - Ein Pause-Knopf öffnet STEUERUNG, TON, MUSIK und TITEL.
  - Escape/P funktioniert wie im Spiel.
- **Wege der Graswelt:**
  - Hütte → 1-1 → 1-2 → 1-3 → 1-4 → Festung → „Fortsetzung folgt“ (der Platzhalter für die Eiswelt, nicht betretbar).
  - Geheime Abzweigung: Der geheime Ausgang von 1-3 öffnet eine Abkürzung von 1-3 direkt zur Festung [Vorschlag, bestätigt].
- **Freischalt-Regel** [Festlegung]:
  - Ein Weg ist offen, wenn sein Startpunkt mit dem passenden Ausgang geschafft ist: normal oder geheim.
  - Die beiden Ausgänge sind unabhängig. Der geheime Ausgang von 1-3 öffnet nur die Abkürzung zur Festung. Der Weg zu 1-4 öffnet sich erst über das normale Gipfelkreuz von 1-3, wie im Genre üblich. Wer die Abkürzung nimmt, darf 1-4 überspringen.
  - Die Hütte und der Weg zu 1-1 sind immer offen.
  - Alle bisher geschafften Level bleiben betretbar.
- **Bewegung auf der Karte** [Festlegung]:
  - Kraxel hält nur auf Punkten, nie mitten auf einem Weg.
  - An einer Gabelung wählt das Steuerkreuz den Weg, der am besten zur gedrückten Richtung passt. Gesperrte Wege sind nicht wählbar.
  - Punkte liegen mindestens 3 Kacheln auseinander, damit sich ihre Trefferflächen nicht überlappen. Bei einem Tipp gewinnt der nächstgelegene Punkt.
- **Datenformat** [Festlegung]: Eine Karte pro Welt als Datei, z. B. `src/maps/world1.txt` oder `.ts`. Sie enthält:
  - das Kachelbild der Karte
  - Punkte mit ID, Kachelposition, Level-ID und Art (Level, Festung, Hütte, Platzhalter)
  - Wege als Kachelfolge zwischen zwei Punkten, jeweils mit dem nötigen Ausgang
  - Das genaue Format darf der Bauende wählen. Es muss rein, testbar und von einem Validator geprüft sein.

## 6. Spielablauf und Speicherstand

- **Ablauf** [Festlegung]: Titel → Karte. Nach dem Gipfelkreuz kommt der Ergebnisbildschirm mit NOCHMAL und WEITER. WEITER führt zur Karte, und dort läuft gegebenenfalls die Freischalt-Animation.
- **Leben und Kristalle** [Festlegung]:
  - Sie gelten für die ganze Spielrunde über alle Level hinweg und bleiben nur im Speicher, nicht im Speicherstand.
  - Ein App-Start beginnt mit 5 Leben.
  - Game Over zeigt kurz „GAME OVER“, dann geht es auf die Karte zum Punkt dieses Levels. Die Leben stehen wieder auf 5, die Kristalle auf 0.
  - Spec M1 Abschnitt 5.5 sagt: „Bei Game Over zurück auf die Weltkarte“.
- **Items zwischen Leveln** [Festlegung]:
  - Helm bzw. Spezial-Item bleiben erhalten, solange Kraxel ein Level schafft, wie im Genre üblich.
  - Wer stirbt, verliert sie (wie heute beim Neustart am Steinmännchen).
  - Der Enzian endet mit dem Level.
- **Neue Level-Ergebnisse:** Der normale und der geheime Ausgang werden getrennt gespeichert.
- **Speicherstand v2** [Festlegung]:
  - Neuer Schlüssel `kraxel-save-v2`.
  - Pro Level: `bestTime`, `edelweiss`, `completed` sowie `exits: { normal: boolean; secret: boolean }`.
  - Dazu `muted` (Ton), `musicMuted` (Musik) und `lastNode` (der Punkt, auf dem Kraxel zuletzt stand).
  - **Migration:** Gibt es einen v1-Stand, wird er übernommen. `completed: true` zählt als normaler Ausgang. Laden wirft nie, wie bisher.
  - Die Knopf-Anordnung bleibt in ihrem eigenen Schlüssel.
- **Titel:** Unten bleibt der STEUERUNG-Knopf. Ein Tipp auf die übrige Fläche führt zur Karte.
- **Level verlassen** [Festlegung]: Das Pausenmenü im Level bekommt den Punkt ZUR KARTE. Es kostet nichts, Leben und Items bleiben. Der Fortschritt im Level verfällt, gefundene Edelweiß werden aber gespeichert, wie bei NEU STARTEN.
- **Direktaufruf `?level=…`** [Festlegung]: Er bleibt ein Entwickler-Zugang, z. B. für den Übungsplatz. Er startet ohne Karte, nach Ziel oder Game Over geht es zum Titel.
- **Levelbeginn** [Festlegung]: Eine kurze Titelkarte zeigt etwa 1 s lang z. B. „1-2 BLUMENHANG“.

## 7. Neue Spielelemente

### 7.1 Steinschleuder [Spec M1 Abschnitt 5.4]
- Sie ist ein Spezial-Item aus Item-Kisten. Die Kiste gibt den Helm, wenn Kraxel noch keinen trägt, sonst das im Level eingetragene Item. Das bestehende Kisten-Zeichen bekommt dafür eine Variante [Festlegung].
- Mit der Schleuder ist der Aktionsknopf im Spiel sichtbar. Er erscheint, sobald Kraxel die Schleuder trägt.
- **Kiesel** [Festlegung]:
  - Er fliegt flach in Blickrichtung mit leichtem Bogen. Höchstens zwei sind gleichzeitig unterwegs.
  - An Wänden prallt er nicht ab, er zerplatzt.
  - Er besiegt Käfer und Schnecke.
  - Kisten öffnet er nicht, Felsblöcke zerschlägt er nicht.
  - Werte stellt der Bauende ein: Startgeschwindigkeit ca. 180 px/s, leichte Schwerkraft, Lebensdauer begrenzt.
- **Treffer-Regel** [Spec M1]: Ein Treffer nimmt das Spezial-Item und lässt den Helm. Der nächste Treffer nimmt den Helm.

### 7.2 Goldener Enzian [Spec M1 Abschnitt 5.4]
- Er kommt aus einer Item-Kiste und gleitet über den Boden wie der Helm.
- Er wirkt ca. 8 s: Kraxel ist unverwundbar und besiegt Gegner bei Berührung.
- Dazu kommen ein Glitzer-Effekt und ein eigener Glitzer-Ton. Die Levelmusik läuft weiter [Festlegung].
- Er wirkt zusätzlich zum Item und ändert nichts daran.

### 7.3 Blätterpolster [Spec M1 Abschnitt 5.8: Sprungfedern bzw. Blätterpolster statt Pilzen]
- Ein Block, der beim Draufspringen federt [Festlegung]:
  - Normal federt er ca. 6 Kacheln hoch, mit gehaltenem Sprung ca. 7.
  - Seitlich ist er fest wie Boden.
  - Er hat ein eigenes Zeichen im Levelformat.
- Die genauen Werte stellt der Bauende ein. Ein Test pinnt die Höhen fest.

### 7.4 Bewegliche Plattformen (1-3 und Festung)
- Es gibt sie waagerecht und senkrecht, mit Strecke und Tempo aus dem Levelformat. Die Bewegung ist deterministisch [Festlegung].
- Sie sind 2 bis 4 Kacheln breit. Kraxel und Gegner, die darauf stehen, fahren mit.
- Von unten kann man hindurchspringen (One-Way).
- Sie werden nie als Falle eingesetzt, die zerquetscht.
- In 1-3 sehen sie aus wie treibende Baumstämme, in der Festung wie Steinplatten.

### 7.5 Steinschlag (Festung)
- Ein Brocken an der Decke [Festlegung]:
  - Kommt Kraxel waagerecht nah genug darunter, rieselt ca. 0,6 s Staub und es rumpelt. Dann fällt der Brocken.
  - Er trifft wie ein Gegner und zerplatzt am Boden.
  - Nach dem Tod und am Steinmännchen ist er wieder da.

### 7.6 Geheimer Ausgang
- Ein zweites, goldenes Gipfelkreuz mit eigenem Zeichen [Festlegung].
- In 1-3 liegt es versteckt oben hinter einer Felswand: Man kommt nur mit Helm oder Stampfen hin.
- Es gibt den Bonus wie das normale Gipfelkreuz und schaltet den geheimen Weg frei.

## 8. Level der Graswelt [Vorschlag, bestätigt]

Jedes Level hat drei Edelweiß nach den Regeln aus Meilenstein 1, ein Steinmännchen etwa in der Mitte und faire Sprünge nach den festgeschriebenen Werten. Die Tests prüfen Erreichbarkeit und Gruben wie bei 1-1.

| Level | Name | Kern |
|---|---|---|
| 1-1 | Sonnige Almwiese | Bleibt wie gebaut. |
| 1-2 | Blumenhang | Geht viel nach oben, mit Abschnitten höher als ein Bildschirm. Führt die **Blätterpolster** ein. Die **Steinschleuder** liegt in einer Kiste, danach kommen Schnecken auf Plattformen, die man jetzt direkt besiegen kann. |
| 1-3 | Bachgrund | Treibende Baumstämme über einem Bach, also **bewegliche Plattformen**. Oben hinter einer Felswand liegt der **geheime Ausgang**. |
| 1-4 | Gratwanderung | Das schwerste Graswelt-Level mit langen Gruben und vielen Gegnern. Eine Kiste enthält den **Goldenen Enzian**. |

Länge: ca. 180–240 Kacheln wie 1-1 [Festlegung]. Der konkrete Aufbau bleibt dem Bauenden überlassen.

## 9. Festung „Wurzelburg“ und Zwischengegner [Vorschlag, bestätigt]

- **Festung:**
  - Alte Steinburg im Berg, von Wurzeln überwuchert. Dunklere Palette mit Steinwänden.
  - Ca. 120 Kacheln lang.
  - Enthält bewegliche Plattformen und Steinschlag.
  - Vor der Tür zur Arena steht ein Steinmännchen.
  - Keine Edelweiß in der Festung [Festlegung]: Der Kampf steht im Mittelpunkt.
- **Arena** [Festlegung]:
  - Fest 16 Kacheln breit, also eine Bildschirmbreite hochkant, mit ebenem Boden und festen Wänden links und rechts.
  - Die Kamera ist fest und mittig auf die Arena gerichtet. Quer sieht man links und rechts zusätzlich die Burgmauer.
  - So sind die Abstände und damit alle Timings in beiden Ausrichtungen gleich, und Drehen ändert nichts am Kampf.
- **Murmelkönig Grummel:**
  - Ein riesiges Murmeltier, 2×2 Kacheln groß, mit eigener Grafik.
  - Ablauf als Zustandsautomat im Spielkern:
    1. **Eingraben:** Er verschwindet im Boden. Ein Erdhügel wandert sichtbar auf Kraxel zu.
    2. **Herausspringen:** Er springt an der Stelle des Hügels heraus. Wer dort steht, wird getroffen. Vorher bebt der Hügel ca. 0,5 s.
    3. **Benommen:** Nach der Landung ist er ca. 1,2 s benommen, mit sichtbaren Sternchen. Ein Sprung oder Stampfen auf den Kopf ist ein Treffer.
    4. **Steinwurf:** Zwischen den Grab-Runden wirft er 1–2 Steine im Bogen auf Kraxel. Man kann ihnen ausweichen.
  - **Drei Treffer** besiegen ihn. Nach jedem Treffer wird er schneller: kürzere Pausen, schnellerer Hügel.
  - Berührung, solange er nicht benommen ist, kostet einen Treffer.
  - Kiesel prallen an ihm ab und richten nichts aus [Festlegung]. So muss man den Kampf mit Sprüngen lösen.
  - Der Enzian macht ihn nicht besiegbar, schützt aber Kraxel [Festlegung].
- **Nach dem Sieg:** Das Gipfelkreuz erscheint in der Arena. Auf der Karte steht „GRASWELT GESCHAFFT!“ als Melodie und Textband, und der Weg zu „Fortsetzung folgt“ zeichnet sich ein.

## 10. Musik [Vorschlag, bestätigt]

- **Stücke:** Titel, Weltkarte, Graswelt-Level, Festung, Zwischengegner. Dazu kurze Melodien für „Welt geschafft“ und Game Over. Das Ziel-Jingle bleibt.
- **Klang:** 3 Stimmen (Rechteck-Melodie, Dreieck-Bass, Rauschen fürs Schlagzeug), in Schleife, mit Notenschrift im Code.
- **Abspieler:** Er plant Noten mit Vorlauf über die Web-Audio-Zeit, damit es nicht ruckelt. Beim Szenenwechsel blendet er kurz über. In der Pause wird es leiser.
- Er nutzt den bestehenden `AudioContext` und dessen Aufwach-Logik (Sfx).
- **Stil:** Alpen-fröhlich für Graswelt und Karte, z. B. Jodel-artige Sexten und Dreiklänge, aber eigene Tonfolgen. Moll und gedämpft für die Festung, schnell für den Zwischengegner.
- **Keine Anklänge** an bekannte Nintendo-Melodien. Der Inhaber hört beim Handy-Test darauf.
- **Menü:** MUSIK: AN/AUS im Pausenmenü und auf der Karte, gespeichert in `musicMuted`.

## 11. Reihenfolge und Testhalte

Jeder Schritt bekommt einen eigenen Umsetzungsplan und am Ende eine Gesamtprüfung.
1. **Weltkarte und Fortschritt:** Kartenszene, Kartendaten, Freischalten, Ablauf Titel → Karte → Level → Karte, Game Over auf der Karte, Speicherstand v2 mit Migration, Leben über Level hinweg, Level-Titelkarte. Dazu Platzhalter-Level 1-2 bis 1-4 und Festung, damit die Karte vollständig ist.
2. **Schleuder, Enzian, Blätterpolster**, ausprobierbar auf dem Übungsplatz.
   → **Handy-Test 1:** Karte, Freischalten, Schleuder und Enzian.
3. **Level 1-2 bis 1-4** mit beweglichen Plattformen und geheimem Ausgang.
4. **Festung, Steinschlag, Murmelkönig.**
5. **Musik.**
   → **Handy-Test 2:** die ganze Graswelt.

## 12. Dem Bauenden überlassen

- Dateiformat der Karte und Erweiterung des Levelformats (neue Zeichen, Plattform-Parameter), sofern rein, testbar und validiert.
- Genaue Werte für Kiesel, Polster, Plattform-Tempo, Steinschlag-Abstand und Murmelkönig-Timings. Die Grenzen oben gelten, Tests pinnen die Werte fest.
- Konkreter Aufbau von 1-2 bis 1-4 und der Festung innerhalb der Vorgaben.
- Sprites für Karte, Murmelkönig, Kiesel, Enzian, Polster, Plattformen und goldenes Gipfelkreuz im Stil A. Die Galerie zeigt alle neuen Sprites.
- Melodien innerhalb der Stilvorgaben.
