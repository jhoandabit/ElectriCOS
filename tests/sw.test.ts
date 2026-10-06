import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Carga public/sw.js con un "self" falso y devuelve lo necesario para probar sus decisiones.
function cargarSW(red: (url: string) => Promise<{ ok: boolean; clone: () => unknown }>) {
  const oyentes: Record<string, (e: any) => void> = {};
  const guardado = new Map<string, unknown>();
  const caches = {
    open: async () => ({
      addAll: async () => undefined,
      put: async (k: any, v: unknown) => void guardado.set(typeof k === "string" ? k : k.url, v),
    }),
    match: async (k: any) => guardado.get(typeof k === "string" ? k : k.url),
    keys: async () => [],
  };
  const self = { addEventListener: (t: string, f: (e: any) => void) => (oyentes[t] = f), location: { origin: "https://app.test" }, skipWaiting() {}, clients: { claim() {} } };
  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), { self, caches, fetch: (r: any) => red(r.url), URL, console });
  const pedir = (url: string, mode = "cors", method = "GET") => {
    let respuesta: Promise<unknown> | undefined;
    oyentes.fetch({ request: { url, mode, method }, respondWith: (p: Promise<unknown>) => (respuesta = p) });
    return respuesta;
  };
  return { pedir, guardado };
}

const ok = { ok: true, clone: () => ok };

test("el service worker no toca el lector de fotos, otros sitios ni lo que no es GET", () => {
  const sw = cargarSW(async () => ok);
  assert.equal(sw.pedir("https://app.test/modelos/det.onnx"), undefined);
  assert.equal(sw.pedir("https://app.test/ort/ort.wasm"), undefined);
  assert.equal(sw.pedir("https://zsoeanxgouiclrnsmaqj.supabase.co/rest/v1/x"), undefined);
  assert.equal(sw.pedir("https://app.test/_next/static/a.js", "cors", "POST"), undefined);
});

test("archivos estáticos propios: se guardan y la segunda vez salen de la copia, sin internet", async () => {
  let llamadas = 0;
  const sw = cargarSW(async () => (llamadas++, ok));
  await sw.pedir("https://app.test/_next/static/chunks/a.js");
  assert.equal(llamadas, 1);
  await new Promise((r) => setTimeout(r, 5));
  await sw.pedir("https://app.test/_next/static/chunks/a.js");
  assert.equal(llamadas, 1);
});

test("la página abre sin conexión con la última copia guardada", async () => {
  let hayRed = true;
  const sw = cargarSW(async () => {
    if (!hayRed) throw new Error("sin red");
    return ok;
  });
  await sw.pedir("https://app.test/", "navigate");
  await new Promise((r) => setTimeout(r, 5));
  hayRed = false;
  assert.equal(await sw.pedir("https://app.test/", "navigate"), ok);
});
