"use client";

// Notificaciones LOCALES de la APK (Capacitor): se programan en el propio celular para el día 10 y el
// día 20 de cada mes a las 8:00, así llegan con la app cerrada y sin servidor ni internet.
// En el navegador normal (sin la APK) no hace nada: ahí el consejo de la quincena sale al abrir la app.
// El plugin lo trae la APK; la web lo usa a través de window.Capacitor (no es una dependencia de la web).

import { proximasQuincenas } from "../calculos/ciclo";

type Plugin = {
  requestPermissions: () => Promise<{ display: string }>;
  checkPermissions: () => Promise<{ display: string }>;
  schedule: (o: { notifications: { id: number; title: string; body: string; schedule: { at: Date; allowWhileIdle?: boolean } }[] }) => Promise<unknown>;
  cancel: (o: { notifications: { id: number }[] }) => Promise<unknown>;
};

type CapacitorGlobal = { isNativePlatform?: () => boolean; Plugins?: { LocalNotifications?: Plugin } };

const PRIMER_ID = 1000; // ids 1000–1011: no chocan con otras notificaciones
const CUANTAS = 12; // seis meses por delante; se reprograma cada vez que se abre la app

const MENSAJES = [
  { t: "💡 Consejo de ahorro", c: "Desconecta cargadores y aparatos en espera: siguen gastando energía aunque estén apagados." },
  { t: "💡 Consejo de ahorro", c: "Cambia por LED los bombillos que más usas y apaga las luces al salir de cada cuarto." },
  { t: "📈 ¿Registraste tu factura?", c: "Anota tu consumo en ElectriCOs y mira si tu meta de ahorro va bien." },
  { t: "💡 Consejo de ahorro", c: "Plancha toda la ropa en una sola sesión y lava con la carga completa." },
];

function plugin(): Plugin | null {
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.LocalNotifications ?? null;
}

export function enAPK(): boolean {
  return plugin() !== null;
}

/** Programa (o cancela) los recordatorios del 10 y el 20. Devuelve false si no se pudo (sin APK o sin permiso). */
export async function programarRecordatorios(activos: boolean): Promise<boolean> {
  const p = plugin();
  if (!p) return false;
  try {
    const ids = Array.from({ length: CUANTAS }, (_, i) => ({ id: PRIMER_ID + i }));
    await p.cancel({ notifications: ids });
    if (!activos) return true;
    let permiso = (await p.checkPermissions()).display;
    if (permiso !== "granted") permiso = (await p.requestPermissions()).display;
    if (permiso !== "granted") return false;
    const fechas = proximasQuincenas(new Date(), CUANTAS);
    await p.schedule({
      notifications: fechas.map((at, i) => ({
        id: PRIMER_ID + i,
        title: MENSAJES[i % MENSAJES.length].t,
        body: MENSAJES[i % MENSAJES.length].c,
        schedule: { at, allowWhileIdle: true },
      })),
    });
    return true;
  } catch {
    return false;
  }
}
