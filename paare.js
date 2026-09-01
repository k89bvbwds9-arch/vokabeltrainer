// Aus erkannten Textzeilen werden Vokabelpaare.
//
// Dieses Modul kennt weder Browser noch Tesseract - es bekommt fertige Zeilen
// und gibt Paare zurueck. Genau deshalb prueft der Erkennungstest auf dem Mac
// dieselbe Logik, die spaeter im iPhone laeuft. Waere die Zuordnung im
// Oberflaechencode versteckt, wuerde der Test etwas anderes messen als der
// Betrieb - der klassische Weg zu gruenen Tests bei kaputter App.
//
// ZWEI DURCHLAEUFE, NICHT EINER. Der erste Entwurf liess Tesseract mit beiden
// Sprachen gleichzeitig laufen. Gemessen an einem Testbild las es "куда" als
// "Kyna" - к/у/д/а sehen wie K/y/n/a aus, und im Zweisprachenmodus darf es
// sich fuer Latein entscheiden. Zwei Schaeden auf einmal: Die Vokabel landet
// falsch geschrieben im Stapel, UND die Paarbildung wirft sie still weg, weil
// die deutsche Zeile danach keinen kyrillischen Vorgaenger mehr hat.
//
// Mit getrennten Durchlaeufen je Sprache kann die Verwechslung gar nicht
// entstehen: Wer nur Kyrillisch kennt, liest "куда" (Konfidenz 96). Welcher
// Durchlauf je Zeile recht hat, verraet die Konfidenz - gemessen lag der
// richtige bei jeder einzelnen Zeile vorn, auch beim App-Titel.

// --- Schriftsysteme -------------------------------------------------------
const BEREICHE = {
  kyrillisch: /[Ѐ-ӿ]/,
  griechisch: /[Ͱ-Ͽ]/,
  hebraeisch: /[֐-׿]/,
  arabisch:   /[؀-ۿ]/,
  lateinisch: /[A-Za-zÀ-ÖØ-öø-ÿ]/,
};

/** Welches Schriftsystem ueberwiegt in dieser Zeile? */
export function schriftVon(text) {
  const zaehler = {};
  for (const zeichen of text) {
    for (const [name, muster] of Object.entries(BEREICHE)) {
      if (muster.test(zeichen)) { zaehler[name] = (zaehler[name] || 0) + 1; break; }
    }
  }
  const sortiert = Object.entries(zaehler).sort((a, b) => b[1] - a[1]);
  return sortiert.length ? sortiert[0][0] : "unbekannt";
}

/** Welches Schriftsystem benutzt diese Sprache? */
export function schriftDerSprache(kuerzel) {
  const tabelle = {
    rus: "kyrillisch", ukr: "kyrillisch", bul: "kyrillisch", srp: "kyrillisch",
    ell: "griechisch", grc: "griechisch", heb: "hebraeisch", ara: "arabisch",
  };
  return tabelle[kuerzel] || "lateinisch";
}

// --- Rauschen wegwerfen ---------------------------------------------------
const RAUSCHEN = [
  /^\d{1,2}[:.]\d{2}$/,   // Uhrzeit "08:53"
  /^\d{1,3}\s*%$/,        // Akkustand
  /^[^\p{L}]*$/u,         // gar keine Buchstaben: Symbole, Ziffern, Striche
];

export function istRauschen(text) {
  const t = (text || "").trim();
  return t.length === 0 || RAUSCHEN.some((m) => m.test(t));
}

function saeubereText(text) {
  return (text || "")
    .replace(/\s+/g, " ")
    .trim()
    // Fuehrende und folgende Nicht-Buchstaben abschneiden - das sind die Reste,
    // die Tesseract aus Haekchen- und Lesezeichensymbolen macht. Klammern und
    // Punkte am Ende bleiben, die gehoeren oft zur Vokabel ("gehen (zu Fuss)").
    .replace(/^[^\p{L}(]+|[^\p{L})\].!?]+$/gu, "")
    .trim();
}

// --- Die beiden Durchlaeufe zusammenfuehren -------------------------------
/**
 * Beide Durchlaeufe sehen dasselbe Bild und zerlegen es fast immer gleich.
 * Zugeordnet wird trotzdem ueber die senkrechte Ueberlappung und nicht ueber
 * den Index: Faellt in einem Durchlauf eine Zeile aus, verschoebe sich sonst
 * alles Folgende um eins - und ab da waere jede Vokabel falsch.
 */
function verschmelze(quelleZeilen, zielZeilen) {
  const offen = [...zielZeilen];
  const raus = [];

  for (const q of quelleZeilen) {
    let besterIndex = -1, besteUeberlappung = 0;
    offen.forEach((z, i) => {
      const ueber = Math.min(q.bbox.y1, z.bbox.y1) - Math.max(q.bbox.y0, z.bbox.y0);
      const hoehe = Math.min(q.bbox.y1 - q.bbox.y0, z.bbox.y1 - z.bbox.y0);
      if (hoehe > 0 && ueber / hoehe > 0.5 && ueber > besteUeberlappung) {
        besteUeberlappung = ueber; besterIndex = i;
      }
    });
    const z = besterIndex >= 0 ? offen.splice(besterIndex, 1)[0] : null;
    raus.push({
      bbox: q.bbox,
      quelleText: saeubereText(q.text), quelleConf: q.conf ?? 0,
      zielText: z ? saeubereText(z.text) : "", zielConf: z ? (z.conf ?? 0) : -1,
    });
  }
  // Zeilen, die nur der Ziel-Durchlauf gefunden hat, nicht verlieren
  for (const z of offen) {
    raus.push({
      bbox: z.bbox, quelleText: "", quelleConf: -1,
      zielText: saeubereText(z.text), zielConf: z.conf ?? 0,
    });
  }
  return raus.sort((a, b) => a.bbox.y0 - b.bbox.y0);
}

// Unterhalb dieser Konfidenz ist eine Zeile kein Text, sondern ein Symbol.
//
// GEMESSEN an IMG_3398: Das Lautsprechersymbol neben jeder Vokabel erzeugt
// eine eigene Zeile ("ОИ 4)", "стул 4)"). Die schiebt sich zwischen Vokabel
// und Uebersetzung, wird mangels Alternative als Quellsprache eingestuft und
// STIEHLT der echten Vokabel ihre Uebersetzung - vier von neun Karten des
// Bildes gingen so verloren.
//
// Die Trennung ist deutlich: Echte Textzeilen lagen bei 88 bis 97, alle
// Symbolzeilen bei 15 bis 56. Der Wert liegt bewusst naeher an den Symbolen -
// eine echte, nur blasse Zeile faelschlich zu verwerfen waere schlimmer, als
// ein Symbol durchzulassen, denn Durchgelassenes sieht man auf dem
// Bestaetigungsbildschirm, Verworfenes nicht.
const MIN_KONFIDENZ = 65;

// Zweites, unabhaengiges Merkmal fuer Symbolzeilen: Wie viel davon sind
// ueberhaupt Buchstaben?
//
// Notwendig geworden durch einen Vergleich Node gegen Browser an DERSELBEN
// Datei: Die Symbolzeile "р 4)" bekam im Node-Build Konfidenz 46, im
// WASM-Build des Browsers aber 76. Die Konfidenzschwelle allein haengt also
// davon ab, WO die Erkennung laeuft - und die App laeuft im Browser, gemessen
// wurde in Node. Der Buchstabenanteil ist dagegen in beiden gleich:
//
//   "р 4)"        1 Buchstabe von 3 Zeichen   = 0,33
//   ". 4)"        0 von 3                     = 0
//   "в магазине"  9 von 9                     = 1,00
//   "как пройти к ___?"                       = 0,75
//
// Die echten Vokabeln der Testbilder lagen alle ueber 0,75, aller Symbolmuell
// unter 0,5.
const MIN_BUCHSTABENANTEIL = 0.6;

function buchstabenAnteil(text) {
  const ohneLeer = text.replace(/\s/g, "");
  if (!ohneLeer.length) return 0;
  return [...ohneLeer].filter((c) => /\p{L}/u.test(c)).length / ohneLeer.length;
}

/**
 * Zeilen, die keine Vokabel sein koennen, gar nicht erst weiterreichen.
 *
 * Eine einzelne Buchstabe ist keine Vokabel - ausser die Erkennung ist sich
 * sehr sicher, denn "я" ("ich") gibt es wirklich.
 */
function istSymbolzeile(z) {
  const text = z.quelleConf >= z.zielConf ? z.quelleText : z.zielText;
  if (Math.max(z.quelleConf, z.zielConf) < MIN_KONFIDENZ) return true;
  if (buchstabenAnteil(text) < MIN_BUCHSTABENANTEIL) return true;
  if (text.length < 2 && Math.max(z.quelleConf, z.zielConf) < 85) return true;
  return false;
}

/** Je Zeile entscheiden, welcher Durchlauf recht hat. */
function bestimmeSprache(zeilen) {
  return zeilen.filter((z) => !istSymbolzeile(z)).map((z) => {
    const istQuelle = z.quelleConf >= z.zielConf;
    return {
      bbox: z.bbox,
      sprache: istQuelle ? "quelle" : "ziel",
      text: istQuelle ? z.quelleText : z.zielText,
      // Abstand der beiden Konfidenzen: klein heisst "knapp entschieden".
      // Wird auf dem Bestaetigungsbildschirm zum Markieren benutzt.
      vorsprung: Math.abs(z.quelleConf - z.zielConf),
      konfidenz: Math.max(z.quelleConf, z.zielConf),
    };
  }).filter((z) => !istRauschen(z.text));
}

// --- Verfahren 1: nach Sprache und Reihenfolge ---------------------------
/**
 * Greift, wenn Quell- und Zielsprache verschiedene Alphabete benutzen
 * (Russisch-Deutsch). Nach den zwei Durchlaeufen ist die Sprache je Zeile
 * belegt statt geraten, und es bleibt eine reine Reihenfolgeregel:
 *
 *   Eine Zielsprachenzeile zaehlt NUR, wenn direkt davor eine Quellsprachen-
 *   zeile stand.
 *
 * Damit faellt der App-Rahmen von selbst weg - der Titel steht vor jedem
 * russischen Wort, die Knopfbeschriftung folgt auf eine bereits verbrauchte
 * deutsche Zeile. Ohne diese Regel muesste jeder Screenshot zugeschnitten
 * werden.
 */
function paareNachReihenfolge(zeilen) {
  const paare = [], unklar = [];
  const { engerAbstand, randToleranz } = layoutMasse(zeilen);
  let offen = null, letztesPaar = null, vorige = null;

  /**
   * Gehoert diese Zeile noch zur vorigen, oder faengt etwas Neues an?
   *
   * Der Anlass ist gemessen, nicht ausgedacht: Im Screenshot mit "извините, я
   * не понял" bricht die Uebersetzung "Entschuldigung, ich habe / nicht
   * verstanden" auf zwei Zeilen um. Die erste Fassung warf die zweite Zeile
   * weg und speicherte die Vokabel verstuemmelt - schlimmer als ein sichtbarer
   * Fehler, weil nichts darauf hinweist.
   *
   * Einfach jede weitere Zeile anzuhaengen geht aber auch nicht: Dann landete
   * die Knopfbeschriftung "Weiter" als Teil der letzten Uebersetzung im
   * Stapel. Die beiden Faelle unterscheiden sich in zwei Merkmalen
   * zuverlaessig: Eine Fortsetzung steht DICHT unter ihrer Zeile und beginnt
   * am SELBEN linken Rand. Ein Bedienelement steht weiter weg oder mittig.
   */
  const istFortsetzung = (zeile) => vorige
    && (zeile.bbox.y0 - vorige.bbox.y1) <= engerAbstand
    && Math.abs(zeile.bbox.x0 - vorige.bbox.x0) <= randToleranz;

  for (const zeile of zeilen) {
    if (zeile.sprache === "quelle") {
      if (offen && istFortsetzung(zeile)) {
        offen = { ...offen, text: `${offen.text} ${zeile.text}`,
          bbox: { ...offen.bbox, y1: zeile.bbox.y1 },
          vorsprung: Math.min(offen.vorsprung, zeile.vorsprung),
          konfidenz: Math.min(offen.konfidenz, zeile.konfidenz) };
      } else {
        if (offen) unklar.push({ quelle: offen.text, ziel: "", grund: "keine Übersetzung gefunden" });
        offen = zeile;
        letztesPaar = null;
      }
    } else if (offen) {
      letztesPaar = {
        quelle: offen.text, ziel: zeile.text,
        // "sicher" steuert, ob die Zeile auf dem Bestaetigungsbildschirm
        // vorausgewaehlt ist. Knapp entschiedene Zeilen will man ansehen.
        sicher: offen.vorsprung >= 10 && zeile.vorsprung >= 10
          && offen.konfidenz >= 70 && zeile.konfidenz >= 70,
      };
      paare.push(letztesPaar);
      offen = null;
    } else if (letztesPaar && istFortsetzung(zeile)) {
      letztesPaar.ziel += ` ${zeile.text}`;
      if (zeile.vorsprung < 10 || zeile.konfidenz < 70) letztesPaar.sicher = false;
    } else {
      // Hier kam etwas dazwischen, das weder zur offenen Vokabel noch zum
      // letzten Paar gehoert. Damit ist die Fortsetzungskette gerissen.
      //
      // Ohne diese Zeile passierte GEMESSEN Folgendes (IMG_3398): "дом"
      // zerfiel bei der Erkennung in zwei Kaestchen, das Bruchstueck "ом"
      // wurde knapp fuer Deutsch gehalten und verworfen - und "Haus" hing
      // sich daraufhin an das WEIT davor liegende Paar "друг|Freund". Ergebnis
      // waere "друг | Freund Haus" gewesen: eine richtige Vokabel verdorben
      // und eine zweite verloren. Eine fehlende Karte sieht man auf dem
      // Bestaetigungsbildschirm, eine still verfaelschte nicht.
      letztesPaar = null;
    }
    vorige = zeile;
  }
  if (offen) unklar.push({ quelle: offen.text, ziel: "", grund: "keine Übersetzung gefunden" });
  return { paare, unklar };
}

/**
 * Was gilt in DIESEM Bild als enger Zeilenabstand, und wie genau muessen
 * linke Raender uebereinstimmen? Beides haengt an der Aufloesung und wird
 * deshalb aus dem Bild selbst bestimmt, statt fest verdrahtet zu werden -
 * sonst zerlegt ein Screenshot vom iPad anders als einer vom iPhone.
 */
function layoutMasse(zeilen) {
  const breite = zeilen.length
    ? Math.max(...zeilen.map((z) => z.bbox.x1)) - Math.min(...zeilen.map((z) => z.bbox.x0))
    : 1000;
  const abstaende = [];
  for (let i = 1; i < zeilen.length; i++) {
    abstaende.push(zeilen[i].bbox.y0 - zeilen[i - 1].bbox.y1);
  }
  return {
    engerAbstand: abstaende.length ? trennGrenze(abstaende) : Infinity,
    randToleranz: breite * 0.04,
  };
}

// --- Verfahren 2: nach Zeilenabstaenden ----------------------------------
/**
 * Greift, wenn beide Sprachen dasselbe Alphabet benutzen (Italienisch-Deutsch).
 * Dann trennen die Konfidenzen nicht mehr, und nur noch das Layout verraet,
 * was zusammengehoert: Innerhalb einer Karte stehen die Zeilen eng, zwischen
 * zwei Karten klafft eine Luecke.
 */
function gruppiereNachAbstand(zeilen) {
  if (zeilen.length < 2) return [zeilen];

  const abstaende = [];
  for (let i = 1; i < zeilen.length; i++) {
    abstaende.push(zeilen[i].bbox.y0 - zeilen[i - 1].bbox.y1);
  }

  const schwelle = trennGrenze(abstaende);

  const gruppen = [[zeilen[0]]];
  for (let i = 1; i < zeilen.length; i++) {
    if (abstaende[i - 1] > schwelle) gruppen.push([zeilen[i]]);
    else gruppen[gruppen.length - 1].push(zeilen[i]);
  }
  return gruppen;
}

/**
 * Trennt Zeilenabstaende in "innerhalb einer Karte" und "zwischen zwei Karten"
 * und gibt die Grenze dazwischen zurueck.
 *
 * Der erste Entwurf nahm "Median mal 1,6". An echten Zahlen faellt der durch:
 * Bei fuenf Karten gibt es genauso viele grosse wie kleine Luecken, der Median
 * landet mitten in den grossen, und alles verschmilzt zu einer einzigen
 * Gruppe. Stattdessen werden die Luecken in zwei Haufen geteilt und die Grenze
 * in die Mitte gelegt. Ausreisser nach oben - der grosse Sprung von der
 * Statusleiste zum Inhalt - wuerden die Haufenbildung verzerren und fliegen
 * vorher raus.
 */
function trennGrenze(abstaende) {
  const sortiert = [...abstaende].sort((a, b) => a - b);
  const p75 = sortiert[Math.floor(sortiert.length * 0.75)];
  const ohneAusreisser = sortiert.filter((a) => a <= p75 * 3);
  return zweiHaufenGrenze(ohneAusreisser.length >= 2 ? ohneAusreisser : sortiert);
}

/** Einfaches Zwei-Mittel-Verfahren auf einer Zahlenreihe, Grenze in der Mitte. */
function zweiHaufenGrenze(werte) {
  let a = werte[0], b = werte[werte.length - 1];
  if (a === b) return b + 1;
  for (let runde = 0; runde < 20; runde++) {
    const nahA = werte.filter((w) => Math.abs(w - a) <= Math.abs(w - b));
    const nahB = werte.filter((w) => Math.abs(w - a) > Math.abs(w - b));
    if (!nahA.length || !nahB.length) break;
    const neuA = nahA.reduce((s, w) => s + w, 0) / nahA.length;
    const neuB = nahB.reduce((s, w) => s + w, 0) / nahB.length;
    if (neuA === a && neuB === b) break;
    a = neuA; b = neuB;
  }
  return (a + b) / 2;
}

function paareNachAbstand(zeilen) {
  const gruppen = gruppiereNachAbstand(zeilen);

  // Kopfzeilen und Knopfbeschriftungen stehen mittig, Karteninhalt linksbuendig.
  // Der uebliche linke Rand verraet also den Rahmen - er wird nicht weggeworfen,
  // sondern nur als unsicher markiert, damit nichts still verschwindet.
  const linkeRaender = zeilen.map((z) => z.bbox.x0).sort((a, b) => a - b);
  const ueblicherRand = linkeRaender[Math.floor(linkeRaender.length / 2)];
  const breite = Math.max(...zeilen.map((z) => z.bbox.x1)) - ueblicherRand;

  const paare = [], unklar = [];
  for (const gruppe of gruppen) {
    if (gruppe.length === 2) {
      const eingerueckt = gruppe.some((z) => z.bbox.x0 - ueblicherRand > breite * 0.15);
      paare.push({ quelle: gruppe[0].text, ziel: gruppe[1].text, sicher: !eingerueckt });
    } else {
      // Bewusst nicht raten. Eine falsch geratene Vokabel bleibt jahrelang im
      // Stapel; eine als unklar markierte kostet drei Sekunden Korrektur.
      unklar.push({ quelle: gruppe.map((g) => g.text).join(" · "), ziel: "",
        grund: `Gruppe mit ${gruppe.length} Zeilen statt 2` });
    }
  }
  return { paare, unklar };
}

// --- Einstieg -------------------------------------------------------------
/**
 * @param durchlaeufe { quelle: [{text, conf, bbox}], ziel: [...] }
 * @param paar        { quelle: "rus", ziel: "deu" }
 */
export function zuPaaren(durchlaeufe, paar) {
  const zeilen = bestimmeSprache(verschmelze(durchlaeufe.quelle, durchlaeufe.ziel));
  const gleicheSchrift = schriftDerSprache(paar.quelle) === schriftDerSprache(paar.ziel);

  const ergebnis = gleicheSchrift ? paareNachAbstand(zeilen) : paareNachReihenfolge(zeilen);
  return { ...ergebnis, verfahren: gleicheSchrift ? "abstand" : "reihenfolge", zeilen };
}
