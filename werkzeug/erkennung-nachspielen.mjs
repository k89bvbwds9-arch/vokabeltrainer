// Spielt eine auf dem iPhone gesicherte Erkennung hier nach.
//
//   node werkzeug/erkennung-nachspielen.mjs erkennung-....json
//
// Damit laesst sich ein Fehler, der nur auf einem anderen Geraet auftritt, auf
// diesem Rechner untersuchen - ohne Tesseract, ohne Bild, in Millisekunden.
import { readFileSync } from "node:fs";
import { zuPaaren, spaltenAufteilung } from "../paare.js";

const daten = JSON.parse(readFileSync(process.argv[2], "utf8"));
const { paar, durchlaeufe, diagnose } = daten;
const breite = diagnose?.ocrBreite || 1600;

console.log(`\nGesichert am ${daten.zeitpunkt}, Fassung ${daten.fassung}`);
console.log(`Sprachpaar ${paar.quelle} → ${paar.ziel}, Bildbreite ${breite}`);
console.log(`Auf dem Geraet: ${diagnose?.verfahren}, Reihen ${diagnose?.messung?.reihenAnzahl}, ` +
  `beidseitig ${Math.round((diagnose?.messung?.beidseitigAnteil ?? 0) * 100)} %, Steg ${diagnose?.grenze}\n`);

const auf = spaltenAufteilung(durchlaeufe.quelle, breite);
console.log(`Hier nachgerechnet: ${auf?.ok ? "Spalten erkannt" : "keine Spalten"}, ` +
  `Reihen ${auf?.reihenAnzahl}, beidseitig ${Math.round((auf?.beidseitigAnteil ?? 0) * 100)} %, ` +
  `Steg ${auf?.grenze}\n`);

if (auf?.ok) {
  console.log("Die ersten Reihen, wie sie zerlegt werden:");
  console.log("-".repeat(100));
  for (const r of auf.reihen.slice(0, Number(process.argv[3]) || 8)) {
    const links = r.woerter.filter((w) => w.bbox.x1 <= auf.grenze);
    const rechts = r.woerter.filter((w) => w.bbox.x0 >= auf.grenze);
    const quer = r.woerter.filter((w) => w.bbox.x0 < auf.grenze && w.bbox.x1 > auf.grenze);
    const zeig = (ws) => ws.map((w) => `${w.text}[x${w.bbox.x0}-${w.bbox.x1} k${Math.round(w.conf)}]`).join(" ");
    console.log(`y ${r.y0}-${r.y1}`);
    console.log(`   links : ${zeig(links) || "—"}`);
    console.log(`   rechts: ${zeig(rechts) || "—"}`);
    if (quer.length) console.log(`   QUER  : ${zeig(quer)}`);
  }
}

const erg = zuPaaren(durchlaeufe, paar, breite);
console.log(`\nErgebnis: ${erg.verfahren}, ${erg.paare.length} Paare, ${erg.unklar.length} unklar`);
for (const p of erg.paare.slice(0, 12)) console.log(`   ${p.quelle}  |  ${p.ziel}`);
