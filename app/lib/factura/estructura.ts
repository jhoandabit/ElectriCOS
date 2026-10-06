// Patrones por ESTRUCTURA (sin etiquetas).
// En varias facturas —p. ej. Energía de Pereira— las etiquetas como
// "Lectura anterior" o "Estrato" hacen parte del diseño de fondo y no
// quedan en el texto del PDF ni siempre en el OCR. Aquí reconocemos los
// datos por la forma de la fila en la que aparecen.

import { diasEntre, fechasEnTexto, formatoPeriodo, mesDesdeTexto, normalizarTexto, parseNumeroCO, periodoDesdeRango } from "./texto";
import type { PuntoHistorico } from "./tipos";

export type DatosEstructura = {
  lecturaAnterior?: number;
  lecturaActual?: number;
  factorMultiplicador?: number;
  consumoKwh?: number;
  promedioKwh?: number;
  periodo?: string;
  diasFacturados?: number;
  municipio?: string;
  estrato?: number;
  valorKwh?: number;
  totalPagar?: number;
  historico?: PuntoHistorico[];
};

const MESES_CORTOS = "ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic";

/**
 * Fila del medidor:  <medidor> <marca> <lectura A> <lectura B> <diferencia> <factor> <consumo> [<promedio>]
 * Ej. EEP: "1408001303 GNS  19840  19487  353  1  353  267"
 * Se acepta solo si |A − B| = diferencia y diferencia × factor = consumo.
 */
function filaMedidor(t: string): Partial<DatosEstructura> | null {
  const patron = /\b\d{5,12}\s+[a-z]{2,6}\s+(\d{1,7})\s+(\d{1,7})\s+(\d{1,6})\s+(\d{1,4}(?:[.,]\d+)?)\s+(\d{1,6})(?:\s+(\d{1,6}))?/g;
  for (const m of t.matchAll(patron)) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const dif = Number(m[3]);
    const factor = parseNumeroCO(m[4]) ?? 1;
    const consumo = Number(m[5]);
    if (Math.abs(a - b) !== dif || Math.abs(dif * factor - consumo) > 1) continue;
    return {
      lecturaAnterior: Math.min(a, b),
      lecturaActual: Math.max(a, b),
      factorMultiplicador: factor,
      consumoKwh: consumo,
      promedioKwh: m[6] ? Number(m[6]) : undefined,
    };
  }
  return null;
}

/**
 * Energía de Pereira rotula cada fila del histórico por el mes de EMISIÓN de la
 * factura; ElectriCOs nombra el periodo por el mes en que TERMINA. Si las filas son
 * meses seguidos y la última lleva el mismo mes que el periodo actual (p. ej. periodo
 * 29/AGO–28/SEP, emitida en octubre, con filas ABR…SEP), esa fila no puede ser el
 * propio mes actual: son los periodos ANTERIORES y todas se corren un mes atrás.
 * Sin periodo conocido, o sin esa coincidencia, no se toca nada.
 */
function corregirRotulos(meses: number[], periodo: string | undefined): number[] {
  if (!periodo || meses.length < 2) return meses;
  const mesActual = Number(periodo.split("-")[1]);
  const seguidos = meses.every((m, i) => i === 0 || (m - meses[i - 1] + 12) % 12 === 1);
  if (!seguidos || meses[meses.length - 1] !== mesActual) return meses;
  return meses.map((m) => (m === 1 ? 12 : m - 1));
}

/**
 * Tabla con encabezado, como la de Celsia (y muchas otras empresas):
 *   Tipo de energía  Lectura actual (kWh)  Lectura anterior (kWh)  Múltiplo  Consumo
 *   Energía Activa   24919                 24605                   1         314
 * Se lee el orden de las columnas en el encabezado y se toman los números del
 * renglón siguiente en ese mismo orden. Solo se acepta si las cuentas cuadran.
 */
function lecturasEnTabla(t: string): Partial<DatosEstructura> | null {
  const lineas = t.split("\n");
  for (let i = 0; i + 1 < lineas.length; i++) {
    const enc = lineas[i];
    const pAct = enc.search(/lectura\s*actual/);
    const pAnt = enc.search(/lectura\s*anterior/);
    if (pAct < 0 || pAnt < 0) continue;
    // Los valores pueden estar en el renglón siguiente o dos más abajo.
    for (const fila of lineas.slice(i + 1, i + 3)) {
      const nums = numerosDeLinea(fila).filter((n) => Number.isFinite(n));
      const enteros = nums.filter((n) => Number.isInteger(n));
      if (enteros.length < 2) continue;
      const [x, y] = enteros;
      const actual = pAct < pAnt ? x : y;
      const anterior = pAct < pAnt ? y : x;
      const dif = actual - anterior;
      if (dif <= 0 || dif >= 3000) continue;
      // Después de las lecturas puede venir: [diferencia] [múltiplo] consumo.
      // Se busca un número igual a diferencia × el número anterior (el múltiplo).
      const resto = enteros.slice(2);
      for (let j = 1; j < resto.length; j++) {
        const f = resto[j - 1];
        if (f > 0 && f <= 1000 && Math.abs(resto[j] - dif * f) <= 1) {
          return { lecturaAnterior: anterior, lecturaActual: actual, factorMultiplicador: f, consumoKwh: resto[j] };
        }
      }
      return { lecturaAnterior: anterior, lecturaActual: actual, consumoKwh: dif };
    }
  }
  return null;
}

/**
 * Gráfico de barras con meses, como en Celsia:
 *   119 kWh  112 kWh  121 kWh  153 kWh  129 kWh  544 kWh  314 kWh
 *   SEP  NOV  ENE  MAR  MAY  JUL  Actual
 * Los días de cada periodo se deducen del salto entre meses (bimestral ≈ 61).
 */
function historicoEnGrafico(t: string, periodo: string | undefined): PuntoHistorico[] {
  const lineas = t.split("\n");
  for (let i = 1; i < lineas.length; i++) {
    const mesesLeidos = Array.from(lineas[i].matchAll(new RegExp(String.raw`\b(${MESES_CORTOS})\b`, "g"))).map((m) => mesDesdeTexto(m[1]) as number);
    // "Actual" (Celsia) o "ACT PROM" / "ACTPROM" (Energía de Pereira).
    if (mesesLeidos.length < 3 || !/\bactual\b|\bact\s*prom/.test(lineas[i])) continue;
    const meses = corregirRotulos(mesesLeidos, periodo);
    // Los valores están unos renglones más arriba (entre ellos puede haber otros textos).
    for (const arriba of lineas.slice(Math.max(0, i - 4), i).reverse()) {
      let valores = Array.from(arriba.matchAll(/(\d{1,4})\s*kwh/g)).map((m) => Number(m[1]));
      if (valores.length !== meses.length + 1) {
        // Energía de Pereira escribe los valores sin "kWh": seis meses + Actual (+ Promedio).
        // (sin "lookbehind": iOS anterior a 16.4 no lo soporta y rompería la carga del módulo)
        const sueltos = Array.from(arriba.matchAll(/(?:^|[^\d.,])(\d{2,4})(?![\d.,])/g)).map((m) => Number(m[1]));
        if (sueltos.length !== meses.length + 1 && sueltos.length !== meses.length + 2) continue;
        valores = sueltos.slice(0, meses.length + 1);
      }
      const hoy = new Date();
      let [anio, mesRef] = periodo ? periodo.split("-").map(Number) : [hoy.getFullYear(), hoy.getMonth() + 1];
      const puntos: PuntoHistorico[] = [];
      for (let k = meses.length - 1; k >= 0; k--) {
        const mes = meses[k];
        if (mes >= mesRef) anio -= 1;
        const salto = (mesRef - mes + 12) % 12 || 12;
        puntos.unshift({ periodo: formatoPeriodo(anio, mes), kwh: valores[k], dias: Math.round(salto * 30.4) });
        mesRef = mes;
      }
      // El primer punto no tiene anterior: se le asigna el mismo salto que al segundo.
      if (puntos.length > 1) puntos[0].dias = puntos[1].dias;
      return puntos;
    }
  }
  return [];
}

/** "14/AGO/2026 - 10/SEP/2026  28" → periodo y días. */
function rangoFechas(t: string): Partial<DatosEstructura> | null {
  // Una fecha: "14/ago/2026", "14-08-2026" y lo que deja el OCR: "14ago/2026", "14/ag0/2026".
  // Si el mes no es válido, fechasEnTexto lo descarta más abajo.
  const FECHA = String.raw`\d{1,2}\s*(?:[/\-.]\s*[a-z0-9]{2,10}|[a-z][a-z0-9]{2,9})\s*[/\-.]\s*20\d{2}`;
  const patron = new RegExp(String.raw`(${FECHA})\s*(?:-|a|al|hasta)\s*(${FECHA})(?:\s+(\d{1,3})\b)?`);
  const m = t.match(patron);
  if (!m) return null;
  const [inicio] = fechasEnTexto(m[1]);
  const [fin] = fechasEnTexto(m[2]);
  if (!inicio || !fin || !(fin > inicio) || diasEntre(inicio, fin) > 75) return null;
  // Solo devolvemos los días si están escritos junto al rango. Si no, los
  // calcula extraer-texto.ts (contando ambos extremos, como la empresa).
  const dias = m[3] ? Number(m[3]) : null;
  return {
    periodo: periodoDesdeRango(inicio, fin) ?? undefined,
    diasFacturados: dias !== null && dias >= 15 && dias <= 75 ? dias : undefined,
  };
}

/** Liquidación por rangos: "0-173 173 905.0529 ..." y ">173 180 905.0529 ..." → 353 kWh */
function liquidacionPorRangos(t: string): number | null {
  const filas = Array.from(t.matchAll(/(?:^|\n|\s)(?:\d{1,4}\s*-\s*\d{1,4}|>\s*\d{1,4})\s+(\d{1,5}(?:[.,]\d{1,2})?)\s+\d{2,4}[.,]\d{2,4}\b/g));
  if (!filas.length) return null;
  const total = filas.reduce((s, m) => s + (parseNumeroCO(m[1]) ?? 0), 0);
  return total > 0 ? Math.round(total * 100) / 100 : null;
}

/** "147 Cartago  Residencial" (código DANE corto + municipio + uso). */
function municipioYUso(textoOriginal: string): string | null {
  const m = textoOriginal.match(/\b\d{2,5}\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúÑñ]+(?:\s+(?:de|del|la|el|[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúÑñ]+)){0,3})\s+(?:Residencial|Comercial|Industrial|Oficial|Rural)\b/);
  return m ? m[1].trim() : null;
}

/**
 * EEP: "CT0172  4" (transformador seguido del estrato).
 * El OCR puede leer "CT0" como "CTo", "Cro" o "C70".
 */
function estratoTrasTransformador(t: string): number | null {
  // Entre el transformador y el estrato pueden venir hasta dos porcentajes
  // ("% Contribución", "% Subsidio": -49.05 en los estratos 1 a 3). El OCR a veces
  // pierde el signo menos.
  const m = t.match(/\bc[tr7][o0]\d{3,5}\s+(?:[-+]?\d{1,3}[.,]\d{1,2}\s+){0,2}([1-6])\b/);
  return m ? Number(m[1]) : null;
}

/** Costo unitario con 4 decimales seguido del mes de la tarifa: "905.0529  AGO-2026". */
function costoUnitario(t: string): number | null {
  const m = t.match(new RegExp(String.raw`\b(\d{3,4}[.,]\d{3,4})\s+(?:${MESES_CORTOS})[a-z]*\s*[-/]\s*20\d{2}\b`));
  if (!m) return null;
  const n = parseNumeroCO(m[1].replace(",", "."));
  return n !== null && n >= 200 && n <= 3000 ? n : null;
}

/** "factura $349,864" / "Pago total ... $349,864" */
function totalFactura(t: string): number | null {
  const m = t.match(/(?:factura|pago\s*total|total\s*a\s*pagar)\s*\$\s*([\d.,]+)/) ?? t.match(/\$\s*([\d]{1,3}(?:[.,]\d{3})+)\b/);
  const n = m ? parseNumeroCO(m[1]) : null;
  return n !== null && n >= 1000 ? n : null;
}

/**
 * Tabla de consumos: "MAR  207  162,374  31" (mes, kWh, pesos, días).
 * Los años se deducen hacia atrás desde el periodo actual.
 */
function tablaHistorico(t: string, periodo: string | undefined): PuntoHistorico[] {
  // Los días son opcionales: si el OCR pierde esa columna se asumen 30.
  const patron = new RegExp(String.raw`\b(${MESES_CORTOS})[a-z]*\.?\s+(\d{1,4})\s+\$?[\d.,]{3,}(?:\s+(\d{2})\b)?`, "g");
  const filas: { mes: number; kwh: number; dias: number }[] = [];
  for (const m of t.matchAll(patron)) {
    const mes = mesDesdeTexto(m[1]);
    const kwh = Number(m[2]);
    const dias = m[3] ? Number(m[3]) : 30;
    if (!mes || kwh < 1 || kwh >= 3000 || dias < 15 || dias > 75) continue;
    if (!filas.some((f) => f.mes === mes)) filas.push({ mes, kwh, dias });
  }
  if (!filas.length) return [];
  const rotulos = corregirRotulos(filas.map((f) => f.mes), periodo);
  filas.forEach((f, i) => { f.mes = rotulos[i]; });

  const hoy = new Date();
  let [anio, mesRef] = periodo ? periodo.split("-").map(Number) : [hoy.getFullYear(), hoy.getMonth() + 1];
  // Recorremos de la fila más reciente a la más antigua asignando años.
  const resultado: PuntoHistorico[] = [];
  for (let i = filas.length - 1; i >= 0; i--) {
    const { mes, kwh, dias } = filas[i];
    if (mes >= mesRef) anio -= 1; // cruzamos a diciembre del año anterior
    resultado.unshift({ periodo: formatoPeriodo(anio, mes), kwh, dias });
    mesRef = mes;
  }
  return resultado;
}

export function extraerPorEstructura(textoOriginal: string): DatosEstructura {
  const t = normalizarTexto(textoOriginal);
  const datos: DatosEstructura = {};

  const medidor = filaMedidor(t) ?? lecturasEnTabla(t);
  if (medidor) Object.assign(datos, medidor);

  const liquidacion = liquidacionPorRangos(t);
  if (datos.consumoKwh === undefined && liquidacion) datos.consumoKwh = liquidacion;

  const rango = rangoFechas(t);
  if (rango) Object.assign(datos, rango);

  const municipio = municipioYUso(textoOriginal);
  if (municipio) datos.municipio = municipio;

  const estrato = estratoTrasTransformador(t);
  if (estrato) datos.estrato = estrato;

  const cu = costoUnitario(t);
  if (cu) datos.valorKwh = cu;

  const total = totalFactura(t);
  if (total) datos.totalPagar = total;

  const historico = tablaHistorico(t, datos.periodo);
  const grafico = historicoEnGrafico(t, datos.periodo);
  if (historico.length || grafico.length) datos.historico = historico.length >= grafico.length ? historico : grafico;

  return datos;
}

export type FilaLecturas = {
  lecturaAnterior: number;
  lecturaActual: number;
  consumoKwh: number;
  factorMultiplicador: number | null;
  promedioKwh: number | null;
};

/** Números enteros de un renglón leído por OCR ("19.840" o "19,840" → 19840). */
export function numerosDeLinea(linea: string): number[] {
  return (linea.match(/\d[\d.,]*/g) ?? [])
    .map((t) => t.replace(/[.,]$/, ""))
    .map((t) => (/^\d{1,3}([.,]\d{3})+$/.test(t) ? t.replace(/[.,]/g, "") : t))
    .map((t) => Number(t.replace(",", ".")))
    .filter((n) => Number.isFinite(n));
}

/**
 * Busca, en una fila de números, dos lecturas seguidas de su diferencia:
 *   … 19840 19487 353 [1 353] [267]
 * Opcionalmente, después vienen el factor, el consumo (= diferencia × factor)
 * y el promedio, como en la fila "Activa" de Energía de Pereira.
 */
export function lecturasDesdeNumeros(numeros: number[]): FilaLecturas | null {
  for (let i = 0; i + 2 < numeros.length; i++) {
    const [a, b, c] = [numeros[i], numeros[i + 1], numeros[i + 2]];
    if (!Number.isInteger(a) || !Number.isInteger(b) || Math.max(a, b) < 100) continue;
    const dif = Math.abs(a - b);
    if (dif < 5 || dif >= 3000 || dif !== c) continue;
    if (a >= 1990 && a <= 2100 && b >= 1990 && b <= 2100) continue; // años

    let factor: number | null = null;
    let consumo = dif;
    let promedio: number | null = null;
    const [f, k, p] = [numeros[i + 3], numeros[i + 4], numeros[i + 5]];
    if (f !== undefined && k !== undefined && f > 0 && f <= 1000 && Math.abs(dif * f - k) <= 1) {
      factor = f;
      consumo = k;
      if (p !== undefined && p >= 5 && p < 3000) promedio = p;
    } else if (f !== undefined && f === dif) {
      // "… 353 353 267": consumo repetido y promedio, sin factor
      if (k !== undefined && k >= 5 && k < 3000) promedio = k;
    }

    return {
      lecturaAnterior: Math.min(a, b),
      lecturaActual: Math.max(a, b),
      consumoKwh: consumo,
      factorMultiplicador: factor,
      promedioKwh: promedio,
    };
  }
  return null;
}

/** Prueba cada renglón y, si ninguno sirve, todos los números juntos. */
export function lecturasDesdeLineas(lineas: string[]): FilaLecturas | null {
  for (const linea of lineas) {
    const r = lecturasDesdeNumeros(numerosDeLinea(linea));
    if (r) return r;
  }
  return lecturasDesdeNumeros(lineas.flatMap(numerosDeLinea));
}
