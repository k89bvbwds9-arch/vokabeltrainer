# Vokabeltrainer — Anleitung

Vokabeln aus Fotos lernen. Foto aufnehmen, Paare bestätigen, fünf Karten je
Runde. **Alles läuft im iPhone** — keine Datenbank, kein Server, kein Konto,
kein laufender Mac. Auch die Texterkennung.

## Auf dem iPhone einrichten

1. In **Safari** die Adresse der App öffnen.
2. Teilen-Symbol → **Zum Home-Bildschirm**.
3. Ab jetzt das Icon benutzen, nicht mehr den Safari-Tab.

Der zweite Schritt ist nicht Kosmetik. Nur eine vom Home-Bildschirm gestartete
Web-App bekommt von iOS dauerhaften Speicherplatz zugesichert; in einem
normalen Safari-Tab kann der Bestand unter Platzdruck weggeräumt werden.

Beim ersten Foto lädt die App einmalig rund 10 MB Texterkennung und
Sprachdaten nach. Danach funktioniert **alles offline**, auch im Flugmodus.

## Bedienung

**Lernen.** „Los geht's" nimmt fünf Karten: erst was liegengeblieben ist, dann
was heute dran ist, dann Neues zum Auffüllen. Karte antippen deckt die Lösung
auf, dann „Gewusst" oder „Nicht gewusst".

Das **Lautsprechersymbol** liest immer das *fremdsprachige* Wort vor — also
das in der Sprache, die beim Anlegen links stand („Sprache der Vokabel"), nie
die deutsche Seite. Bei Russisch–Deutsch also immer das Russische, bei
Italienisch–Deutsch immer das Italienische, gleich in welche Richtung gefragt
wird.

Geht die Frage von der Muttersprache aus (Deutsch → Russisch), erscheint der
Lautsprecher **erst nach dem Aufdecken** und steht dann unter der Antwort.
Vorher wäre er ein Weg, sich die Lösung vorsagen zu lassen, ohne sie zu wissen.

**Hinzufügen.** Sprachpaar wählen, Foto auswählen. Nach ein paar Sekunden
erscheinen die gefundenen Paare zur Bestätigung. Gelb umrandete Zeilen sind
solche, bei denen die Erkennung selbst unsicher war — die lohnt sich anzusehen.
Bereits bekannte Vokabeln sind grau und abgewählt. Jedes Feld ist antippbar und
änderbar, ⇅ vertauscht die beiden Sprachen einer Zeile, ✕ wirft sie weg.

**Vokabeln.** Bei mehreren Sprachpaaren steht oben eine Sprachwahl —
**Alle** oder ein einzelnes Paar. Sie gilt für den Fortschritt *und* die Liste
darunter, sonst sähe es aus wie ein Fehler. Sie wird bewusst nicht gespeichert:
Beim nächsten Öffnen steht wieder „Alle" da, damit sich niemand fragt, wo die
halben Vokabeln geblieben sind.

Darunter alle Einträge, durchsuchbar. ✎ ändert an Ort und Stelle, ✕
löscht. Darunter Einstellungen, Sicherung und der Fortschritt.

## Wie die Wiederholung funktioniert

Jede Vokabel wird zu **zwei Karten**: Russisch → Deutsch und Deutsch →
Russisch, jede mit eigenem Merkstand. Dass „сейчас → jetzt" sitzt, heißt nicht,
dass einem „jetzt → сейчас" einfällt.

Die beiden Karten einer Vokabel landen **nie in derselben Runde**, solange
genug andere da sind — sonst stünde die Antwort ja gerade noch auf dem
Bildschirm. Innerhalb gleicher Dringlichkeit wird gemischt.

Gewusst schiebt die Karte weiter: **1 → 3 → 7 → 16 → 35 Tage**. Danach ruht sie
und kommt nur noch alle vier Monate zur Kontrolle. Nicht gewusst wirft sie auf
Anfang zurück, sie ist morgen wieder dran — und kommt einmal ans Ende der
laufenden Runde.

### Sprachen auswählen

Wer mehrere Sprachpaare führt, wird beim Tippen auf **Los geht's** oder **Frei
üben** zuerst gefragt, welche gelernt werden sollen — mit den Anzahlen je Paar
(Vokabeln, fällig, neu). Die Auswahl bleibt gespeichert.

Gibt es nur ein Sprachpaar, entfällt die Frage: Sie wäre ein Klick ohne
Entscheidung.

### Freies Üben

„Frei üben, ohne Wertung" fragt — nach den Sprachen — nach der Gruppe: **Alle**, **Anfang**, die
fünf Abstände oder der **Ruhestand** — dieselbe Einteilung wie die
Fortschrittsbalken, mit den Anzahlen daneben. Leere Gruppen sind gesperrt.

Der Merkstand bleibt dabei unverändert; Fälligkeiten verschieben sich nicht.
Noch nie abgefragte Karten sind bewusst ausgenommen — sonst kennt man sie beim
ersten echten Antreffen schon.

Der Sinn: Jede Vokabel kommt genau dann, wenn man sie fast vergessen hätte.
Gekonnte sieht man kaum noch, verliert sie aber auch nicht.

**Die erste Wiederholung kommt schon am Folgetag.** Wer an einem Tag 160
Vokabeln anlegt und durcharbeitet, hat am nächsten Tag 320 Karten fällig. Das
ist kein Fehler, sondern die Leiter: Stufe 1 heißt ein Tag Abstand.

Die Balken im Fortschritt zeigen den Abstand, auf dem eine Vokabel **gerade**
steht — nicht den nächsten. „Anfang" sind zurückgeworfene Karten, die morgen
wieder drankommen.

## Sicherung — bitte ernst nehmen

Der Bestand liegt **ausschließlich** in diesem iPhone. Löschst du das App-Icon,
sind die Vokabeln weg. Ob sie im iCloud-Backup landen, sichert Apple nicht zu.

Deshalb: **Vokabeln → Einstellungen → Sichern**. Das schreibt eine Datei über
das Teilen-Blatt, Ziel „In Dateien sichern" — von dort synchronisiert iCloud
Drive selbständig weiter. Ab 20 Vokabeln erinnert die App auf dem
Startbildschirm daran, wenn die letzte Sicherung über vier Wochen her ist.

**Wiederherstellen** fragt, ob zusammengeführt oder ersetzt werden soll.
Zusammenführen ist der sichere Weg: Bei Vokabeln, die es beidseitig gibt,
gewinnt der weiter fortgeschrittene Merkstand. Eine alte Sicherung kann den
Lernstand also nicht zurückdrehen.

## Was die App bewusst nicht kann

**Tägliche Erinnerung.** iOS erlaubt Web-Apps keine selbst geplanten
Mitteilungen; echte Push-Nachrichten bräuchten einen Server. Ersatz: in der
Kurzbefehle-App eine Automation „Tageszeit → App öffnen" anlegen.

**Aus der Foto-App direkt teilen.** Web Share Target gibt es unter iOS nicht.
Erst die App öffnen, dann das Bild wählen.

## Zwei Anordnungen von Vorlagen

Die App erkennt selbst, wie eine Vorlage aufgebaut ist:

**Untereinander** – wie in Lern-Apps: Vokabel oben, Übersetzung darunter.
Bei verschiedenen Alphabeten (Russisch–Deutsch) wird am Schriftsystem
zugeordnet, sonst an den Zeilenabständen.

**Nebeneinander** – wie im Lehrbuch: Vokabel links, Übersetzung rechts.
Erkannt wird das an der Belegungsdichte über die Bildbreite: Zwei dichte
Blöcke mit einem leeren Steg dazwischen. Getrennt wird in der Mitte des Stegs.

Der Steg wird dabei **nicht als leerste Stelle** gesucht, sondern so: erst die
Stellen, über die *kein Wort hinwegläuft* — das ist die Eigenschaft einer echten
Spaltengrenze —, und unter diesen die, die *die meisten Zeilen trennt*. Beide
Kriterien einzeln führen in die Irre, und beide Irrwege sind gemessen:

| Kriterium allein | Ergebnis |
|---|---|
| nur „wenigste Wörter quer" | Steg landet im leeren Streifen rechts vom Text (6 % statt 84 % beidseitig) |
| nur „meiste Zeilen getrennt" | Steg landet mitten im Text bei x=520 (39 von 44 getrennt, aber 12 Wörter quer) |

Dabei ist außerdem wichtig, dass zuerst nach **Höhe** gruppiert wird. Tesseract zerlegt
eine Buchseite je nach Bauart unterschiedlich: Auf dem Mac kommt eine Zeile je
Tabellenzeile (`l'ingresso der Einstieg …`), auf dem iPhone kommen zwei – je
Spalte eine. Wer verlangt, dass die *Zeilen* über beide Spalten reichen, hat
auf dem einen Gerät eine funktionierende Erkennung und auf dem anderen Unsinn.

Das Spaltenverfahren hat einen Vorteil, den keines der anderen hat: Die Sprache
je Seite steht **fest** statt geraten zu werden. Die linke Hälfte wird deshalb
vom Modell der Quellsprache gelesen, die rechte von dem der Zielsprache.
Umbrochene Zellen erkennt es am Einzug und führt sie zusammen; Überschriften
und Randmarken wie „E1“ fallen weg.

## Wie gut die Erkennung ist

Gemessen an 19 echten Screenshots der Lern-App, davon 4 mit von Hand
geschriebener Vergleichsliste (35 Vokabelpaare), sowie einer abfotografierten
Lehrbuchseite (ebenfalls 35 Paare):

| | |
|---|---|
| Zeichengenau richtig, Screenshots | **33/35 = 94 %** |
| Zeichengenau richtig, Buchseite | **33/35 = 94 %** (Browser 32/35) |
| Gefundene Paare über alle 19 Bilder | 161 |
| Durchgerutschter App-Rahmen (Titel, Knöpfe) | 0 |
| Als unsicher markiert und damit sichtbar | 19 |
| Zeit je Bild (Mac) | rund 4 Sekunden |

Dieselbe Zahl im Browser wie in Node — Prüfstand und Betrieb laufen durch
dieselbe Kette. Die zwei Fehlschläge: eine Vokabel mit Lückenstrichen
(`как пройти к ___?`, Tesseract kann lange Unterstriche nicht) und die oberste,
halb unter der Kopfzeile verblasste Karte.

**Praktischer Hinweis:** Vor dem Screenshot so scrollen, dass die oberste Karte
vollständig sichtbar ist. Die halb verdeckte geht sonst gelegentlich verloren.

**Ungemessen:** Dunkelmodus. Unter den Testbildern war kein einziger. Die App
erkennt und dreht ihn um, aber belegt ist das nicht.

## Aufbau

```
index.html, app.css, app.js   die vier Bildschirme und ihre Steuerung
lernen.js                     Intervalle, Rundenzusammenstellung
paare.js                      erkannte Textzeilen zu Vokabelpaaren
erkennung.js                  Tesseract, zwei Durchläufe je Bild
bildwerte.js                  die Stellschrauben der Bildbehandlung
speicher.js                   IndexedDB, Sichern, Zusammenführen
sprachen.js                   Sprachliste und Sprachausgabe
sw.js                         Offlinebetrieb
vendor/tesseract/             Texterkennung, mitgeliefert statt vom CDN
sprachdaten/                  17 Sprachen, werden bei Bedarf geladen
werkzeug/                     Prüfstände, laufen nur auf dem Mac
```

Kein Framework, kein Build-Schritt. Ausliefern ist ein `git push`.

### Eine Sprache ergänzen

Zeile in `sprachen.js` eintragen und die passende Datei nach `sprachdaten/`
legen:

```bash
curl -O https://tessdata.projectnaptha.com/4.0.0_fast/<kürzel>.traineddata.gz
```

## Tests

Ohne Browser, ohne Netz, in einer Sekunde:

```bash
npm test
```

86 Prüfungen: Intervallleiter gegen simulierte Kalendertage, Zuordnungslogik
gegen echt gemessene Erkennungswerte, Zusammenführen von Sicherungen.

Der Erkennungstest braucht die eigenen Screenshots in `testbilder/` (die sind
nicht im Repo) und daneben je eine `<name>.erwartet.txt` mit `quelle|ziel` je
Zeile:

```bash
node werkzeug/ocr-test.mjs testbilder/*.PNG
node werkzeug/ocr-test.mjs --paar ita:deu testbilder/italienisch-buch.png
node werkzeug/uebersicht.mjs testbilder/*.PNG     # nur Struktur, ohne Messung
node werkzeug/varianten.mjs testbilder/*.PNG      # Bildbehandlung vergleichen
```

Wenn eine Vorlage nicht sauber erkannt wird, führen diese vier Werkzeuge
schrittweise zur Ursache:

```bash
node werkzeug/rohzeilen.mjs BILD ita        # was Tesseract überhaupt sieht
node werkzeug/woerter.mjs BILD ita          # Wortlücken je Zeile
node werkzeug/spalte-finden.mjs BILD ita    # Belegungsdichte, Steg
node werkzeug/steg-pruefen.mjs BILD ita     # wie knapp an den Schwellen?
node werkzeug/zellen.mjs BILD ita deu 795   # linke und rechte Zellenhälfte
```

## Fünf Fallen, die Zeit gekostet haben

Alle drei wurden gebaut, gemessen und wieder ausgebaut. Wer sie erneut
einbauen will, sollte vorher `werkzeug/varianten.mjs` laufen lassen.

**1. Beide Sprachen in einem Durchlauf.** Tesseract las `куда` als `Kyna` —
к/у/д/а sehen wie K/y/n/a aus, und mit beiden Sprachen gleichzeitig darf es
sich für Latein entscheiden. Doppelter Schaden: falsch geschrieben gespeichert
*und* die Paarbildung wirft die Vokabel still weg. Jetzt läuft je Sprache ein
eigener Durchlauf; welcher recht hat, verrät die Konfidenz.

**2. Bildbearbeitung.** Kontrastspreizung senkte die Trefferquote von 94 % auf
91 %, automatische Normalisierung auf 43 %. Graustufen erzeugten aus den
Lautsprechersymbolen Scheinzeilen, die den Vokabeln ihre Übersetzung stahlen.
Und selbst ein Canvas in *gleicher Größe ohne jede Umrechnung* drückte die
Quote auf 51 % — iPhone-Screenshots sind Display P3, das Canvas rechnet nach
sRGB um. Heute geht das Bild unverändert an Tesseract, solange es nicht
verkleinert oder umgedreht werden muss.

**3. Auf einem Gerät gemessen, auf einem anderen benutzt.** Die
Spaltenerkennung war hier grün und lieferte auf dem iPhone Unsinn – weil
Tesseract dort dieselbe Seite in getrennte Zeilen je Spalte zerlegt statt in
eine gemeinsame. Sichtbar wurde es erst an einem Screenshot aus dem Betrieb.
Seitdem nennt der Bestätigungsbildschirm, wie er das Bild gelesen hat
(„nebeneinander“ / „untereinander“) – das steht dann im nächsten Screenshot
und erspart drei Rückfragen.

**4. Wortfilter allein nach Konfidenz.** Beim Spaltenverfahren sollten Reste
der Nachbarseite („die Familie e>;“, „neu A“) verschwinden. Eine Schwelle von
40 warf sie zuverlässig weg – zusammen mit `l'ingresso` (Konfidenz 29) und
`l'appartamento` (38). Wörter mit Apostroph bekommen im italienischen Modell
niedrige Werte, obwohl sie richtig gelesen sind. Es zählt **kurz UND unsicher**,
nicht unsicher allein.

**5. Fortsetzungszeilen.** Umbrochene Übersetzungen müssen angehängt werden
(„Entschuldigung, ich habe / nicht verstanden"), Knopfbeschriftungen nicht.
Der erste Anlauf hängte auch weit entfernte Zeilen an und machte aus
`друг | Freund` ein `друг | Freund Haus` — eine Vokabel verdorben, eine
verloren. Jetzt reißt die Kette, sobald etwas dazwischenkommt.

Die ausführlichen Begründungen mit allen Zahlen stehen als Kommentare in
`paare.js`, `erkennung.js` und `bildwerte.js`.
