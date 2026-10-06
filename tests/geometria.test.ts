import { test } from "node:test";
import assert from "node:assert/strict";
import { lineasDeTabla, zonaDelEstrato } from "../app/lib/factura/geometria";
import { extraerDeTexto } from "../app/lib/factura/extraer-texto";

const caja = (texto: string, x: number, y: number, ancho = 60, alto = 22) => ({
  texto,
  poligono: [[x, y - alto / 2], [x + ancho, y - alto / 2], [x + ancho, y + alto / 2], [x, y + alto / 2]] as [number, number][],
});

// Tabla de la factura de estrato 1 con la foto torcida (≈2°: a la derecha baja ~14 px) y el gráfico de barras al lado.
function tabla(inclinacion: number) {
  const filas = [["ABR", "278", "218,067", "30"], ["MAY", "256", "209,479", "31"], ["JUN", "267", "222,704", "30"], ["JUL", "282", "233,701", "31"], ["AGO", "256", "219,490", "31"], ["SEP", "313", "278,625", "30"]];
  const cajas = filas.flatMap((f, i) => {
    const y = 1065 + i * 26;
    return [caja(f[0], 790, y), caja(f[1], 970, y + inclinacion * 0.3), caja(f[2], 1150, y + inclinacion * 0.6), caja(f[3], 1400, y + inclinacion)];
  });
  // números sobre las barras (a la altura de las primeras filas) y rótulos del gráfico en un renglón
  const barras = ["278", "256", "267", "282", "256", "313", "385", "275"].map((n, i) => caja(n, 160 + i * 75, 1060 + (i % 3) * 8));
  const ejes = ["ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "ACTPROM"].map((n, i) => caja(n, 150 + i * 90, 1225));
  return [...cajas, ...barras, ...ejes, caja("Periodo facturado: 29/AGO/2026 - 28/SEP/2026", 100, 1500, 500)];
}

test("tabla leída por posición: kWh, valor y días de cada mes aunque la foto esté torcida", () => {
  for (const inc of [0, 14, -14]) {
    const l = lineasDeTabla(tabla(inc));
    assert.deepEqual(l, ["ABR 278 218,067 30", "MAY 256 209,479 31", "JUN 267 222,704 30", "JUL 282 233,701 31", "AGO 256 219,490 31", "SEP 313 278,625 30"]);
  }
});

test("las filas por posición llegan hasta el histórico con kWh y días correctos", () => {
  const texto = lineasDeTabla(tabla(14)).join("\n") + "\n29/AGO/2026 - 28/SEP/2026 Días facturados: 31";
  const h = extraerDeTexto(texto).historico;
  assert.deepEqual(h.map((x) => `${x.periodo}:${x.kwh}:${x.dias}`), ["2026-04:278:30", "2026-05:256:31", "2026-06:267:30", "2026-07:282:31", "2026-08:256:31", "2026-09:313:30"]);
});

test("los rótulos del gráfico (en un renglón) no se toman por una tabla", () => {
  assert.deepEqual(lineasDeTabla(tabla(0).filter((c) => !/^\d/.test(c.texto) || c.poligono[0][0] < 400)), []);
});

test("zona del estrato: a la derecha de 'Estrato', o de 'Subsidio' si no se leyó", () => {
  const a = zonaDelEstrato([caja("Estrato:", 1060, 753, 110)]);
  assert.equal(a?.ancla, "estrato");
  assert.ok(a && a.x >= 1170);
  assert.equal(zonaDelEstrato([caja("% Subsidio:", 770, 750, 200)])?.ancla, "subsidio");
  assert.equal(zonaDelEstrato([caja("Ruta: 01", 50, 50)]), null);
});

test("un mes sin leer en la tabla no impide corregir el periodo ni los años (5 de 6)", () => {
  const h = extraerDeTexto("ABR 278 218,067 30\nMAY 256 209,479 31\nJUN 267 222,704 30\nJUL 282 233,701 31\nSEP 313 278,625 30\n29/AGO/2026 - 28/SEP/2026 Días facturados: 31").historico;
  assert.deepEqual(h.map((x) => x.periodo), ["2026-04", "2026-05", "2026-06", "2026-07", "2026-09"]);
});

test("cada fila trae la zona del kWh para releerlo ampliado", async () => {
  const { filasDeTabla } = await import("../app/lib/factura/geometria");
  const f = filasDeTabla(tabla(0));
  const may = f.find((x) => x.mes === "MAY");
  assert.ok(may && may.kwh === 256 && may.zonaKwh.x > 900 && may.zonaKwh.x < 1000 && may.zonaKwh.alto > 20);
});
