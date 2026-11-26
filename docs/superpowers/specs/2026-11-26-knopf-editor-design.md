# Knopf-Editor: Design (kurz)

**Status:** Entwurf am 24.11.2026 vorgelegt, vom Repo-Inhaber am 26.11.2026 freigegeben („Ja, bauen“).

## Absicht

Beim ersten Handy-Test hat der Repo-Inhaber die Knöpfe manchmal verfehlt. Als Sofortmaßnahme kamen größere Knöpfe und Trefferflächen ohne Lücken. Sein Wunsch ist zusätzlich, die Steuerung in den Einstellungen selbst zu platzieren, getrennt für hochkant und quer. Ziel ist, dass jede Hand und jedes Handy die Knöpfe dort hat, wo der Daumen sie trifft.

**Nicht-Ziele:** Belegung ändern, weitere Knöpfe, Deckkraft-Regler, Online-Profile.

**Anti-Ziele:**
- Der Editor darf das Spielbild hochkant nie verdecken.
- Knöpfe dürfen sich nicht überlagern.
- Eine gespeicherte Anordnung darf auf einem anderen Bildschirm nicht aus dem Bild rutschen.

## Ansätze

| Ansatz | Abwägung |
|---|---|
| **Ziehen + Größe mit −/+ (gewählt)** | So kennt man es aus Handyspielen. Man sieht direkt, wo der Daumen landet. |
| Feste Vorlagen (z. B. „höher“, „weiter innen“) | Schnell gebaut, passt aber nie genau zur eigenen Hand. |
| Schieberegler für X, Y und Größe | Fummelig und abstrakt. |

## Entscheidungen

- **Einstieg:** „STEUERUNG“ als vierter Punkt im Pausenmenü und als kleiner Knopf auf dem Titelbild.
- **Ausrichtung:** Bearbeitet wird die Ansicht, in der man das Handy gerade hält. Dreht man es im Editor, wechselt die bearbeitete Ansicht. Beide Ansichten bleiben im Arbeitsstand erhalten.
- **Bedienung:**
  - Einen Knopf antippen wählt ihn aus und hebt ihn hervor. Ziehen verschiebt ihn.
  - **−/+** ändert die Größe des gewählten Knopfs in Schritten von 12,5 % zwischen 75 % und 150 %.
  - **STANDARD** setzt die aktuelle Ansicht zurück.
  - **FERTIG** speichert und kehrt zurück.
- **Erlaubter Bereich:**
  - Hochkant liegt er im Steuerfeld unterhalb der Info-Zeile und oberhalb des unteren Safe-Area-Rands.
  - Quer liegt er in der Safe Area unterhalb der Info-Leiste und außerhalb der Pause-Fläche.
  - Knöpfe werden in den Bereich geklemmt. Zwischen zwei gezeichneten Knöpfen bleiben mindestens 4 px frei. Eine Verschiebung, die das verletzen würde, wird nicht übernommen.
- **Speicherung:**
  - Eigener Schlüssel `kraxel-controls-v1`, getrennt vom Spielstand.
  - Gespeichert werden pro Ansicht und Knopf die Lage als Anteil am erlaubten Bereich (0…1) und die Größe.
  - So passt die Anordnung auch auf andere Bildschirmgrößen. Würde sie dort überlappen oder nicht passen, gilt für diese Ansicht der Standard.
- **Treffer:** Die Trefferregel bleibt: Der nächste Knopfrand gewinnt, hochkant ohne Lücken. `hitR` wächst mit der Knopfgröße.
- **Aktionsknopf:** Er erscheint im Editor, damit seine Lage für die spätere Steinschleuder schon passt.
- **Spielzustand:** Während der Editor offen ist, bleibt das Spiel angehalten. Die Spielknöpfe der Info-Ebene werden ausgeblendet.

## Dem Bauenden überlassen

Das Aussehen der Werkzeugleiste und der Hervorhebung im Pixel-Stil des Entwurfs, der Hinweistext und die genaue Lage der Werkzeugleiste. Quer darf sie keinen Knopf ganz verdecken.
