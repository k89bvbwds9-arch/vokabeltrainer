# Die weitergebbare Anleitung

`Vokabeltrainer-Anleitung.pdf` ist die Fassung zum Verschicken und Ausdrucken —
geschrieben für Leute, die die App nicht kennen und nichts über die Technik
dahinter wissen wollen.

Sie enthält den QR-Code, die Einrichtung Schritt für Schritt, echte
Bildschirmfotos und die Antwort auf die Frage, an der man wirklich
hängenbleibt: **welche Sprache links, welche rechts.**

## Neu erzeugen, wenn sich die App geändert hat

Zwei Schritte, beide brauchen einmalig Zusatzwerkzeuge.

**1. Bildschirmfotos neu machen.** Braucht den installierten Google Chrome und
`puppeteer-core`, und der lokale Server muss laufen:

```bash
npx serve -l 4173 .          # im Projektordner, in einem eigenen Fenster
npm install --no-save puppeteer-core
node anleitung/bilder-machen.mjs anleitung/bilder
```

Das Skript legt sich selbst einen Beispielbestand an und schneidet jeden Schuss
auf seinen Inhalt zu. Für den Bestätigungsbildschirm lässt es ein echtes Foto
durch die Erkennung laufen — dafür muss `testbilder/IMG_3390.PNG` vorhanden
sein. Fehlt es, im Skript ein anderes Bild eintragen.

**2. PDF bauen.** Braucht `reportlab` und `pillow`:

```bash
python3 -m venv .pdfumgebung
.pdfumgebung/bin/pip install reportlab pillow
.pdfumgebung/bin/python anleitung/anleitung-bauen.py
```

## Zwei Fallstricke

**Schriften.** Die eingebauten Schriften von reportlab können kein Kyrillisch —
die russischen Beispiele kämen als schwarze Kästen. Deshalb wird Arial
eingebettet. Die Pfeilsymbole der App (⇄ ⇅ ✕ ✎) fehlen wiederum in Arial;
für die einzelnen Zeichen springt Arial Unicode ein.

**Der QR-Code** ändert sich nie, weil die Adresse sich nie ändert. Er liegt als
`vokabeltrainer-qr.png` daneben und muss nicht neu erzeugt werden.
