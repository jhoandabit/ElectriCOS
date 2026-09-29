// Pruebas del motor matemático. Ejecutar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularLineaBase,
  calcularMeta,
  comparacionConPromedio,
  comparacionSubsistencia,
  evaluarAvance,
  huellaKg,
  huellaPorPersona,
  kwhMesNormalizado,
  metaConLineaBase,
} from "../app/lib/calculos/motor";
import { FACTOR_EMISION_SIN, sobre1000Metros } from "../app/lib/calculos/parametros";

// Histórico real de la factura de referencia (Energía de Pereira, Cartago)
const historico = [
  { periodo: "2026-03", kwh: 207, dias: 31 },
  { periodo: "2026-04", kwh: 178, dias: 30 },
  { periodo: "2026-05", kwh: 256, dias: 31 },
  { periodo: "2026-06", kwh: 280, dias: 30 },
  { periodo: "2026-07", kwh: 268, dias: 31 },
  { periodo: "2026-08", kwh: 415, dias: 33 },
];

test("huella = consumo × factor de emisión", () => {
  assert.equal(FACTOR_EMISION_SIN.valor, 0.22);
  assert.ok(Math.abs(huellaKg(353, FACTOR_EMISION_SIN.valor) - 77.66) < 1e-9);
  assert.ok(Math.abs(huellaPorPersona(353, 0.22, 4) - 19.415) < 1e-9);
  assert.throws(() => huellaPorPersona(353, 0.22, 0));
});

test("normaliza a 30 días", () => {
  assert.ok(Math.abs(kwhMesNormalizado({ periodo: "2026-08", kwh: 415, dias: 33 }) - 377.27) < 0.01);
  assert.equal(kwhMesNormalizado({ periodo: "2026-09", kwh: 353, dias: null }), 353);
});

test("meta: ejemplo de la migración (180,5 kWh − 5 % ≈ 171,5)", () => {
  assert.equal(calcularMeta(180.5, 5), 171.5);
  assert.throws(() => calcularMeta(180.5, 0));
  assert.throws(() => calcularMeta(180.5, 100));
});

test("línea base con el histórico de la factura", () => {
  const lb = calcularLineaBase(historico);
  assert.ok(lb);
  assert.equal(lb.meses, 6);
  assert.equal(lb.desde, "2026-03");
  assert.equal(lb.hasta, "2026-08");
  assert.equal(lb.minimo, 178);
  assert.equal(lb.maximo, 377.3); // 415 kWh en 33 días → 377,3 en 30
  assert.ok(lb.promedio > 250 && lb.promedio < 260);
  assert.ok(lb.tendencia > 0, "el consumo viene subiendo");
});

test("línea base necesita al menos 3 meses", () => {
  assert.equal(calcularLineaBase(historico.slice(0, 2)), null);
});

test("un mes repetido cuenta una sola vez", () => {
  const lb = calcularLineaBase([...historico.slice(0, 3), { periodo: "2026-05", kwh: 999, dias: 30 }]);
  assert.equal(lb?.meses, 3);
  assert.equal(lb?.maximo, 999);
});

test("comparación con el promedio", () => {
  assert.equal(comparacionConPromedio(300, 250), 20);
  assert.equal(comparacionConPromedio(200, 250), -20);
});

test("avance frente a la meta", () => {
  const avance = evaluarAvance(
    [...historico, { periodo: "2026-09", kwh: 353, dias: 28 }],
    250,
    237.5,
    "2026-09",
    0.22,
    905.0529
  );
  assert.equal(avance.length, 1);
  assert.equal(avance[0].cumple, false); // 353 en 28 días → 378,2 en 30
  assert.ok(avance[0].ahorroKwh < 0);
});

test("subsistencia: referencia por altitud", () => {
  assert.equal(sobre1000Metros("Cartago"), false);
  assert.equal(sobre1000Metros("Pereira"), true);
  assert.equal(sobre1000Metros("Ciudad inventada"), null);
  assert.deepEqual(comparacionSubsistencia(353, false), { referencia: 173, diferencia: 180, porEncima: true });
});

test("la meta pierde su línea base si se borran sus meses", () => {
  const seis = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
  assert.equal(metaConLineaBase(seis, "2026-04", "2026-09"), true);
  assert.equal(metaConLineaBase(["2026-08", "2026-09"], "2026-04", "2026-09"), false); // quedan 2
  assert.equal(metaConLineaBase([], "2026-04", "2026-09"), false); // se borró todo
  assert.equal(metaConLineaBase(["2026-10", "2026-11", "2026-12"], "2026-04", "2026-09"), false); // meses nuevos no cuentan
});
