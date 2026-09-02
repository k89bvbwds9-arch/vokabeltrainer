// Zeigt ueber mehrere Tage, was die Fortschrittsbalken anzeigen - vorher und
// nachher. Zweck: die Frage "muessten nicht alle auf 1 Tag stehen?" mit
// Zahlen beantworten statt mit einer Behauptung.
import { neueKarte, bewerte, statistik, INTERVALLE, plusTage } from "../lernen.js";

const ANZAHL = 166 * 2;
let tag = "2026-09-01";
let karten = Array.from({ length: ANZAHL }, (_, i) => neueKarte("k" + i, "v" + i, "hin"));

const zeigeTag = (beschriftung) => {
  const s = statistik({ karten }, tag);
  const balken = s.proStufe
    .map((b) => `${b.stufe === 0 ? "Anfang" : b.abstand + " T."}: ${String(b.anzahl).padStart(3)}`)
    .join("   ");
  console.log(`${tag}  ${beschriftung}`);
  console.log(`          fällig heute: ${String(s.faelligHeute).padStart(3)}   |   ${balken}\n`);
};

console.log(`\n${ANZAHL} Karten an einem Tag angelegt. Zwei Drittel jeweils gewusst.\n`);

for (let durchgang = 1; durchgang <= 4; durchgang++) {
  // Alles abfragen, was heute faellig oder neu ist
  karten = karten.map((k, i) => {
    const dran = !k.faellig || k.faellig <= tag;
    return dran ? bewerte(k, (i + durchgang) % 3 !== 0, tag) : k;
  });
  tag = plusTage(tag, 1);
  zeigeTag(`(am Vortag alles Fällige abgearbeitet)`);
}

console.log("Zum Vergleich - was die ALTE, falsche Beschriftung an Tag 2 gezeigt hätte:");
console.log(`          ${INTERVALLE.map((t) => t + " T.").join("   ")}`);
console.log("          also die 1. Stufe unter \"1 T.\", die 2. unter \"3 T.\" - um eins verschoben.");
