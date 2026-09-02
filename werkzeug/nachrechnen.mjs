// Renes Fall nachstellen: an Tag 1 rund 166 Vokabeln angelegt und abgefragt,
// an Tag 2 nachsehen, was faellig ist und was die Fortschrittsanzeige sagt.
import { neueKarte, bewerte, statistik, offeneAnzahl, stelleRundeZusammen,
         plusTage, INTERVALLE } from "../lernen.js";

const TAG1 = "2026-09-01";
const TAG2 = "2026-09-02";
const ANZAHL = 166;

const zustand = { vokabeln: [], karten: [], einstellungen: { rundenGroesse: 5 } };
for (let i = 0; i < ANZAHL; i++) {
  zustand.vokabeln.push({ id: "v" + i });
  zustand.karten.push(neueKarte("k" + i + "a", "v" + i, "hin"));
  zustand.karten.push(neueKarte("k" + i + "b", "v" + i, "rueck"));
}
console.log(`Tag 1: ${zustand.vokabeln.length} Vokabeln = ${zustand.karten.length} Karten angelegt`);

// An Tag 1 alle abfragen: jede dritte Karte falsch, der Rest richtig.
let richtig = 0, falsch = 0;
zustand.karten = zustand.karten.map((k, i) => {
  const gewusst = i % 3 !== 0;
  gewusst ? richtig++ : falsch++;
  return bewerte(k, gewusst, TAG1);
});
console.log(`Tag 1 abgefragt: ${richtig} gewusst, ${falsch} nicht gewusst\n`);

const s = statistik(zustand, TAG2);
console.log("--- Tag 2, was die App anzeigt ---");
console.log(`Startbildschirm  "fällig heute": ${s.faelligHeute}`);
console.log(`Startbildschirm  "insgesamt offen": ${offeneAnzahl(zustand.karten, TAG2)}`);
console.log(`Fortschritt      Balken: ${s.proStufe.join(" | ")}`);
console.log(`Fortschritt      Beschriftung: ${INTERVALLE.map((t) => t + " T.").join(" | ")}`);
console.log(`Fortschritt      in Arbeit ${s.inArbeit}, neu ${s.neu}, ruhend ${s.ruhend}\n`);

console.log("--- Was steckt wirklich in den Balken? ---");
for (let stufe = 0; stufe <= INTERVALLE.length; stufe++) {
  const drin = zustand.karten.filter((k) => k.stufe === stufe && k.faellig);
  if (!drin.length) continue;
  const faellig = [...new Set(drin.map((k) => k.faellig))].sort();
  console.log(`Stufe ${stufe}: ${String(drin.length).padStart(3)} Karten, fällig am ${faellig.join(", ")}` +
    `   (Balken-Beschriftung sagt "${INTERVALLE[stufe] ?? "—"} T.")`);
}

const imBalken = s.proStufe.reduce((a, b) => a + b, 0);
const mitFaelligkeit = zustand.karten.filter((k) => k.faellig).length;
console.log(`\nIn den Balken gezählt: ${imBalken} von ${mitFaelligkeit} Karten mit Fälligkeit` +
  (imBalken < mitFaelligkeit ? `   ← ${mitFaelligkeit - imBalken} FEHLEN` : ""));
