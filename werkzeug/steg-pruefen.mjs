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

const schritt=10, felder=Math.ceil(width/schritt), belegung=new Array(felder).fill(0);
for (const r of reihen) { const d=new Set();
  for (const wo of r.woerter) for (let x=Math.floor(wo.bbox.x0/schritt); x<=Math.floor(wo.bbox.x1/schritt); x++) if(x>=0&&x<felder) d.add(x);
  for (const x of d) belegung[x]++; }
const von=Math.floor(felder*0.2), bis=Math.floor(felder*0.8);
let wenigste=Infinity; for(let i=von;i<=bis;i++) wenigste=Math.min(wenigste,belegung[i]);
let anfang=-1, bester={laenge:0,x:-1};
for(let i=von;i<=bis+1;i++){ const drin=i<=bis&&belegung[i]===wenigste;
  if(drin&&anfang<0) anfang=i;
  if(!drin&&anfang>=0){ const l=i-anfang; if(l>bester.laenge) bester={laenge:l,x:((anfang+i)/2)*schritt}; anfang=-1; } }
const grenze=bester.x;
const beidseitig = reihen.filter(r =>
  r.woerter.some(w=>w.bbox.x1<=grenze) && r.woerter.some(w=>w.bbox.x0>=grenze)).length;

console.log(`\n${bild}  [${sprache}]`);
console.log(`  Zeilen mit Woertern : ${zeilen.length}`);
console.log(`  daraus Reihen       : ${reihen.length}`);
console.log(`  Steg-Kandidat bei x : ${grenze}  (Breite ${bester.laenge*schritt} px)`);
console.log(`  Belegung am Steg    : ${wenigste} von ${reihen.length} Reihen ` +
  `= ${(wenigste/reihen.length*100).toFixed(0)} %   (erlaubt bis 12 %)`);
console.log(`  beidseitig belegt   : ${beidseitig} von ${reihen.length} Reihen ` +
  `= ${(beidseitig/reihen.length*100).toFixed(0)} %   (verlangt ab 60 %)`);
