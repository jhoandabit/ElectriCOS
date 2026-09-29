// Pruebas del lector de facturas con la factura de referencia (texto anonimizado).
// Ejecutar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { datosDeRecorte, extraerDeTexto, municipioConocido } from "../app/lib/factura/extraer-texto";
import { agruparEnRenglones, elegirLectura } from "../app/lib/factura/ocr-paddle";
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

test("municipio: corrige palabras pegadas por el OCR", () => {
  assert.equal(municipioConocido("Cartago Serviclo"), "Cartago");
  assert.equal(municipioConocido("Santa Rosa de Cabal"), "Santa Rosa de Cabal");
  assert.equal(municipioConocido("Pueblo Inventado"), "Pueblo Inventado");
});

test("días del periodo: se cuentan ambos extremos si no están escritos", () => {
  const d = extraerDeTexto("Periodo facturado: 14/AGO/2026 - 10/SEP/2026\nConsumo 353 kWh");
  assert.equal(d.diasFacturados, 28);
  assert.equal(d.periodo, "2026-09");
});

test("OCR de foto torcida: los renglones no se parten", () => {
  // Cajas como las entrega PaddleOCR en una foto inclinada 1,5°: la fila
  // "Activa" baja unos píxeles de izquierda a derecha.
  const caja = (texto: string, x: number, y: number, ancho: number) => ({
    texto,
    confianza: 0.99,
    poligono: [[x, y], [x + ancho, y + 1], [x + ancho, y + 21], [x, y + 20]] as [number, number][],
  });
  const renglones = agruparEnRenglones([
    caja("Activa", 20, 100, 60),
    caja("1408001303 GNS", 110, 102, 150),
    caja("19840", 290, 105, 60),
    caja("19487", 380, 108, 60),
    caja("353", 470, 111, 35),
    caja("1", 530, 113, 10),
    caja("353", 560, 115, 35),
    caja("267", 640, 118, 35),
    caja("Reactiva", 20, 130, 70),
  ]);
  assert.equal(renglones[0], "Activa  1408001303 GNS  19840  19487  353  1  353  267");
  assert.equal(renglones[1], "Reactiva");
  const d = extraerDeTexto(renglones.join("\n"));
  assert.equal(d.consumoKwh, 353);
  assert.equal(d.lecturaActual, 19840);
});

// Texto REAL que PaddleOCR leyó de una captura de pantalla pequeña (616×500)
// de la factura de referencia, sin ampliar (1x) y ampliada al doble (2x).
// Datos personales borrados. El periodo "14/AGO/2026 - 10/SEP/2026" sale
// ilegible ("6MAG0行026-105EPG224") y los días salen "21" en vez de 28.
for (const [nombre, archivo] of [["1x", "eep-ocr-captura-1x.txt"], ["2x", "eep-ocr-captura-2x.txt"]]) {
  test(`captura pequeña leída por OCR (${nombre}): lo que sí se puede rescatar`, () => {
    const texto = readFileSync(new URL(`./fixtures/${archivo}`, import.meta.url), "utf8");
    const { datos, avisos } = validarYCompletar(extraerDeTexto(texto));
    assert.equal(datos.consumoKwh, 353);
    assert.equal(datos.lecturaAnterior, 19487);
    assert.equal(datos.lecturaActual, 19840);
    assert.equal(datos.municipio, "Cartago");
    assert.equal(datos.estrato, 4); // "Cro172  4" (1x) o "Estrato; 4" (2x)
    // El periodo se deduce de la fecha de emisión (14/SEP/2026) y se avisa.
    assert.equal(datos.periodo, "2026-09");
    assert.equal(datos.periodoEstimado, true);
    assert.ok(avisos.some((a) => a.campo === "periodo" && a.nivel === "revisar"));
    // Días ilegibles (el OCR leyó "Dim facturadas 21", que es falso): no se
    // usa ese número; se asume 30, que no altera la normalización, y se avisa.
    assert.equal(datos.diasFacturados, 30);
    assert.equal(datos.diasEstimados, true);
    assert.ok(avisos.some((a) => a.campo === "diasFacturados" && a.nivel === "revisar"));
  });
}

test("municipio con letras mal leídas por el OCR", () => {
  assert.equal(municipioConocido("Ctago"), "Cartago");
  assert.equal(municipioConocido("Cmrtag"), "Cartago");
  assert.equal(municipioConocido("Dosquebradaz"), "Dosquebradas");
  // Nombres que no se parecen a ninguno se dejan como vienen.
  assert.equal(municipioConocido("Sevilla"), "Sevilla");
});

test("el PDF sigue leyendo el periodo real, no el estimado", () => {
  const texto = readFileSync(new URL("./fixtures/eep-factura-referencia.txt", import.meta.url), "utf8");
  const datos = extraerDeTexto(texto);
  assert.equal(datos.periodo, "2026-09");
  assert.equal(datos.periodoEstimado, undefined);
  assert.equal(datos.diasFacturados, 28);
  assert.equal(datos.diasEstimados, undefined);
});

test("histórico del PDF: 6 meses con kWh y días, listos para la línea base", () => {
  const texto = readFileSync(new URL("./fixtures/eep-factura-referencia.txt", import.meta.url), "utf8");
  const { datos } = validarYCompletar(extraerDeTexto(texto));
  assert.deepEqual(datos.historico, [
    { periodo: "2026-03", kwh: 207, dias: 31 },
    { periodo: "2026-04", kwh: 178, dias: 30 },
    { periodo: "2026-05", kwh: 256, dias: 31 },
    { periodo: "2026-06", kwh: 280, dias: 30 },
    { periodo: "2026-07", kwh: 268, dias: 31 },
    { periodo: "2026-08", kwh: 415, dias: 33 },
  ]);
});

test("histórico mal leído por OCR (\"AGO-2026 24\") se descarta con aviso", () => {
  const texto = readFileSync(new URL("./fixtures/eep-ocr-captura-2x.txt", import.meta.url), "utf8");
  const crudo = extraerDeTexto(texto);
  assert.ok(crudo.historico.some((p) => p.kwh === 24)); // el error existe en la lectura…
  const { datos, avisos } = validarYCompletar(crudo);
  assert.equal(datos.historico.length, 0); // …pero no llega a guardarse
  assert.ok(avisos.some((a) => a.campo === "historico"));
});

test("lectura guiada: la línea del periodo y los días, aunque el OCR los lea mal", () => {
  // Así puede quedar esa línea en una foto borrosa: sin barra, con 0 en vez de O.
  for (const linea of [
    "Periodo facturado:  14/AGO/2026 - 10/SEP/2026  Días facturados:  28",
    "Periodo facturado:  14AGO/2026 - 10/SEP/2026  Dias facturados  28",
    "Periodo facturado:  14/AG0/2026 - 10/5EP/2026  28",
  ]) {
    const r = datosDeRecorte([linea]);
    assert.equal(r.periodo, "2026-09", linea);
    assert.equal(r.diasFacturados, 28, linea);
    assert.equal(r.lecturaAnterior, undefined);
  }
});

test("lectura guiada: la fila del medidor", () => {
  const r = datosDeRecorte(["Activa  1408001303  GNS  19840  19487  353  1  353  267"]);
  assert.equal(r.consumoKwh, 353);
  assert.equal(r.lecturaAnterior, 19487);
  assert.equal(r.periodo, undefined); // nada estimado en un recorte
  assert.equal(r.diasFacturados, undefined);
});

// Factura real de Celsia (Cartago, estrato 2, facturación bimestral), texto
// tal como lo entrega PDF.js en la app. Datos personales borrados.
test("Celsia PDF: lecturas en tabla, valor del kWh, municipio y bimestre", () => {
  const texto = readFileSync(new URL("./fixtures/celsia-factura-referencia.txt", import.meta.url), "utf8");
  const { datos, confianzaConsumo } = validarYCompletar(extraerDeTexto(texto));
  assert.equal(datos.empresa, "celsia");
  assert.equal(datos.consumoKwh, 314);
  // "Lectura actual (kWh)  Lectura anterior (kWh)" → 24919  24605 (antes salía 24919 → 24919)
  assert.equal(datos.lecturaAnterior, 24605);
  assert.equal(datos.lecturaActual, 24919);
  assert.equal(confianzaConsumo >= 95, true);
  assert.equal(datos.diasFacturados, 61); // bimestral
  assert.equal(datos.periodo, "2026-09"); // 14/JUL/2026 – 12/SEP/2026
  assert.equal(datos.estrato, 2);
  // Antes "Buga": salía de un texto legal ("…en los municipios de Buga, Cartago…")
  assert.equal(datos.municipio, "Cartago");
  // Antes 173 (eran los kWh subsidiados). 314 × 981,92 = 308.323 ✓
  assert.equal(datos.valorKwh, 981.92);
  // Gráfico bimestral: SEP NOV ENE MAR MAY JUL + Actual
  assert.deepEqual(datos.historico.map((p) => [p.periodo, p.kwh, p.dias]), [
    ["2025-09", 119, 61], ["2025-11", 112, 61], ["2026-01", 121, 61],
    ["2026-03", 153, 61], ["2026-05", 129, 61], ["2026-07", 544, 61],
  ]);
});

test("un periodo en el futuro (OCR: 2026 → 2028) no se usa", () => {
  const { datos, avisos } = validarYCompletar(extraerDeTexto("Periodo facturado: 14/JUL/2028 - 12/SEP/2028\nConsumo mes: 314 kWh"));
  assert.equal(datos.periodo, null); // sin otras fechas para corregir el año: se pide escribirlo
  assert.ok(avisos.some((a) => a.mensaje.includes("periodo")));
});

test("lectura guiada: la tabla de últimos consumos", () => {
  const r = datosDeRecorte(["MAR  207  162,374  31", "ABR  178  145,654  30", "MAY  256  213,529  31"]);
  assert.equal(r.historico?.length, 3);
  assert.deepEqual(r.historico?.[1], { periodo: r.historico?.[1].periodo, kwh: 178, dias: 30 });
});

test("foto de Celsia: año mal leído (2028) y 'Clasificación' no son el periodo ni el municipio", () => {
  const original = readFileSync(new URL("./fixtures/celsia-factura-referencia.txt", import.meta.url), "utf8");
  // Así lo deja el OCR: 6 → 8 en el periodo y la etiqueta "Clasificación" pegada.
  const texto = original
    .replace("14/JUL/2026 - 12/SEP/2026", "14/JUL/2028 - 12/SEP/2028")
    .replace("Residencial  Estrato:  2", "Clasificaciónc  Residencial  Estrato:  2");
  const { datos, avisos } = validarYCompletar(extraerDeTexto(texto));
  assert.equal(datos.municipio, "Cartago");
  assert.equal(datos.periodo, "2026-09"); // el mes se conserva; el año sale de las demás fechas
  assert.equal(datos.periodoEstimado, true);
  assert.ok(avisos.some((a) => a.campo === "periodo"));
  assert.equal(datos.historico[datos.historico.length - 1].periodo, "2026-07"); // también se corrige
});

test("gráfico de fotos: entre lecturas distintas de una barra gana la de más dígitos", () => {
  assert.equal(elegirLectura([12, 121]), 121);
  assert.equal(elegirLectura([153]), 153);
  assert.equal(elegirLectura([121, 12, 12]), 121); // "12" es "121" sin el último dígito
  assert.equal(elegirLectura([129, 125, 129]), 129);
});

test("barras ilegibles (0 kWh) se quitan antes de compararlas con el consumo", () => {
  const base = extraerDeTexto("Consumo mes: 314 kWh\nDías facturados: 61\nPeriodo facturado: 14/JUL/2026 - 12/SEP/2026");
  const meses = ["2025-09", "2025-11", "2026-01", "2026-03", "2026-05", "2026-07"];
  const kwh = [0, 0, 0, 153, 0, 544];
  const { datos, avisos } = validarYCompletar({ ...base, historico: meses.map((periodo, i) => ({ periodo, kwh: kwh[i], dias: 61 })) });
  assert.deepEqual(datos.historico.map((p) => p.kwh), [153, 544]);
  assert.ok(avisos.some((a) => a.campo === "historico" && /No se pudo leer 4 meses/.test(a.mensaje)));
  assert.ok(!avisos.some((a) => /muy distinto del promedio/.test(a.mensaje)), "los ceros no bajan el promedio");
});

test("Celsia en fotos por partes: cada parte aporta lo suyo y juntas dan la factura completa", () => {
  const partes = readFileSync(new URL("./fixtures/celsia-ocr-partes.txt", import.meta.url), "utf8")
    .split(/^### PARTE \d\n/m)
    .filter((p) => p.trim());
  assert.equal(partes.length, 4);

  // Solo el encabezado: estrato y municipio, pero no el consumo.
  const encabezado = validarYCompletar(extraerDeTexto(partes[0])).datos;
  assert.equal(encabezado.estrato, 2);
  assert.equal(encabezado.municipio, "Cartago");
  assert.equal(encabezado.consumoKwh, null);

  // Las cuatro partes juntas (en cualquier orden).
  for (const orden of [[0, 1, 2, 3], [3, 2, 1, 0], [1, 0, 3, 2]]) {
    const { datos } = validarYCompletar(extraerDeTexto(orden.map((i) => partes[i]).join("\n")));
    assert.equal(datos.consumoKwh, 314);
    assert.equal(datos.lecturaAnterior, 24605);
    assert.equal(datos.lecturaActual, 24919);
    assert.equal(datos.diasFacturados, 61);
    assert.equal(datos.periodo, "2026-09");
    assert.equal(datos.estrato, 2);
    assert.equal(datos.municipio, "Cartago");
    assert.equal(datos.valorKwh, 981.92);
    assert.deepEqual(
      datos.historico.map((p) => `${p.periodo}:${p.kwh}`),
      ["2025-09:119", "2025-11:112", "2026-01:121", "2026-03:153", "2026-05:129", "2026-07:544"]
    );
  }
});
