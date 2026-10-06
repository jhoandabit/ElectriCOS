// Cola de sincronización: los consumos que no se pudieron enviar a Supabase (sin señal) quedan
// guardados en el dispositivo y se envían solos al volver la conexión.
// Estados: pending_sync (esperando) · sync_error (el servidor lo rechazó; se muestra el motivo).
// El envío es idempotente: el servidor hace upsert por (hogar, mes), así que reintentar no duplica.

import type { Almacen } from "./almacen";

export type EstadoSync = "synced" | "pending_sync" | "sync_error";

export type Pendiente = {
  clave: string; // `${hogarId}|${AAAA-MM}`
  hogarId: string;
  periodo: string;
  consumo_kwh: number;
  dias: number | null;
  lectura_anterior: number | null;
  lectura_actual: number | null;
  valor_kwh: number | null;
  fuente: "manual" | "factura" | "historico";
  /** Histórico de la factura: no debe pisar un dato que la persona ya guardó para ese mes. */
  soloSiNoExiste: boolean;
  estado: "pending_sync" | "sync_error";
  intentos: number;
  error?: string;
  creado: number;
};

type Datos = Pick<Pendiente, "periodo" | "consumo_kwh" | "dias" | "lectura_anterior" | "lectura_actual" | "valor_kwh" | "fuente">;

const clave = (hogarId: string, periodo: string) => `${hogarId}|${periodo}`;

export async function encolar(a: Almacen, hogarId: string, r: Datos, soloSiNoExiste: boolean, ahora = Date.now()): Promise<void> {
  const k = clave(hogarId, r.periodo);
  const previo = await a.leer<Pendiente>("pendientes", k);
  // Un guardado que la persona hizo a propósito manda sobre el histórico automático.
  if (previo && !previo.soloSiNoExiste && soloSiNoExiste) return;
  await a.escribir("pendientes", k, {
    clave: k,
    hogarId,
    ...r,
    soloSiNoExiste,
    estado: "pending_sync",
    intentos: 0,
    creado: previo?.creado ?? ahora,
  } satisfies Pendiente);
}

export async function listarPendientes(a: Almacen, hogarId: string): Promise<Pendiente[]> {
  return (await a.todos<Pendiente>("pendientes")).filter((p) => p.hogarId === hogarId).sort((x, y) => x.periodo.localeCompare(y.periodo));
}

export type ResultadoSync = { enviados: number; pendientes: number; conError: number; sinRed: boolean };

/**
 * Envía los pendientes uno por uno. Si falla la red se detiene (se reintenta luego, sin perder nada);
 * si el servidor rechaza uno, queda marcado sync_error con el motivo y se sigue con los demás.
 */
export async function sincronizar(
  a: Almacen,
  hogarId: string,
  enviar: (p: Pendiente) => Promise<void>,
  esErrorDeRed: (e: unknown) => boolean
): Promise<ResultadoSync> {
  let enviados = 0;
  let sinRed = false;
  for (const p of await listarPendientes(a, hogarId)) {
    try {
      await enviar(p);
      await a.borrar("pendientes", p.clave);
      enviados++;
    } catch (e) {
      if (esErrorDeRed(e)) {
        sinRed = true;
        break;
      }
      await a.escribir("pendientes", p.clave, { ...p, estado: "sync_error", intentos: p.intentos + 1, error: (e as Error).message });
    }
  }
  const quedan = await listarPendientes(a, hogarId);
  return { enviados, pendientes: quedan.length, conError: quedan.filter((p) => p.estado === "sync_error").length, sinRed };
}

type Registro = {
  id: string;
  periodo: string;
  consumo_kwh: number;
  dias: number | null;
  lectura_anterior: number | null;
  lectura_actual: number | null;
  valor_kwh: number | null;
  fuente: "manual" | "factura" | "historico";
  estado?: EstadoSync;
  error?: string;
};

/** Lo guardado en el servidor + lo que espera conexión (que se ve de inmediato, marcado como pendiente). */
export function fusionar<R extends Registro>(remotos: R[], pendientes: Pendiente[]): R[] {
  const porMes = new Map<string, R>(remotos.map((r) => [r.periodo, { ...r, estado: "synced" as EstadoSync }]));
  for (const p of pendientes) {
    if (p.soloSiNoExiste && porMes.has(p.periodo)) continue;
    porMes.set(p.periodo, {
      id: `local:${p.periodo}`,
      periodo: p.periodo,
      consumo_kwh: p.consumo_kwh,
      dias: p.dias,
      lectura_anterior: p.lectura_anterior,
      lectura_actual: p.lectura_actual,
      valor_kwh: p.valor_kwh,
      fuente: p.fuente,
      estado: p.estado,
      error: p.error,
    } as R);
  }
  return Array.from(porMes.values()).sort((x, y) => x.periodo.localeCompare(y.periodo));
}
