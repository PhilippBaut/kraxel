# Meilenstein 1: offene Punkte (Stand 26.11.2026)

Meilenstein 1 ist fertig, online und vom Repo-Inhaber am Handy getestet („echt klasse“, Kraxel-Fix „klappt jetzt“). Diese Liste hält fest, was bewusst offen blieb, damit spätere Meilensteine es aufgreifen können.

## Wartet auf den Repo-Inhaber

- **Knopf-Editor (eigener Wunsch vom 24.11.):** Der Entwurf liegt vor, die Freigabe fehlt noch.
  - Erreichbar unter „STEUERUNG“ im Pausenmenü und auf dem Titelbild.
  - Bearbeitet wird die Ansicht, in der man das Handy gerade hält.
  - Knöpfe lassen sich ziehen. Antippen und −/+ ändert die Größe (75–150 %).
  - Hochkant bleiben die Knöpfe im Steuerfeld unter der Info-Zeile. Quer dürfen sie überall in die Safe Area außer auf Info-Leiste und Pause.
  - Knöpfe dürfen sich nicht überlappen.
  - „STANDARD“ setzt zurück, „FERTIG“ speichert. Gespeichert wird getrennt für hochkant und quer.
  - Die Trefferregel (nächster Knopfrand gewinnt) bleibt.
- **Ton-Sitzung:** `navigator.audioSession.type = 'playback'` lässt den Ton auch bei Stummschalter laufen, stoppt aber vermutlich Musik aus anderen Apps. Die Alternative `'ambient'` mischt sich mit der Musik, ist bei Stummschalter aber still.
- **Klänge:** Prüfen, ob Sprung, Helm (`powerUp`) oder die Ziel-Fanfare (G4 G4 C5 G4 E5 G5) an Mario erinnern.
- **Text:** „GAME OVER“ auf Englisch lassen oder durch „SPIEL VORBEI“ ersetzen?
- **Bremsen:** Die Spec sagt „Umdrehen oder Loslassen bremst mit kurzer Rutsch-Animation“. Der Plan hat das auf Umdrehen verengt. Soll auch Loslassen aus vollem Lauf rutschen?
- **Stampfen:** Es braucht jetzt einen frischen Druck auf „unten“ ohne Seite. Fühlt sich das am Handy zuverlässig an?
- **Bildlauf:** Ruckelt es irgendwo? Der Schrittzähler rastet bei ±6 % auf 1/60 s ein, damit laufen 61–64-Hz-Displays bis zu 6 % schneller.

## Zurückgestellte Kleinigkeiten (aus den Reviews)

**Grafik und Level-Format**
- `buildSprites()` wird pro Aufruf neu gebaut.
- Toter Code in `drawClouds` und `drawSwamp`.
- Schrift und Knöpfe werden bei jedem Weltwechsel neu gebacken.
- `LevelData.startCount`.
- Der Parser ist streng bei Leerzeichen am Zeilenende.
- Die Prüfung der Spawn-Zellen ist ungetestet.

**Kollision und Bewegung**
- Ungetestete Zweige in collide.ts.
- `TILE` ist in collide.ts doppelt definiert.
- `wallLock`, `wallDir`, `runTimer` und `speedCap` bleiben nach dem Stampfen veraltet.
- `MANTLE_PUSH_TIME` ist kein Tuning-Wert.

**Kisten und Gegner**
- `openCrate` ignoriert den Helm-Typ, solange es nur den Helm gibt.
- Ein Item kann in einer festen Zelle stecken bleiben.
- Ein doppelter Helm (+10) löst kein Event aus.
- Besiegte Gegner hängen 0,5 s in der Luft.
- Die Schmerz-Animation überdeckt die Stampf-Animation.

**Leben, Tod, Ziel**
- `killPlayer` hat keinen Phasen-Schutz.
- `createGame` und `respawn` bauen das Raster doppelt auf.
- `stepGoal` behandelt keine Grube.

**Eingabe**
- Andere Maustasten als links zählen als Druck.
- Tasten aus dem Debug-Panel landen im Spiel.
- Es fehlt ein Test, dass `Controls.setLayout` `book.reset()` aufruft.

**Darstellung**
- `Array.filter` und `setTexture` laufen in WorldView jedes Bild.
- Das Fehler-Overlay sammelt Meldungen ohne Grenze.

**Speicherstand**
- Ein kaputter Level-Eintrag setzt den ganzen Speicherstand zurück.
- Der Fall `__proto__` als Schlüssel ist nicht abgefangen.
- `recordResult` hat keinen NaN-Schutz.

**Ton**
- Der erste Ton nach der allerersten Berührung kann fehlen.
- Es gibt keine Tests für `audioSession`, `resume` und die Planung der Töne.

**Level 1-1**
- Das Steinmännchen steht bei 59 % der Länge.
- Die Level-Tests entfernen die Gegner (`calm()`), außer dem Landetest.
- Die Skripte zählen Frames exakt und brechen bei geänderten Bewegungswerten.

**Manifest**
- Es gibt kein 512er-Icon mit `purpose: any`.
- Der Rand des Maskable-Icons ist auf Android noch nicht angesehen.

## Bewusst außerhalb von M1

- Felsblöcke mit Kristallen.
- Die iOS-Wischgeste „zurück“ im Browser-Modus.
- NEU STARTEN füllt die Leben auf.
- Kisten erscheinen nach dem Tod neu.
- 120-Hz-Displays zeigen 60 Schritte pro Sekunde.
- Treffer- und Todesgeräusch können sich überlagern.
- iPad-Layouts.
- Bedienkomfort von Galerie und Debug-Panel.
