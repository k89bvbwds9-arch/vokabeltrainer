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
import { zuPaaren, spaltenAufteilung } from "../paare.js";
import { MAX_BREITE, DUNKEL_AB, SEITENMODUS, SEITENMODUS_ERSATZ, MIN_ZEILEN } from "../bildwerte.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, "..");
const HUERDE = 90;   // Prozent, laut Plan

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

/**
 * Liest ein Bild - mit derselben Ausweichlogik wie die App: Findet der erste
 * Seitenmodus auffaellig wenige Zeilen, bekommt der zweite eine Chance.
 * Steht bewusst hier UND in erkennung.js; die Alternative waere ein gemeinsames
 * Modul, das in Node und Browser verschiedene Tesseract-Bauarten kapseln
 * muesste. Die Zahlen kommen aus bildwerte.js, damit nichts auseinanderlaeuft.
 */
const alsZeilen = (daten) => zeilenAus(daten).map((z) => ({
  text: z.text, conf: z.confidence, bbox: z.bbox,
  woerter: (z.words || []).filter((w) => w.text && w.text.trim())
    .map((w) => ({ text: w.text, conf: w.confidence, bbox: w.bbox })),
}));

/** Kaestchen eines Ausschnitts zurueck aufs ganze Bild rechnen. */
function verschiebe(zeile, versatz) {
  const um = (b) => ({ ...b, x0: b.x0 + versatz, x1: b.x1 + versatz });
  return { ...zeile, bbox: um(zeile.bbox),
    woerter: (zeile.woerter || []).map((w) => ({ ...w, bbox: um(w.bbox) })) };
}

async function liesMitAusweich(arbeiterQ, arbeiterZ, puffer, bildBreite, hoehe) {
  const lies = async (a, modus, eingabe = puffer) => {
    await a.setParameters({ tessedit_pageseg_mode: modus });
    const e = await a.recognize(eingabe, {}, { blocks: true, text: false });
    return alsZeilen(e.data);
  };
  let quelle = await lies(arbeiterQ, SEITENMODUS);

  // Zwei Spalten? Dann jede einzeln lesen - genau wie die App. Die Begruendung
  // mit Messwerten steht in spalten.js und erkennung.js.
  const aufteilung = spaltenAufteilung(quelle, bildBreite);
  if (aufteilung?.ok) {
    const grenze = Math.round(aufteilung.grenze);
    const links = await sharp(puffer).extract({ left: 0, top: 0, width: grenze, height: hoehe }).png().toBuffer();
    const rechts = await sharp(puffer)
      .extract({ left: grenze, top: 0, width: bildBreite - grenze, height: hoehe }).png().toBuffer();
    const quelleLinks = await lies(arbeiterQ, SEITENMODUS, links);
    const zielRechts = await lies(arbeiterZ, SEITENMODUS, rechts);
    return {
      quelle: quelleLinks,
      ziel: zielRechts.map((z) => verschiebe(z, grenze)),
      grenze, modus: SEITENMODUS, spaltenEinzeln: true,
    };
  }

  let ziel = await lies(arbeiterZ, SEITENMODUS);
  let modus = SEITENMODUS;

  if (Math.min(quelle.length, ziel.length) < MIN_ZEILEN) {
    const q2 = await lies(arbeiterQ, SEITENMODUS_ERSATZ);
    const z2 = await lies(arbeiterZ, SEITENMODUS_ERSATZ);
    if (Math.min(q2.length, z2.length) > Math.min(quelle.length, ziel.length)) {
      quelle = q2; ziel = z2; modus = SEITENMODUS_ERSATZ;
    }
  }
  return { quelle, ziel, modus };
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
    const t0 = Date.now();
    const { width: bildBreite, height: bildHoehe } = await sharp(puffer).metadata();
    const { quelle, ziel, modus, grenze: vorgabe, spaltenEinzeln } =
      await liesMitAusweich(arbeiterQ, arbeiterZ, puffer, bildBreite, bildHoehe);
    const dauer = Date.now() - t0;
    const { paare, unklar, verfahren } =
      zuPaaren({ quelle, ziel, grenze: vorgabe }, paar, bildBreite);

    console.log(`\n--- Modus ${modus} (${MODUS_NAME[modus]}) · ${dauer} ms · Verfahren "${verfahren}"` +
      `${spaltenEinzeln ? " · Spalten einzeln gelesen" : ""} ---`);
    for (const p of paare) console.log(`   ${p.sicher ? " " : "?"} ${p.quelle}  |  ${p.ziel}`);
    for (const u of unklar) console.log(`   ! ${u.quelle}   (${u.grund})`);

    if (erwartet) {
      const { treffer, gesamt, fehler, ueberzaehlig } = vergleiche(paare, erwartet);
      const quote = Math.round((treffer / gesamt) * 100);
      console.log(`   => ${treffer}/${gesamt} zeichengenau (${quote} %)`);
      for (const f of fehler) console.log(`      FEHLT:      ${f}`);
      for (const u of ueberzaehlig) console.log(`      ZUVIEL:     ${u.quelle} | ${u.ziel}`);
      summeTreffer += treffer; summeGesamt += gesamt;
    }
  }

  await arbeiterQ.terminate();
  await arbeiterZ.terminate();

  if (summeGesamt) {
    const quote = Math.round((summeTreffer / summeGesamt) * 100);
    console.log("\n" + "=".repeat(72));
    console.log(`GESAMT: ${summeTreffer}/${summeGesamt} = ${quote} %   ` +
      `Hürde laut Plan: ${HUERDE} %   =>  ${quote >= HUERDE ? "BESTANDEN" : "DURCHGEFALLEN"}`);
    console.log("=".repeat(72));
    process.exit(quote >= HUERDE ? 0 : 1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
