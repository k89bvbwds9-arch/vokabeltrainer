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
    // Typografische Anfuehrungszeichen auf die geraden abbilden. Buchsatz
    // benutzt "l’indirizzo", Tastaturen "l'indirizzo" - ohne das haette man
    // dieselbe Vokabel in zwei Schreibweisen im Stapel und wuerde sie beim
    // Suchen nicht wiederfinden.
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .trim()
    // Fuehrende und folgende Nicht-Buchstaben abschneiden - das sind die Reste,
    // die Tesseract aus Haekchen- und Lesezeichensymbolen macht. Klammern,
    // Punkte und Strichpunkte am Ende bleiben: Sie gehoeren oft zur Vokabel
    // ("gehen (zu Fuss)") oder trennen im Buchsatz die Bedeutungen
    // ("il signore/la signora;").
    .replace(/^[^\p{L}(]+|[^\p{L})\].!?;:,]+$/gu, "")
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
      // Wortkaestchen beider Durchlaeufe getrennt aufheben - das Spaltenverfahren
      // nimmt die linke Haelfte aus dem einen und die rechte aus dem anderen.
      quelleWoerter: q.woerter || [],
      zielWoerter: z?.woerter || [],
    });
  }
  // Zeilen, die nur der Ziel-Durchlauf gefunden hat, nicht verlieren
  for (const z of offen) {
    raus.push({
      bbox: z.bbox, quelleText: "", quelleConf: -1,
      zielText: saeubereText(z.text), zielConf: z.conf ?? 0,
      quelleWoerter: [], zielWoerter: z.woerter || [],
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

// --- Verfahren 3: nebeneinander in zwei Spalten --------------------------
//
// Der Fall aus dem Lehrbuch: links die Vokabel, rechts die Uebersetzung -
// anders als in Lern-Apps, wo beides untereinander steht.
//
// WICHTIG, und der Grund fuer den zweiten Anlauf an dieser Stelle: Tesseract
// zerlegt so eine Seite je nach Bauart UNTERSCHIEDLICH.
//
//   Auf dem Mac  ->  eine Zeile je Tabellenzeile:
//                    "l'ingresso der Einstieg, Eintritt; der Eingang"
//   Auf dem iPhone -> zwei Zeilen, je Spalte eine:
//                    "l'ingresso"   und   "der Einstieg, Eintritt; der Eingang"
//
// Die erste Fassung verlangte, dass die ZEILEN selbst ueber beide Spalten
// reichen. Auf dem iPhone war das nie erfuellt, die Spaltenerkennung lehnte ab,
// und das Abstandsverfahren machte aus der Buchseite Unsinn - genau das hat
// Rene im Betrieb gesehen, waehrend hier alles gruen war.
//
// Deshalb wird jetzt zuerst nach HOEHE gruppiert: Zeilen, die auf gleicher
// Hoehe stehen, bilden eine Reihe. Ob diese Reihe aus einer oder zwei Zeilen
// besteht, ist danach gleichgueltig - beide Bauarten laufen durch denselben
// Code.

// Ueber den Steg duerfen hoechstens so viele Reihen mit einem Wort hinweg-
// laufen (Anteil aller Reihen). Nicht null, weil eine Ueberschrift durchaus
// ueber beide Spalten reicht.
const STEG_HOECHSTENS = 0.12;

// So viele REIHEN muessen auf beiden Seiten des Stegs Text haben, sonst ist es
// keine Tabelle, sondern eine einspaltige Liste. Dieser Wert ist die Sicherung
// dafuer, dass die russischen Screenshots weiterhin ueber die Reihenfolge
// zugeordnet werden.
//
// GEMESSEN (werkzeug/steg-pruefen.mjs):
//   Buchseite, hier         37 von 44 Reihen = 84 %
//   Screenshot IMG_3390      1 von 29 Reihen =  3 %
//   Screenshot IMG_3382      0 von 29 Reihen =  0 %
//
// Der Abstand zwischen beiden Welten ist also riesig. Die erste Fassung setzte
// 60 % - genau in die Mitte des Nichts. Auf Renes iPhone zerlegt Tesseract
// dieselbe Buchseite in 104 statt 44 Textzeilen; die zusaetzlichen Bruchstuecke
// sitzen in nur einer Spalte und druecken den Anteil unter 60 %. Die Erkennung
// lehnte ab, und die Seite wurde zu Unsinn.
//
// 35 % hat immer noch den zehnfachen Abstand zu den einspaltigen Vorlagen und
// verkraftet, dass auf einem Geraet ein Drittel mehr Bruchstuecke entsteht.
const BEIDSEITIG_MINDESTENS = 0.35;

// Zusaetzlich eine absolute Untergrenze: Ein Anteil allein traegt bei wenigen
// Reihen nicht - drei von acht sind 38 %, sagen aber nichts.
const BEIDSEITIG_ANZAHL = 6;

// Wie schwer ein quer laufendes Wort gegenueber einer getrennten Reihe wiegt.
// Drei genuegt mit Abstand: An der Buchseite muesste es nur groesser als 0,17
// sein, damit der echte Steg die Stelle mitten im Text schlaegt.
const QUER_GEWICHT = 3;

/**
 * Zeilen auf gleicher Hoehe zu einer Reihe zusammenfassen.
 *
 * Verglichen wird gegen die MITTE der ersten Zeile einer Reihe, nicht gegen
 * deren gewachsene Ausdehnung. Der Unterschied ist im Betrieb aufgefallen:
 *
 * Der erste Entwurf pruefte die Ueberlappung mit der bereits gewachsenen Reihe
 * und dehnte sie bei jedem Treffer weiter. Auf Renes iPhone erkennt Tesseract
 * 104 statt 44 Textzeilen, viele davon Bruchstuecke. Eines davon ueberlappt
 * eine Reihe, dehnt sie nach unten, dann ueberlappt die naechste ECHTE
 * Buchzeile die gedehnte Reihe - und so weiter. Aus 104 Zeilen wurden 47
 * Reihen statt rund 90, und in einer Reihe landeten zwei Vokabeln:
 * "Se | neu Haus; nach Hause, zuhause".
 *
 * Ein fester Bezugspunkt kann nicht wandern. Die Schwelle richtet sich nach
 * der ueblichen Zeilenhoehe des Bildes, damit sie bei jeder Aufloesung passt.
 */
function zuReihen(zeilen) {
  const mitWorten = (zeilen || []).filter((z) => z.woerter?.length);
  if (!mitWorten.length) return [];

  const hoehen = mitWorten.map((z) => z.bbox.y1 - z.bbox.y0).sort((a, b) => a - b);
  const uebliche = hoehen[Math.floor(hoehen.length / 2)] || 1;
  const schwelle = uebliche * 0.6;

  const mitte = (z) => (z.bbox.y0 + z.bbox.y1) / 2;
  const sortiert = [...mitWorten].sort((a, b) => mitte(a) - mitte(b));

  const reihen = [];
  for (const z of sortiert) {
    const letzte = reihen[reihen.length - 1];
    if (letzte && Math.abs(mitte(z) - letzte.ankerMitte) <= schwelle) {
      letzte.y0 = Math.min(letzte.y0, z.bbox.y0);
      letzte.y1 = Math.max(letzte.y1, z.bbox.y1);
      letzte.woerter.push(...z.woerter);
    } else {
      reihen.push({
        y0: z.bbox.y0, y1: z.bbox.y1,
        ankerMitte: mitte(z),        // fester Bezugspunkt, waechst nicht mit
        woerter: [...z.woerter],
      });
    }
  }
  return reihen;
}

/**
 * Sucht den senkrechten Steg zwischen zwei Textspalten.
 * @returns { grenze, reihen } oder null, wenn die Vorlage einspaltig ist
 */
export function spaltenAufteilung(zeilen, bildBreite) {
  const reihen = zuReihen((zeilen || []).filter((z) => z.woerter?.length));
  if (reihen.length < 5) return { ok: false, reihenAnzahl: reihen.length };

  // Den Steg NICHT als leerste Stelle suchen, sondern als die Stelle, die am
  // besten TRENNT.
  //
  // Der erste Entwurf nahm das Minimum der Belegungsdichte und prueft erst
  // danach, ob dort wirklich zwei Spalten liegen. Auf dem Mac klappte das: Bei
  // x=800 hatten null von 44 Reihen Text. Auf Renes iPhone erkennt Tesseract
  // dieselbe Seite etwas anders, ein Bruchstueck faellt in die Luecke, und das
  // Minimum wandert an eine ganz andere Stelle - rechts im deutschen Text, wo
  // dann nur noch 6 statt 84 Prozent der Reihen beidseitig belegt sind.
  //
  // Die neue Suche probiert alle Stellen durch und nimmt die mit den meisten
  // beidseitig belegten Reihen. Damit wird direkt das optimiert, worauf es
  // ankommt, statt auf einen Stellvertreter zu hoffen.
  const schritt = 10;
  const felder = Math.ceil(bildBreite / schritt);
  if (felder < 10) return { ok: false, reihenAnzahl: reihen.length };

  const von = Math.floor(felder * 0.2) * schritt;
  const bis = Math.floor(felder * 0.8) * schritt;

  const bewerte = (x) => {
    let beidseitig = 0, drueber = 0;
    for (const r of reihen) {
      let links = false, rechts = false, quer = false;
      for (const w of r.woerter) {
        if (w.bbox.x1 <= x) links = true;
        else if (w.bbox.x0 >= x) rechts = true;
        else quer = true;
      }
      if (links && rechts) beidseitig++;
      if (quer) drueber++;
    }
    return { beidseitig, drueber };
  };

  const werte = [];
  for (let x = von; x <= bis; x += schritt) werte.push({ x, ...bewerte(x) });
  if (!werte.length) return { ok: false, reihenAnzahl: reihen.length };

  // Beide Kriterien zaehlen, und alle drei Anlaeufe davor hatten das falsch:
  //
  //   Nur "wenigste Woerter quer"      -> auf Renes iPhone landete der Steg in
  //     einem leeren Streifen am rechten Rand; nur 6 statt 84 Prozent der
  //     Reihen waren dort beidseitig belegt.
  //   Nur "meiste beidseitig"          -> an der Buchseite liegt das Hoechstmass
  //     (39 von 44) bei x=520 MITTEN im italienischen Text, wo zwoelf Woerter
  //     quer laufen. Der echte Steg bei x=750 hat 37, dafuer null quer.
  //   "Erst quer, dann beidseitig"     -> ein hartes Ausschlusskriterium. Laeuft
  //     ueber den echten Steg auch nur EIN Wort - eine Ueberschrift, ein
  //     Schattenrest -, faellt er ganz aus der Auswahl, und der leere Streifen
  //     gewinnt wieder.
  //
  // Richtig ist eine Verrechnung: Jede Reihe, die getrennt wird, zaehlt positiv;
  // jedes Wort, das quer laeuft, zaehlt dreifach negativ. An der Buchseite
  // ergibt das fuer x=750 den Wert 37 und fuer x=520 nur 39 - 3*12 = 3.
  const bewertung = (w) => w.beidseitig - QUER_GEWICHT * w.drueber;
  const bester = werte.reduce((a, b) => (bewertung(b) > bewertung(a) ? b : a));

  // Meist trennen viele Stellen gleich gut - naemlich der ganze Steg. Getrennt
  // wird in seiner MITTE: Dort ist der Abstand zu beiden Spalten am groessten,
  // und eine leicht schief gehaltene Kamera schiebt die Zeilen nicht ueber die
  // Grenze.
  let laufAnfang = -1, laengster = { laenge: 0, x: -1 };
  for (let i = 0; i <= werte.length; i++) {
    const passt = i < werte.length && bewertung(werte[i]) === bewertung(bester);
    if (passt && laufAnfang < 0) laufAnfang = i;
    if (!passt && laufAnfang >= 0) {
      const laenge = i - laufAnfang;
      if (laenge > laengster.laenge) {
        laengster = { laenge, x: (werte[laufAnfang].x + werte[i - 1].x) / 2 };
      }
      laufAnfang = -1;
    }
  }
  if (laengster.x < 0) return { ok: false, reihenAnzahl: reihen.length };

  const grenze = laengster.x;
  const messung = {
    grenze, reihenAnzahl: reihen.length,
    stegAnteil: bester.drueber / reihen.length,
    beidseitigAnteil: bester.beidseitig / reihen.length,
  };

  // Ueber den Steg selbst darf kaum ein Wort hinweglaufen - sonst ist es keine
  // Spaltengrenze, sondern eine willkuerliche Stelle mitten im Text.
  if (bester.drueber > reihen.length * STEG_HOECHSTENS) return { ...messung, ok: false };
  if (bester.beidseitig < BEIDSEITIG_ANZAHL) return { ...messung, ok: false };
  if (bester.beidseitig < reihen.length * BEIDSEITIG_MINDESTENS) return { ...messung, ok: false };

  return { ...messung, ok: true, reihen };
}

/**
 * Baut aus den Reihen die Vokabelpaare.
 *
 * Der Gewinn gegenueber allen anderen Verfahren: Bei zwei Spalten ist die
 * Sprache je Seite BEKANNT, nicht geraten. Die linke Haelfte kommt deshalb aus
 * dem Durchlauf der Quellsprache, die rechte aus dem der Zielsprache - jede
 * Seite von dem Modell gelesen, das sie kennt.
 */
function paareNachSpalten(reihen, zielZeilen, grenze) {
  const zielNachReihe = verteileAufReihen(
    (zielZeilen || []).flatMap((z) => z.woerter || []).filter((w) => w.bbox.x0 >= grenze),
    reihen);

  const zellen = reihen.map((r, i) => ({
    y0: r.y0, y1: r.y1,
    links: brauchbareWorte(r.woerter, (w) => w.bbox.x1 <= grenze),
    rechts: brauchbareWorte(zielNachReihe[i], () => true),
  }));

  const linkerRand = spaltenRand(zellen.map((z) => z.links));
  const rechterRand = spaltenRand(zellen.map((z) => z.rechts));
  const einzug = Math.max(12, grenze * 0.04);

  // Randmarken wie "E1" stehen im Buch LINKS neben der Spalte. Gemessen wird am
  // ANFANG des Wortes: Was links vom Spaltenrand beginnt, steht ausserhalb.
  const toleranz = Math.max(10, grenze * 0.03);
  const ohneRandmarken = (worte, rand) => worte.filter((w) => w.bbox.x0 >= rand - toleranz);

  const paare = [], unklar = [];
  let letztes = null;

  for (const zelle of zellen) {
    const linkeWorte = ohneRandmarken(zelle.links, linkerRand);
    const links = saeubereText(linkeWorte.map((w) => w.text).join(" "));
    const rechts = saeubereText(zelle.rechts.map((w) => w.text).join(" "));
    if (!links && !rechts) continue;

    const linksEingerueckt = linkeWorte.length && linkeWorte[0].bbox.x0 > linkerRand + einzug;
    const rechtsEingerueckt = zelle.rechts.length && zelle.rechts[0].bbox.x0 > rechterRand + einzug;

    // Eine Vokabel, deren Zelle umbricht, ist auf der betroffenen Seite
    // EINGERUECKT - im Buch etwa "il signore/la signora; / pl. i signori m."
    // mit "Pl. die Herrschaften" daneben.
    const istFortsetzung = letztes &&
      ((links && rechts && linksEingerueckt && rechtsEingerueckt) ||
       (links && !rechts && linksEingerueckt) ||
       (rechts && !links && rechtsEingerueckt));

    if (istFortsetzung) {
      if (links) letztes.quelle += ` ${links}`;
      if (rechts) letztes.ziel += ` ${rechts}`;
      continue;
    }

    if (links && rechts) {
      letztes = { quelle: links, ziel: rechts, sicher: true };
      paare.push(letztes);
      continue;
    }

    // Nur eine Seite belegt und nicht eingerueckt: eine Ueberschrift wie
    // "Ingresso" oder "Lezione 1". Nicht wegwerfen - der Nutzer soll sehen,
    // dass da etwas stand -, aber auch nicht an die Vokabel davor haengen.
    unklar.push({ quelle: links || rechts, ziel: "", grund: "keine Übersetzung daneben" });
    letztes = null;
  }
  return { paare, unklar };
}

/**
 * Ordnet jedes Wort der rechten Spalte GENAU EINER Reihe zu - der naechsten.
 *
 * Der erste Anlauf nahm alle Woerter, deren Mitte "innerhalb der Reihe plus
 * etwas Luft" lag. Das kann ein Wort mehreren Reihen zuschlagen, und die
 * Trefferquote der Buchseite fiel von 94 auf 80 Prozent: Aus "grazie | danke"
 * wurde "grazie | Angenehm!; danke das Vergnügen", weil die Nachbarzeile
 * hineinlief. Die naechste Reihe zu suchen ist eindeutig und kann nichts
 * doppelt vergeben.
 */
function verteileAufReihen(woerter, reihen) {
  const eimer = reihen.map(() => []);
  const mitten = reihen.map((r) => (r.y0 + r.y1) / 2);
  for (const w of woerter) {
    const mitte = (w.bbox.y0 + w.bbox.y1) / 2;
    let beste = 0, kleinster = Infinity;
    reihen.forEach((r, i) => {
      const abstand = mitte < r.y0 ? r.y0 - mitte : mitte > r.y1 ? mitte - r.y1 : 0;
      const gleichstand = abstand === kleinster && Math.abs(mitte - mitten[i]) < Math.abs(mitte - mitten[beste]);
      if (abstand < kleinster || gleichstand) { kleinster = abstand; beste = i; }
    });
    // Weit ausserhalb jeder Reihe ist kein Zellinhalt, sondern Rand.
    const hoehe = reihen[beste].y1 - reihen[beste].y0;
    if (kleinster <= Math.max(8, hoehe * 0.6)) eimer[beste].push(w);
  }
  return eimer;
}

/**
 * Wirft aus einer Zellenhaelfte die Woerter, die keine sein koennen.
 *
 * GEMESSEN an der Buchseite: Am rechten Rand hinterlaesst die aufgeschlagene
 * Nachbarseite Schattenreste, die Tesseract als winzige Woerter liest -
 * "die Familie e>;", "neu A", "danke s". Echte Schlusswoerter der Zeile lagen
 * bei Konfidenz 74 bis 97, jeder dieser Reste bei 0 bis 83, und alle waren
 * ein bis drei Zeichen lang.
 */
function brauchbareWorte(woerter, gehoertDazu) {
  const roh = (woerter || []).filter(gehoertDazu).filter((w) => {
    const text = w.text.trim();
    const konf = w.conf ?? 100;
    if (!text || !/\p{L}/u.test(text)) return false;      // Striche, Ziffern, Zeichen
    // Kurz UND unsicher heisst Muell. Kurz allein nicht: "e", "a" und "di"
    // sind echte Vokabeln. Unsicher allein auch nicht - das war ein Fehlgriff:
    // Woerter mit Apostroph bekommen im italienischen Modell niedrige Werte,
    // obwohl sie richtig gelesen sind ("l'ingresso" 29, "l'appartamento" 38).
    return !(text.length <= 3 && konf < 40);
  }).sort((a, b) => a.bbox.x0 - b.bbox.x0);
  if (roh.length <= 1) return roh;
  // Ein einzelner Buchstabe am ENDE einer sonst gefuellten Zelle ist ein Rest
  // der Nachbarseite ("neu A", "danke s"), keine Vokabel.
  return roh.filter((w, i) =>
    !(i === roh.length - 1 && w.text.trim().length === 1 && (w.conf ?? 100) < 90));
}

/**
 * Wo faengt eine Spalte an?
 *
 * Bewusst nicht das Minimum: Randmarken stehen weiter links, umbrochene
 * Zeilen weiter rechts. Beides sind Ausreisser, und das Minimum faellt auf den
 * ersten herein - dann gilt jede Ueberschrift als eingerueckt und wird an die
 * Vokabel davor gehaengt.
 */
function spaltenRand(zellen) {
  const anfaenge = zellen.filter((w) => w.length).map((w) => w[0].bbox.x0).sort((a, b) => a - b);
  if (!anfaenge.length) return 0;
  return anfaenge[Math.floor(anfaenge.length * 0.3)];
}

// --- Einstieg -------------------------------------------------------------
/**
 * @param durchlaeufe { quelle: [{text, conf, bbox, woerter}], ziel: [...] }
 * @param paar        { quelle: "rus", ziel: "deu" }
 * @param bildBreite  Breite des erkannten Bildes, fuer die Spaltensuche
 */
export function zuPaaren(durchlaeufe, paar, bildBreite = 0) {
  // Zuerst pruefen, ob die Vorlage zweispaltig ist. Das ist die einzige
  // Anordnung, bei der die Sprache je Seite feststeht statt geraten zu werden -
  // wenn sie vorliegt, ist sie allen anderen Verfahren ueberlegen.
  //
  // Das laeuft bewusst VOR dem Verschmelzen der beiden Durchlaeufe: Wenn
  // Tesseract die Spalten als getrennte Zeilen liefert, wuerde das Verschmelzen
  // die linke italienische Zeile mit der rechten deutschen zusammenwerfen - und
  // danach waere nicht mehr erkennbar, was wohin gehoert.
  const breite = bildBreite
    || Math.max(0, ...(durchlaeufe.quelle || []).map((z) => z.bbox.x1)) + 40;

  // Steht die Spaltengrenze schon fest, wird nicht neu gesucht. Das ist der
  // Fall, wenn jede Spalte einzeln gelesen wurde: Dann enthaelt der
  // Quell-Durchlauf nur noch die linke und der Ziel-Durchlauf nur noch die
  // rechte Seite, und eine erneute Suche faende gar keine zwei Spalten mehr.
  const aufteilung = durchlaeufe.grenze
    ? { ok: true, grenze: durchlaeufe.grenze,
        reihen: zuReihen(durchlaeufe.quelle),
        reihenAnzahl: zuReihen(durchlaeufe.quelle).length,
        beidseitigAnteil: null, vorgegeben: true }
    : (spaltenAufteilung(durchlaeufe.quelle, breite) || { ok: false });

  if (aufteilung.ok) {
    return {
      ...paareNachSpalten(aufteilung.reihen, durchlaeufe.ziel, aufteilung.grenze),
      verfahren: "spalten", grenze: aufteilung.grenze, messung: aufteilung,
    };
  }

  const zeilen = bestimmeSprache(verschmelze(durchlaeufe.quelle, durchlaeufe.ziel));
  const gleicheSchrift = schriftDerSprache(paar.quelle) === schriftDerSprache(paar.ziel);
  const ergebnis = gleicheSchrift ? paareNachAbstand(zeilen) : paareNachReihenfolge(zeilen);
  return { ...ergebnis, verfahren: gleicheSchrift ? "abstand" : "reihenfolge",
    zeilen, messung: aufteilung };
}
