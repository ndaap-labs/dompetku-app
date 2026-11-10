/* Service Worker Dompetku - ubah VERSION setiap kali ada update file agar cache diperbarui */
const VERSION = "dompetku-v3";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./favicon.svg",
  "./favicon.ico",
  "./favicon-192.png",
  "./favicon-512.png",
  "./apple-touch-icon.png",
  "./iconweb.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* SDK Firebase (versi terkunci 10.8.0): cache-first supaya aplikasi tetap terbuka saat offline */
async function firebaseSdk(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req.url);
  if (hit) return hit;
  try {
    const res = await fetch(req.url, { mode: "cors" });
    if (res.ok) {
      cache.put(req.url, res.clone());
      return res;
    }
  } catch (_) {}
  return fetch(req);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) {
    e.respondWith(firebaseSdk(req));
    return;
  }

  // Request ke server lain (API Firebase Auth/Firestore dll) tidak disentuh
  if (url.origin !== self.location.origin) return;

  // Buka halaman: coba internet dulu, kalau offline pakai cache
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put("./index.html", copy));
          }
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // File statis (ikon, manifest): pakai cache, perbarui di belakang layar
  e.respondWith(
    caches.match(req).then((cached) => {
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});
