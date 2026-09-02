// Senkrechtes Profil: Wie stark schwankt die Helligkeit in jeder Bildspalte?
// Text schwankt stark, ein leerer Steg gar nicht - unabhaengig davon, wie
// kontrastarm der Text ist.
import sharp from "sharp";

for (const datei of ["testbilder/italienisch-buch.png", "testbilder/buch-geraetenah.png"]) {
  const bild = sharp(datei).resize({ width: 1600, withoutEnlargement: true }).greyscale();
  const { data, info } = await bild.raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  // Nur den Tabellenbereich betrachten, nicht Kopf und Fuss
  const vonY = Math.round(height * 0.09), bisY = Math.round(height * 0.95);

  const streuung = new Array(width).fill(0);
  for (let x = 0; x < width; x++) {
    let summe = 0, summeQ = 0, n = 0;
    for (let y = vonY; y < bisY; y += 2) {
      const v = data[y * width + x];
      summe += v; summeQ += v * v; n++;
    }
    const mittel = summe / n;
    streuung[x] = Math.sqrt(Math.max(0, summeQ / n - mittel * mittel));
  }
  console.log(`\n${datei}`);
  console.log("   x   Streuung");
  for (let x = 100; x < 1500; x += 50) {
    const balken = "█".repeat(Math.round(streuung[x] / 2));
    console.log(`${String(x).padStart(4)}  ${streuung[x].toFixed(1).padStart(5)}  ${balken}`);
  }
}
