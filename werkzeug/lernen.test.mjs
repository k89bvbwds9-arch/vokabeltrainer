// Prueft die Wiederholungslogik gegen simulierte Kalendertage.
// Laeuft ohne Browser, ohne Netz, ohne Kosten:  node werkzeug/lernen.test.mjs
import assert from "node:assert/strict";
import { INTERVALLE, RUHE_TAGE, plusTage, tageZwischen, neueKarte, bewerte,
  stelleRundeZusammen, offeneAnzahl, haengeAn, statistik, heute,
  aktuellerAbstand, mischen } from "../lernen.js";

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

// Beim Mischen wird in den Tests NICHT gewuerfelt - sonst pruefen sie den
// Zufall statt die Regel. Die echte Mischfunktion bekommt einen eigenen Test.
const ohneMischen = (liste) => [...liste];

/** Karte mit eigener Vokabel-Kennung; Geschwister teilen sich eine. */
const K = (id, vokabelId, faellig = null, richtung = "hin") =>
  ({ ...neueKarte(id, vokabelId, richtung), faellig });

const stapel = [
  K("alt2", "v1", "2026-08-20"),   // lange ueberfaellig
  K("alt1", "v2", "2026-08-28"),   // ueberfaellig
  K("heu1", "v3", T0),             // heute
  K("heu2", "v4", T0),
  K("neu1", "v5"),                 // nie abgefragt
  K("neu2", "v6"),
  K("spae", "v7", "2026-12-01"),   // spaeter
];
const runde = (karten, anzahl) =>
  stelleRundeZusammen(karten, { anzahl, tag: T0, mische: ohneMischen });

pruefe("nimmt ueberfaellig vor faellig vor neu", () => {
  assert.deepEqual(runde(stapel, 5).map((k) => k.id), ["alt2", "alt1", "heu1", "heu2", "neu1"]);
});
pruefe("sortiert ueberfaellige mit der aeltesten zuerst", () => {
  assert.deepEqual(runde(stapel, 2).map((k) => k.id), ["alt2", "alt1"]);
});
pruefe("nimmt nie eine Karte, die erst spaeter dran ist", () => {
  assert.ok(!runde(stapel, 99).some((k) => k.id === "spae"));
});
pruefe("bei 40 faelligen bleibt es bei fuenf", () => {
  const viele = Array.from({ length: 40 }, (_, i) => K("x" + i, "vx" + i, T0));
  assert.equal(runde(viele, 5).length, 5);
  assert.equal(offeneAnzahl(viele, T0), 40);
});
pruefe("bei drei faelligen wird mit neuen auf fuenf aufgefuellt", () => {
  const gemischt = [
    ...Array.from({ length: 3 }, (_, i) => K("f" + i, "vf" + i, T0)),
    ...Array.from({ length: 9 }, (_, i) => K("n" + i, "vn" + i)),
  ];
  const r = runde(gemischt, 5);
  assert.equal(r.length, 5);
  assert.equal(r.filter((k) => k.faellig).length, 3);
});
pruefe("bei null offenen Karten bleibt die Runde leer", () => {
  assert.equal(runde([K("a", "v1", "2026-12-01")], 5).length, 0);
  assert.equal(offeneAnzahl([K("a", "v1", "2026-12-01")], T0), 0);
});

console.log("\nBeide Richtungen derselben Vokabel trennen");
// GEMELDET AUS DEM BETRIEB: "сейчас -> jetzt" und direkt danach
// "jetzt -> сейчас". Die zweite Karte prueft dann nichts mehr.
const paarweise = [];
for (let i = 0; i < 6; i++) {
  paarweise.push(K("h" + i, "v" + i, T0, "hin"));
  paarweise.push(K("r" + i, "v" + i, T0, "rueck"));
}

pruefe("nimmt keine zwei Karten derselben Vokabel in eine Runde", () => {
  const r = runde(paarweise, 5);
  const vokabeln = r.map((k) => k.vokabelId);
  assert.equal(new Set(vokabeln).size, vokabeln.length,
    "in der Runde steckt eine Vokabel doppelt");
});
pruefe("gilt auch bei gemischter Dringlichkeit", () => {
  const gemischt = [
    K("h1", "v1", "2026-08-20", "hin"), K("r1", "v1", "2026-08-20", "rueck"),
    K("h2", "v2", T0, "hin"), K("r2", "v2", T0, "rueck"),
    K("h3", "v3", null, "hin"), K("r3", "v3", null, "rueck"),
  ];
  const r = runde(gemischt, 3);
  assert.equal(new Set(r.map((k) => k.vokabelId)).size, 3);
});
pruefe("nimmt bei zu kleinem Stapel doch beide - eine Karte waere schlechter", () => {
  const einzeln = [K("h", "v1", T0, "hin"), K("r", "v1", T0, "rueck")];
  const r = runde(einzeln, 5);
  assert.equal(r.length, 2, "bei nur einer Vokabel muessen beide Karten kommen");
});
pruefe("stellt Geschwister hinten an, statt sie zu verlieren", () => {
  // Zwei Vokabeln, Runde zu fuenft: erst je eine Karte, dann die Geschwister.
  const zwei = [
    K("h1", "v1", T0, "hin"), K("r1", "v1", T0, "rueck"),
    K("h2", "v2", T0, "hin"), K("r2", "v2", T0, "rueck"),
  ];
  const r = runde(zwei, 5);
  assert.equal(r.length, 4);
  assert.deepEqual(r.slice(0, 2).map((k) => k.vokabelId), ["v1", "v2"],
    "zuerst je eine Karte je Vokabel");
});

console.log("\nMischen");
pruefe("mischen liefert dieselben Elemente zurueck", () => {
  const rein = [1, 2, 3, 4, 5, 6, 7, 8];
  const raus = mischen(rein);
  assert.deepEqual([...raus].sort((a, b) => a - b), rein);
  assert.deepEqual(rein, [1, 2, 3, 4, 5, 6, 7, 8], "die Vorlage bleibt unveraendert");
});
pruefe("die Runde kommt nicht immer in Anlegereihenfolge", () => {
  // Ohne Mischen kamen die Karten in Anlegereihenfolge - genau der gemeldete
  // Fehler. Ueber viele Laeufe muss mehr als eine Reihenfolge vorkommen.
  const zehn = Array.from({ length: 10 }, (_, i) => K("k" + i, "v" + i, T0));
  const gesehen = new Set();
  for (let i = 0; i < 40; i++) {
    gesehen.add(stelleRundeZusammen(zehn, { anzahl: 5, tag: T0 }).map((k) => k.id).join(","));
  }
  assert.ok(gesehen.size > 1, "die Reihenfolge war in 40 Laeufen immer dieselbe");
});
pruefe("Dringlichkeit schlaegt Mischen", () => {
  // Gemischt wird NUR innerhalb gleicher Dringlichkeit. Ueberfaelliges muss
  // in jedem Lauf vor Faelligem und Neuem kommen.
  const gemischt = [
    ...Array.from({ length: 4 }, (_, i) => K("n" + i, "vn" + i)),
    ...Array.from({ length: 4 }, (_, i) => K("f" + i, "vf" + i, T0)),
    ...Array.from({ length: 4 }, (_, i) => K("u" + i, "vu" + i, "2026-08-25")),
  ];
  for (let i = 0; i < 25; i++) {
    const r = stelleRundeZusammen(gemischt, { anzahl: 8, tag: T0 });
    assert.ok(r.slice(0, 4).every((k) => k.id.startsWith("u")), "ueberfaellig muss zuerst kommen");
    assert.ok(r.slice(4, 8).every((k) => k.id.startsWith("f")), "dann das heute faellige");
  }
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

console.log("\nFortschrittsbalken");
pruefe("zeigt den Abstand, auf dem die Karte GERADE steht", () => {
  // Der gemeldete Fehler: Stufe 1 (einmal gewusst, Abstand 1 Tag) stand unter
  // der Beschriftung "3 T." - das ist der Abstand fuer das naechste Mal.
  assert.equal(aktuellerAbstand(0), 1, "zurueckgeworfen heisst morgen wieder");
  assert.equal(aktuellerAbstand(1), 1);
  assert.equal(aktuellerAbstand(2), 3);
  assert.equal(aktuellerAbstand(3), 7);
  assert.equal(aktuellerAbstand(4), 16);
  assert.equal(aktuellerAbstand(5), 35);
});
pruefe("hat einen Balken fuer JEDE Stufe, auch die letzte", () => {
  // Stufe 5 fehlte in der ersten Fassung ganz - dort sitzen die Karten, die
  // die Leiter durchlaufen haben und noch nicht ruhen.
  const s = statistik({ karten: [] }, T0);
  assert.equal(s.proStufe.length, INTERVALLE.length + 1);
  assert.deepEqual(s.proStufe.map((b) => b.abstand), [1, 1, 3, 7, 16, 35]);
});
pruefe("zaehlt Renes Fall richtig: gestern gelernt, heute faellig", () => {
  // Nachgestellt aus dem Betrieb: An Tag 1 alle Karten abgefragt, ein Drittel
  // davon nicht gewusst. An Tag 2 muessen ALLE faellig sein - die gewussten
  // stehen auf dem 1-Tages-Abstand, nicht auf drei Tagen.
  const gestern = "2026-08-31";
  const karten = Array.from({ length: 300 }, (_, i) =>
    bewerte(neueKarte("k" + i, "v" + i, "hin"), i % 3 !== 0, gestern));
  const s = statistik({ karten }, T0);

  assert.equal(s.faelligHeute, 300, "alle muessen heute faellig sein");
  const aufEinemTag = s.proStufe.filter((b) => b.abstand === 1)
    .reduce((summe, b) => summe + b.anzahl, 0);
  assert.equal(aufEinemTag, 300, "alle stehen auf dem 1-Tages-Abstand");
  assert.equal(s.proStufe.find((b) => b.stufe === 2).anzahl, 0,
    "auf dem 3-Tages-Abstand darf am zweiten Tag noch nichts stehen");
});
pruefe("nach der zweiten richtigen Antwort steht die Karte auf drei Tagen", () => {
  let k = neueKarte("k", "v", "hin");
  k = bewerte(k, true, "2026-08-31");          // -> Stufe 1, Abstand 1 Tag
  k = bewerte(k, true, k.faellig);             // -> Stufe 2, Abstand 3 Tage
  const s = statistik({ karten: [k] }, k.faellig);
  assert.equal(s.proStufe.find((b) => b.stufe === 2).anzahl, 1);
  assert.equal(tageZwischen("2026-09-01", k.faellig), 3);
});
pruefe("laesst ruhende Karten aus den Balken heraus", () => {
  let k = neueKarte("k", "v", "hin"), tag = T0;
  for (let i = 0; i < INTERVALLE.length + 1; i++) { k = bewerte(k, true, tag); tag = k.faellig; }
  assert.equal(k.ruht, true);
  const s = statistik({ karten: [k] }, tag);
  assert.equal(s.proStufe.reduce((summe, b) => summe + b.anzahl, 0), 0);
  assert.equal(s.ruhend, 1);
});

console.log(`\n${bestanden} Pruefungen bestanden` +
  (process.exitCode ? " - MIT FEHLERN" : "") + "\n");
