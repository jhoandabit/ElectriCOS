import { empresaDesdeNombre } from "./empresas";
import type { RespuestaIa } from "./ia";
import { diasEntre, normalizarPeriodo, parseNumeroCO, periodoDesdeRango } from "./texto";
import { NOMBRES_EMPRESA, type DatosFactura } from "./tipos";

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") return parseNumeroCO(v);
  return null;
}

function fecha(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const m = v.match(/^(20\d{2})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Convierte la respuesta de la IA al modelo común, revisando tipos. */
export function datosDesdeIa(r: RespuestaIa): DatosFactura {
  const empresa = empresaDesdeNombre(r.empresa);
  const inicio = fecha(r.periodoInicio);
  const fin = fecha(r.periodoFin);

  const periodo =
    (inicio && fin ? periodoDesdeRango(inicio, fin) : null) ??
    normalizarPeriodo(r.periodoMes) ??
    (fin ? normalizarPeriodo(r.periodoFin?.slice(0, 7)) : null);

  const estrato = num(r.estrato);

  return {
    empresa,
    empresaNombre: empresa === "otra" ? (r.empresa?.trim() || null) : NOMBRES_EMPRESA[empresa],
    municipio: r.municipio?.trim() || null,
    estrato: estrato !== null ? Math.round(estrato) : null,
    periodo,
    diasFacturados: num(r.diasFacturados) ?? (inicio && fin ? diasEntre(inicio, fin) : null),
    lecturaAnterior: num(r.lecturaAnterior),
    lecturaActual: num(r.lecturaActual),
    factorMultiplicador: num(r.factorMultiplicador),
    consumoKwh: num(r.consumoKwh),
    promedioKwh: num(r.promedioKwh),
    valorKwh: num(r.valorKwh),
    totalPagar: num(r.totalPagar),
    historico: Array.isArray(r.historico)
      ? r.historico
          .map((p) => ({ periodo: normalizarPeriodo(p?.periodo) ?? "", kwh: num(p?.kwh) ?? -1 }))
          .filter((p) => p.periodo && p.kwh >= 0)
      : [],
  };
}
