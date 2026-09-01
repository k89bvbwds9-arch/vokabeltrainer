// Baut die App-Icons aus einer SVG-Zeichnung. Einmal aufrufen, danach liegen
// sie in icons/ und aendern sich nicht mehr.
import sharp from "sharp";

// Zwei Sprechblasen mit Buchstaben - lesbar auch bei 60 Pixeln auf dem
// Home-Bildschirm. Bewusst ohne feine Linien: Die verschwinden dort.
const zeichnung = (rand) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${rand}" fill="#5b34d6"/>
  <g fill="#ffffff">
    <rect x="86" y="132" width="250" height="150" rx="34"/>
    <path d="M132 282 h64 l-58 52 z"/>
    <rect x="176" y="228" width="250" height="150" rx="34" fill="#c9b6ff"/>
    <path d="M380 378 h-64 l58 52 z" fill="#c9b6ff"/>
  </g>
  <text x="211" y="228" font-family="Helvetica,Arial,sans-serif" font-size="104"
        font-weight="700" fill="#5b34d6" text-anchor="middle">A</text>
  <text x="301" y="324" font-family="Helvetica,Arial,sans-serif" font-size="104"
        font-weight="700" fill="#3d1f9c" text-anchor="middle">Я</text>
</svg>`;

// Auf dem Home-Bildschirm rundet iOS selbst - ein eigener Radius doppelt sich
// dort zu einem zu kleinen Symbol. Deshalb fuer Apple ohne Rundung.
for (const [datei, groesse, rand] of [
  ["icons/icon-180.png", 180, 0],
  ["icons/icon-192.png", 192, 42],
  ["icons/icon-512.png", 512, 112],
  ["icons/icon-512-maskierbar.png", 512, 0],
]) {
  await sharp(Buffer.from(zeichnung(rand))).resize(groesse, groesse).png().toFile(datei);
  console.log(`${datei} (${groesse}px)`);
}
