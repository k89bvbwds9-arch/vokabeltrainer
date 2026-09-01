// Baut eine Attrappe des Screenshots aus der Lern-App - Statusleiste, Titel,
// fuenf Karten, Knopf. NUR fuer den Funktionstest der Erkennungskette gedacht,
// damit sie nicht ungeprueft auf echte Bilder losgelassen wird.
//
// Achtung: Ein synthetisch gerendertes Bild ist LEICHTER zu lesen als ein
// echter Screenshot. Aus einem guten Ergebnis hier folgt NICHTS ueber die
// Qualitaet im Betrieb. Dafuer braucht es Renes echte Bilder.
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const PAARE = [
  ["куда", "wohin"], ["сейчас", "jetzt"], ["когда", "wann"],
  ["сколько", "wie viel"], ["стоить", "kosten"],
];

const B = 1170, KARTE_H = 200, OBEN = 700;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${B}" height="${OBEN + PAARE.length * KARTE_H + 260}">
<rect width="100%" height="100%" fill="#ffffff"/>
<text x="100" y="105" font-family="Helvetica" font-size="58" font-weight="700" fill="#000">08:53</text>
<text x="${B / 2}" y="720" font-family="Helvetica" font-size="62" font-weight="700" fill="#000" text-anchor="middle">Vokabeln und Wendungen</text>
<text x="${B / 2}" y="800" font-family="Helvetica" font-size="62" font-weight="700" fill="#000" text-anchor="middle">fürs Wörterbuch</text>`;

PAARE.forEach(([ru, de], i) => {
  const y = OBEN + 190 + i * KARTE_H;
  svg += `<rect x="55" y="${y - 65}" width="${B - 110}" height="${KARTE_H - 30}" rx="34" fill="#f2f2f4"/>
<text x="170" y="${y + 20}" font-family="Helvetica" font-size="52" font-weight="700" fill="#111">${ru}</text>
<text x="100" y="${y + 95}" font-family="Helvetica" font-size="50" fill="#8a8a8f">${de}</text>`;
});

const yKnopf = OBEN + 190 + PAARE.length * KARTE_H + 30;
svg += `<rect x="55" y="${yKnopf}" width="${B - 110}" height="130" rx="65" fill="#6b30f5"/>
<text x="${B / 2}" y="${yKnopf + 85}" font-family="Helvetica" font-size="54" font-weight="700" fill="#fff" text-anchor="middle">Weiter</text></svg>`;

await sharp(Buffer.from(svg)).png().toFile("testbilder/attrappe.png");
writeFileSync("testbilder/attrappe.erwartet.txt",
  PAARE.map(([a, b]) => `${a}|${b}`).join("\n") + "\n");
console.log("testbilder/attrappe.png + .erwartet.txt gebaut");
