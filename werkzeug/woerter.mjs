// Zeigt die Wortkaestchen je Zeile - und die groesste Luecke darin.
// Grundlage fuer die Frage, ob sich eine Spaltengrenze bestimmen laesst.
import { createWorker } from "tesseract.js";
import sharp from "sharp";
import path from "node:path";
import { MAX_BREITE, SEITENMODUS } from "../bildwerte.js";

const bild = process.argv[2], sprache = process.argv[3] || "ita";
const puffer = await sharp(bild).resize({ width: MAX_BREITE, withoutEnlargement: true }).png().toBuffer();
const w = await createWorker([sprache], 1, {
  langPath: path.resolve("sprachdaten"), gzip: true,
  cachePath: path.resolve(".tesseract-cache"), logger: () => {} });
await w.setParameters({ tessedit_pageseg_mode: SEITENMODUS });
const { data } = await w.recognize(puffer, {}, { blocks: true, text: false });

const luecken = [];
console.log("groesste Luecke in der Zeile:  Breite @ x   davor | danach");
console.log("-".repeat(96));
for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) {
  const woerter = (l.words || []).filter((x) => x.text.trim());
  if (woerter.length < 2) continue;
  let best = { breite: -1 };
  for (let i = 1; i < woerter.length; i++) {
    const breite = woerter[i].bbox.x0 - woerter[i - 1].bbox.x1;
    if (breite > best.breite) best = { breite, x: woerter[i - 1].bbox.x1, i };
  }
  if (best.breite < 0) continue;
  luecken.push(best);
  const davor = woerter.slice(0, best.i).map((x) => x.text).join(" ");
  const danach = woerter.slice(best.i).map((x) => x.text).join(" ");
  console.log(`${String(best.breite).padStart(4)} @ ${String(best.x).padStart(4)}   ${davor.slice(-32).padStart(32)} | ${danach.slice(0, 36)}`);
}
const xs = luecken.filter((l) => l.breite > 40).map((l) => l.x).sort((a, b) => a - b);
console.log(`\nLuecken breiter als 40 px: ${xs.length}`);
console.log(`ihre x-Positionen, Median: ${xs[Math.floor(xs.length / 2)]}`);
console.log(`Spanne: ${xs[0]} bis ${xs[xs.length - 1]}`);
await w.terminate();
