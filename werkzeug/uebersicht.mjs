// Schneller Ueberblick ueber viele Bilder: wie viele Paare, wie viel Unklares,
// und faellt Rahmenwerk durch? Ohne Vergleichsliste - fuer die Strukturpruefung.
import { createWorker } from "tesseract.js";
import sharp from "sharp";
import path from "node:path";
import { zuPaaren } from "../paare.js";
import { MAX_BREITE, DUNKEL_AB } from "../bildwerte.js";

const RAHMENVERDACHT = /dictionary|weiter|zurück|fertig|speichern|suchen/i;

function zeilenAus(d) {
  if (Array.isArray(d.lines) && d.lines.length) return d.lines;
  const r = [];
  for (const b of d.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) r.push(l);
  return r;
}
const schlank = (z) => z.map((l) => ({ text: l.text, conf: l.confidence, bbox: l.bbox }));

const opts = { langPath: path.resolve("sprachdaten"), gzip: true, cachePath: path.resolve(".tesseract-cache"), logger: () => {} };
const wQ = await createWorker(["rus"], 1, opts);
const wZ = await createWorker(["deu"], 1, opts);
await wQ.setParameters({ tessedit_pageseg_mode: "4" });
await wZ.setParameters({ tessedit_pageseg_mode: "4" });

console.log("\nBild            Paare  davon unsicher  unklar  Rahmen?  Zeit");
console.log("-".repeat(66));
let summePaare = 0, summeUnsicher = 0, summeUnklar = 0, summeRahmen = 0;

for (const bild of process.argv.slice(2)) {
  const grau = sharp(bild).resize({ width: MAX_BREITE, withoutEnlargement: true }).greyscale();
  const { channels } = await grau.clone().stats();
  const dunkel = channels[0].mean < DUNKEL_AB;
  const puffer = await (dunkel ? grau.negate() : grau).png().toBuffer();

  const t0 = Date.now();
  const [eQ, eZ] = await Promise.all([
    wQ.recognize(puffer, {}, { blocks: true, text: false }),
    wZ.recognize(puffer, {}, { blocks: true, text: false })]);
  const ms = Date.now() - t0;

  const { paare, unklar } = zuPaaren(
    { quelle: schlank(zeilenAus(eQ.data)), ziel: schlank(zeilenAus(eZ.data)) },
    { quelle: "rus", ziel: "deu" });

  const unsicher = paare.filter((p) => !p.sicher).length;
  const rahmen = paare.filter((p) => RAHMENVERDACHT.test(p.quelle) || RAHMENVERDACHT.test(p.ziel));
  summePaare += paare.length; summeUnsicher += unsicher;
  summeUnklar += unklar.length; summeRahmen += rahmen.length;

  console.log(`${path.basename(bild).padEnd(16)}${String(paare.length).padStart(4)}` +
    `${String(unsicher).padStart(14)}${String(unklar.length).padStart(8)}` +
    `${String(rahmen.length).padStart(9)}${String(ms).padStart(7)} ms` +
    (dunkel ? "  [dunkel]" : ""));
  for (const r of rahmen) console.log(`      RAHMEN DURCHGERUTSCHT: ${r.quelle} | ${r.ziel}`);
  for (const u of unklar) console.log(`      unklar: ${u.quelle}  (${u.grund})`);
}

console.log("-".repeat(66));
console.log(`Summe            ${String(summePaare).padStart(3)}${String(summeUnsicher).padStart(14)}` +
  `${String(summeUnklar).padStart(8)}${String(summeRahmen).padStart(9)}`);
await wQ.terminate(); await wZ.terminate();
