// Oberflaechensteuerung. Haelt die vier Bildschirme, den Ablauf einer Runde
// und den Bestaetigungsbildschirm nach dem Foto zusammen.
//
// Die Rechenarbeit steckt woanders: lernen.js (Intervalle, Runden),
// paare.js (Foto zu Vokabelpaaren), speicher.js (Bestand), erkennung.js
// (Tesseract). Hier steht nur, was der Nutzer sieht und antippt.

import * as speicher from "./speicher.js";
import * as lernen from "./lernen.js";
import { SPRACHEN, nameVon, paarName, sprich } from "./sprachen.js";
import { zuPaaren } from "./paare.js";

const el = (id) => document.getElementById(id);
const alle = (w) => [...document.querySelectorAll(w)];

const S = {
  schirm: "start",
  runde: [],
  stelle: 0,
  aufgedeckt: false,
  wiederholt: new Set(),
  richtigInRunde: 0,
  frei: false,          // freies Ueben: veraendert den Merkstand nicht
  vorschlaege: [],      // was der Bestaetigungsbildschirm gerade zeigt
};

// --- Kurzmeldungen --------------------------------------------------------
let meldungsUhr = null;
function melde(text, dauer = 2600) {
  const kasten = el("meldung");
  kasten.textContent = text;
  kasten.hidden = false;
  clearTimeout(meldungsUhr);
  meldungsUhr = setTimeout(() => { kasten.hidden = true; }, dauer);
}

// --- Bildschirmwechsel ----------------------------------------------------
function zeige(name) {
  S.schirm = name;
  alle(".schirm").forEach((s) => { s.hidden = s.dataset.schirm !== name; });
  alle("#fussleiste button").forEach((b) => b.classList.toggle("aktiv", b.dataset.ziel === name));
  document.body.classList.toggle("abfrageLaeuft", name === "abfrage");
  el("schirme").scrollTop = 0;

  if (name === "start") zeichneStart();
  if (name === "vokabeln") zeichneVokabeln();
}

// --- Startbildschirm ------------------------------------------------------
function zeichneStart() {
  const zustand = speicher.hole();
  const s = lernen.statistik(zustand);

  el("serie").textContent = s.serie > 0
    ? `${s.serie} ${s.serie === 1 ? "Tag" : "Tage"} in Folge gelernt`
    : "Noch keine Serie – heute ist ein guter Tag dafür.";

  el("startZahlen").innerHTML = [
    ["fällig heute", s.faelligHeute],
    ["neu", s.neu],
    ["Vokabeln", s.vokabeln],
  ].map(([b, w]) => `<div class="zahlKachel"><b>${w}</b><span>${b}</span></div>`).join("");

  const offen = lernen.offeneAnzahl(zustand.karten);
  const groesse = zustand.einstellungen.rundenGroesse;

  el("btnLosgehts").disabled = offen === 0;
  el("btnFreiUeben").hidden = !(offen === 0 && zustand.karten.length > 0);

  if (zustand.karten.length === 0) {
    el("startHinweis").textContent = "Noch keine Vokabeln. Leg über „Hinzufügen“ los.";
  } else if (offen === 0) {
    el("startHinweis").textContent = "Alles erledigt für heute. Die nächsten Karten kommen automatisch.";
  } else {
    el("startHinweis").textContent = `${Math.min(offen, groesse)} Karten in dieser Runde` +
      (offen > groesse ? `, ${offen} insgesamt offen` : "");
  }

  zeigeSicherungsWarnung(zustand);
}

function zeigeSicherungsWarnung(zustand) {
  const kasten = el("sicherungsWarnung");
  const letzte = zustand.einstellungen.letzteSicherung;
  const vokabeln = zustand.vokabeln.length;

  // Erst ab einem Bestand, um den es schade waere. Bei drei Vokabeln waere die
  // Warnung nur Laerm.
  if (vokabeln < 20) { kasten.hidden = true; return; }

  const tage = letzte ? lernen.tageZwischen(letzte, lernen.heute()) : Infinity;
  if (tage < 28) { kasten.hidden = true; return; }

  kasten.hidden = false;
  kasten.textContent = letzte
    ? `Letzte Sicherung vor ${tage} Tagen. Deine ${vokabeln} Vokabeln liegen nur auf diesem iPhone – unter „Vokabeln → Einstellungen“ sicherst du sie in die Dateien-App.`
    : `Deine ${vokabeln} Vokabeln liegen nur auf diesem iPhone und sind noch nie gesichert worden. Unter „Vokabeln → Einstellungen“ legst du eine Sicherung in der Dateien-App an.`;
}

// --- Runde ----------------------------------------------------------------
function starteRunde({ frei = false } = {}) {
  const zustand = speicher.hole();
  S.frei = frei;
  S.wiederholt = new Set();
  S.stelle = 0;
  S.richtigInRunde = 0;

  if (frei) {
    // Freies Ueben nimmt einen zufaelligen Querschnitt und laesst den
    // Merkstand in Ruhe - sonst wuerde Ueben den Kalender durcheinanderbringen.
    S.runde = [...zustand.karten].sort(() => Math.random() - 0.5)
      .slice(0, zustand.einstellungen.rundenGroesse);
  } else {
    S.runde = lernen.stelleRundeZusammen(zustand.karten,
      { anzahl: zustand.einstellungen.rundenGroesse });
  }

  if (!S.runde.length) { melde("Nichts zu üben."); return; }
  zeige("abfrage");
  zeigeKarte();
}

function vokabelZu(karte) {
  return speicher.hole().vokabeln.find((v) => v.id === karte.vokabelId);
}

function paarZu(vokabel) {
  return speicher.hole().sprachpaare.find((p) => p.id === vokabel.paarId)
    || { quelle: "deu", ziel: "deu" };
}

function zeigeKarte() {
  const karte = S.runde[S.stelle];
  if (!karte) return zeigeRundenEnde();

  const vokabel = vokabelZu(karte);
  if (!vokabel) { S.stelle++; return zeigeKarte(); }
  const paar = paarZu(vokabel);

  // "hin" = Quellsprache zeigen, Uebersetzung abrufen.
  // "rueck" = umgekehrt. Beide sind eigene Karten mit eigenem Merkstand.
  const hin = karte.richtung === "hin";
  const frageText = hin ? vokabel.quelle : vokabel.ziel;
  const frageSprache = hin ? paar.quelle : paar.ziel;

  S.aufgedeckt = false;
  el("richtungHinweis").textContent =
    `${nameVon(frageSprache)} → ${nameVon(hin ? paar.ziel : paar.quelle)}`;
  el("frage").textContent = frageText;
  el("antwort").textContent = hin ? vokabel.ziel : vokabel.quelle;
  el("antwort").hidden = true;
  el("trenner").hidden = true;
  el("tippHinweis").hidden = false;
  el("bewertung").hidden = true;
  el("rundeFertig").hidden = true;
  el("karte").hidden = false;

  // Vorgelesen wird IMMER das fremdsprachige Wort, nie die Muttersprache -
  // also das der Sprache, die beim Anlegen links stand ("Sprache der
  // Vokabel"). Die deutsche Seite vorzulesen bringt beim Lernen nichts.
  //
  // Bei "rueck" ist dieses Wort aber die gesuchte Antwort. Der Knopf
  // erscheint deshalb erst nach dem Aufdecken - sonst waere Vorlesen ein
  // Weg, sich die Loesung vorsagen zu lassen, ohne sie zu wissen.
  const knopf = el("btnSprich");
  knopf.dataset.text = vokabel.quelle;
  knopf.dataset.sprache = paar.quelle;
  knopf.hidden = !window.speechSynthesis || !hin;
  // Der Knopf wandert zu dem Wort, das er vorliest.
  el("karte").insertBefore(knopf, hin ? el("trenner") : el("tippHinweis"));

  el("abfrageZaehler").textContent = `${S.stelle + 1}/${S.runde.length}`;
  el("fortschrittBalken").style.width = `${(S.stelle / S.runde.length) * 100}%`;
}

function deckeAuf() {
  if (S.aufgedeckt) return;
  S.aufgedeckt = true;
  el("antwort").hidden = false;
  el("trenner").hidden = false;
  el("tippHinweis").hidden = true;
  el("bewertung").hidden = false;
  // Bei Muttersprache -> Fremdsprache steht das vorlesbare Wort erst jetzt da.
  if (window.speechSynthesis) el("btnSprich").hidden = false;
}

async function bewerte(gewusst) {
  if (!S.aufgedeckt) return;
  const karte = S.runde[S.stelle];
  if (gewusst) S.richtigInRunde++;

  if (!S.frei) {
    // Nach JEDER Karte schreiben, nicht erst am Rundenende: Wer zwischendurch
    // die App wegwischt oder einen Anruf bekommt, soll bereits beantwortete
    // Karten nicht noch einmal vorgelegt bekommen.
    await speicher.aendere((z) => {
      const i = z.karten.findIndex((k) => k.id === karte.id);
      if (i >= 0) z.karten[i] = lernen.bewerte(z.karten[i], gewusst);
      return z;
    });
  }

  // Falsch beantwortete Karten kommen ans Ende der Runde - genau einmal.
  if (!gewusst) S.runde = lernen.haengeAn(S.runde, karte, S.wiederholt);

  S.stelle++;
  zeigeKarte();
}

function zeigeRundenEnde() {
  el("karte").hidden = true;
  el("bewertung").hidden = true;
  el("rundeFertig").hidden = false;
  el("fortschrittBalken").style.width = "100%";
  el("abfrageZaehler").textContent = "";

  const gestellt = S.runde.length;
  el("fertigZahl").textContent = `${S.richtigInRunde} von ${gestellt}`;

  const offen = S.frei ? 0 : lernen.offeneAnzahl(speicher.hole().karten);
  el("fertigText").textContent = S.frei
    ? "Freies Üben – der Merkstand bleibt unverändert."
    : offen > 0 ? `Noch ${offen} ${offen === 1 ? "Karte ist" : "Karten sind"} offen.`
      : "Alles erledigt für heute.";
  el("btnWeitereRunde").hidden = offen === 0;
}

// --- Sprachpaare ----------------------------------------------------------
function fuelleSprachwahl() {
  const bauen = () => SPRACHEN.map((s) => `<option value="${s.kuerzel}">${s.name}</option>`).join("");
  el("waehlQuelle").innerHTML = bauen();
  el("waehlZiel").innerHTML = bauen();

  const letztes = speicher.hole().einstellungen.letztesPaar;
  el("waehlQuelle").value = letztes?.quelle || "rus";
  el("waehlZiel").value = letztes?.ziel || "deu";
}

function gewaehltesPaar() {
  return { quelle: el("waehlQuelle").value, ziel: el("waehlZiel").value };
}

/** Sucht das Sprachpaar im Bestand oder legt es an. */
async function holePaarId(paar) {
  const id = `${paar.quelle}-${paar.ziel}`;
  await speicher.aendere((z) => {
    if (!z.sprachpaare.some((p) => p.id === id)) {
      z.sprachpaare.push({ id, quelle: paar.quelle, ziel: paar.ziel, name: paarName(paar) });
    }
    z.einstellungen.letztesPaar = paar;
    return z;
  });
  return id;
}

// --- Foto verarbeiten -----------------------------------------------------
async function verarbeiteFoto(datei) {
  const paar = gewaehltesPaar();
  if (paar.quelle === paar.ziel) { melde("Bitte zwei verschiedene Sprachen wählen."); return; }

  el("aufnahmeBereich").hidden = true;
  el("pruefBereich").hidden = true;
  el("arbeitBereich").hidden = false;
  el("arbeitText").textContent = "Bild wird vorbereitet …";

  try {
    const { erkenne } = await import("./erkennung.js");
    const durchlaeufe = await erkenne(datei, paar, (t) => { el("arbeitText").textContent = t; });
    const { paare, unklar } = zuPaaren(durchlaeufe, paar);

    S.vorschlaege = [
      ...paare.map((p) => ({ ...p, uebernehmen: true })),
      // Unklares kommt mit, aber abgewaehlt: Es soll sichtbar sein, dass da
      // etwas war, ohne dass es ungeprueft in den Stapel rutscht.
      ...unklar.map((u) => ({ quelle: u.quelle, ziel: "", sicher: false, uebernehmen: false })),
    ];

    if (!S.vorschlaege.length) {
      melde("Auf dem Bild waren keine Vokabelpaare zu erkennen.", 4000);
      el("arbeitBereich").hidden = true;
      el("aufnahmeBereich").hidden = false;
      return;
    }
    zeichnePruefung(paar);
  } catch (fehler) {
    console.error(fehler);
    melde(`Erkennung fehlgeschlagen: ${fehler.message}`, 5000);
    el("arbeitBereich").hidden = true;
    el("aufnahmeBereich").hidden = false;
  }
}

// --- Bestaetigungsbildschirm ---------------------------------------------
/**
 * Die Stelle, an der jede Fehlerkennung abgefangen wird, bevor sie sich
 * dauerhaft einnistet. Deshalb ist hier alles aenderbar: Text, Richtung,
 * Auswahl - und Zeilen lassen sich ergaenzen.
 */
function zeichnePruefung(paar) {
  el("arbeitBereich").hidden = true;
  el("pruefBereich").hidden = false;

  const bekannt = new Set(speicher.hole().vokabeln
    .filter((v) => v.paarId === `${paar.quelle}-${paar.ziel}`)
    .map((v) => `${v.quelle} ${v.ziel}`));

  const unsicher = S.vorschlaege.filter((v) => !v.sicher).length;
  el("pruefKopf").textContent =
    `${S.vorschlaege.length} gefunden` +
    (unsicher ? ` · ${unsicher} unsicher, bitte prüfen` : "") +
    ` · ${nameVon(paar.quelle)} → ${nameVon(paar.ziel)}`;

  el("pruefListe").innerHTML = S.vorschlaege.map((v, i) => {
    const doppelt = bekannt.has(`${v.quelle} ${v.ziel}`);
    if (doppelt) v.uebernehmen = false;
    return `
      <div class="pruefZeile ${v.sicher ? "" : "unsicher"} ${doppelt ? "doppelt" : ""}" data-i="${i}">
        <input type="checkbox" ${v.uebernehmen ? "checked" : ""} data-feld="uebernehmen">
        <div class="pruefFelder">
          <input class="quelle" data-feld="quelle" value="${schuetze(v.quelle)}"
                 placeholder="${nameVon(paar.quelle)}" autocapitalize="off" autocorrect="off">
          <input class="ziel" data-feld="ziel" value="${schuetze(v.ziel)}"
                 placeholder="${nameVon(paar.ziel)}" autocapitalize="off" autocorrect="off">
        </div>
        ${doppelt ? '<span class="marke">kennst du</span>' : ""}
        <button class="zeilenKnopf" data-tun="tauschen" aria-label="Vertauschen">⇅</button>
        <button class="zeilenKnopf" data-tun="loeschen" aria-label="Löschen">✕</button>
      </div>`;
  }).join("");
}

function schuetze(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Liest die (moeglicherweise von Hand geaenderten) Felder zurueck. */
function lesePruefung() {
  return alle("#pruefListe .pruefZeile").map((zeile) => ({
    quelle: zeile.querySelector('[data-feld="quelle"]').value.trim(),
    ziel: zeile.querySelector('[data-feld="ziel"]').value.trim(),
    uebernehmen: zeile.querySelector('[data-feld="uebernehmen"]').checked,
    sicher: !zeile.classList.contains("unsicher"),
  }));
}

async function uebernimmVorschlaege() {
  const paar = gewaehltesPaar();
  const zeilen = lesePruefung().filter((z) => z.uebernehmen && z.quelle && z.ziel);
  if (!zeilen.length) { melde("Nichts ausgewählt."); return; }

  const paarId = await holePaarId(paar);

  await speicher.aendere((z) => {
    const bekannt = new Set(z.vokabeln.filter((v) => v.paarId === paarId)
      .map((v) => `${v.quelle} ${v.ziel}`));
    for (const zeile of zeilen) {
      if (bekannt.has(`${zeile.quelle} ${zeile.ziel}`)) continue;
      bekannt.add(`${zeile.quelle} ${zeile.ziel}`);
      const id = kennung();
      z.vokabeln.push({ id, paarId, quelle: zeile.quelle, ziel: zeile.ziel, angelegt: lernen.heute() });
      // Zwei Karten je Vokabel - beide Richtungen mit eigenem Merkstand.
      z.karten.push(lernen.neueKarte(kennung(), id, "hin"));
      z.karten.push(lernen.neueKarte(kennung(), id, "rueck"));
    }
    return z;
  });

  melde(`${zeilen.length} ${zeilen.length === 1 ? "Vokabel" : "Vokabeln"} übernommen.`);
  setzeHinzufuegenZurueck();
  zeige("start");
}

function setzeHinzufuegenZurueck() {
  S.vorschlaege = [];
  el("pruefBereich").hidden = true;
  el("arbeitBereich").hidden = true;
  el("aufnahmeBereich").hidden = false;
  el("dateiWahl").value = "";
}

function kennung() {
  return (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

// --- Vokabelliste ---------------------------------------------------------
function zeichneVokabeln() {
  const zustand = speicher.hole();
  const suchtext = el("suche").value.trim().toLowerCase();

  const gefiltert = zustand.vokabeln.filter((v) =>
    !suchtext || v.quelle.toLowerCase().includes(suchtext) || v.ziel.toLowerCase().includes(suchtext));

  el("listenKopf").textContent = suchtext
    ? `${gefiltert.length} von ${zustand.vokabeln.length}`
    : `${zustand.vokabeln.length} Vokabeln · ${zustand.karten.length} Karten`;

  el("vokabelListe").innerHTML = gefiltert.length
    ? gefiltert.slice().reverse().map((v) => {
        const karten = zustand.karten.filter((k) => k.vokabelId === v.id);
        const stufe = Math.min(...karten.map((k) => k.stufe), lernen.INTERVALLE.length);
        const ruht = karten.length > 0 && karten.every((k) => k.ruht);
        const punkte = lernen.INTERVALLE.map((_, i) =>
          `<i class="punkt ${ruht ? "ruht" : i < stufe ? "voll" : ""}"></i>`).join("");
        return `
          <div class="vokabelZeile" data-id="${v.id}">
            <div class="vokabelText"><b>${schuetze(v.quelle)}</b><span>${schuetze(v.ziel)}</span></div>
            <div class="stufenPunkte" title="Merkstand">${punkte}</div>
            <button class="zeilenKnopf" data-tun="bearbeiten" aria-label="Bearbeiten">✎</button>
            <button class="zeilenKnopf" data-tun="entfernen" aria-label="Löschen">✕</button>
          </div>`;
      }).join("")
    : `<p class="hinweis">${suchtext ? "Nichts gefunden." : "Noch keine Vokabeln."}</p>`;

  el("waehlRunde").value = String(zustand.einstellungen.rundenGroesse);
  zeichneFortschritt(zustand);
  zeichneSicherungsStand(zustand);
}

function zeichneFortschritt(zustand) {
  const s = lernen.statistik(zustand);

  // Leerer Bestand: Balken auf null waeren als erstes Element des Bildschirms
  // nur entmutigend und sagen nichts.
  if (!s.karten) {
    el("fortschrittZahlen").innerHTML =
      `<p class="hinweis">Noch keine Vokabeln. Über „Hinzufügen“ kommt die erste herein.</p>`;
    return;
  }

  const hoechster = Math.max(1, ...s.proStufe);
  el("fortschrittZahlen").innerHTML = `
    <p class="label">Fortschritt</p>
    <p class="hinweis">${s.inArbeit} in Arbeit · ${s.neu} noch nie abgefragt · ${s.ruhend} im Ruhestand</p>
    <div class="stufenBalken">
      ${s.proStufe.map((n) => `<div style="height:${(n / hoechster) * 100}%"><span>${n}</span></div>`).join("")}
    </div>
    <div class="stufenBeschriftung">
      ${lernen.INTERVALLE.map((t) => `<span>${t} T.</span>`).join("")}
    </div>`;
}

function zeichneSicherungsStand(zustand) {
  const letzte = zustand.einstellungen.letzteSicherung;
  el("sicherungsStand").textContent = letzte
    ? `Zuletzt gesichert: ${letzte} (vor ${lernen.tageZwischen(letzte, lernen.heute())} Tagen)`
    : "Noch nie gesichert. Die Vokabeln liegen nur auf diesem iPhone.";
}

/**
 * Bearbeiten geschieht an Ort und Stelle in der Liste.
 *
 * Der erste Entwurf benutzte zwei prompt()-Dialoge hintereinander. Auf einem
 * Telefon ist das zaeh: zwei Systemfenster, zweimal Tastatur auf und zu, und
 * man sieht die Vokabel nicht mehr, waehrend man sie korrigiert. Genau dieser
 * Ablauf faellt aber oft an - er faengt jede Fehlerkennung ab.
 */
function bearbeiteVokabel(id) {
  const zeile = document.querySelector(`.vokabelZeile[data-id="${id}"]`);
  const v = speicher.hole().vokabeln.find((x) => x.id === id);
  if (!zeile || !v || zeile.classList.contains("wirdBearbeitet")) return;
  const paar = paarZu(v);

  zeile.classList.add("wirdBearbeitet");
  zeile.innerHTML = `
    <div class="pruefFelder">
      <input class="quelle" value="${schuetze(v.quelle)}" placeholder="${nameVon(paar.quelle)}"
             autocapitalize="off" autocorrect="off" spellcheck="false">
      <input class="ziel" value="${schuetze(v.ziel)}" placeholder="${nameVon(paar.ziel)}"
             autocapitalize="off" autocorrect="off" spellcheck="false">
    </div>
    <button class="zeilenKnopf" data-tun="abbrechen" aria-label="Verwerfen">✕</button>
    <button class="zeilenKnopf" data-tun="speichern" aria-label="Sichern">✓</button>`;

  const feld = zeile.querySelector(".quelle");
  feld.focus();
  feld.setSelectionRange(feld.value.length, feld.value.length);
}

async function speichereBearbeitung(id, zeile) {
  const quelle = zeile.querySelector(".quelle").value.trim();
  const ziel = zeile.querySelector(".ziel").value.trim();
  if (!quelle || !ziel) { melde("Beide Felder müssen gefüllt sein."); return; }

  await speicher.aendere((z) => {
    const treffer = z.vokabeln.find((x) => x.id === id);
    if (treffer) { treffer.quelle = quelle; treffer.ziel = ziel; }
    return z;
  });
  // Der Merkstand bleibt absichtlich stehen: Eine korrigierte Schreibweise ist
  // dieselbe Vokabel, und der Lernfortschritt daran ist echt.
  melde("Geändert.");
  zeichneVokabeln();
}

async function entferneVokabel(id) {
  const v = speicher.hole().vokabeln.find((x) => x.id === id);
  if (!v || !confirm(`„${v.quelle} – ${v.ziel}“ endgültig löschen?`)) return;
  await speicher.aendere((z) => {
    z.vokabeln = z.vokabeln.filter((x) => x.id !== id);
    z.karten = z.karten.filter((k) => k.vokabelId !== id);
    return z;
  });
  melde("Gelöscht.");
  zeichneVokabeln();
}

/**
 * Von Hand angelegte Vokabeln laufen ueber denselben Bestaetigungsbildschirm
 * wie die aus dem Foto - nur eben mit leeren Feldern. Ein eigener Dialog waere
 * eine zweite Oberflaeche fuer dieselbe Sache, mit eigenen Fehlern.
 */
function vonHandAnlegen() {
  const paar = gewaehltesPaar();
  if (paar.quelle === paar.ziel) { melde("Bitte zwei verschiedene Sprachen wählen."); return; }
  S.vorschlaege = [{ quelle: "", ziel: "", sicher: true, uebernehmen: true }];
  zeichnePruefung(paar);
  el("pruefListe").querySelector(".quelle")?.focus();
}

// --- Sichern und Wiederherstellen ----------------------------------------
/**
 * iOS erlaubt einer Web-App kein stilles Schreiben in die Dateien-App. Der
 * Weg fuehrt ueber das Teilen-Blatt ("In Dateien sichern") oder, wo das nicht
 * geht, ueber einen normalen Download.
 */
async function sichern() {
  const text = speicher.alsText();
  const name = speicher.dateiname();
  const datei = new File([text], name, { type: "application/json" });

  try {
    if (navigator.canShare?.({ files: [datei] })) {
      await navigator.share({ files: [datei], title: "Vokabeln sichern" });
    } else {
      const url = URL.createObjectURL(datei);
      const a = document.createElement("a");
      a.href = url; a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (fehler) {
    if (fehler.name === "AbortError") return;   // Nutzer hat abgebrochen
    melde(`Sichern fehlgeschlagen: ${fehler.message}`, 4000);
    return;
  }

  await speicher.aendere((z) => { z.einstellungen.letzteSicherung = lernen.heute(); return z; });
  melde("Gesichert.");
  zeichneVokabeln();
}

async function wiederherstellen(datei) {
  let gelesen;
  try {
    gelesen = JSON.parse(await datei.text());
  } catch {
    melde("Die Datei lässt sich nicht lesen.", 4000);
    return;
  }

  const fehler = speicher.pruefeSicherung(gelesen);
  if (fehler) { melde(fehler, 5000); return; }

  const eigene = speicher.hole().vokabeln.length;
  const fremde = gelesen.vokabeln.length;

  // Zusammenfuehren ist die sichere Vorgabe; Ersetzen muss man ausdruecklich
  // wollen, weil es den aktuellen Bestand verwirft.
  const ersetzen = eigene > 0 && !confirm(
    `Die Sicherung enthält ${fremde} Vokabeln, hier liegen ${eigene}.\n\n` +
    `OK: zusammenführen (der weiter fortgeschrittene Merkstand gewinnt)\n` +
    `Abbrechen: den hiesigen Bestand ersetzen`);

  if (ersetzen && !confirm(`Wirklich alle ${eigene} Vokabeln hier durch die Sicherung ersetzen?`)) return;

  await speicher.aendere((z) => ersetzen
    ? { ...gelesen, einstellungen: { ...z.einstellungen, ...gelesen.einstellungen } }
    : speicher.fuehreZusammen(z, gelesen));

  melde(ersetzen ? "Bestand ersetzt." : "Zusammengeführt.");
  zeichneVokabeln();
}

// --- Ereignisse -----------------------------------------------------------
function verdrahte() {
  alle("#fussleiste button").forEach((b) =>
    b.addEventListener("click", () => zeige(b.dataset.ziel)));

  el("btnLosgehts").addEventListener("click", () => starteRunde());
  el("btnFreiUeben").addEventListener("click", () => starteRunde({ frei: true }));
  el("btnWeitereRunde").addEventListener("click", () => starteRunde({ frei: S.frei }));
  el("btnZurueckZumStart").addEventListener("click", () => zeige("start"));
  el("btnAbbrechen").addEventListener("click", () => zeige("start"));

  el("karte").addEventListener("click", deckeAuf);
  el("btnRichtig").addEventListener("click", () => bewerte(true));
  el("btnFalsch").addEventListener("click", () => bewerte(false));

  el("btnSprich").addEventListener("click", (e) => {
    e.stopPropagation();   // sonst deckt der Lautsprecher die Antwort mit auf
    sprich(e.currentTarget.dataset.text, e.currentTarget.dataset.sprache);
  });

  el("btnFotoWaehlen").addEventListener("click", () => el("dateiWahl").click());
  el("dateiWahl").addEventListener("change", (e) => {
    if (e.target.files?.[0]) verarbeiteFoto(e.target.files[0]);
  });
  el("btnVonHand").addEventListener("click", vonHandAnlegen);
  el("btnPaarTauschen").addEventListener("click", () => {
    const q = el("waehlQuelle").value;
    el("waehlQuelle").value = el("waehlZiel").value;
    el("waehlZiel").value = q;
  });

  el("btnUebernehmen").addEventListener("click", uebernimmVorschlaege);
  el("btnPruefAbbrechen").addEventListener("click", setzeHinzufuegenZurueck);
  el("btnZeileDazu").addEventListener("click", () => {
    S.vorschlaege = [...lesePruefung(), { quelle: "", ziel: "", sicher: true, uebernehmen: true }];
    zeichnePruefung(gewaehltesPaar());
    el("pruefListe").lastElementChild?.querySelector(".quelle")?.focus();
  });

  el("pruefListe").addEventListener("click", (e) => {
    const knopf = e.target.closest("[data-tun]");
    if (!knopf) return;
    const zeile = knopf.closest(".pruefZeile");
    if (knopf.dataset.tun === "loeschen") {
      S.vorschlaege = lesePruefung().filter((_, i) => i !== Number(zeile.dataset.i));
      zeichnePruefung(gewaehltesPaar());
    } else if (knopf.dataset.tun === "tauschen") {
      const q = zeile.querySelector('[data-feld="quelle"]');
      const z = zeile.querySelector('[data-feld="ziel"]');
      [q.value, z.value] = [z.value, q.value];
    }
  });

  el("suche").addEventListener("input", zeichneVokabeln);
  el("waehlRunde").addEventListener("change", async (e) => {
    await speicher.aendere((z) => {
      z.einstellungen.rundenGroesse = Number(e.target.value);
      return z;
    });
    melde(`${e.target.value} Vokabeln je Runde.`);
  });

  el("vokabelListe").addEventListener("click", (e) => {
    const knopf = e.target.closest("[data-tun]");
    if (!knopf) return;
    const zeile = knopf.closest(".vokabelZeile");
    const id = zeile.dataset.id;
    if (knopf.dataset.tun === "bearbeiten") bearbeiteVokabel(id);
    if (knopf.dataset.tun === "entfernen") entferneVokabel(id);
    if (knopf.dataset.tun === "speichern") speichereBearbeitung(id, zeile);
    if (knopf.dataset.tun === "abbrechen") zeichneVokabeln();
  });

  // Eingabetaste sichert, Escape verwirft - damit man die Tastatur nicht
  // schliessen muss, um einen Knopf zu treffen.
  el("vokabelListe").addEventListener("keydown", (e) => {
    const zeile = e.target.closest(".wirdBearbeitet");
    if (!zeile) return;
    if (e.key === "Enter") { e.preventDefault(); speichereBearbeitung(zeile.dataset.id, zeile); }
    if (e.key === "Escape") zeichneVokabeln();
  });

  el("btnSichern").addEventListener("click", sichern);
  el("btnWiederherstellen").addEventListener("click", () => el("sicherungsWahl").click());
  el("sicherungsWahl").addEventListener("change", (e) => {
    if (e.target.files?.[0]) wiederherstellen(e.target.files[0]);
    e.target.value = "";
  });
}

// --- Start ----------------------------------------------------------------
async function los() {
  await speicher.starte();
  fuelleSprachwahl();
  verdrahte();
  zeige("start");

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Ohne Service Worker laeuft alles weiter, nur eben nicht offline.
    });
  }
}

los().catch((fehler) => {
  console.error(fehler);
  document.body.innerHTML =
    `<div style="padding:40px 24px"><h1>Start fehlgeschlagen</h1><p>${fehler.message}</p></div>`;
});
