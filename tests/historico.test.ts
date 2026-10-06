// Histórico de consumos (tabla y gráfico "Consumo últimos seis meses") en facturas EEP.
// Datos sintéticos con la disposición de la factura de estrato 1 del 06/10/2026
// (periodo 29/AGO – 28/SEP/2026, emitida 02/OCT; sin nombre ni dirección).
import { test } from "node:test";
import assert from "node:assert/strict";
import { extraerDeTexto } from "../app/lib/factura/extraer-texto";
import { validarYCompletar } from "../app/lib/factura/validar";

const CAB = "147 Cartago  Residencial\nCT0123  1\n24672371  HIK  6300  5915  385  1  385  275\n29/AGO/2026 - 28/SEP/2026  31\n";
const resumen = (t: string) =>
  validarYCompletar(extraerDeTexto(t)).datos.historico.map((p) => `${p.periodo}:${p.kwh}:${p.dias}`);

// La factura rotula las filas ABR…SEP por el mes de EMISIÓN y el periodo actual es el mes
// SIGUIENTE a la última fila: la factura se emitió el 02/OCT, así que es 2026-10 (el cálculo
// por fechas daría 2026-09, que choca con la fila SEP). Los rótulos impresos se respetan:
// ABR…SEP = abril…septiembre de 2026 (antes caían en 2025 o se corrían un mes atrás).
const ESPERADO = ["2026-04:278:30", "2026-05:256:31", "2026-06:267:30", "2026-07:282:31", "2026-08:256:31", "2026-09:313:30"];
const periodoDe = (t: string) => validarYCompletar(extraerDeTexto(t)).datos.periodo;

test("tabla con días: se respetan los rótulos ABR…SEP y el periodo actual pasa a 2026-10", () => {
  const t = CAB + "Mes  kWh  Valor  Dias facturados\nABR  278  218,067  30\nMAY  256  209,479  31\nJUN  267  222,704  30\nJUL  282  233,701  31\nAGO  256  219,490  31\nSEP  313  278,625  30";
  assert.deepEqual(resumen(t), ESPERADO);
  assert.equal(periodoDe(t), "2026-10");
});

test("tabla sin la columna de días (el OCR la perdió): se asumen 30", () => {
  const t = CAB + "ABR  278  218,067\nMAY  256  209,479\nJUN  267  222,704\nJUL  282  233,701\nAGO  256  219,490\nSEP  313  278,625";
  assert.deepEqual(
    resumen(t).map((x) => x.split(":").slice(0, 2).join(":")),
    ESPERADO.map((x) => x.split(":").slice(0, 2).join(":"))
  );
  assert.ok(resumen(t).every((x) => x.endsWith(":30")));
});

test("gráfico con números sueltos (sin 'kWh') y rótulos ABR…ACTPROM", () => {
  const t = CAB + "278  256  267  282  256  313  385  275\nABR  MAY  JUN  JUL  AGO  SEP  ACTPROM";
  assert.deepEqual(resumen(t).map((x) => x.split(":").slice(0, 2).join(":")), ESPERADO.map((x) => x.split(":").slice(0, 2).join(":")));
});

test("gráfico armado por la app ('N kWh'): ningún mes sale con 365 días", () => {
  const t = CAB + "278 kWh  256 kWh  267 kWh  282 kWh  256 kWh  313 kWh  385 kWh\nABR  MAY  JUN  JUL  AGO  SEP  Actual";
  const h = validarYCompletar(extraerDeTexto(t)).datos.historico;
  assert.equal(h.length, 6);
  assert.ok(h.every((p) => p.dias >= 28 && p.dias <= 31), JSON.stringify(h));
  assert.equal(h[0].periodo, "2026-04");
  assert.equal(h[5].periodo, "2026-09");
  assert.equal(periodoDe(t), "2026-10");
});

test("sin colisión no se corre nada: la factura de referencia (periodo 2026-09, última fila AGO) queda igual", () => {
  const t = "147 Cartago  Residencial\nCT0172  4\n1400000000 GNS  19840  19487  353  1  353  267\n14/AGO/2026 - 10/SEP/2026  28\nMAR  207  162,374  31\nABR  178  145,654  30\nMAY  256  213,529  31\nJUN  280  232,043  30\nJUL  268  229,778  31\nAGO  415  369,423  33";
  assert.deepEqual(resumen(t), ["2026-03:207:31", "2026-04:178:30", "2026-05:256:31", "2026-06:280:30", "2026-07:268:31", "2026-08:415:33"]);
  assert.equal(periodoDe(t), "2026-09");
});
