// Prueft die Wiederholungslogik gegen simulierte Kalendertage.
// Laeuft ohne Browser, ohne Netz, ohne Kosten:  node werkzeug/lernen.test.mjs
import assert from "node:assert/strict";
import { INTERVALLE, RUHE_TAGE, plusTage, tageZwischen, neueKarte, bewerte,
  stelleRundeZusammen, offeneAnzahl, haengeAn, statistik, heute } from "../lernen.js";

let bestanden = 0;
function pruefe(name, fn) {
  try { fn(); bestanden++; console.log(`  ok   ${name}`); }
  catch (e) { console.error(`  FEHL ${name}\n       ${e.message}`); process.exitCode = 1; }
}

const T0 = "2026-09-01";

console.log("\nDatumsrechnung");
pruefe("plusTage rechnet ueber Monatsgrenzen", () => {
  assert.equal(plusTage("2026-09-30", 1), "2026-10-01");
  assert.equal(plusTage("2026-12-31", 1), "2027-01-01");
});
pruefe("plusTage ueberspringt keinen Tag bei der Zeitumstellung", () => {
  // In Deutschland endet die Sommerzeit am 25.10.2026. Eine naive Rechnung in
  // Ortszeit landet hier auf dem 25., weil der Tag 25 Stunden hat.
  assert.equal(plusTage("2026-10-24", 2), "2026-10-26");
});
pruefe("tageZwischen zaehlt richtig", () => {
  assert.equal(tageZwischen("2026-09-01", "2026-09-08"), 7);
  assert.equal(tageZwischen("2026-09-08", "2026-09-01"), -7);
});
pruefe("heute liefert den Ortstag, nicht den UTC-Tag", () => {
  // 23:30 Ortszeit ist in UTC bereits der Folgetag. Wer abends lernt, soll
  // trotzdem den heutigen Lerntag bekommen - sonst reisst die Serie.
  const spaet = new Date(2026, 8, 1, 23, 30);
  assert.equal(heute(spaet), "2026-09-01");
});

console.log("\nIntervallleiter");
pruefe("durchlaeuft alle fuenf Stufen mit den geplanten Abstaenden", () => {
  let k = neueKarte("k1", "v1", "hin");
  let tag = T0;
  const gemessen = [];
  for (let i = 0; i < INTERVALLE.length; i++) {
    k = bewerte(k, true, tag);
    gemessen.push(tageZwischen(tag, k.faellig));
    tag = k.faellig;
  }
  assert.deepEqual(gemessen, INTERVALLE);
  assert.equal(k.stufe, INTERVALLE.length);
  assert.equal(k.ruht, false, "nach der letzten Stufe ist sie noch nicht im Ruhestand");
});
pruefe("geht erst NACH der 35-Tage-Stufe in den Ruhestand", () => {
  let k = neueKarte("k1", "v1", "hin"), tag = T0;
  for (let i = 0; i < INTERVALLE.length; i++) { k = bewerte(k, true, tag); tag = k.faellig; }
  k = bewerte(k, true, tag);
  assert.equal(k.ruht, true);
  assert.equal(tageZwischen(tag, k.faellig), RUHE_TAGE);
});
pruefe("bleibt im Ruhestand ohne die Stufe weiter hochzuzaehlen", () => {
  let k = neueKarte("k1", "v1", "hin"), tag = T0;
  for (let i = 0; i < INTERVALLE.length + 3; i++) { k = bewerte(k, true, tag); tag = k.faellig; }
  assert.equal(k.stufe, INTERVALLE.length);
  assert.equal(k.ruht, true);
});
pruefe("Nicht gewusst wirft auf Stufe 0 und auf morgen zurueck", () => {
  let k = neueKarte("k1", "v1", "hin"), tag = T0;
  for (let i = 0; i < 3; i++) { k = bewerte(k, true, tag); tag = k.faellig; }
  assert.equal(k.stufe, 3);
  const nach = bewerte(k, false, tag);
  assert.equal(nach.stufe, 0);
  assert.equal(nach.ruht, false);
  assert.equal(tageZwischen(tag, nach.faellig), 1);
});
pruefe("holt eine ruhende Karte bei Fehler zurueck in den Umlauf", () => {
  let k = neueKarte("k1", "v1", "hin"), tag = T0;
  for (let i = 0; i < INTERVALLE.length + 1; i++) { k = bewerte(k, true, tag); tag = k.faellig; }
  assert.equal(k.ruht, true);
  assert.equal(bewerte(k, false, tag).ruht, false);
});
pruefe("bewerte veraendert die uebergebene Karte nicht", () => {
  const k = neueKarte("k1", "v1", "hin");
  bewerte(k, true, T0);
  assert.equal(k.stufe, 0);
  assert.equal(k.faellig, null);
});
pruefe("zaehlt richtig und falsch mit", () => {
  let k = neueKarte("k1", "v1", "hin");
  k = bewerte(k, true, T0); k = bewerte(k, false, T0); k = bewerte(k, true, T0);
  assert.equal(k.richtig, 2);
  assert.equal(k.falsch, 1);
});

console.log("\nRunde zusammenstellen");
const stapel = [
  { ...neueKarte("alt2", "v", "hin"), faellig: "2026-08-20" },   // lange ueberfaellig
  { ...neueKarte("alt1", "v", "hin"), faellig: "2026-08-28" },   // ueberfaellig
  { ...neueKarte("heu1", "v", "hin"), faellig: T0 },             // heute
  { ...neueKarte("heu2", "v", "hin"), faellig: T0 },
  neueKarte("neu1", "v", "hin"),                                  // nie abgefragt
  neueKarte("neu2", "v", "hin"),
  { ...neueKarte("spae", "v", "hin"), faellig: "2026-12-01" },    // spaeter
];
pruefe("nimmt ueberfaellig vor faellig vor neu", () => {
  const runde = stelleRundeZusammen(stapel, { anzahl: 5, tag: T0 });
  assert.deepEqual(runde.map((k) => k.id), ["alt2", "alt1", "heu1", "heu2", "neu1"]);
});
pruefe("sortiert ueberfaellige mit der aeltesten zuerst", () => {
  const runde = stelleRundeZusammen(stapel, { anzahl: 2, tag: T0 });
  assert.deepEqual(runde.map((k) => k.id), ["alt2", "alt1"]);
});
pruefe("nimmt nie eine Karte, die erst spaeter dran ist", () => {
  const runde = stelleRundeZusammen(stapel, { anzahl: 99, tag: T0 });
  assert.ok(!runde.some((k) => k.id === "spae"));
});
pruefe("bei 40 faelligen bleibt es bei fuenf", () => {
  const viele = Array.from({ length: 40 }, (_, i) =>
    ({ ...neueKarte(`x${i}`, "v", "hin"), faellig: T0 }));
  assert.equal(stelleRundeZusammen(viele, { anzahl: 5, tag: T0 }).length, 5);
  assert.equal(offeneAnzahl(viele, T0), 40);
});
pruefe("bei drei faelligen wird mit neuen auf fuenf aufgefuellt", () => {
  const gemischt = [
    ...Array.from({ length: 3 }, (_, i) => ({ ...neueKarte(`f${i}`, "v", "hin"), faellig: T0 })),
    ...Array.from({ length: 9 }, (_, i) => neueKarte(`n${i}`, "v", "hin")),
  ];
  const runde = stelleRundeZusammen(gemischt, { anzahl: 5, tag: T0 });
  assert.equal(runde.length, 5);
  assert.equal(runde.filter((k) => k.faellig).length, 3);
});
pruefe("bei null offenen Karten bleibt die Runde leer", () => {
  const alleSpaeter = [{ ...neueKarte("a", "v", "hin"), faellig: "2026-12-01" }];
  assert.equal(stelleRundeZusammen(alleSpaeter, { anzahl: 5, tag: T0 }).length, 0);
  assert.equal(offeneAnzahl(alleSpaeter, T0), 0);
});

console.log("\nFalsche Karte nachreichen");
pruefe("haengt eine falsche Karte genau einmal an", () => {
  const wiederholt = new Set();
  const k = neueKarte("k1", "v", "hin");
  let runde = [k];
  runde = haengeAn(runde, k, wiederholt);
  assert.equal(runde.length, 2);
  runde = haengeAn(runde, k, wiederholt);
  assert.equal(runde.length, 2, "beim zweiten Mal darf sie die Runde nicht verlaengern");
});

console.log("\nZahlen fuer den Startbildschirm");
pruefe("zaehlt faellig, neu, ruhend und in Arbeit getrennt", () => {
  const z = { vokabeln: [{}, {}, {}], karten: [
    { ...neueKarte("a", "v", "hin"), faellig: "2026-08-28" },
    { ...neueKarte("b", "v", "hin"), faellig: T0 },
    { ...neueKarte("c", "v", "hin"), faellig: "2026-12-01", ruht: true, stufe: 5 },
    neueKarte("d", "v", "hin"),
  ] };
  const s = statistik(z, T0);
  assert.equal(s.faelligHeute, 2);
  assert.equal(s.neu, 1);
  assert.equal(s.ruhend, 1);
  // neu + inArbeit + ruhend muss den Bestand ergeben: 1 + 2 + 1 = 4 Karten
  assert.equal(s.inArbeit, 2);
  assert.equal(s.neu + s.inArbeit + s.ruhend, s.karten);
  assert.equal(s.vokabeln, 3);
});
pruefe("zaehlt die Serie aufeinanderfolgender Lerntage", () => {
  const z = { karten: [
    { ...neueKarte("a", "v", "hin"), zuletzt: "2026-08-30" },
    { ...neueKarte("b", "v", "hin"), zuletzt: "2026-08-31" },
    { ...neueKarte("c", "v", "hin"), zuletzt: T0 },
  ] };
  assert.equal(statistik(z, T0).serie, 3);
});
pruefe("Serie ueberlebt den heutigen Vormittag (gestern zaehlt)", () => {
  const z = { karten: [{ ...neueKarte("a", "v", "hin"), zuletzt: "2026-08-31" }] };
  assert.equal(statistik(z, T0).serie, 1);
});
pruefe("Serie reisst nach einem uebersprungenen Tag", () => {
  const z = { karten: [
    { ...neueKarte("a", "v", "hin"), zuletzt: "2026-08-28" },
    { ...neueKarte("b", "v", "hin"), zuletzt: "2026-08-30" },
    { ...neueKarte("c", "v", "hin"), zuletzt: T0 },
  ] };
  // Der 31.08. fehlt, die Serie reicht also nur bis zum heutigen Tag selbst
  assert.equal(statistik(z, T0).serie, 1);
});
pruefe("Serie ist null nach laengerer Pause", () => {
  const z = { karten: [{ ...neueKarte("a", "v", "hin"), zuletzt: "2026-08-01" }] };
  assert.equal(statistik(z, T0).serie, 0);
});

console.log(`\n${bestanden} Pruefungen bestanden` +
  (process.exitCode ? " - MIT FEHLERN" : "") + "\n");
