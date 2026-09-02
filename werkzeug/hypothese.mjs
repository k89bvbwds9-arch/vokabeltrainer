// Prueft die Vermutung: Wenn Tesseract die beiden Spalten als GETRENNTE
// Zeilen liefert statt als eine gemeinsame, lehnt die Spaltenerkennung ab.
import { zuPaaren, spaltenAufteilung } from "../paare.js";

const wort = (text, x0, breite, conf = 95) =>
  ({ text, conf, bbox: { x0, x1: x0 + breite, y0: 0, y1: 0 } });
const zeile = (y, woerter) => ({
  text: woerter.map((w) => w.text).join(" "), conf: 92,
  bbox: { x0: woerter[0].bbox.x0, x1: woerter[woerter.length - 1].bbox.x1, y0: y, y1: y + 40 },
  woerter: woerter.map((w) => ({ ...w, bbox: { ...w.bbox, y0: y, y1: y + 40 } })),
});

const PAARE = [["il nome","der Name"],["il cognome","der Nachname"],["la via","der Weg"],
               ["il palazzo","das Wohnhaus"],["la casa","das Haus"],["il gatto","die Katze"],
               ["la famiglia","die Familie"],["il numero","die Zahl"]];

// Fall A: beide Spalten in EINER Zeile (so laeuft es auf dem Mac)
const fallA = PAARE.map(([it, de], i) =>
  zeile(200 + i * 100, [wort(it, 185, it.length * 18), wort(de, 810, de.length * 18)]));

// Fall B: jede Spalte eine EIGENE Zeile (Vermutung fuers iPhone)
const fallB = PAARE.flatMap(([it, de], i) => [
  zeile(200 + i * 100, [wort(it, 185, it.length * 18)]),
  zeile(200 + i * 100, [wort(de, 810, de.length * 18)]),
]);

for (const [name, zeilen] of [["Fall A: eine gemeinsame Zeile", fallA],
                              ["Fall B: getrennte Zeilen je Spalte", fallB]]) {
  const a = spaltenAufteilung(zeilen, 1600); const grenze = a?.ok ? a.grenze : null;
  const erg = zuPaaren({ quelle: zeilen, ziel: zeilen.map((z) => ({ ...z })) },
    { quelle: "ita", ziel: "deu" }, 1600);
  console.log(`\n${name}`);
  console.log(`  Steg gefunden: ${grenze ?? "NEIN"}`);
  console.log(`  Verfahren:     ${erg.verfahren}`);
  console.log(`  Paare:         ${erg.paare.length}`);
  console.log(`  erste drei:    ${erg.paare.slice(0, 3).map((p) => `${p.quelle} | ${p.ziel}`).join("   ") || "—"}`);
  if (erg.unklar.length) console.log(`  unklar:        ${erg.unklar.slice(0,2).map(u=>u.quelle).join("   ")}`);
}
