// Zeigt je Bildzeile die Woerter links und rechts des Stegs, mit Konfidenz -
// die Grundlage, um zu sehen, wo eine Zellenhaelfte verlorengeht.
import { createWorker } from "tesseract.js";
import sharp from "sharp";
import path from "node:path";
import { MAX_BREITE, SEITENMODUS } from "../bildwerte.js";

const [bild, q, z, grenze] = [process.argv[2], process.argv[3], process.argv[4], Number(process.argv[5] || 795)];
const puffer = await sharp(bild).resize({ width: MAX_BREITE, withoutEnlargement: true }).png().toBuffer();
const lies = async (sprache) => {
  const w = await createWorker([sprache], 1, { langPath: path.resolve("sprachdaten"), gzip: true,
    cachePath: path.resolve(".tesseract-cache"), logger: () => {} });
  await w.setParameters({ tessedit_pageseg_mode: SEITENMODUS });
  const { data } = await w.recognize(puffer, {}, { blocks: true, text: false });
  const zeilen = [];
  for (const b of data.blocks||[]) for (const p of b.paragraphs||[]) for (const l of p.lines||[])
    zeilen.push({ bbox: l.bbox, woerter: (l.words||[]).filter(x=>x.text.trim()) });
  await w.terminate();
  return zeilen;
};
const [ql, zl] = [await lies(q), await lies(z)];
console.log(`Steg bei x=${grenze}\n`);
console.log("y0    LINKS aus dem " + q + "-Durchlauf" .padEnd(46) + "  RECHTS aus dem " + z + "-Durchlauf");
console.log("-".repeat(120));
for (const zeile of ql.filter(z => z.woerter.some(w => /\p{L}/u.test(w.text)))) {
  const links = zeile.woerter.filter(w => w.bbox.x1 <= grenze).map(w=>`${w.text}(${Math.round(w.confidence)})`).join(" ");
  const partner = zl.find(x => Math.min(zeile.bbox.y1,x.bbox.y1) - Math.max(zeile.bbox.y0,x.bbox.y0) > 0.5*Math.min(zeile.bbox.y1-zeile.bbox.y0, x.bbox.y1-x.bbox.y0));
  const rechts = partner ? partner.woerter.filter(w => w.bbox.x0 >= grenze).map(w=>`${w.text}(${Math.round(w.confidence)})`).join(" ") : "— KEIN PARTNER —";
  console.log(`${String(zeile.bbox.y0).padStart(4)}  ${(links||"(leer)").slice(0,46).padEnd(46)}  ${rechts.slice(0,60)}`);
}
