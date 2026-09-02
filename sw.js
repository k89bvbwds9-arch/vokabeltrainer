// Service Worker: macht die App offline lauffaehig.
//
// Zwei Klassen von Dateien, bewusst unterschiedlich behandelt:
//
// 1. Die App selbst (HTML, CSS, JS) - klein, aendert sich bei jedem Update.
//    Wird beim Einrichten vollstaendig geladen und danach zuerst aus dem
//    Netz geholt, damit ein Update nicht tagelang haengenbleibt. Ohne Netz
//    kommt sie aus dem Zwischenspeicher.
//
// 2. Tesseract und die Sprachdaten - rund 10 MB, aendern sich nie.
//    Werden NICHT beim Einrichten geladen, sondern beim ersten Foto. Sonst
//    wuerde die Installation der App an einem langsamen Mobilfunkanschluss
//    minutenlang stillstehen, bevor ueberhaupt etwas zu sehen ist. Danach
//    liegen sie dauerhaft im Zwischenspeicher - auch im Flugmodus.

// Zwei getrennte Nummern, und das ist wichtig: Die App aendert sich staendig,
// Tesseract und die Sprachdaten nie. Haengte beides an derselben Nummer, wuerde
// jede noch so kleine Korrektur die 10 MB Erkennungsdaten wegwerfen - und der
// naechste Fotoversuch begaenne mit einem langen Download ueber Mobilfunk.
const SCHALE = "schale-v2";
const BROCKEN = "brocken-v1";   // Tesseract und Sprachdaten

const SCHALEN_DATEIEN = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./speicher.js",
  "./lernen.js",
  "./paare.js",
  "./sprachen.js",
  "./erkennung.js",
  "./bildwerte.js",
  "./fassung.js",
  "./manifest.webmanifest",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const lager = await caches.open(SCHALE);
    // Einzeln statt addAll: Faellt eine Datei aus, soll nicht die gesamte
    // Einrichtung scheitern und die App gar nicht erst starten.
    await Promise.all(SCHALEN_DATEIEN.map((d) =>
      lager.add(d).catch((f) => console.warn("[sw] nicht geladen:", d, f.message))));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name !== SCHALE && name !== BROCKEN) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

const istBrocken = (pfad) =>
  pfad.includes("/vendor/tesseract/") || pfad.includes("/sprachdaten/");

self.addEventListener("fetch", (e) => {
  const anfrage = e.request;
  if (anfrage.method !== "GET") return;

  const url = new URL(anfrage.url);
  if (url.origin !== self.location.origin) return;

  // Grosse, unveraenderliche Dateien: erst der Zwischenspeicher.
  if (istBrocken(url.pathname)) {
    e.respondWith((async () => {
      const lager = await caches.open(BROCKEN);
      const gefunden = await lager.match(anfrage);
      if (gefunden) return gefunden;
      const antwort = await fetch(anfrage);
      if (antwort.ok) lager.put(anfrage, antwort.clone());
      return antwort;
    })());
    return;
  }

  // Die App selbst: erst das Netz, damit Aenderungen sofort ankommen.
  e.respondWith((async () => {
    try {
      const antwort = await fetch(anfrage);
      if (antwort.ok) (await caches.open(SCHALE)).put(anfrage, antwort.clone());
      return antwort;
    } catch (fehler) {
      const gefunden = await caches.match(anfrage);
      if (gefunden) return gefunden;
      // Bei einem Seitenaufruf ohne Netz die Startseite ausliefern.
      if (anfrage.mode === "navigate") {
        const start = await caches.match("./index.html");
        if (start) return start;
      }
      throw fehler;
    }
  })());
});
