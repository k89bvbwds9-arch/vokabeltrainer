// Texterkennung im iPhone. Kapselt Tesseract und gibt fertige Zeilen an
// paare.js weiter - dasselbe Format, das der Erkennungstest auf dem Mac
// benutzt.
//
// Zwei Durchlaeufe je Bild, einer pro Sprache. Die Begruendung steht
// ausfuehrlich in paare.js; kurz: Mit beiden Sprachen gleichzeitig liest
// Tesseract "куда" als "Kyna", weil die Buchstaben gleich aussehen.

// Der ESM-Build von Tesseract hat NUR einen Standard-Export, keine benannten.
// "import { createWorker }" scheitert deshalb erst zur Laufzeit, mit einer
// Meldung, die das Modul nennt statt die Ursache.
import Tesseract from "./vendor/tesseract/tesseract.esm.min.js";
import { MAX_BREITE, DUNKEL_AB } from "./bildwerte.js";

const PFADE = {
  worker: "./vendor/tesseract/worker.min.js",
  core: "./vendor/tesseract/",
  sprachen: "./sprachdaten/",
};

// Modus 4 = eine Spalte mit wechselnden Schriftgroessen. Gemessen an einem
// Testbild: Modus 4 und 3 beide fehlerfrei, Modus 6 deutlich schlechter.
const SEITENMODUS = "4";

// Ein Arbeiter je Sprache, ueber die Sitzung hinweg wiederverwendet. Das
// Anlegen kostet mehrere Sekunden - beim zweiten Foto waere das unnoetig.
const arbeiter = new Map();

async function holeArbeiter(sprache, melde) {
  if (arbeiter.has(sprache)) return arbeiter.get(sprache);

  melde?.(`Sprachdaten für ${sprache} werden geladen …`);
  const w = await Tesseract.createWorker(sprache, 1, {
    workerPath: PFADE.worker,
    corePath: PFADE.core,
    langPath: PFADE.sprachen,
    gzip: true,
  });
  await w.setParameters({ tessedit_pageseg_mode: SEITENMODUS });
  arbeiter.set(sprache, w);
  return w;
}

/** Beim Verlassen des Hinzufuegen-Bildschirms aufraeumen. */
export async function beende() {
  for (const w of arbeiter.values()) { try { await w.terminate(); } catch { /* egal */ } }
  arbeiter.clear();
}

// --- Vorverarbeitung ------------------------------------------------------
/**
 * Verkleinert grosse Bilder - und laesst sonst ALLES in Ruhe.
 *
 * Dass hier so wenig passiert, ist die am teuersten erkaufte Entscheidung
 * dieser Datei. Der Weg dahin, jeder Schritt gemessen:
 *
 *   1. Kontrastspreizung und automatische Normalisierung eingebaut, um blasse
 *      Vorlagen zu retten. Gemessen: 91 % und 43 % statt 94 %. Beide wieder
 *      ausgebaut (Zahlen in bildwerte.js).
 *   2. Graustufen behalten, weil sie in dieser Messung nichts kosteten. Im
 *      Browser dann direkt verglichen, DIESELBE Datei:
 *
 *        Originalbild in Farbe  ->  "в магазине", "на работе", "в метро"
 *        mein Graustufenbild    ->  dieselben Zeilen PLUS ". 4)" und "р 4)"
 *
 *      Die grauen Lautsprechersymbole neben jeder Vokabel gewinnen durch die
 *      Umwandlung so viel Kontrast, dass Tesseract sie fuer Text haelt. Diese
 *      Scheinzeilen schieben sich zwischen Vokabel und Uebersetzung und
 *      stehlen ihr die Zuordnung. Die Graustufen waren also die URSACHE des
 *      Problems, gegen das paare.js filtern musste.
 *
 * Tesseract binarisiert Farbbilder mit einem eigenen Schwellwert je
 * Bildbereich. Das ist besser als alles, was hier von Hand nachgebaut wuerde.
 *
 * Ein Dunkelmodus-Screenshot wird umgedreht - dunkle Schrift auf hellem Grund
 * ist das, worauf Tesseract trainiert ist.
 */
export async function vorverarbeite(datei) {
  const bild = await ladeBild(datei);
  const dunkelmodus = mittlereHelligkeit(bild) < DUNKEL_AB;

  // Der haeufigste Fall - ein Screenshot in Leserichtung, hell, unter 1600 px
  // breit - geht UNVERAENDERT durch. Auch das ist gemessen: Dieselben vier
  // Testbilder ergaben
  //
  //   Originaldatei direkt an Tesseract   33/35 = 94 %
  //   ueber ein Canvas gereicht           18/35 = 51 %
  //
  // obwohl das Canvas in gleicher Groesse und ohne jede Umrechnung gezeichnet
  // wurde. Die Ursache liegt im Farbraum: iPhone-Screenshots sind Display P3,
  // ein Canvas rechnet sie beim Zeichnen nach sRGB um. Die grauen
  // Lautsprechersymbole verschieben sich dabei genug, dass Tesseract sie fuer
  // Text haelt - und diese Scheinzeilen stehlen den Vokabeln ihre Zuordnung.
  //
  // Die Lehre gilt allgemein: Jede Bildbearbeitung muss sich rechtfertigen.
  // Keine ist der Normalfall.
  if (!dunkelmodus && bild.width <= MAX_BREITE) {
    return { eingabe: datei, dunkelmodus, unveraendert: true };
  }

  const faktor = Math.min(1, MAX_BREITE / bild.width);
  const breite = Math.round(bild.width * faktor);
  const hoehe = Math.round(bild.height * faktor);

  const flaeche = document.createElement("canvas");
  flaeche.width = breite;
  flaeche.height = hoehe;
  const stift = flaeche.getContext("2d", { willReadFrequently: true });
  stift.drawImage(bild, 0, 0, breite, hoehe);

  if (dunkelmodus) {
    const daten = stift.getImageData(0, 0, breite, hoehe);
    const p = daten.data;
    for (let i = 0; i < p.length; i += 4) {
      p[i] = 255 - p[i]; p[i + 1] = 255 - p[i + 1]; p[i + 2] = 255 - p[i + 2];
    }
    stift.putImageData(daten, 0, 0);
  }

  return { eingabe: flaeche, dunkelmodus, unveraendert: false };
}

/**
 * Mittlere Helligkeit ueber eine kleine Miniatur.
 *
 * Bewusst 64 Pixel breit: Es geht nur um die Frage hell oder dunkel, und das
 * Vollbild auszulesen kostet auf einem iPhone bei einem 12-Megapixel-Foto
 * spuerbar Zeit und Speicher.
 */
function mittlereHelligkeit(bild) {
  const breite = 64;
  const hoehe = Math.max(1, Math.round((bild.height / bild.width) * breite));
  const mini = document.createElement("canvas");
  mini.width = breite;
  mini.height = hoehe;
  const stift = mini.getContext("2d", { willReadFrequently: true });
  stift.drawImage(bild, 0, 0, breite, hoehe);
  const p = stift.getImageData(0, 0, breite, hoehe).data;
  let summe = 0;
  for (let i = 0; i < p.length; i += 4) {
    summe += p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114;
  }
  return summe / (p.length / 4);
}

function ladeBild(datei) {
  return new Promise((fertig, fehler) => {
    const url = URL.createObjectURL(datei);
    const bild = new Image();
    bild.onload = () => { URL.revokeObjectURL(url); fertig(bild); };
    bild.onerror = () => { URL.revokeObjectURL(url); fehler(new Error("Bild nicht lesbar")); };
    bild.src = url;
  });
}

// --- Erkennen -------------------------------------------------------------
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

const schlank = (zeilen) => zeilen.map((z) => ({ text: z.text, conf: z.confidence, bbox: z.bbox }));

/**
 * @param datei  die vom Nutzer gewaehlte Bilddatei
 * @param paar   { quelle: "rus", ziel: "deu" }
 * @param melde  Rueckruf fuer den Fortschrittstext
 * @returns { quelle: [...], ziel: [...] } fuer zuPaaren()
 */
export async function erkenne(datei, paar, melde) {
  melde?.("Bild wird vorbereitet …");
  const { eingabe, dunkelmodus } = await vorverarbeite(datei);

  const [arbeiterQ, arbeiterZ] = [
    await holeArbeiter(paar.quelle, melde),
    await holeArbeiter(paar.ziel, melde),
  ];

  // Nacheinander, nicht parallel. Zwei Tesseract-Arbeiter gleichzeitig
  // belegen auf einem iPhone rund 500 MB - Safari beendet die Seite dann
  // wortlos, und der Nutzer sieht nur einen Neustart ohne Erklaerung.
  melde?.(`Text wird gelesen (1 von 2) …`);
  const ergQ = await arbeiterQ.recognize(eingabe, {}, { blocks: true, text: false });
  melde?.(`Text wird gelesen (2 von 2) …`);
  const ergZ = await arbeiterZ.recognize(eingabe, {}, { blocks: true, text: false });

  return {
    quelle: schlank(zeilenAus(ergQ.data)),
    ziel: schlank(zeilenAus(ergZ.data)),
    dunkelmodus,
  };
}
