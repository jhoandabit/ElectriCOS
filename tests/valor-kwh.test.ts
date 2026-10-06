// Valor del kWh con 4 decimales (factura EEP de estrato 1, 06/10/2026).
// Datos sintéticos con la MISMA disposición de la factura real (sin nombre ni dirección).
import { test } from "node:test";
import assert from "node:assert/strict";
import { extraerDeTexto } from "../app/lib/factura/extraer-texto";
import { parseNumeroCO } from "../app/lib/factura/texto";

const MEDIDOR = "24672371  HIK  6300  5915  385  1  385  275";

test("valor del kWh con 4 decimales ('905.0529') se lee aunque el mes de la tarifa esté lejos", () => {
  const casos = [
    `${MEDIDOR}\nValor kWh:  905.0529`,
    `${MEDIDOR}\nValor kWh:  905.0529\nTarifa a mes de:  AGO-2026  CLT Consumo Lectura Tomada`, // OCR: separados
    `${MEDIDOR}\nValor kWh:  905,0529`,
    `${MEDIDOR}\n905.0529  AGO-2026`, // PDF: juntos (ya funcionaba)
  ];
  for (const t of casos) assert.equal(extraerDeTexto(t).valorKwh, 905.0529, t);
  // Los miles no se rompen: "12.345" sigue siendo doce mil.
  assert.equal(parseNumeroCO("905.0529"), 905.0529);
  assert.equal(parseNumeroCO("12.345"), 12345);
});
