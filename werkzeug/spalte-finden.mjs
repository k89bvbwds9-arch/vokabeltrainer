// Sucht die Spaltengrenze ueber die Belegungsdichte: an welcher x-Position
// ueberdecken die wenigsten Zeilen Text? Das ist der Steg zwischen den Spalten.
import { createWorker } from "tesseract.js";
import sharp from "sharp";
import path from "node:path";
import { MAX_BREITE, SEITENMODUS } from "../bildwerte.js";

const bild = process.argv[2], sprache = process.argv[3] || "ita";
const puffer = await sharp(bild).resize({ width: MAX_BREITE, withoutEnlargement: true }).png().toBuffer();
const { width } = await sharp(puffer).metadata();
const w = await createWorker([sprache], 1, {
  langPath: path.resolve("sprachdaten"), gzip: true,
  cachePath: path.resolve(".tesseract-cache"), logger: () => {} });
await w.setParameters({ tessedit_pageseg_mode: SEITENMODUS });
const { data } = await w.recognize(puffer, {}, { blocks: true, text: false });

const zeilen = [];
for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) {
  const woerter = (l.words || []).filter((x) => /\p{L}/u.test(x.text));
  if (woerter.length) zeilen.push(woerter);
}

// Belegung je x: wie viele Zeilen haben dort ein Wort?
const schritt = 10;
const belegung = new Array(Math.ceil(width / schritt)).fill(0);
for (const woerter of zeilen) {
  const dabei = new Set();
  for (const wo of woerter) {
    for (let x = Math.floor(wo.bbox.x0 / schritt); x <= Math.floor(wo.bbox.x1 / schritt); x++) dabei.add(x);
  }
  for (const x of dabei) belegung[x]++;
}

const links = Math.floor(belegung.length * 0.15), rechts = Math.floor(belegung.length * 0.85);
let tiefste = { wert: Infinity, x: -1 };
for (let i = links; i <= rechts; i++) {
  if (belegung[i] < tiefste.wert) tiefste = { wert: belegung[i], x: i * schritt };
}
console.log(`${zeilen.length} Textzeilen, Bildbreite ${width}\n`);
console.log("x     Zeilen mit Text an dieser Stelle");
for (let i = 0; i < belegung.length; i += 3) {
  const marke = i * schritt === tiefste.x ? "   <== tiefster Punkt" : "";
  console.log(`${String(i * schritt).padStart(4)}  ${"█".repeat(belegung[i])}${belegung[i] === 0 ? "·" : ""}${marke}`);
}
console.log(`\nTiefster Punkt zwischen 15 % und 85 % der Breite: x = ${tiefste.x} (${tiefste.wert} Zeilen)`);
await w.terminate();
