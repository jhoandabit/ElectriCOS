"use client";

// Todas las lecturas y escrituras de la base de datos pasan por aquí.
// Así las pantallas no conocen SQL ni nombres de tablas, y si algo falla,
// el error se traduce a un mensaje comprensible en un solo lugar.

import type { PostgrestError } from "@supabase/supabase-js";
import type { LineaBase, Registro } from "../calculos/motor";
import { PARAMETROS_POR_DEFECTO, type Parametro } from "../calculos/parametros";
import type { DatosFactura, FuenteLectura } from "../factura/tipos";
import { supabase } from "./cliente";

export type Hogar = {
  id: string;
  alias: string;
  municipio: string;
  estrato: number;
  personas: number;
  sobre_1000_msnm: boolean;
  empresa: string | null;
};

export type RegistroConsumo = {
  id: string;
  periodo: string; // AAAA-MM
  consumo_kwh: number;
  dias: number | null;
  lectura_anterior: number | null;
  lectura_actual: number | null;
  valor_kwh: number | null;
  fuente: "manual" | "factura" | "historico";
};

export type Meta = {
  id: string;
  baseline_id: string;
  porcentaje: number;
  meta_kwh: number;
  inicio: string; // AAAA-MM
  estado: "activa" | "cumplida" | "cerrada";
  acciones: string[];
  acciones_hechas: string[];
  linea_base: { promedio_kwh: number; desde: string; hasta: string; meses: number };
};

/** Convierte errores de Postgres/Supabase en frases para estudiantes. */
function traducir(error: PostgrestError | Error | null, contexto: string): never {
  const e = error as PostgrestError | null;
  const codigo = e?.code;
  let mensaje = `No se pudo ${contexto}.`;
  if (codigo === "23505") mensaje = `No se pudo ${contexto}: ya existe un registro igual (por ejemplo, el mismo mes).`;
  else if (codigo === "23514") mensaje = `No se pudo ${contexto}: algún valor está fuera del rango permitido.`;
  else if (codigo === "42501") mensaje = `No se pudo ${contexto}: no tienes permiso para esa acción.`;
  else if (e?.message?.includes("Failed to fetch")) mensaje = `No se pudo ${contexto}: revisa tu conexión a internet.`;
  console.error(`[datos] ${contexto}`, error);
  throw new Error(mensaje);
}

const aMes = (fecha: string) => fecha.slice(0, 7); // "2026-09-01" → "2026-09"
const aFecha = (mes: string) => `${mes}-01`; // "2026-09" → "2026-09-01"
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

// ---------- Parámetros oficiales ----------
export async function obtenerParametros(): Promise<Record<string, Parametro>> {
  const porDefecto = Object.fromEntries(PARAMETROS_POR_DEFECTO.map((p) => [p.clave, p]));
  const { data, error } = await supabase()
    .from("energy_parameters")
    .select("clave, valor, unidad, vigencia, fuente, url")
    .order("vigencia", { ascending: true });
  if (error || !data) return porDefecto; // sin conexión seguimos con los valores del código
  const resultado = { ...porDefecto };
  for (const p of data) resultado[p.clave] = { ...p, valor: Number(p.valor), url: p.url ?? "" };
  return resultado;
}

// ---------- Hogar ----------
export async function obtenerHogar(): Promise<Hogar | null> {
  const { data, error } = await supabase()
    .from("households")
    .select("id, alias, municipio, estrato, personas, sobre_1000_msnm, empresa")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) traducir(error, "cargar tu hogar");
  return data;
}

export async function guardarHogar(hogar: Omit<Hogar, "id"> & { id?: string }): Promise<Hogar> {
  const consulta = hogar.id
    ? supabase().from("households").update(hogar).eq("id", hogar.id)
    : supabase().from("households").insert(hogar);
  const { data, error } = await consulta.select("id, alias, municipio, estrato, personas, sobre_1000_msnm, empresa").single();
  if (error) traducir(error, "guardar el hogar");
  return data;
}

// ---------- Consumos ----------
export async function listarRegistros(hogarId: string): Promise<RegistroConsumo[]> {
  const { data, error } = await supabase()
    .from("consumption_records")
    .select("id, periodo, consumo_kwh, dias, lectura_anterior, lectura_actual, valor_kwh, fuente")
    .eq("household_id", hogarId)
    .order("periodo", { ascending: true });
  if (error) traducir(error, "cargar el historial");
  return (data ?? []).map((r) => ({
    ...r,
    periodo: aMes(r.periodo),
    consumo_kwh: Number(r.consumo_kwh),
    lectura_anterior: num(r.lectura_anterior),
    lectura_actual: num(r.lectura_actual),
    valor_kwh: num(r.valor_kwh),
  }));
}

export type NuevoRegistro = Omit<RegistroConsumo, "id">;

/** Guarda (o reemplaza) el consumo de un mes. */
export async function guardarRegistro(hogarId: string, r: NuevoRegistro): Promise<string> {
  const { data, error } = await supabase()
    .from("consumption_records")
    .upsert({ ...r, periodo: aFecha(r.periodo), household_id: hogarId }, { onConflict: "household_id,periodo" })
    .select("id")
    .single();
  if (error) traducir(error, "guardar el consumo");
  return data.id;
}

/** Agrega los meses del histórico de la factura que todavía no estén guardados. */
export async function importarHistorico(hogarId: string, puntos: { periodo: string; kwh: number; dias?: number }[]) {
  if (!puntos.length) return 0;
  const filas = puntos.map((p) => ({
    household_id: hogarId,
    periodo: aFecha(p.periodo),
    consumo_kwh: p.kwh,
    dias: p.dias ?? null,
    fuente: "historico" as const,
  }));
  const { data, error } = await supabase()
    .from("consumption_records")
    .upsert(filas, { onConflict: "household_id,periodo", ignoreDuplicates: true })
    .select("id");
  if (error) traducir(error, "importar el histórico");
  return data?.length ?? 0;
}

export async function borrarRegistro(id: string) {
  const { error } = await supabase().from("consumption_records").delete().eq("id", id);
  if (error) traducir(error, "borrar el registro");
}

/** Evidencia de la lectura: lo que leyó la app y lo que la persona confirmó. */
export async function registrarFactura(
  hogarId: string,
  registroId: string,
  metodo: FuenteLectura | "guiada",
  confianza: number,
  extraidos: DatosFactura,
  confirmados: NuevoRegistro
) {
  // Solo datos de consumo: nada de nombres, direcciones ni números de cuenta.
  const { error } = await supabase().from("invoices").insert({
    household_id: hogarId,
    consumption_record_id: registroId,
    empresa: extraidos.empresaNombre,
    metodo,
    confianza,
    datos_extraidos: extraidos,
    datos_confirmados: confirmados,
  });
  if (error) traducir(error, "registrar la factura");
}

// ---------- Metas ----------
export async function obtenerMetaActiva(hogarId: string): Promise<Meta | null> {
  const { data, error } = await supabase()
    .from("reduction_goals")
    .select("id, baseline_id, porcentaje, meta_kwh, inicio, estado, acciones, acciones_hechas, baselines (promedio_kwh, desde, hasta, meses)")
    .eq("household_id", hogarId)
    .eq("estado", "activa")
    .maybeSingle();
  if (error) traducir(error, "cargar la meta");
  if (!data) return null;
  const lb = (Array.isArray(data.baselines) ? data.baselines[0] : data.baselines) as {
    promedio_kwh: number; desde: string; hasta: string; meses: number;
  };
  return {
    id: data.id,
    baseline_id: data.baseline_id,
    porcentaje: Number(data.porcentaje),
    meta_kwh: Number(data.meta_kwh),
    inicio: aMes(data.inicio),
    estado: data.estado,
    acciones: data.acciones ?? [],
    acciones_hechas: data.acciones_hechas ?? [],
    linea_base: { promedio_kwh: Number(lb.promedio_kwh), desde: aMes(lb.desde), hasta: aMes(lb.hasta), meses: lb.meses },
  };
}

export async function crearMeta(
  hogarId: string,
  lineaBase: LineaBase,
  porcentaje: number,
  metaKwh: number,
  inicio: string,
  acciones: string[]
) {
  const { data: base, error: errorBase } = await supabase()
    .from("baselines")
    .insert({
      household_id: hogarId,
      desde: aFecha(lineaBase.desde),
      hasta: aFecha(lineaBase.hasta),
      meses: lineaBase.meses,
      promedio_kwh: lineaBase.promedio,
      minimo_kwh: lineaBase.minimo,
      maximo_kwh: lineaBase.maximo,
      desviacion_kwh: lineaBase.desviacion,
      tendencia_kwh_mes: lineaBase.tendencia,
    })
    .select("id")
    .single();
  if (errorBase) traducir(errorBase, "guardar la línea base");

  const { error } = await supabase().from("reduction_goals").insert({
    household_id: hogarId,
    baseline_id: base.id,
    porcentaje,
    meta_kwh: metaKwh,
    inicio: aFecha(inicio),
    acciones,
  });
  if (error) traducir(error, "guardar la meta");
}

export async function actualizarAccionesHechas(metaId: string, hechas: string[]) {
  const { error } = await supabase().from("reduction_goals").update({ acciones_hechas: hechas }).eq("id", metaId);
  if (error) traducir(error, "actualizar las acciones");
}

export async function cerrarMeta(metaId: string, estado: "cumplida" | "cerrada") {
  const { error } = await supabase().from("reduction_goals").update({ estado }).eq("id", metaId);
  if (error) traducir(error, "cerrar la meta");
}

/** Registros en el formato del motor matemático. */
export function paraMotor(registros: RegistroConsumo[]): Registro[] {
  return registros.map((r) => ({ periodo: r.periodo, kwh: r.consumo_kwh, dias: r.dias }));
}
