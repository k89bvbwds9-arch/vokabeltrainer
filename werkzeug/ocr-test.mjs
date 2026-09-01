// Erkennungstest: laeuft auf dem Mac, benutzt dieselbe Tesseract-Fassung und
// dieselbe Zuordnungslogik wie spaeter die App im iPhone.
//
//   node werkzeug/ocr-test.mjs testbilder/*.png
//   node werkzeug/ocr-test.mjs --paar ita:deu testbilder/italienisch.png
//
// Liegt neben einem Bild eine Datei <bildname>.erwartet.txt mit je einer Zeile
// "quelle|ziel", wird gemessen. Ohne sie zeigt das Werkzeug nur, was es
// erkannt hat - dann muss ein Mensch urteilen.
import { createWorker } from "tesseract.js";
import sharp from "sharp";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zuPaaren } from "../paare.js";
import { MAX_BREITE, DUNKEL_AB } from "../bildwerte.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, "..");
const HUERDE = 90;   // Prozent, laut Plan

// 4 = eine Spalte mit wechselnden Schriftgroessen (Kartenliste)
// 6 = ein einheitlicher Textblock
// 3 = vollautomatisch
const MODI = ["4"];
const MODUS_NAME = { 4: "Spalte", 6: "Block", 3: "automatisch" };

// --- Aufrufparameter ---
const argumente = process.argv.slice(2);
let paar = { quelle: "rus", ziel: "deu" };
const bilder = [];
for (let i = 0; i < argumente.length; i++) {
  if (argumente[i] === "--paar") {
    const [q, z] = argumente[++i].split(":");
    paar = { quelle: q, ziel: z };
  } else bilder.push(argumente[i]);
}

if (!bilder.length) {
  console.error("Kein Bild angegeben.  node werkzeug/ocr-test.mjs testbilder/*.png");
  process.exit(1);
}

/**
 * Dieselbe Vorverarbeitung wie in der App, hier mit sharp statt Canvas.
 * Die Zahlen kommen aus bildwerte.js, damit Test und Betrieb nicht
 * auseinanderlaufen.
 */
/**
 * Dieselbe Entscheidung wie in der App: Wenn nichts zu tun ist, geht das Bild
 * UNVERAENDERT an Tesseract. Jede Umkodierung veraendert das Ergebnis - die
 * Begruendung mit Zahlen steht in erkennung.js.
 */
async function vorverarbeite(bildPfad) {
  const bild = sharp(bildPfad);
  const { width } = await bild.metadata();
  const { channels } = await bild.clone().greyscale().stats();
  const dunkelmodus = channels[0].mean < DUNKEL_AB;

  if (!dunkelmodus && width <= MAX_BREITE) {
    return { puffer: readFileSync(bildPfad), dunkelmodus, unveraendert: true };
  }
  const bearbeitet = bild.resize({ width: MAX_BREITE, withoutEnlargement: true });
  return {
    puffer: await (dunkelmodus ? bearbeitet.negate() : bearbeitet).png().toBuffer(),
    dunkelmodus, unveraendert: false,
  };
}

/** Zeilen aus dem Tesseract-Ergebnis holen - v4 und v5 legen sie anders ab. */
function zeilenAus(daten) {
  if (Array.isArray(daten.lines) && daten.lines.length) return daten.lines;
  const raus = [];
  for (const block of daten.blocks || []) {
    for (const absatz of block.paragraphs || []) {
      for (const zeile of absatz.lines || []) raus.push(zeile);
    }
  }
  return raus;
}

async function baueArbeiter(sprache) {
  return createWorker([sprache], 1, {
    langPath: path.join(WURZEL, "sprachdaten"),
    gzip: true,
    cachePath: path.join(WURZEL, ".tesseract-cache"),
    logger: () => {},
  });
}

function ladeErwartung(bildPfad) {
  const kandidat = bildPfad.replace(/\.[^.]+$/, "") + ".erwartet.txt";
  if (!existsSync(kandidat)) return null;
  return readFileSync(kandidat, "utf8")
    .split("\n").map((z) => z.trim()).filter(Boolean)
    .map((z) => { const [q, zi] = z.split("|"); return { quelle: q.trim(), ziel: (zi || "").trim() }; });
}

function vergleiche(erkannt, erwartet) {
  let treffer = 0;
  const fehler = [];
  for (const soll of erwartet) {
    if (erkannt.some((p) => p.quelle === soll.quelle && p.ziel === soll.ziel)) { treffer++; continue; }
    const fast = erkannt.find((p) => p.quelle === soll.quelle || p.ziel === soll.ziel);
    fehler.push(`${soll.quelle} | ${soll.ziel}` +
      (fast ? `   →  erkannt als:  ${fast.quelle} | ${fast.ziel}` : "   →  gar nicht gefunden"));
  }
  const ueberzaehlig = erkannt.filter((p) =>
    !erwartet.some((s) => s.quelle === p.quelle || s.ziel === p.ziel));
  return { treffer, gesamt: erwartet.length, fehler, ueberzaehlig };
}

async function main() {
  const arbeiterQ = await baueArbeiter(paar.quelle);
  const arbeiterZ = await baueArbeiter(paar.ziel);
  let summeTreffer = 0, summeGesamt = 0;

  for (const bild of bilder) {
    console.log("\n" + "=".repeat(72));
    console.log(`${bild}   [${paar.quelle} → ${paar.ziel}]`);
    console.log("=".repeat(72));
    const erwartet = ladeErwartung(bild);
    if (!erwartet) console.log("(keine .erwartet.txt daneben — nur Anzeige, keine Messung)");
    const { puffer, dunkelmodus } = await vorverarbeite(bild);
    if (dunkelmodus) console.log("(als Dunkelmodus erkannt und umgedreht)");

    for (const psm of MODI) {
      await arbeiterQ.setParameters({ tessedit_pageseg_mode: psm });
      await arbeiterZ.setParameters({ tessedit_pageseg_mode: psm });

      const t0 = Date.now();
      const [ergQ, ergZ] = await Promise.all([
        arbeiterQ.recognize(puffer, {}, { blocks: true, text: false }),
        arbeiterZ.recognize(puffer, {}, { blocks: true, text: false }),
      ]);
      const dauer = Date.now() - t0;

      const hole = (e) => zeilenAus(e.data).map((z) => ({ text: z.text, conf: z.confidence, bbox: z.bbox }));
      const { paare, unklar, verfahren } = zuPaaren({ quelle: hole(ergQ), ziel: hole(ergZ) }, paar);

      console.log(`\n--- Modus ${psm} (${MODUS_NAME[psm]}) · ${dauer} ms · Verfahren "${verfahren}" ---`);
      for (const p of paare) console.log(`   ${p.sicher ? " " : "?"} ${p.quelle}  |  ${p.ziel}`);
      for (const u of unklar) console.log(`   ! ${u.quelle}   (${u.grund})`);

      if (erwartet) {
        const { treffer, gesamt, fehler, ueberzaehlig } = vergleiche(paare, erwartet);
        const quote = Math.round((treffer / gesamt) * 100);
        console.log(`   => ${treffer}/${gesamt} zeichengenau (${quote} %)`);
        for (const f of fehler) console.log(`      FEHLT:      ${f}`);
        for (const u of ueberzaehlig) console.log(`      ZUVIEL:     ${u.quelle} | ${u.ziel}`);
        if (psm === "4") { summeTreffer += treffer; summeGesamt += gesamt; }
      }
    }
  }

  await arbeiterQ.terminate();
  await arbeiterZ.terminate();

  if (summeGesamt) {
    const quote = Math.round((summeTreffer / summeGesamt) * 100);
    console.log("\n" + "=".repeat(72));
    console.log(`GESAMT (Modus 4): ${summeTreffer}/${summeGesamt} = ${quote} %   ` +
      `Hürde laut Plan: ${HUERDE} %   =>  ${quote >= HUERDE ? "BESTANDEN" : "DURCHGEFALLEN"}`);
    console.log("=".repeat(72));
    process.exit(quote >= HUERDE ? 0 : 1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
