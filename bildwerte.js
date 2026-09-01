// Die Stellschrauben der Bildvorverarbeitung - an einer Stelle, weil sie an
// ZWEI Stellen angewandt werden: im iPhone ueber Canvas (erkennung.js) und im
// Erkennungstest auf dem Mac ueber sharp (werkzeug/ocr-test.mjs).
//
// Warum das wichtig ist: Anfangs steckte die Vorverarbeitung nur in der App.
// Der Test lief damit auf dem Rohbild und mass eine andere Kette als die, die
// im Betrieb laeuft - eine gemessene Trefferquote, die fuer den Betrieb nichts
// aussagt. Die Pixelrechnung laesst sich zwischen Canvas und sharp nicht
// teilen, die Zahlen und die Entscheidungslogik sehr wohl.
//
// ============================================================
// ERGEBNIS: Am Bild wird NICHTS veraendert, solange es nicht muss.
// ============================================================
//
// Das ist keine Bequemlichkeit, sondern das Ergebnis von drei Messreihen an
// vier echten Screenshots mit 35 Vokabelpaaren.
//
// Erste Reihe, in Node (werkzeug/varianten.mjs):
//
//   roh, unveraendert             33/35   94 %
//   nur verkleinert               33/35   94 %
//   verkleinert + Graustufen      33/35   94 %
//   + Kontrast gespreizt          32/35   91 %
//   + automatisch normalisiert    15/35   43 %
//
// Die Kontrastspreizung war als Hilfe fuer blasse Vorlagen gedacht und ist
// genau deshalb schaedlich: Sie hebt auch den halbdurchsichtigen App-Kopf mit
// an, der dann in die erste Vokabel hineinlaeuft ("ОсНопагу сок" statt "сок").
// Die automatische Normalisierung streckt auf die extremsten Pixel des
// Bildes - bei einem Screenshot sind das die schwarze Statusleiste und der
// weisse Rand - und zerstoert die Erkennung fast vollstaendig.
//
// Zweite Reihe, dieselbe Datei im Browser gegen Node:
//
//   Originalbild in Farbe  ->  "в магазине", "на работе", "в метро"
//   Graustufenbild         ->  dieselben Zeilen PLUS ". 4)" und "р 4)"
//
// Die grauen Lautsprechersymbole neben jeder Vokabel gewinnen durch die
// Umwandlung so viel Kontrast, dass Tesseract sie fuer Text haelt. Diese
// Scheinzeilen schieben sich zwischen Vokabel und Uebersetzung und stehlen ihr
// die Zuordnung.
//
// Dritte Reihe, im Browser, Bild unveraendert gegen Bild durch ein Canvas
// gereicht - GLEICHE GROESSE, keine Umrechnung, nur gezeichnet:
//
//   Originaldatei direkt an Tesseract   33/35   94 %
//   ueber ein Canvas gereicht           18/35   51 %
//
// Ursache ist der Farbraum: iPhone-Screenshots sind Display P3, ein Canvas
// rechnet sie beim Zeichnen nach sRGB um, und die grauen Symbole verschieben
// sich dabei ueber die Schwelle.
//
// Die Lehre: Jede Bildbearbeitung muss sich rechtfertigen. Keine ist der
// Normalfall. Wer es erneut versuchen will - die Varianten stehen noch in
// werkzeug/varianten.mjs, und die Messung dauert eine Minute.

// Nur wenn ein Bild breiter ist als das, wird es ueberhaupt angefasst. Ein
// iPhone-Foto hat leicht 4000 px Breite, und Tesseracts Laufzeit waechst mit
// der Flaeche; fuer Text in Lesegroesse bringt mehr Aufloesung nichts.
// Screenshots liegen mit rund 1200 px darunter und gehen unveraendert durch.
export const MAX_BREITE = 1600;

// Liegt die mittlere Helligkeit darunter, ist es ein Dunkelmodus-Screenshot
// und wird umgedreht: Dunkle Schrift auf hellem Grund ist das, worauf
// Tesseract trainiert ist.
//
// ACHTUNG, ungemessen: Unter den 19 Testbildern war kein einziger
// Dunkelmodus-Screenshot. Die Umkehr ist sachlich richtig, aber nicht belegt -
// und sie fuehrt zwangslaeufig ueber ein Canvas, das sich oben als schaedlich
// erwiesen hat. Wer den Dunkelmodus benutzt, sollte einen solchen Screenshot
// durch werkzeug/ocr-test.mjs schicken, bevor er sich darauf verlaesst.
export const DUNKEL_AB = 110;
