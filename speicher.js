// Persistenz im iPhone. Ein einziges JSON-Objekt in IndexedDB unter einem
// Schluessel, beim Start in den Speicher geladen, bei jeder Aenderung
// geschrieben.
//
// Warum kein Datensatz je Vokabel: Der Bestand ist auch nach Jahren nur ein
// paar hundert Kilobyte, und jede Abfrage, die die App braucht ("was ist
// faellig", "welche gibt es"), ist Filtern eines Arrays. Eine ausgebaute
// Datenbank waere hier Aufwand ohne Gegenwert - und jede Schemaaenderung ein
// Wanderungsschritt mehr.
//
// Warum IndexedDB und nicht localStorage: localStorage ist auf 5 MB begrenzt,
// schreibt synchron (die Oberflaeche stockt) und wird von iOS eher
// weggeraeumt. IndexedDB ueberlebt in einer vom Home-Bildschirm gestarteten
// App zuverlaessiger - was hier zaehlt, weil der Lernstand nirgendwo sonst
// liegt.

const DATENBANK = "vokabeltrainer";
const LAGER = "zustand";
const SCHLUESSEL = "aktuell";

export const LEERER_ZUSTAND = {
  version: 1,
  sprachpaare: [],
  vokabeln: [],
  karten: [],
  einstellungen: { rundenGroesse: 5, letzteSicherung: null, letztesPaar: null },
};

let db = null;
let zustand = null;

function oeffne() {
  return new Promise((fertig, fehler) => {
    const anfrage = indexedDB.open(DATENBANK, 1);
    anfrage.onupgradeneeded = () => {
      if (!anfrage.result.objectStoreNames.contains(LAGER)) {
        anfrage.result.createObjectStore(LAGER);
      }
    };
    anfrage.onsuccess = () => fertig(anfrage.result);
    anfrage.onerror = () => fehler(anfrage.error);
  });
}

function lies() {
  return new Promise((fertig, fehler) => {
    const a = db.transaction(LAGER, "readonly").objectStore(LAGER).get(SCHLUESSEL);
    a.onsuccess = () => fertig(a.result);
    a.onerror = () => fehler(a.error);
  });
}

function schreib(wert) {
  return new Promise((fertig, fehler) => {
    const t = db.transaction(LAGER, "readwrite");
    t.objectStore(LAGER).put(wert, SCHLUESSEL);
    t.oncomplete = () => fertig();
    t.onerror = () => fehler(t.error);
  });
}

/** Beim Start aufrufen. Laedt den Bestand oder legt einen leeren an. */
export async function starte() {
  db = await oeffne();

  // iOS raeumt "wegwerfbaren" Speicher unter Platzdruck ab. Diese Bitte macht
  // ihn dauerhaft. Sie kann abgelehnt werden - dann laeuft alles weiter, nur
  // ohne diese Zusicherung, und der Hinweis zur Sicherung wird umso wichtiger.
  if (navigator.storage && navigator.storage.persist) {
    try { await navigator.storage.persist(); } catch { /* unkritisch */ }
  }

  zustand = (await lies()) || structuredClone(LEERER_ZUSTAND);
  return zustand;
}

export function hole() {
  if (!zustand) throw new Error("starte() wurde nicht aufgerufen");
  return zustand;
}

/**
 * Aendert den Bestand und schreibt ihn weg.
 *
 * Geschrieben wird bewusst bei JEDER Bewertung, nicht erst am Rundenende:
 * Wer waehrend einer Runde die App wegwischt oder einen Anruf bekommt, soll
 * die bereits beantworteten Karten nicht noch einmal vorgelegt bekommen.
 */
export async function aendere(fn) {
  zustand = fn(zustand) || zustand;
  await schreib(zustand);
  return zustand;
}

// --- Sichern und Wiederherstellen ----------------------------------------
export function alsText() {
  return JSON.stringify({ ...zustand, gesichertAm: new Date().toISOString() }, null, 2);
}

export function dateiname() {
  return `vokabeln-${new Date().toISOString().slice(0, 10)}.json`;
}

/** Prueft eine eingelesene Datei, bevor sie den laufenden Bestand ersetzt. */
export function pruefeSicherung(obj) {
  if (!obj || typeof obj !== "object") return "Die Datei enthält keine Sicherung.";
  for (const feld of ["vokabeln", "karten", "sprachpaare"]) {
    if (!Array.isArray(obj[feld])) return `Der Datei fehlt das Feld "${feld}".`;
  }
  if (obj.version > LEERER_ZUSTAND.version) {
    return "Die Sicherung stammt aus einer neueren Fassung der App.";
  }
  return null;
}

/**
 * Fuehrt eine Sicherung mit dem laufenden Bestand zusammen.
 *
 * Bei Vokabeln, die es beidseitig gibt, gewinnt der WEITER FORTGESCHRITTENE
 * Merkstand. Andernfalls wuerde das Einlesen einer alten Sicherung wochenlange
 * Lernarbeit zurueckdrehen - und das faellt erst auf, wenn laengst gekonnte
 * Vokabeln wieder taeglich erscheinen.
 */
export function fuehreZusammen(alt, neu) {
  const ergebnis = structuredClone(alt);
  const schluessel = (v) => `${v.paarId} ${v.quelle} ${v.ziel}`;
  const vorhanden = new Map(ergebnis.vokabeln.map((v) => [schluessel(v), v]));
  const paarIds = new Set(ergebnis.sprachpaare.map((p) => p.id));

  for (const paar of neu.sprachpaare || []) {
    if (!paarIds.has(paar.id)) { ergebnis.sprachpaare.push(paar); paarIds.add(paar.id); }
  }

  for (const v of neu.vokabeln || []) {
    const treffer = vorhanden.get(schluessel(v));
    const kartenDazu = (neu.karten || []).filter((k) => k.vokabelId === v.id);

    if (!treffer) {
      ergebnis.vokabeln.push(v);
      ergebnis.karten.push(...kartenDazu);
      continue;
    }
    for (const k of kartenDazu) {
      const eigene = ergebnis.karten.find(
        (e) => e.vokabelId === treffer.id && e.richtung === k.richtung);
      if (!eigene) { ergebnis.karten.push({ ...k, vokabelId: treffer.id }); continue; }
      const weiter = (k.stufe > eigene.stufe)
        || (k.stufe === eigene.stufe && (k.faellig || "") > (eigene.faellig || ""));
      if (weiter) Object.assign(eigene, k, { id: eigene.id, vokabelId: treffer.id });
    }
  }
  return ergebnis;
}
