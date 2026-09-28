// Pruebas del lector de facturas con la factura de referencia (texto anonimizado).
// Ejecutar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extraerDeTexto } from "../app/lib/factura/extraer-texto";
import { lecturasDesdeLineas } from "../app/lib/factura/estructura";
import { parseNumeroCO } from "../app/lib/factura/texto";
import { consumoPorLecturas, validarYCompletar } from "../app/lib/factura/validar";

const texto = readFileSync(new URL("./fixtures/eep-factura-referencia.txt", import.meta.url), "utf8");

test("PDF de referencia: prueba de aceptación de la migración", () => {
  const d = extraerDeTexto(texto);
  assert.equal(d.empresa, "energia-pereira");
  assert.equal(d.municipio, "Cartago");
  assert.equal(d.estrato, 4);
  assert.equal(d.diasFacturados, 28);
  assert.equal(d.lecturaAnterior, 19487);
  assert.equal(d.lecturaActual, 19840);
  assert.equal(d.consumoKwh, 353);
  // Periodo 14/AGO/2026 – 10/SEP/2026: se nombra por el mes en que termina
  // (así la factura llama "AGO" al periodo anterior, de 415 kWh).
  assert.equal(d.periodo, "2026-09");
  assert.equal(d.promedioKwh, 267);
  assert.equal(d.valorKwh, 905.0529);
  assert.equal(d.totalPagar, 349864);
});

test("19840 − 19487 = 353 y 173 + 180 = 353", () => {
  const d = extraerDeTexto(texto);
  assert.equal(consumoPorLecturas(d), 353);
  assert.equal(173 + 180, d.consumoKwh);
  const v = validarYCompletar(d);
  assert.equal(v.confianzaConsumo, 100);
});

test("no confunde importes ni franjas con el consumo", () => {
  const d = extraerDeTexto(texto);
  for (const trampa of [905.0529, 156574, 162910, 319853, 349864, 173, 180, 267]) {
    assert.notEqual(d.consumoKwh, trampa);
  }
});

test("histórico con años y días", () => {
  const d = extraerDeTexto(texto);
  assert.deepEqual(d.historico.map((p) => p.periodo), ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"]);
  assert.deepEqual(d.historico.map((p) => p.kwh), [207, 178, 256, 280, 268, 415]);
  assert.equal(d.historico[5].dias, 33);
});

test("fila del medidor leída por OCR (lectura guiada)", () => {
  const f = lecturasDesdeLineas(["Actva 1408001303 GNS 19840 19487 353 1 353 267"]);
  assert.deepEqual(f, { lecturaAnterior: 19487, lecturaActual: 19840, consumoKwh: 353, factorMultiplicador: 1, promedioKwh: 267 });
  assert.equal(lecturasDesdeLineas(["2025 2026 1"]), null);
});

test("números con formato colombiano", () => {
  assert.equal(parseNumeroCO("1.234,5"), 1234.5);
  assert.equal(parseNumeroCO("$ 187.450"), 187450);
  assert.equal(parseNumeroCO("349,864"), 349864);
  assert.equal(parseNumeroCO("905.0529"), 905.0529);
});

test("medidor que dio la vuelta", () => {
  assert.equal(consumoPorLecturas({ lecturaAnterior: 99950, lecturaActual: 120, factorMultiplicador: 1 }), 170);
  // Lecturas al revés no son una vuelta del medidor (error encontrado al probar la interfaz)
  assert.equal(consumoPorLecturas({ lecturaAnterior: 500, lecturaActual: 400, factorMultiplicador: 1 }), null);
  assert.equal(consumoPorLecturas({ lecturaAnterior: 19840, lecturaActual: 19487, factorMultiplicador: 1 }), null);
});
