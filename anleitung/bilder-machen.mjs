// Bildschirmfotos fuer die Anleitung, mit dem installierten Chrome.
// Jeder Schuss wird auf seinen Inhalt zugeschnitten - sonst steht in der
// Anleitung ein Drittel Leerraum.
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ZIEL = process.argv[2];
const BREITE = 390;

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: "new", args: ["--hide-scrollbars"],
});
const seite = await browser.newPage();
await seite.setViewport({ width: BREITE, height: 844, deviceScaleFactor: 3 });
await seite.goto("http://localhost:4173/", { waitUntil: "networkidle0" });

await seite.evaluate(async () => {
  const sp = await import("./speicher.js");
  const lernen = await import("./lernen.js");
  await sp.starte();
  await sp.aendere((z) => {
    z.sprachpaare = [{ id: "rus-deu", quelle: "rus", ziel: "deu", name: "Russisch – Deutsch" }];
    const w = [["сейчас","jetzt"],["когда","wann"],["хлеб","Brot"],["вода","Wasser"],
               ["дом","Haus"],["друг","Freund"],["ночь","Nacht"],["час","Stunde"]];
    z.vokabeln = []; z.karten = [];
    w.forEach(([q, zi], i) => {
      const id = "v" + i;
      z.vokabeln.push({ id, paarId: "rus-deu", quelle: q, ziel: zi, angelegt: lernen.heute() });
      ["hin","rueck"].forEach((r, j) => {
        const k = lernen.neueKarte("k" + i + j, id, r);
        if (i < 6) { k.stufe = (i % 4) + 1; k.faellig = lernen.plusTage(lernen.heute(), i % 3);
                     k.zuletzt = lernen.heute(); k.richtig = k.stufe; }
        z.karten.push(k);
      });
    });
    return z;
  });
});
await seite.reload({ waitUntil: "networkidle0" });
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
await warte(600);

/** Hoehe des tatsaechlich gefuellten Bereichs, Fussleiste eingerechnet. */
async function inhaltsHoehe() {
  return seite.evaluate(() => {
    const schirm = [...document.querySelectorAll(".schirm")].find((s) => !s.hidden);
    let unten = 0;
    for (const kind of schirm.querySelectorAll("*")) {
      const r = kind.getBoundingClientRect();
      if (r.height > 0 && r.width > 0) unten = Math.max(unten, r.bottom);
    }
    const leiste = document.getElementById("fussleiste");
    const leistenHoehe = leiste.offsetParent === null ? 0 : leiste.getBoundingClientRect().height;
    return Math.ceil(unten + 20 + leistenHoehe);
  });
}

async function schuss(name) {
  await warte(400);
  const hoehe = Math.min(1400, Math.max(320, await inhaltsHoehe()));
  await seite.setViewport({ width: BREITE, height: hoehe, deviceScaleFactor: 3 });
  await warte(250);
  await seite.screenshot({ path: `${ZIEL}/${name}.png` });
  await seite.setViewport({ width: BREITE, height: 844, deviceScaleFactor: 3 });
  console.log(`${name}  (${BREITE}x${hoehe})`);
}

await schuss("1-start");

await seite.evaluate(() => document.querySelector('#fussleiste button[data-ziel="hinzufuegen"]').click());
await schuss("2-hinzufuegen");

// Bestaetigungsbildschirm: echtes Foto durchlaufen lassen
await seite.evaluate(async () => {
  const b = await (await fetch("./testbilder/IMG_3390.PNG")).blob();
  const dt = new DataTransfer();
  dt.items.add(new File([b], "IMG_3390.PNG", { type: "image/png" }));
  const e = document.getElementById("dateiWahl");
  e.files = dt.files;
  e.dispatchEvent(new Event("change", { bubbles: true }));
});
await seite.waitForFunction(() => !document.getElementById("pruefBereich").hidden, { timeout: 120000 });
await schuss("3-bestaetigen");

await seite.evaluate(() => {
  document.getElementById("btnPruefAbbrechen").click();
  document.querySelector('#fussleiste button[data-ziel="start"]').click();
  document.getElementById("btnLosgehts").click();
});
await warte(400);
await seite.evaluate(() => document.getElementById("karte").click());
await schuss("4-karte");

await seite.evaluate(() => {
  document.getElementById("btnAbbrechen").click();
  document.querySelector('#fussleiste button[data-ziel="vokabeln"]').click();
});
await schuss("5-vokabeln");

await browser.close();
