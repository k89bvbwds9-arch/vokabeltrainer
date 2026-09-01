// Prueft das Pruefen und Zusammenfuehren von Sicherungen.
// Nur reine Rechnung - IndexedDB wird nie angefasst, deshalb laeuft das in Node.
import assert from "node:assert/strict";
import { pruefeSicherung, fuehreZusammen, LEERER_ZUSTAND } from "../speicher.js";

let bestanden = 0;
function pruefe(name, fn) {
  try { fn(); bestanden++; console.log(`  ok   ${name}`); }
  catch (e) { console.error(`  FEHL ${name}\n       ${e.message}`); process.exitCode = 1; }
}

const vokabel = (id, quelle, ziel) => ({ id, paarId: "ru-de", quelle, ziel, angelegt: "2026-09-01" });
const karte = (id, vokabelId, richtung, stufe, faellig) =>
  ({ id, vokabelId, richtung, stufe, faellig, zuletzt: null, richtig: stufe, falsch: 0, ruht: false });

console.log("\nSicherung pruefen");
pruefe("weist Unsinn zurueck", () => {
  assert.ok(pruefeSicherung(null));
  assert.ok(pruefeSicherung("Text"));
  assert.ok(pruefeSicherung({ vokabeln: [] }));
});
pruefe("nimmt eine vollstaendige Sicherung an", () => {
  assert.equal(pruefeSicherung(structuredClone(LEERER_ZUSTAND)), null);
});
pruefe("weist eine Sicherung aus einer neueren Fassung zurueck", () => {
  const zukunft = { ...structuredClone(LEERER_ZUSTAND), version: 99 };
  assert.ok(pruefeSicherung(zukunft).includes("neueren"));
});

console.log("\nZusammenfuehren");
const alt = {
  ...structuredClone(LEERER_ZUSTAND),
  sprachpaare: [{ id: "ru-de", quelle: "rus", ziel: "deu", name: "Russisch – Deutsch" }],
  vokabeln: [vokabel("v1", "куда", "wohin"), vokabel("v2", "сейчас", "jetzt")],
  karten: [karte("k1", "v1", "hin", 4, "2026-10-01"), karte("k2", "v1", "rueck", 1, "2026-09-02"),
           karte("k3", "v2", "hin", 0, null), karte("k4", "v2", "rueck", 0, null)],
};

pruefe("uebernimmt unbekannte Vokabeln samt ihren Karten", () => {
  const neu = {
    ...structuredClone(LEERER_ZUSTAND),
    sprachpaare: alt.sprachpaare,
    vokabeln: [vokabel("v9", "когда", "wann")],
    karten: [karte("k9", "v9", "hin", 2, "2026-09-10")],
  };
  const z = fuehreZusammen(alt, neu);
  assert.equal(z.vokabeln.length, 3);
  assert.ok(z.vokabeln.some((v) => v.quelle === "когда"));
  assert.ok(z.karten.some((k) => k.id === "k9"));
});

pruefe("uebernimmt ein unbekanntes Sprachpaar nur einmal", () => {
  const neu = {
    ...structuredClone(LEERER_ZUSTAND),
    sprachpaare: [alt.sprachpaare[0], { id: "it-de", quelle: "ita", ziel: "deu", name: "Italienisch – Deutsch" }],
  };
  const z = fuehreZusammen(alt, neu);
  assert.equal(z.sprachpaare.length, 2);
});

pruefe("laesst eine ALTE Sicherung den Lernstand NICHT zurueckdrehen", () => {
  // Der teuerste denkbare Fehler: Eine Sicherung von vor sechs Wochen einlesen
  // und dabei alles Gelernte seitdem verlieren. Stufe 4 muss Stufe 1 schlagen.
  const veraltet = {
    ...structuredClone(LEERER_ZUSTAND),
    sprachpaare: alt.sprachpaare,
    vokabeln: [vokabel("x1", "куда", "wohin")],
    karten: [karte("kx", "x1", "hin", 1, "2026-08-01")],
  };
  const z = fuehreZusammen(alt, veraltet);
  const k = z.karten.find((e) => e.vokabelId === "v1" && e.richtung === "hin");
  assert.equal(k.stufe, 4, "der weiter fortgeschrittene Stand muss gewinnen");
  assert.equal(k.faellig, "2026-10-01");
  assert.equal(z.vokabeln.length, 2, "куда darf nicht doppelt entstehen");
});

pruefe("uebernimmt einen WEITEREN Stand aus der Sicherung", () => {
  const neuer = {
    ...structuredClone(LEERER_ZUSTAND),
    sprachpaare: alt.sprachpaare,
    vokabeln: [vokabel("x2", "сейчас", "jetzt")],
    karten: [karte("ky", "x2", "hin", 3, "2026-09-20")],
  };
  const z = fuehreZusammen(alt, neuer);
  const k = z.karten.find((e) => e.vokabelId === "v2" && e.richtung === "hin");
  assert.equal(k.stufe, 3);
  assert.equal(k.id, "k3", "die eigene Karten-Kennung bleibt erhalten");
  assert.equal(k.vokabelId, "v2", "die Karte bleibt an der eigenen Vokabel");
});

pruefe("ergaenzt eine fehlende Richtung, statt sie zu ueberschreiben", () => {
  const nurHin = {
    ...structuredClone(LEERER_ZUSTAND),
    sprachpaare: alt.sprachpaare,
    vokabeln: [vokabel("v1", "куда", "wohin")],
    karten: [karte("kz", "v1", "hin", 2, "2026-09-05")],
  };
  const ohneRueck = { ...structuredClone(alt), karten: alt.karten.filter((k) => k.id !== "k2") };
  const z = fuehreZusammen(ohneRueck, nurHin);
  assert.equal(z.karten.filter((k) => k.vokabelId === "v1").length, 1);
});

pruefe("veraendert den laufenden Bestand nicht", () => {
  const vorher = JSON.stringify(alt);
  fuehreZusammen(alt, { ...structuredClone(LEERER_ZUSTAND), vokabeln: [vokabel("v7", "новый", "neu")] });
  assert.equal(JSON.stringify(alt), vorher);
});

console.log(`\n${bestanden} Pruefungen bestanden` +
  (process.exitCode ? " - MIT FEHLERN" : "") + "\n");
