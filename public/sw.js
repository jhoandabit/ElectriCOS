// Service worker mínimo de ElectriCOs: permite instalar la app en el
// celular (PWA) y abrir la pantalla inicial sin conexión. No guarda datos
// de Supabase: esos siempre se piden a internet.
const CACHE = "electricos-v2";
// El lector de fotos (motor ONNX ≈ 11 MB y modelos ≈ 6 MB) se guarda la
// primera vez y luego se usa desde el celular: no se vuelve a descargar con
// cada foto (con datos móviles eso tardaba mucho). Cambiar la versión
// ("lector-v1") obliga a descargarlo de nuevo.
const CACHE_LECTOR = "lector-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== CACHE_LECTOR).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === "GET" && url.origin === self.location.origin && /^\/(ort|modelos)\//.test(url.pathname)) {
    e.respondWith(
      caches.open(CACHE_LECTOR).then(async (c) => {
        const guardado = await c.match(e.request, { ignoreSearch: true });
        if (guardado) return guardado;
        const r = await fetch(e.request);
        if (r.ok && r.status === 200) c.put(e.request, r.clone());
        return r;
      })
    );
    return;
  }
  // Solo las páginas: primero internet; si no hay, la copia guardada.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copia = r.clone();
          caches.open(CACHE).then((c) => c.put("/", copia));
          return r;
        })
        .catch(() => caches.match("/"))
    );
  }
});
