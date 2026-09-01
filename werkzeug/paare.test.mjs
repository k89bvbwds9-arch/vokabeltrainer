// Prueft die Zuordnungslogik ohne Tesseract - mit von Hand gesetzten Zeilen.
// Die Zahlen im ersten Fall sind ECHT gemessen (werkzeug/durchlaeufe-
// vergleichen.mjs an testbilder/attrappe.png) und stehen hier als
// Rueckfallsicherung: Der "Kyna"-Fall darf nie wieder unbemerkt durchgehen.
import assert from "node:assert/strict";
import { zuPaaren, schriftVon, schriftDerSprache, istRauschen } from "../paare.js";

let bestanden = 0;
function pruefe(name, fn) {
  try { fn(); bestanden++; console.log(`  ok   ${name}`); }
  catch (e) { console.error(`  FEHL ${name}\n       ${e.message}`); process.exitCode = 1; }
}

const z = (text, conf, y0, hoehe = 40, x0 = 100) =>
  ({ text, conf, bbox: { x0, x1: x0 + text.length * 25, y0, y1: y0 + hoehe } });

console.log("\nSchrifterkennung");
pruefe("erkennt Kyrillisch und Latein", () => {
  assert.equal(schriftVon("куда"), "kyrillisch");
  assert.equal(schriftVon("wohin"), "lateinisch");
  assert.equal(schriftVon("fürs Wörterbuch"), "lateinisch");
});
pruefe("laesst sich von einem einzelnen Fremdzeichen nicht umkippen", () => {
  // Tesseract verwechselt gern das kyrillische "с" mit dem lateinischen "c".
  assert.equal(schriftVon("cейчас"), "kyrillisch");
});
pruefe("ordnet Sprachen ihrem Schriftsystem zu", () => {
  assert.equal(schriftDerSprache("rus"), "kyrillisch");
  assert.equal(schriftDerSprache("deu"), "lateinisch");
  assert.equal(schriftDerSprache("ita"), "lateinisch");
  assert.equal(schriftDerSprache("ell"), "griechisch");
});

console.log("\nRauschen");
pruefe("wirft Uhrzeit, Akkustand und reine Symbole weg", () => {
  assert.ok(istRauschen("08:53"));
  assert.ok(istRauschen("40 %"));
  assert.ok(istRauschen("—"));
  assert.ok(istRauschen(""));
  assert.ok(!istRauschen("куда"));
  assert.ok(!istRauschen("wie viel"));
});

console.log("\nZwei Durchlaeufe, verschiedene Schriften (Russisch-Deutsch)");
// Echte Messwerte aus testbilder/attrappe.png, Modus 4.
const ECHT = {
  quelle: [
    z("08:53", 97, 64), z("\\УокаБет ипа \\ММепаипдеп", 61, 675), z("таг$ ММочегрисв", 0, 755),
    z("куда", 96, 881), z("мой", 29, 949), z("сейчас", 96, 1071), z("1221", 0, 1149),
    z("когда", 96, 1281), z("мапп", 46, 1359), z("сколько", 84, 1481), z("мле ме!", 54, 1549),
    z("стоить", 90, 1681), z("коеп", 18, 1749),
  ],
  ziel: [
    z("08:53", 96, 64), z("Vokabeln und Wendungen", 97, 675), z("fürs Wörterbuch", 97, 755),
    z("Kyna", 91, 881), z("wohin", 96, 949), z("cenyac", 37, 1071), z("jetzt", 97, 1149),
    z("KOrda", 73, 1281), z("wann", 96, 1359), z("CKOJIbKO", 68, 1481), z("wie viel", 97, 1549),
    z("CTONTb", 44, 1681), z("kosten", 96, 1749),
  ],
};

pruefe("liest куда richtig statt Kyna (der Fall, der den Plan geaendert hat)", () => {
  const { paare } = zuPaaren(ECHT, { quelle: "rus", ziel: "deu" });
  assert.equal(paare[0].quelle, "куда");
  assert.equal(paare[0].ziel, "wohin");
});
pruefe("findet alle fuenf Paare des Testbildes", () => {
  const { paare, verfahren } = zuPaaren(ECHT, { quelle: "rus", ziel: "deu" });
  assert.equal(verfahren, "reihenfolge");
  assert.deepEqual(paare.map((p) => `${p.quelle}|${p.ziel}`), [
    "куда|wohin", "сейчас|jetzt", "когда|wann", "сколько|wie viel", "стоить|kosten"]);
});
pruefe("wirft Titel, Uhrzeit und Knopf ohne Zuschneiden weg", () => {
  const { paare } = zuPaaren(ECHT, { quelle: "rus", ziel: "deu" });
  const alles = paare.map((p) => p.quelle + p.ziel).join(" ");
  assert.ok(!alles.includes("Vokabeln"), "Titel ist durchgerutscht");
  assert.ok(!alles.includes("08:53"), "Uhrzeit ist durchgerutscht");
});
pruefe("markiert die knapp entschiedene Zeile als unsicher", () => {
  // куда: rus 96 gegen deu 91 - nur 5 Punkte Vorsprung. Genau die Zeile, auf
  // die der Nutzer schauen soll. Die uebrigen liegen weit auseinander.
  const { paare } = zuPaaren(ECHT, { quelle: "rus", ziel: "deu" });
  assert.equal(paare[0].sicher, false, "куда muesste als unsicher markiert sein");
  assert.ok(paare.slice(1).every((p) => p.sicher), "die uebrigen sind eindeutig");
});
pruefe("meldet eine Quellzeile ohne Uebersetzung, statt sie wegzuwerfen", () => {
  const nurQuelle = {
    quelle: [z("куда", 96, 100), z("сейчас", 96, 300), z("шоЬіп", 20, 400)],
    ziel:   [z("Kyna", 50, 100), z("cenyac", 30, 300), z("wohin", 96, 400)],
  };
  const { paare, unklar } = zuPaaren(nurQuelle, { quelle: "rus", ziel: "deu" });
  assert.equal(paare.length, 1);
  assert.equal(unklar.length, 1);
  assert.equal(unklar[0].quelle, "куда");
});
pruefe("verliert nichts, wenn ein Durchlauf eine Zeile weniger findet", () => {
  // Ohne Zuordnung ueber die Bildposition wuerde sich hier alles um eins
  // verschieben - ab da waere jede Vokabel falsch gepaart.
  const luecke = {
    quelle: [z("куда", 96, 100), z("мой", 29, 200), z("сейчас", 96, 400), z("1221", 0, 500)],
    ziel:   [z("Kyna", 50, 100), z("wohin", 96, 200), /* сейчас fehlt */ z("jetzt", 97, 500)],
  };
  const { paare } = zuPaaren(luecke, { quelle: "rus", ziel: "deu" });
  assert.deepEqual(paare.map((p) => `${p.quelle}|${p.ziel}`), ["куда|wohin", "сейчас|jetzt"]);
});

console.log("\nUmbruch und Rahmen auseinanderhalten");
pruefe("haengt eine umbrochene Uebersetzung an, statt sie wegzuwerfen", () => {
  // Echter Fall aus IMG_3390: "Entschuldigung, ich habe / nicht verstanden".
  // Die zweite Zeile steht dicht darunter und am selben linken Rand.
  const umbruch = {
    quelle: [z("извините, я не понял", 95, 1240), z("Етгзсви!ащдипд", 40, 1300, 40, 100),
             z("тсЫ уегапаеп", 30, 1360, 40, 100), z("как настроение?", 96, 1500)],
    ziel:   [z("N3BUHUTE", 30, 1240), z("Entschuldigung, ich habe", 96, 1300, 40, 100),
             z("nicht verstanden", 96, 1360, 40, 100), z("Kak HaCTpoeHue?", 40, 1500)],
  };
  const { paare } = zuPaaren(umbruch, { quelle: "rus", ziel: "deu" });
  assert.equal(paare[0].ziel, "Entschuldigung, ich habe nicht verstanden");
});
pruefe("haengt eine mittig stehende Knopfbeschriftung NICHT an", () => {
  const mitKnopf = {
    quelle: [z("стоить", 90, 1681), z("коеп", 18, 1749, 40, 100), z("У/еЦег", 30, 1980, 45, 420)],
    ziel:   [z("CTONTb", 44, 1681), z("kosten", 96, 1749, 40, 100), z("Weiter", 92, 1980, 45, 420)],
  };
  const { paare } = zuPaaren(mitKnopf, { quelle: "rus", ziel: "deu" });
  assert.equal(paare.length, 1);
  assert.equal(paare[0].ziel, "kosten");
});
pruefe("reisst die Fortsetzungskette, wenn etwas dazwischenkommt", () => {
  // GEMESSEN an IMG_3398: "дом" zerfaellt in zwei Kaestchen, das Bruchstueck
  // "ом" wird knapp fuer Deutsch gehalten - und "Haus" darf sich danach NICHT
  // an das weit davor liegende Paar "друг|Freund" haengen.
  const zerfallen = {
    quelle: [z("друг", 94, 2122), z("Егеипа", 58, 2144, 40, 101),
             z("ом", 85, 2376, 29, 130), z("Наи$", 85, 2441, 36, 101)],
    ziel:   [z("Apyr", 30, 2122), z("Freund", 66, 2144, 40, 101),
             z("OM", 90, 2376, 29, 130), z("Haus", 97, 2441, 36, 101)],
  };
  const { paare } = zuPaaren(zerfallen, { quelle: "rus", ziel: "deu" });
  assert.equal(paare[0].ziel, "Freund", 'Freund darf nicht zu "Freund Haus" werden');
});

console.log("\nSymbole aussortieren");
pruefe("wirft die Zeile des Lautsprechersymbols weg", () => {
  // GEMESSEN an IMG_3398: Das Symbol erzeugt eine eigene Zeile zwischen
  // Vokabel und Uebersetzung, wird als Russisch eingestuft und STIEHLT der
  // Vokabel ihre Uebersetzung - vier von neun Karten gingen so verloren.
  // Echte Zeilen lagen bei 88-97, Symbolzeilen bei 15-56.
  const mitSymbol = {
    quelle: [z("это окно", 96, 344), z("ОИ 4)", 46, 366), z("Да$ 151 ет Реп%ег", 56, 408)],
    ziel:   [z("3TO OKHO", 78, 344), z("on 4)", 37, 366), z("das ist ein Fenster", 96, 408)],
  };
  const { paare, unklar } = zuPaaren(mitSymbol, { quelle: "rus", ziel: "deu" });
  assert.equal(unklar.length, 0, "die Vokabel darf nicht als unklar enden");
  assert.deepEqual(paare.map((p) => `${p.quelle}|${p.ziel}`), ["это окно|das ist ein Fenster"]);
});

console.log("\nGleiche Schriften (Italienisch-Deutsch), Zuordnung ueber Abstaende");
// Nachgebaut nach der Geometrie des echten Screenshots: enge Luecke innerhalb
// einer Karte (rund 30 px), weite zwischen zwei Karten (rund 85 px).
const LATEIN = { quelle: [], ziel: [] };
[["dove", "wohin"], ["adesso", "jetzt"], ["quando", "wann"],
 ["quanto", "wie viel"], ["costare", "kosten"]].forEach(([it, de], i) => {
  const y = 880 + i * 200;
  LATEIN.quelle.push(z(it, 90, y));      LATEIN.ziel.push(z(it, 88, y));
  LATEIN.quelle.push(z(de, 88, y + 68)); LATEIN.ziel.push(z(de, 90, y + 68));
});

pruefe("gruppiert Karten anhand der Zeilenabstaende", () => {
  const { paare, verfahren } = zuPaaren(LATEIN, { quelle: "ita", ziel: "deu" });
  assert.equal(verfahren, "abstand");
  assert.deepEqual(paare.map((p) => `${p.quelle}|${p.ziel}`), [
    "dove|wohin", "adesso|jetzt", "quando|wann", "quanto|wie viel", "costare|kosten"]);
});
pruefe("laesst sich vom grossen Sprung der Statusleiste nicht verwirren", () => {
  // Der Abstand von der Uhrzeit zum Inhalt ist rund siebenmal so gross wie der
  // zwischen zwei Karten. Ein Median-Schwellwert kippt daran um; deshalb
  // fliegen Ausreisser vor der Haufenbildung raus.
  const mitKopf = {
    quelle: [z("08:53", 97, 64), ...LATEIN.quelle],
    ziel:   [z("08:53", 96, 64), ...LATEIN.ziel],
  };
  const { paare } = zuPaaren(mitKopf, { quelle: "ita", ziel: "deu" });
  assert.equal(paare.length, 5);
  assert.equal(paare[0].quelle, "dove");
});
pruefe("markiert eine mittig stehende Ueberschrift als unsicher", () => {
  // Titel stehen mittig, Karteninhalt linksbuendig. Zwei Titelzeilen sehen
  // sonst genauso aus wie eine Karte - sie werden nicht weggeworfen, aber
  // auf dem Bestaetigungsbildschirm nicht vorausgewaehlt.
  const mitTitel = {
    quelle: [z("Vocaboli e frasi", 90, 675, 40, 380), z("per il dizionario", 90, 723, 40, 380), ...LATEIN.quelle],
    ziel:   [z("Vocaboli e frasi", 90, 675, 40, 380), z("per il dizionario", 90, 723, 40, 380), ...LATEIN.ziel],
  };
  const { paare } = zuPaaren(mitTitel, { quelle: "ita", ziel: "deu" });
  const titel = paare.find((p) => p.quelle.startsWith("Vocaboli"));
  assert.ok(titel, "der Titel soll sichtbar bleiben, nicht still verschwinden");
  assert.equal(titel.sicher, false);
  assert.ok(paare.filter((p) => p.sicher).length >= 5, "die echten Karten bleiben vorausgewaehlt");
});
pruefe("meldet eine dreizeilige Gruppe als unklar, statt zu raten", () => {
  const dreizeilig = {
    quelle: [z("dove", 90, 880), z("wohin", 88, 948), z("Zusatz", 88, 1000),
             z("adesso", 90, 1180), z("jetzt", 88, 1248)],
    ziel:   [z("dove", 88, 880), z("wohin", 90, 948), z("Zusatz", 90, 1000),
             z("adesso", 88, 1180), z("jetzt", 90, 1248)],
  };
  const { paare, unklar } = zuPaaren(dreizeilig, { quelle: "ita", ziel: "deu" });
  assert.equal(paare.length, 1);
  assert.equal(unklar.length, 1);
  assert.ok(unklar[0].grund.includes("3 Zeilen"));
});

console.log(`\n${bestanden} Pruefungen bestanden` +
  (process.exitCode ? " - MIT FEHLERN" : "") + "\n");
