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
import { MAX_BREITE, DUNKEL_AB, SEITENMODUS, SEITENMODUS_ERSATZ, MIN_ZEILEN } from "./bildwerte.js";
import { spaltenAufteilung } from "./paare.js";

const PFADE = {
  worker: "./vendor/tesseract/worker.min.js",
  core: "./vendor/tesseract/",
  sprachen: "./sprachdaten/",
};

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
  // HEIC/HEIF gehen IMMER ueber das Canvas. iPhone-Fotos kommen in diesem
  // Format, und nur der Browser selbst kann es entpacken - reicht man die Datei
  // unveraendert an Tesseract weiter, bekommt es Bytes, mit denen es nichts
  // anfangen kann. Ueber das Canvas hat Safari das Bild bereits dekodiert.
  const istHeic = /hei[cf]/i.test(datei.type || "") || /\.hei[cf]$/i.test(datei.name || "");

  if (!dunkelmodus && !istHeic && bild.width <= MAX_BREITE) {
    return { eingabe: datei, dunkelmodus, unveraendert: true, bild };
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

  return { eingabe: flaeche, dunkelmodus, unveraendert: false, bild };
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

/** Schneidet einen senkrechten Streifen heraus, in der Groesse des Erkennungslaufs. */
function zeichneAusschnitt(bild, vonX, bisX, skala) {
  const breite = Math.max(1, Math.round((bisX - vonX) * skala));
  const hoehe = Math.max(1, Math.round(bild.height * skala));
  const flaeche = document.createElement("canvas");
  flaeche.width = breite;
  flaeche.height = hoehe;
  flaeche.getContext("2d").drawImage(
    bild, vonX, 0, bisX - vonX, bild.height, 0, 0, breite, hoehe);
  return flaeche;
}

/** Rechnet die Kaestchen eines Ausschnitts zurueck aufs ganze Bild. */
function verschiebe(zeile, versatz) {
  const um = (b) => ({ ...b, x0: b.x0 + versatz, x1: b.x1 + versatz });
  return {
    ...zeile,
    bbox: um(zeile.bbox),
    woerter: (zeile.woerter || []).map((w) => ({ ...w, bbox: um(w.bbox) })),
  };
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

// Die Wortkaestchen muessen mit: Bei einem Buchseiten-Layout stehen Vokabel
// und Uebersetzung NEBENEINANDER, und Tesseract liefert beide Spalten als EINE
// Zeile. Ohne Wortpositionen liesse sich die Zeile nicht an der Spaltengrenze
// trennen.
const schlank = (zeilen) => zeilen.map((z) => ({
  text: z.text,
  conf: z.confidence,
  bbox: z.bbox,
  woerter: (z.words || [])
    .filter((w) => w.text && w.text.trim())
    .map((w) => ({ text: w.text, conf: w.confidence, bbox: w.bbox })),
}));

async function lies(arbeiter, eingabe, modus) {
  await arbeiter.setParameters({ tessedit_pageseg_mode: modus });
  const { data } = await arbeiter.recognize(eingabe, {}, { blocks: true, text: false });
  return schlank(zeilenAus(data));
}

/**
 * @param datei  die vom Nutzer gewaehlte Bilddatei
 * @param paar   { quelle: "rus", ziel: "deu" }
 * @param melde  Rueckruf fuer den Fortschrittstext
 * @returns { quelle: [...], ziel: [...] } fuer zuPaaren()
 */
export async function erkenne(datei, paar, melde) {
  melde?.("Bild wird vorbereitet …");
  const { eingabe, dunkelmodus, bild } = await vorverarbeite(datei);

  const [arbeiterQ, arbeiterZ] = [
    await holeArbeiter(paar.quelle, melde),
    await holeArbeiter(paar.ziel, melde),
  ];

  // Nacheinander, nicht parallel. Zwei Tesseract-Arbeiter gleichzeitig
  // belegen auf einem iPhone rund 500 MB - Safari beendet die Seite dann
  // wortlos, und der Nutzer sieht nur einen Neustart ohne Erklaerung.
  melde?.("Text wird gelesen (1 von 2) …");
  let quelle = await lies(arbeiterQ, eingabe, SEITENMODUS);

  melde?.("Text wird gelesen (2 von 2) …");
  let ziel = await lies(arbeiterZ, eingabe, SEITENMODUS);

  // Auffaellig wenige Zeilen? Dann lag es womoeglich an der Seitenaufteilung
  // und nicht am Bild. Der zweite Modus bekommt eine Chance, und es gewinnt
  // der mit mehr Zeilen. Begruendung mit Zahlen in bildwerte.js.
  if (Math.min(quelle.length, ziel.length) < MIN_ZEILEN) {
    melde?.("Zweiter Versuch mit anderer Aufteilung …");
    const quelle2 = await lies(arbeiterQ, eingabe, SEITENMODUS_ERSATZ);
    const ziel2 = await lies(arbeiterZ, eingabe, SEITENMODUS_ERSATZ);
    if (Math.min(quelle2.length, ziel2.length) > Math.min(quelle.length, ziel.length)) {
      quelle = quelle2;
      ziel = ziel2;
    }
  }

  const bildBreite = eingabe instanceof HTMLCanvasElement ? eingabe.width : bild.width;

  // Zwei Spalten? Dann jede EINZELN lesen.
  //
  // GEMESSEN (werkzeug/spaltenversuch.mjs): Tesseract bestimmt seine
  // Schwarz-Weiss-Schwelle ueber das ganze Bild. Die linke Spalte der
  // Buchseite ist grau hinterlegt - im Mittel 134 gegen 177 der weissen
  // rechten. Auf diesem Rechner reicht das noch; auf Renes iPhone verschiebt
  // die Farbumrechnung sie so weit, dass sie als Hintergrund durchfaellt: 42
  // statt 105 Woerter links, waehrend rechts alles stand.
  //
  // Nachgestellt, indem die linke Spalte im Kontrast zusammengedrueckt wurde:
  //
  //   ganzes Bild, Original        105 Woerter links
  //   ganzes Bild, kontrastarm       0 Woerter links   <- Renes Fall
  //   eigener Ausschnitt           108 Woerter links   <- die Loesung
  //
  // Im eigenen Ausschnitt ist die graue Flaeche das hellste im Bild, und
  // Tesseracts Schwelle richtet sich danach.
  //
  // GEPRUEFT UND VERWORFEN: die Spalten stattdessen im BILD zu suchen, ueber
  // die senkrechte Streuung der Helligkeit je Bildspalte. Das findet den Steg
  // auch dann, wenn eine Spalte gar nicht gelesen wurde - kann einspaltige
  // Vorlagen aber nicht zuverlaessig ablehnen. In einem Screenshot ist das Tal
  // rechts vom Text flach und breit, das Minimum springt je nach Rundung
  // zwischen x=728, 800 und 903, und bei IMG_3392 landete es mitten im Text.
  // Vier von sieben russischen Screenshots wurden faelschlich fuer zweispaltig
  // gehalten; die Trefferquote fiel von 94 auf 26 Prozent. Die Zuordnung ueber
  // erkannte Woerter trennt dagegen sauber (84 % gegen 0 bis 3 %).
  //
  // Preis dieser Entscheidung: Ist eine Spalte SO blass, dass gar kein Wort
  // darin erkannt wird, bemerkt die App die Spalten nicht. Auf Renes Geraet
  // wurden 42 Woerter gefunden - genug.
  const aufteilung = spaltenAufteilung(quelle, bildBreite);
  if (aufteilung?.ok) {
    melde?.("Spalten gefunden, jede wird einzeln gelesen …");
    const skala = bildBreite / bild.width;
    const grenze = aufteilung.grenze;

    const links = zeichneAusschnitt(bild, 0, grenze / skala, skala);
    const rechts = zeichneAusschnitt(bild, grenze / skala, bild.width, skala);

    const quelleLinks = await lies(arbeiterQ, links, SEITENMODUS);
    const zielRechts = await lies(arbeiterZ, rechts, SEITENMODUS);

    return {
      quelle: quelleLinks,
      ziel: zielRechts.map((z) => verschiebe(z, grenze)),
      grenze,
      dunkelmodus, bildBreite,
      diagnose: {
        rohBreite: bild.width, rohHoehe: bild.height, ocrBreite: bildBreite,
        ueberCanvas: true, spaltenEinzeln: true, messung: aufteilung,
        zeilenQ: quelleLinks.length, zeilenZ: zielRechts.length,
        worteQ: quelleLinks.reduce((s, z) => s + (z.woerter?.length || 0), 0),
        worteZ: zielRechts.reduce((s, z) => s + (z.woerter?.length || 0), 0),
      },
    };
  }

  // Diagnose fuer den Bestaetigungsbildschirm.
  //
  // Anlass: Eine Buchseite lief hier fehlerfrei durch und ergab auf dem iPhone
  // Unsinn. Zwei Rueckfragen und eine falsche Vermutung spaeter war klar, dass
  // ohne die nackten Zahlen vom Geraet selbst keine Diagnose moeglich ist.
  // Diese Zeile kostet nichts und beantwortet die Fragen, die sich stellen:
  // Wie gross kam das Bild an? Wurde es ueber das Canvas gereicht? Wie viele
  // Zeilen und Woerter hat Tesseract gefunden?
  const zaehleWorte = (zeilen) => zeilen.reduce((s, z) => s + (z.woerter?.length || 0), 0);
  const diagnose = {
    rohBreite: bild.width, rohHoehe: bild.height,
    ocrBreite: bildBreite,
    ueberCanvas: eingabe instanceof HTMLCanvasElement,
    zeilenQ: quelle.length, zeilenZ: ziel.length,
    worteQ: zaehleWorte(quelle), worteZ: zaehleWorte(ziel),
  };

  return { quelle, ziel, dunkelmodus, bildBreite, diagnose };
}
