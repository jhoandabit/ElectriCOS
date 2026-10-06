// Fechas de los consejos de la quincena (día 10 y día 20 de cada mes).

/**
 * Consejo "del 10 y del 20": el ciclo vigente es el último de esos dos días que ya pasó
 * (p. ej. 2026-10-20 desde el 20 hasta fin de mes). Antes del 10 no hay ciclo nuevo.
 */
export function cicloQuincenal(hoy: Date): string | null {
  const d = hoy.getDate();
  const dia = d >= 20 ? 20 : d >= 10 ? 10 : null;
  if (!dia) return null;
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${dia}`;
}
