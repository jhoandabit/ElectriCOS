// Orientación de la foto: una foto sin marca de rotación (EXIF = 1) puede venir con el texto
// de lado. Caso real (06/10/2026): factura de EEP fotografiada con el texto de arriba hacia
// abajo; Tesseract no leía ninguna palabra clave así y 6 de 13 girada 90° a la izquierda.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { detectarGiro, puntajeOrientacion, recuadroEnOriginal, puntoGirado, type Giro } from "../app/lib/factura/orientacion";

const derecho = readFileSync(new URL("./fixtures/eep-factura-referencia.txt", import.meta.url), "utf8");
const basura = "ilTtl  vVnu  ol11  l  Ie  mmm  oo|  X7  ~~  nOs  ; ,, 5l  Ob  ::  ///  r  H";

test("el texto derecho de una factura puntúa alto y el texto ilegible casi nada", () => {
  assert.ok(puntajeOrientacion(derecho) >= 6, String(puntajeOrientacion(derecho)));
  assert.ok(puntajeOrientacion(basura) <= 1);
  assert.equal(puntajeOrientacion(""), 0);
});

// Simula el lector: solo entrega texto legible en el giro que de verdad endereza la foto.
const lectorQueEnderezaEn = (bueno: Giro, llamadas: Giro[] = []) => async (g: Giro) => {
  llamadas.push(g);
  return g === bueno ? derecho : basura;
};

test("foto derecha: se acepta con una sola lectura de prueba (no gasta más memoria)", async () => {
  const llamadas: Giro[] = [];
  const r = await detectarGiro(lectorQueEnderezaEn(0, llamadas));
  assert.equal(r.giro, 0);
  assert.deepEqual(llamadas, [0]);
});

test("foto de lado (texto de arriba hacia abajo): se detecta el giro de 270° (90° a la izquierda)", async () => {
  const r = await detectarGiro(lectorQueEnderezaEn(270));
  assert.equal(r.giro, 270);
});

test("foto de lado al otro lado: giro de 90°", async () => {
  assert.equal((await detectarGiro(lectorQueEnderezaEn(90))).giro, 90);
});

test("foto de cabeza: giro de 180°", async () => {
  assert.equal((await detectarGiro(lectorQueEnderezaEn(180))).giro, 180);
});

test("si ninguna orientación se lee, no se gira nada", async () => {
  assert.equal((await detectarGiro(async () => basura)).giro, 0);
});

test("sin ventaja clara sobre la foto original, no se gira (no inventar rotaciones)", async () => {
  // El giro apenas mejora en 1 palabra clave: se queda como está.
  const poco = "consumo kwh valor";
  const r = await detectarGiro(async (g) => (g === 0 ? "consumo kwh" : g === 90 ? poco : basura));
  assert.equal(r.giro, 0);
});

test("recuadro dibujado sobre la foto enderezada → recuadro equivalente en la foto original", () => {
  const r = { x: 0.2, y: 0.1, ancho: 0.5, alto: 0.05 };
  for (const g of [0, 90, 180, 270] as Giro[]) {
    const o = recuadroEnOriginal(r, g);
    // Las 4 esquinas del recuadro original, giradas hacia adelante, deben caer en el recuadro dibujado.
    const esquinas = [[o.x, o.y], [o.x + o.ancho, o.y], [o.x, o.y + o.alto], [o.x + o.ancho, o.y + o.alto]];
    const giradas = esquinas.map(([x, y]) => puntoGirado(x, y, g));
    const xs = giradas.map((p) => p[0]);
    const ys = giradas.map((p) => p[1]);
    const cerca = (a: number, b: number) => Math.abs(a - b) < 1e-9;
    assert.ok(cerca(Math.min(...xs), r.x) && cerca(Math.max(...xs), r.x + r.ancho), `x en giro ${g}`);
    assert.ok(cerca(Math.min(...ys), r.y) && cerca(Math.max(...ys), r.y + r.alto), `y en giro ${g}`);
  }
});
