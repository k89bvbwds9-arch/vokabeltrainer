// Weist nach, ob eine kontrastarme Spalte im Gesamtbild untergeht - und ob
// ein eigener Ausschnitt sie rettet.
import { createWorker } from "tesseract.js";
import sharp from "sharp";
import path from "node:path";
import { MAX_BREITE, SEITENMODUS } from "../bildwerte.js";

const STEG = 800;
const grund = await sharp("testbilder/italienisch-buch.png")
  .resize({ width: MAX_BREITE, withoutEnlargement: true }).png().toBuffer();
const { width, height } = await sharp(grund).metadata();

// Geraetenaehe nachstellen: die linke Spalte im Kontrast zusammendruecken
const linkeHaelfte = await sharp(grund).extract({ left: 0, top: 0, width: STEG, height })
  .linear(0.45, 128 * 0.55).png().toBuffer();
const rechteHaelfte = await sharp(grund).extract({ left: STEG, top: 0, width: width - STEG, height }).png().toBuffer();
const flau = await sharp({ create: { width, height, channels: 3, background: "#fff" } })
  .composite([{ input: linkeHaelfte, left: 0, top: 0 }, { input: rechteHaelfte, left: STEG, top: 0 }])
  .png().toBuffer();

const opts = { langPath: path.resolve("sprachdaten"), gzip: true,
  cachePath: path.resolve(".tesseract-cache"), logger: () => {} };
const w = await createWorker(["ita"], 1, opts);
await w.setParameters({ tessedit_pageseg_mode: SEITENMODUS });

async function zaehle(puffer, versatz = 0) {
  const { data } = await w.recognize(puffer, {}, { blocks: true, text: false });
  const worte = [];
  for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || [])
    for (const x of l.words || []) if (x.text.trim()) worte.push({ ...x, x0: x.bbox.x0 + versatz });
  return worte;
}

console.log("                                    Wörter links   Wörter rechts");
console.log("-".repeat(66));
for (const [name, puffer] of [["Original, ganzes Bild", grund], ["Kontrastarm links, ganzes Bild", flau]]) {
  const worte = await zaehle(puffer);
  console.log(`${name.padEnd(34)} ${String(worte.filter((x) => x.x0 < STEG).length).padStart(8)} ` +
    `${String(worte.filter((x) => x.x0 >= STEG).length).padStart(15)}`);
}

// Nun derselbe kontrastarme Fall, aber die linke Spalte als eigener Ausschnitt
const nurLinks = await sharp(flau).extract({ left: 0, top: 0, width: STEG, height }).png().toBuffer();
const worteAusschnitt = await zaehle(nurLinks);
console.log(`${"Kontrastarm links, eigener Ausschnitt".padEnd(34)} ${String(worteAusschnitt.length).padStart(8)}`);
console.log(`\nErste Wörter aus dem Ausschnitt: ${worteAusschnitt.slice(0, 10).map((x) => x.text.trim()).join(" | ")}`);
await w.terminate();
