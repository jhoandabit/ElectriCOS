const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-09" → "septiembre 2026" */
export function nombreMes(periodo: string) {
  const [anio, mes] = periodo.split("-").map(Number);
  return `${MESES[mes - 1] ?? periodo} ${anio}`;
}

/** "2026-09" → "sep 26" */
export function mesCorto(periodo: string) {
  const [anio, mes] = periodo.split("-").map(Number);
  return `${CORTOS[mes - 1] ?? "?"} ${String(anio).slice(2)}`;
}

/** Mes siguiente: "2026-12" → "2027-01" */
export function mesSiguiente(periodo: string) {
  const [anio, mes] = periodo.split("-").map(Number);
  return mes === 12 ? `${anio + 1}-01` : `${anio}-${String(mes + 1).padStart(2, "0")}`;
}

export function mesActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-09" → "sep 2026" (para tablas angostas) */
export function mesMedio(periodo: string) {
  const [anio, mes] = periodo.split("-").map(Number);
  return `${CORTOS[mes - 1] ?? "?"} ${anio}`;
}
