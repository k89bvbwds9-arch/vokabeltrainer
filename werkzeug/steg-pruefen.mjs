// Zeigt, wie knapp die Spaltenerkennung an ihren Schwellen liegt - fuer
// beliebige Bilder. Ohne diese Zahlen laesst sich nicht entscheiden, ob eine
// Schwelle zu streng ist oder ob die Vorlage wirklich einspaltig ist.
import { createWorker } from "tesseract.js";
import sharp from "sharp";
import path from "node:path";
import { MAX_BREITE, SEITENMODUS } from "../bildwerte.js";

const bild = process.argv[2], sprache = process.argv[3] || "ita";
const puffer = await sharp(bild).resize({ width: MAX_BREITE, withoutEnlargement: true }).png().toBuffer();
const { width } = await sharp(puffer).metadata();
const w = await createWorker([sprache], 1, { langPath: path.resolve("sprachdaten"), gzip: true,
  cachePath: path.resolve(".tesseract-cache"), logger: () => {} });
await w.setParameters({ tessedit_pageseg_mode: SEITENMODUS });
const { data } = await w.recognize(puffer, {}, { blocks: true, text: false });
const zeilen = [];
for (const b of data.blocks||[]) for (const p of b.paragraphs||[]) for (const l of p.lines||[]) {
  const woerter = (l.words||[]).filter(x=>x.text.trim()).map(x=>({ text:x.text, conf:x.confidence, bbox:x.bbox }));
  if (woerter.length) zeilen.push({ bbox: l.bbox, woerter });
}
await w.terminate();

// Reihen bilden wie in paare.js
const sortiert = [...zeilen].sort((a,b)=>a.bbox.y0-b.bbox.y0);
const reihen = [];
for (const z of sortiert) {
  const letzte = reihen[reihen.length-1];
  const ueber = letzte ? Math.min(letzte.y1,z.bbox.y1)-Math.max(letzte.y0,z.bbox.y0) : -1;
  const hoehe = letzte ? Math.min(letzte.y1-letzte.y0, z.bbox.y1-z.bbox.y0) : 1;
  if (letzte && hoehe>0 && ueber/hoehe>0.5) {
    letzte.y0=Math.min(letzte.y0,z.bbox.y0); letzte.y1=Math.max(letzte.y1,z.bbox.y1);
    letzte.woerter.push(...z.woerter);
  } else reihen.push({ y0:z.bbox.y0, y1:z.bbox.y1, woerter:[...z.woerter] });
}

// Profil der neuen Suche: wie gut trennt jede Stelle?
const bewerte = (x) => {
  let beidseitig = 0, drueber = 0;
  for (const r of reihen) {
    let li = false, re = false, quer = false;
    for (const w of r.woerter) {
      if (w.bbox.x1 <= x) li = true; else if (w.bbox.x0 >= x) re = true; else quer = true;
    }
    if (li && re) beidseitig++;
    if (quer) drueber++;
  }
  return { beidseitig, drueber };
};
const schritt = 10, felder = Math.ceil(width / schritt);
const von = Math.floor(felder * 0.2) * schritt, bis = Math.floor(felder * 0.8) * schritt;
const werte = [];
for (let x = von; x <= bis; x += schritt) werte.push({ x, ...bewerte(x) });
const max = Math.max(...werte.map((w) => w.beidseitig));
const besten = werte.filter((w) => w.beidseitig === max);
const minDrueber = Math.min(...besten.map((w) => w.drueber));

console.log(`\n${bild}  [${sprache}]   ${reihen.length} Reihen, Bildbreite ${width}\n`);
console.log("   x   beidseitig  drueber");
for (const w of werte) {
  if (w.x % 50) continue;
  const marke = w.beidseitig === max ? (w.drueber === minDrueber ? "  <== beste" : "  <== max, aber quer") : "";
  console.log(`${String(w.x).padStart(4)}  ${String(w.beidseitig).padStart(6)}  ${String(w.drueber).padStart(8)}${marke}`);
}
console.log(`\nHoechstes beidseitig: ${max} von ${reihen.length} = ${(max/reihen.length*100).toFixed(0)} %`);
console.log(`Stellen mit diesem Wert: ${besten.length}, x von ${besten[0].x} bis ${besten[besten.length-1].x}`);
console.log(`davon geringstes drueber: ${minDrueber} = ${(minDrueber/reihen.length*100).toFixed(0)} %  (erlaubt bis 12 %)`);
