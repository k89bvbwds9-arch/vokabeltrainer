// Wiederholungslogik: wann kommt welche Karte wieder, und woraus besteht eine
// Runde.
//
// Alles hier ist reine Rechnung ohne Speicher und ohne Oberflaeche - dadurch
// laesst es sich gegen simulierte Kalendertage pruefen, ohne einen Browser zu
// starten und ohne zu warten.

// Die Intervallleiter in Tagen. Stufe = wie oft die Karte in Folge sass.
//   Stufe 0 --1 Tag--> 1 --3--> 2 --7--> 3 --16--> 4 --35--> 5
export const INTERVALLE = [1, 3, 7, 16, 35];

// Nach der letzten Stufe verschwindet die Karte aus dem Alltag, aber nicht aus
// dem Bestand. Vier Monate spaeter kommt sie einmal zur Kontrolle wieder.
// Der Nutzer wollte urspruenglich "einmal gekonnt, nie wieder" - dagegen habe
// ich argumentiert, und er hat die Leiter gewaehlt. Der Ruhestand ist der
// Kompromiss: im Alltag unsichtbar, aber nicht verloren.
export const RUHE_TAGE = 120;

// --- Datumsrechnung -------------------------------------------------------
// Durchgehend "JJJJ-MM-TT" als Zeichenkette. Die laesst sich direkt
// vergleichen und sortieren, und es gibt keine Zeitzonenfallen: Wer um 23:30
// lernt, soll denselben Lerntag haben wie um 00:30 - nicht plaetzlich zwei.

/** Heutiges Datum in Ortszeit als JJJJ-MM-TT. */
export function heute(jetzt = new Date()) {
  const versetzt = new Date(jetzt.getTime() - jetzt.getTimezoneOffset() * 60000);
  return versetzt.toISOString().slice(0, 10);
}

/** Tage auf ein Datum addieren. Rechnet in UTC, damit die Sommerzeit-
 *  umstellung keinen Tag verschluckt oder verdoppelt. */
export function plusTage(datum, tage) {
  const d = new Date(`${datum}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

/** Ganze Tage zwischen zwei Datumsangaben (b - a). */
export function tageZwischen(a, b) {
  return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
}

// --- Karten ---------------------------------------------------------------
/** Eine frische Karte: noch nie abgefragt, deshalb ohne Faelligkeitsdatum. */
export function neueKarte(id, vokabelId, richtung) {
  return { id, vokabelId, richtung, stufe: 0, faellig: null, zuletzt: null,
    richtig: 0, falsch: 0, ruht: false };
}

/**
 * Bewertet eine Karte und gibt eine NEUE zurueck - die alte bleibt unberuehrt.
 * Das macht die Rueckgaengig-Taste im Abfragebildschirm zu einer Zuweisung
 * statt zu einer Rueckrechnung.
 */
export function bewerte(karte, gewusst, tag = heute()) {
  if (!gewusst) {
    // Zurueck auf Anfang und morgen wieder. Nicht heute: Wer eine Vokabel
    // fuenf Minuten spaeter nochmal richtig hat, hat sein Kurzzeitgedaechtnis
    // geprueft, nicht sein Gedaechtnis.
    return { ...karte, stufe: 0, ruht: false, faellig: plusTage(tag, 1),
      zuletzt: tag, falsch: karte.falsch + 1 };
  }

  const amEnde = karte.stufe >= INTERVALLE.length;
  const tage = amEnde ? RUHE_TAGE : INTERVALLE[karte.stufe];
  return { ...karte,
    stufe: amEnde ? karte.stufe : karte.stufe + 1,
    ruht: amEnde,
    faellig: plusTage(tag, tage),
    zuletzt: tag,
    richtig: karte.richtig + 1 };
}

// --- Runde zusammenstellen ------------------------------------------------
/**
 * Reihenfolge laut Plan: erst was liegengeblieben ist, dann was heute dran
 * ist, dann Neues zum Auffuellen.
 *
 * Das Auffuellen mit Neuem ist die bewusste Abweichung vom reinen Lehrbuch-
 * verfahren. Streng nach Plan haette man an manchen Tagen null Karten und
 * nach einer Woche Urlaub vierzig - und genau daran scheitern Vokabeltrainer
 * im Alltag. Fuenf sind immer machbar.
 */
export function stelleRundeZusammen(karten, { anzahl = 5, tag = heute() } = {}) {
  const ueberfaellig = karten.filter((k) => k.faellig && k.faellig < tag)
    .sort((a, b) => a.faellig.localeCompare(b.faellig));
  const faellig = karten.filter((k) => k.faellig === tag);
  const neu = karten.filter((k) => !k.faellig);

  return [...ueberfaellig, ...faellig, ...neu].slice(0, anzahl);
}

/** Wie viele Karten waeren insgesamt dran? Fuer "Noch 35 faellig - weiter?" */
export function offeneAnzahl(karten, tag = heute()) {
  return karten.filter((k) => !k.faellig || k.faellig <= tag).length;
}

/**
 * Eine falsch beantwortete Karte kommt ans Ende der laufenden Runde - einmal.
 * Ohne dieses "einmal" koennte eine Vokabel, die heute einfach nicht sitzt,
 * die Runde endlos verlaengern; der Nutzer kaeme nie zum Schluss.
 */
export function haengeAn(runde, karte, bereitsWiederholt) {
  if (bereitsWiederholt.has(karte.id)) return runde;
  bereitsWiederholt.add(karte.id);
  return [...runde, karte];
}

// --- Zahlen fuer den Startbildschirm --------------------------------------
export function statistik(zustand, tag = heute()) {
  const karten = zustand.karten || [];
  const lerntage = [...new Set(karten.map((k) => k.zuletzt).filter(Boolean))].sort();

  // Serie: aufeinanderfolgende Lerntage bis heute oder gestern. Gestern zaehlt
  // mit, damit die Serie nicht schon vormittags als gerissen angezeigt wird,
  // bevor der heutige Durchgang ueberhaupt stattgefunden hat.
  let serie = 0;
  const letzter = lerntage[lerntage.length - 1];
  if (letzter && tageZwischen(letzter, tag) <= 1) {
    serie = 1;
    for (let i = lerntage.length - 1; i > 0; i--) {
      if (tageZwischen(lerntage[i - 1], lerntage[i]) === 1) serie++;
      else break;
    }
  }

  return {
    vokabeln: (zustand.vokabeln || []).length,
    karten: karten.length,
    faelligHeute: karten.filter((k) => k.faellig && k.faellig <= tag).length,
    neu: karten.filter((k) => !k.faellig).length,
    ruhend: karten.filter((k) => k.ruht).length,
    inArbeit: karten.filter((k) => k.faellig && !k.ruht).length,
    proStufe: INTERVALLE.map((_, i) => karten.filter((k) => k.stufe === i && k.faellig).length),
    serie,
  };
}
