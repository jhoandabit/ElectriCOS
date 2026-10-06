// Motor matemático de ElectriCOs.
// Funciones puras: reciben números y devuelven números. No usan la base de
// datos ni la IA, así que se pueden probar con tests/calculos.test.ts.
//
// Regla del proyecto: la IA NUNCA reemplaza estos cálculos; solo los explica.

import { SUBSIDIO_MAXIMO_POR_ESTRATO } from "./parametros";

export type Registro = {
  /** Mes del periodo facturado, formato AAAA-MM */
  periodo: string;
  kwh: number;
  /** Días facturados; si se conocen, permiten comparar meses de distinto largo */
  dias?: number | null;
};

const DIAS_MES = 30;

export function redondear(n: number, decimales = 1) {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
}

/**
 * Consumo llevado a un mes de 30 días. Una factura de 33 días y otra de 28
 * no se pueden comparar directamente: 415 kWh en 33 días equivalen a
 * 377 kWh en 30 días.
 */
export function kwhMesNormalizado(r: Registro): number {
  if (r.dias && r.dias > 0) return (r.kwh / r.dias) * DIAS_MES;
  return r.kwh;
}

/** Huella eléctrica = consumo (kWh) × factor de emisión (kg CO2e/kWh). */
export function huellaKg(kwh: number, factor: number): number {
  return kwh * factor;
}

export function huellaPorPersona(kwh: number, factor: number, personas: number): number {
  if (!(personas >= 1)) throw new Error("El número de personas debe ser 1 o más.");
  return huellaKg(kwh, factor) / personas;
}

export function kwhPorPersona(kwh: number, personas: number): number {
  if (!(personas >= 1)) throw new Error("El número de personas debe ser 1 o más.");
  return kwh / personas;
}

export type LineaBase = {
  meses: number;
  desde: string;
  hasta: string;
  promedio: number;
  minimo: number;
  maximo: number;
  /** Desviación estándar muestral */
  desviacion: number;
  /** Desviación / promedio, en %: qué tanto varía el consumo */
  variacionPct: number;
  /** Pendiente de la recta de tendencia, en kWh por mes (+ sube, − baja) */
  tendencia: number;
};

export const MESES_MINIMOS_LINEA_BASE = 3;

/** Ordena por periodo y deja un registro por mes (el último que llegue gana). */
export function ordenarRegistros(registros: Registro[]): Registro[] {
  const porMes = new Map<string, Registro>();
  for (const r of registros) porMes.set(r.periodo, r);
  return [...porMes.values()].sort((a, b) => a.periodo.localeCompare(b.periodo));
}

/** Índice del mes (año × 12 + mes) para calcular la tendencia sin huecos falsos. */
function indiceMes(periodo: string) {
  const [anio, mes] = periodo.split("-").map(Number);
  return anio * 12 + (mes - 1);
}

/** Pendiente por mínimos cuadrados: y = a + b·x */
export function pendiente(puntos: { x: number; y: number }[]): number {
  const n = puntos.length;
  if (n < 2) return 0;
  const mx = puntos.reduce((s, p) => s + p.x, 0) / n;
  const my = puntos.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of puntos) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/**
 * Línea base con los últimos `meses` registros (6 por defecto).
 * Devuelve null si hay menos de 3 meses: con tan pocos datos el promedio
 * no representa bien al hogar.
 */
export function calcularLineaBase(registros: Registro[], meses = 6): LineaBase | null {
  const ultimos = ordenarRegistros(registros).slice(-meses);
  if (ultimos.length < MESES_MINIMOS_LINEA_BASE) return null;

  const valores = ultimos.map(kwhMesNormalizado);
  const n = valores.length;
  const promedio = valores.reduce((s, v) => s + v, 0) / n;
  const desviacion = Math.sqrt(valores.reduce((s, v) => s + (v - promedio) ** 2, 0) / (n - 1));

  return {
    meses: n,
    desde: ultimos[0].periodo,
    hasta: ultimos[n - 1].periodo,
    promedio: redondear(promedio),
    minimo: redondear(Math.min(...valores)),
    maximo: redondear(Math.max(...valores)),
    desviacion: redondear(desviacion),
    variacionPct: redondear((desviacion / promedio) * 100),
    tendencia: redondear(pendiente(ultimos.map((r, i) => ({ x: indiceMes(r.periodo), y: valores[i] })))),
  };
}

/** Diferencia del consumo actual frente al promedio, en % (+ = consume más). */
export function comparacionConPromedio(kwhActual: number, promedio: number): number {
  if (!(promedio > 0)) return 0;
  return redondear(((kwhActual - promedio) / promedio) * 100);
}

/** meta = línea base × (1 − porcentaje de reducción) */
export function calcularMeta(lineaBase: number, porcentajeReduccion: number): number {
  if (!(porcentajeReduccion > 0 && porcentajeReduccion < 100)) {
    throw new Error("El porcentaje de reducción debe estar entre 0 y 100.");
  }
  return redondear(lineaBase * (1 - porcentajeReduccion / 100));
}

export type Avance = {
  periodo: string;
  kwh: number;
  meta: number;
  cumple: boolean;
  /** kWh por debajo (+) o por encima (−) de la línea base */
  ahorroKwh: number;
  ahorroKgCo2e: number;
  ahorroPesos: number | null;
};

/** Evalúa cada mes registrado desde el inicio de la meta. */
export function evaluarAvance(
  registros: Registro[],
  lineaBase: number,
  meta: number,
  inicio: string,
  factor: number,
  valorKwh?: number | null
): Avance[] {
  return ordenarRegistros(registros)
    .filter((r) => r.periodo >= inicio)
    .map((r) => {
      const kwh = kwhMesNormalizado(r);
      const ahorroKwh = lineaBase - kwh;
      return {
        periodo: r.periodo,
        kwh: redondear(kwh),
        meta,
        cumple: kwh <= meta,
        ahorroKwh: redondear(ahorroKwh),
        ahorroKgCo2e: redondear(huellaKg(ahorroKwh, factor)),
        ahorroPesos: valorKwh ? Math.round(ahorroKwh * valorKwh) : null,
      };
    });
}

/**
 * Comparación con el consumo de subsistencia. Es solo una referencia
 * regulatoria (el tope del consumo subsidiado), no un límite ni una meta.
 */
export function comparacionSubsistencia(kwhMes: number, sobre1000: boolean, bajo1000Kwh = 173, sobre1000Kwh = 130) {
  const referencia = sobre1000 ? sobre1000Kwh : bajo1000Kwh;
  return { referencia, diferencia: redondear(kwhMes - referencia), porEncima: kwhMes > referencia };
}

/**
 * ¿La meta todavía tiene su línea base? Cuenta cuántos de los meses que
 * formaron la línea base (desde–hasta, AAAA-MM) siguen registrados. Si se
 * borraron y quedan menos de 3, la meta ya no tiene contra qué compararse.
 */
export function metaConLineaBase(periodos: string[], desde: string, hasta: string): boolean {
  const quedan = new Set(periodos.filter((p) => p >= desde && p <= hasta)).size;
  return quedan >= MESES_MINIMOS_LINEA_BASE;
}


/**
 * Subsidio máximo posible del mes: el tope del estrato aplicado a los kWh que no pasan de la
 * subsistencia (lo que pase se paga a tarifa plena). Devuelve null en estratos 4, 5 y 6.
 * Es una cota ("hasta"): el subsidio real es el % que imprime la factura.
 */
export function subsidioMaximo(estrato: number, kwh: number, subsistencia: number, valorKwh: number) {
  const porcentaje = SUBSIDIO_MAXIMO_POR_ESTRATO[estrato];
  if (!porcentaje || !(kwh > 0) || !(valorKwh > 0)) return null;
  const kwhSubsidiados = Math.min(kwh, subsistencia);
  return { porcentaje, kwhSubsidiados, pesos: Math.round(kwhSubsidiados * valorKwh * (porcentaje / 100)) };
}
