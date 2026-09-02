// Zeigt die Rohzeilen samt Kaestchen - die Grundlage jeder Zuordnungsidee.
import { createWorker } from "tesseract.js";
import sharp from "sharp";
import path from "node:path";
import { MAX_BREITE, SEITENMODUS, SEITENMODUS_ERSATZ } from "../bildwerte.js";

const [bild, sprache, modus] = [process.argv[2], process.argv[3] || "ita", process.argv[4] || SEITENMODUS];
const puffer = await sharp(bild).resize({ width: MAX_BREITE, withoutEnlargement: true }).png().toBuffer();
const { width } = await sharp(puffer).metadata();

const w = await createWorker([sprache], 1, {
  langPath: path.resolve("sprachdaten"), gzip: true,
  cachePath: path.resolve(".tesseract-cache"), logger: () => {} });
await w.setParameters({ tessedit_pageseg_mode: modus });
const { data } = await w.recognize(puffer, {}, { blocks: true, text: false });
const zeilen = [];
for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) zeilen.push(l);

console.log(`${bild}  [${sprache}, Modus ${modus}]  Bildbreite ${width}, ${zeilen.length} Zeilen\n`);
console.log(" x0   x1    y0   y1  conf  Text");
console.log("-".repeat(90));
for (const l of zeilen) {
  const b = l.bbox;
  console.log(`${String(b.x0).padStart(4)} ${String(b.x1).padStart(4)}  ${String(b.y0).padStart(4)} ${String(b.y1).padStart(4)}  ${String(Math.round(l.confidence)).padStart(3)}  ${l.text.trim().slice(0, 60)}`);
}
await w.terminate();
