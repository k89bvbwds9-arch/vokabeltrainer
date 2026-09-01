// Misst, ob getrennte Durchlaeufe je Sprache die Homoglyphen-Verwechslung
// beheben - und ob die Konfidenzwerte taugen, um je Zeile die richtige
// Sprache zu waehlen.
import { createWorker } from "tesseract.js";
import path from "node:path";

const bild = process.argv[2];
async function lauf(sprachen) {
  const w = await createWorker(sprachen, 1, {
    langPath: path.resolve("sprachdaten"), gzip: true,
    cachePath: path.resolve(".tesseract-cache"), logger: () => {} });
  await w.setParameters({ tessedit_pageseg_mode: "4" });
  const t0 = Date.now();
  const { data } = await w.recognize(bild, {}, { blocks: true, text: false });
  const ms = Date.now() - t0;
  const zeilen = [];
  for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || [])
    zeilen.push({ text: l.text.trim(), conf: Math.round(l.confidence), y0: l.bbox.y0 });
  await w.terminate();
  return { zeilen, ms };
}

const q = await lauf(["rus"]);
const z = await lauf(["deu"]);
console.log(`rus-Durchlauf ${q.ms} ms · deu-Durchlauf ${z.ms} ms\n`);
console.log("y0     rus-Durchlauf                  conf   deu-Durchlauf                  conf");
console.log("-".repeat(84));
const n = Math.max(q.zeilen.length, z.zeilen.length);
for (let i = 0; i < n; i++) {
  const a = q.zeilen[i] || { text: "", conf: 0, y0: 0 };
  const b = z.zeilen[i] || { text: "", conf: 0 };
  console.log(`${String(a.y0).padStart(4)}   ${a.text.padEnd(30)} ${String(a.conf).padStart(3)}    ${b.text.padEnd(30)} ${String(b.conf).padStart(3)}`);
}
