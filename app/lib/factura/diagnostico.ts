// Registro de pasos de la última lectura de factura.
// Sirve para saber DÓNDE se cae la página en un celular que se queda sin memoria
// (iPhone: Safari la recarga o cierra la pestaña sin avisar). Se guarda en
// localStorage, que sobrevive a la recarga, y la pantalla "Leer factura" lo muestra
// para copiarlo. NO guarda fotos ni datos de la factura: solo nombres de pasos y tamaños.

const CLAVE = "electricos-pasos";
const MAXIMO = 80;

type Paso = { t: number; p: string };

function leer(): Paso[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function guardar(pasos: Paso[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(pasos.slice(-MAXIMO)));
  } catch {
    /* sin almacenamiento (navegación privada): no pasa nada */
  }
}

/** Empieza un registro nuevo (una lectura nueva). */
export function reiniciarPasos(texto: string) {
  guardar([{ t: Date.now(), p: texto }]);
}

/** Agrega un paso al registro. */
export function paso(texto: string) {
  guardar([...leer(), { t: Date.now(), p: texto }]);
}

export function hayPasos() {
  return leer().length > 0;
}

/** Texto listo para copiar y pegar: el celular y los pasos con su tiempo. */
export function textoDiagnostico(): string {
  const pasos = leer();
  if (!pasos.length) return "";
  const t0 = pasos[0].t;
  const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { deviceMemory?: number }) : null;
  const cabecera = [
    `Fecha: ${new Date(t0).toISOString()}`,
    `Navegador: ${nav?.userAgent ?? "?"}`,
    `Pantalla: ${typeof screen !== "undefined" ? `${screen.width}x${screen.height}` : "?"} · núcleos: ${nav?.hardwareConcurrency ?? "?"} · memoria (GB): ${nav?.deviceMemory ?? "no informa"}`,
  ];
  const lineas = pasos.map((x) => `+${((x.t - t0) / 1000).toFixed(1)} s  ${x.p}`);
  return [...cabecera, "", ...lineas].join("\n");
}
