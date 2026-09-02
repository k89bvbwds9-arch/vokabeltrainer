// Wie haengt Trefferquote und Laufzeit an der Bildgroesse?
// Wichtig fuer das iPhone: Speicher ist dort knapp, und ein zu grosses Bild
// laesst Safari die Seite wortlos beenden.
import { createWorker } from "tesseract.js";
import sharp from "sharp";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { zuPaaren } from "../paare.js";
import { SEITENMODUS } from "../bildwerte.js";

const bild = process.argv[2];
const paar = { quelle: process.argv[3] || "ita", ziel: process.argv[4] || "deu" };
const erwartetDatei = bild.replace(/\.[^.]+$/, "") + ".erwartet.txt";
const soll = existsSync(erwartetDatei)
  ? readFileSync(erwartetDatei, "utf8").split("\n").map((z) => z.trim()).filter(Boolean) : [];

const opts = { langPath: path.resolve("sprachdaten"), gzip: true,
  cachePath: path.resolve(".tesseract-cache"), logger: () => {} };
const wQ = await createWorker([paar.quelle], 1, opts);
const wZ = await createWorker([paar.ziel], 1, opts);
await wQ.setParameters({ tessedit_pageseg_mode: SEITENMODUS });
await wZ.setParameters({ tessedit_pageseg_mode: SEITENMODUS });

const hole = async (w, puffer) => {
  const { data } = await w.recognize(puffer, {}, { blocks: true, text: false });
  const r = [];
  for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || [])
    r.push({ text: l.text, conf: l.confidence, bbox: l.bbox,
      woerter: (l.words || []).filter((x) => x.text.trim())
        .map((x) => ({ text: x.text, conf: x.confidence, bbox: x.bbox })) });
  return r;
};

console.log("Breite  Megapixel  Zeit    Paare  Treffer   Verfahren");
console.log("-".repeat(60));
for (const breite of [2400, 2000, 1600, 1300, 1100, 900, 750, 600]) {
  const puffer = await sharp(bild).resize({ width: breite, withoutEnlargement: true }).png().toBuffer();
  const m = await sharp(puffer).metadata();
  const t0 = Date.now();
  const erg = zuPaaren({ quelle: await hole(wQ, puffer), ziel: await hole(wZ, puffer) }, paar, m.width);
  const ms = Date.now() - t0;
  const ist = erg.paare.map((p) => `${p.quelle}|${p.ziel}`);
  const treffer = soll.filter((s) => ist.includes(s)).length;
  console.log(`${String(m.width).padStart(5)}  ${((m.width * m.height) / 1e6).toFixed(1).padStart(8)}  ` +
    `${String(ms).padStart(5)}ms  ${String(erg.paare.length).padStart(5)}  ` +
    `${String(treffer).padStart(3)}/${soll.length}  ${String(Math.round(treffer / (soll.length || 1) * 100)).padStart(4)}%  ${erg.verfahren}`);
}
await wQ.terminate(); await wZ.terminate();
