// Misst verschiedene Vorverarbeitungen gegeneinander an den echten Bildern.
// Zweck: die Wahl belegen statt sie zu behaupten.
import { createWorker } from "tesseract.js";
import sharp from "sharp";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { zuPaaren } from "../paare.js";
import { MAX_BREITE, DUNKEL_AB, spreizung } from "../bildwerte.js";

const BILDER = process.argv.slice(2);
const { a, b } = spreizung();

const VARIANTEN = {
  "roh, unveraendert":            async (p) => sharp(p).png().toBuffer(),
  "nur verkleinert":              async (p) => sharp(p).resize({ width: MAX_BREITE, withoutEnlargement: true }).png().toBuffer(),
  "verkleinert + Graustufen":     async (p) => sharp(p).resize({ width: MAX_BREITE, withoutEnlargement: true }).greyscale().png().toBuffer(),
  "+ Kontrast gespreizt":         async (p) => sharp(p).resize({ width: MAX_BREITE, withoutEnlargement: true }).greyscale().linear(a, b).png().toBuffer(),
  "+ automatisch normalisiert":   async (p) => sharp(p).resize({ width: MAX_BREITE, withoutEnlargement: true }).greyscale().normalise().png().toBuffer(),
};

function zeilenAus(d) {
  if (Array.isArray(d.lines) && d.lines.length) return d.lines;
  const r = [];
  for (const bl of d.blocks || []) for (const p of bl.paragraphs || []) for (const l of p.lines || []) r.push(l);
  return r;
}
const schlank = (z) => z.map((l) => ({ text: l.text, conf: l.confidence, bbox: l.bbox }));

function erwartung(p) {
  const k = p.replace(/\.[^.]+$/, "") + ".erwartet.txt";
  if (!existsSync(k)) return null;
  return readFileSync(k, "utf8").split("\n").map((z) => z.trim()).filter(Boolean)
    .map((z) => { const [q, zi] = z.split("|"); return { quelle: q.trim(), ziel: (zi || "").trim() }; });
}

const opts = { langPath: path.resolve("sprachdaten"), gzip: true, cachePath: path.resolve(".tesseract-cache"), logger: () => {} };
const wQ = await createWorker(["rus"], 1, opts);
const wZ = await createWorker(["deu"], 1, opts);
await wQ.setParameters({ tessedit_pageseg_mode: "4" });
await wZ.setParameters({ tessedit_pageseg_mode: "4" });

console.log("\nVariante                        Treffer   Zeit je Bild");
console.log("-".repeat(58));
for (const [name, bauen] of Object.entries(VARIANTEN)) {
  let treffer = 0, gesamt = 0, ms = 0;
  const verfehlt = [];
  for (const bild of BILDER) {
    const soll = erwartung(bild);
    if (!soll) continue;
    const puffer = await bauen(bild);
    const t0 = Date.now();
    const [eQ, eZ] = await Promise.all([
      wQ.recognize(puffer, {}, { blocks: true, text: false }),
      wZ.recognize(puffer, {}, { blocks: true, text: false })]);
    ms += Date.now() - t0;
    const { paare } = zuPaaren(
      { quelle: schlank(zeilenAus(eQ.data)), ziel: schlank(zeilenAus(eZ.data)) },
      { quelle: "rus", ziel: "deu" });
    for (const s of soll) {
      gesamt++;
      if (paare.some((p) => p.quelle === s.quelle && p.ziel === s.ziel)) treffer++;
      else verfehlt.push(`${path.basename(bild)}: ${s.quelle} | ${s.ziel}`);
    }
  }
  const quote = Math.round((treffer / gesamt) * 100);
  console.log(`${name.padEnd(30)} ${String(treffer).padStart(3)}/${gesamt}  ${String(quote).padStart(3)} %   ${Math.round(ms / BILDER.length)} ms`);
  for (const v of verfehlt) console.log(`     verfehlt: ${v}`);
}
await wQ.terminate(); await wZ.terminate();
