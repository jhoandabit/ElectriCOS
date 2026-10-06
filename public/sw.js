// Service worker de ElectriCOs (PWA).
//  • Permite instalar la app en el celular.
//  • Abre la pantalla inicial SIN conexión: guarda la página y sus archivos estáticos
//    (los de /_next/static llevan el hash en el nombre, así que nunca cambian).
//  • Está listo para recibir notificaciones push del servidor (eventos "push" y "notificationclick").
//  • No guarda datos de Supabase ni nada de otros sitios: esos siempre se piden a internet.
//  • El lector de fotos (/modelos, /ort) NO pasa por aquí: en Safari fallaba con "Load failed";
//    lo guarda el navegador con su caché normal (next.config.ts).
// v4: guarda también los archivos estáticos para abrir sin conexión + eventos de push.
const CACHE = "electricos-v4";
const ESTATICOS = "electricos-estaticos-v4";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== ESTATICOS).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

function esEstatico(url) {
  return url.origin === self.location.origin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/iconos/") || url.pathname.startsWith("/marca/"));
}

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // Páginas: primero internet; si no hay, la copia guardada.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copia = r.clone();
          if (r.ok) caches.open(CACHE).then((c) => c.put("/", copia));
          return r;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // Archivos estáticos propios: primero la copia (no cambian); si no está, internet y se guarda.
  if (esEstatico(url)) {
    e.respondWith(
      caches.match(e.request).then(
        (guardado) =>
          guardado ||
          fetch(e.request).then((r) => {
            if (r.ok) {
              const copia = r.clone();
              caches.open(ESTATICOS).then((c) => c.put(e.request, copia));
            }
            return r;
          })
      )
    );
  }
});

// ---- Notificaciones push (cuando haya servidor que las envíe) ----
self.addEventListener("push", (e) => {
  let datos = {};
  try {
    datos = e.data ? e.data.json() : {};
  } catch {
    datos = { cuerpo: e.data ? e.data.text() : "" };
  }
  const titulo = datos.titulo || "ElectriCOs";
  e.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.cuerpo || "Tienes un consejo de ahorro nuevo.",
      icon: "/iconos/icono-192.png",
      badge: "/iconos/icono-192.png",
      tag: datos.etiqueta || "consejo",
      data: { url: datos.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const destino = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) if ("focus" in v) return v.focus();
      return self.clients.openWindow(destino);
    })
  );
});
