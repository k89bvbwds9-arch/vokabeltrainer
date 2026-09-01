// Die unterstuetzten Sprachen.
//
// "kuerzel" ist der Tesseract-Name und zugleich der Dateiname unter
// sprachdaten/. Eine Sprache ergaenzen heisst: hier eine Zeile eintragen und
// die passende .traineddata.gz in sprachdaten/ legen - mehr nicht.
//
// "stimme" ist das BCP-47-Kuerzel fuer die Sprachausgabe des iPhones. Ohne
// dieses Kuerzel liest iOS ein russisches Wort mit deutscher Stimme vor, was
// eher schadet als nuetzt.

export const SPRACHEN = [
  { kuerzel: "deu", name: "Deutsch",        stimme: "de-DE" },
  { kuerzel: "rus", name: "Russisch",       stimme: "ru-RU" },
  { kuerzel: "eng", name: "Englisch",       stimme: "en-US" },
  { kuerzel: "fra", name: "Französisch",    stimme: "fr-FR" },
  { kuerzel: "ita", name: "Italienisch",    stimme: "it-IT" },
  { kuerzel: "spa", name: "Spanisch",       stimme: "es-ES" },
  { kuerzel: "por", name: "Portugiesisch",  stimme: "pt-PT" },
  { kuerzel: "nld", name: "Niederländisch", stimme: "nl-NL" },
  { kuerzel: "pol", name: "Polnisch",       stimme: "pl-PL" },
  { kuerzel: "ces", name: "Tschechisch",    stimme: "cs-CZ" },
  { kuerzel: "swe", name: "Schwedisch",     stimme: "sv-SE" },
  { kuerzel: "dan", name: "Dänisch",        stimme: "da-DK" },
  { kuerzel: "tur", name: "Türkisch",       stimme: "tr-TR" },
  { kuerzel: "ell", name: "Griechisch",     stimme: "el-GR" },
  { kuerzel: "ukr", name: "Ukrainisch",     stimme: "uk-UA" },
  { kuerzel: "ara", name: "Arabisch",       stimme: "ar-SA" },
  { kuerzel: "heb", name: "Hebräisch",      stimme: "he-IL" },
];

const nachKuerzel = new Map(SPRACHEN.map((s) => [s.kuerzel, s]));

export function sprache(kuerzel) {
  return nachKuerzel.get(kuerzel) || { kuerzel, name: kuerzel, stimme: undefined };
}

export function nameVon(kuerzel) {
  return sprache(kuerzel).name;
}

export function paarName(paar) {
  return `${nameVon(paar.quelle)} – ${nameVon(paar.ziel)}`;
}

/**
 * Liest ein Wort vor. Braucht kein Netz - iOS bringt die Stimmen mit.
 *
 * Kein Fehler, wenn die Sprache fehlt: Nicht auf jedem Geraet sind alle
 * Stimmen installiert. Dann bleibt es eben still, statt eine Fehlermeldung
 * mitten in die Abfrage zu werfen.
 */
export function sprich(text, kuerzel) {
  if (!window.speechSynthesis) return;
  try {
    speechSynthesis.cancel();
    const aeusserung = new SpeechSynthesisUtterance(text);
    const ziel = sprache(kuerzel).stimme;
    if (ziel) aeusserung.lang = ziel;
    // Etwas langsamer als normal: Es geht ums Mitsprechen, nicht ums Zuhoeren.
    aeusserung.rate = 0.85;
    speechSynthesis.speak(aeusserung);
  } catch {
    /* Sprachausgabe ist Zubehoer, kein Grund die Abfrage abzubrechen */
  }
}
