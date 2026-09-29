// Utilidades de texto y números para facturas colombianas.

const MESES: Record<string, number> = {
  ene: 1, enero: 1,
  feb: 2, febrero: 2,
  mar: 3, marzo: 3,
  abr: 4, abril: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6,
  jul: 7, julio: 7,
  ago: 8, agosto: 8,
  sep: 9, sept: 9, septiembre: 9, set: 9, setiembre: 9,
  oct: 10, octubre: 10,
  nov: 11, noviembre: 11,
  dic: 12, diciembre: 12,
};

/** Minúsculas, sin tildes, espacios simples. Conserva dígitos y signos. */
export function normalizarTexto(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ /g, " ")
    .replace(/[|]/g, " ")
    .replace(/[—–]/g, "-")
    .toLowerCase()
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "")
    .trim();
}

/**
 * Convierte números con formato colombiano o anglosajón:
 * "1.234,5" → 1234.5 · "1,234.5" → 1234.5 · "12.345" → 12345 · "186,4" → 186.4
 */
export function parseNumeroCO(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;

  let s = valor.replace(/[$\s]/g, "").replace(/[^0-9.,-]/g, "");
  if (!s || !/\d/.test(s)) return null;

  const ultimoPunto = s.lastIndexOf(".");
  const ultimaComa = s.lastIndexOf(",");

  if (ultimoPunto >= 0 && ultimaComa >= 0) {
    // El separador que aparece de último es el decimal.
    if (ultimaComa > ultimoPunto) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (ultimaComa >= 0) {
    const decimales = s.length - ultimaComa - 1;
    const comas = (s.match(/,/g) ?? []).length;
    // "12,345" (3 cifras y una sola coma) se trata como miles.
    s = comas === 1 && decimales !== 3 ? s.replace(",", ".") : s.replace(/,/g, "");
  } else if (ultimoPunto >= 0) {
    const decimales = s.length - ultimoPunto - 1;
    const puntos = (s.match(/\./g) ?? []).length;
    // "12.345" o "1.234.567" son miles; "186.4" es decimal.
    if (puntos > 1 || decimales === 3) s = s.replace(/\./g, "");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Devuelve el número de mes (1-12) a partir de "ago", "Agosto", "08"... */
export function mesDesdeTexto(texto: string): number | null {
  let t = normalizarTexto(texto).replace(/[^a-z0-9]/g, "");
  if (/^\d+$/.test(t)) {
    if (t.length > 2) return null;
    const n = Number(t);
    return n >= 1 && n <= 12 ? n : null;
  }
  // El OCR confunde letras con números parecidos: "AG0" (cero), "5EP", "A6O", "JU1".
  if (/\d/.test(t)) t = t.replace(/0/g, "o").replace(/5/g, "s").replace(/6/g, "g").replace(/1/g, "l").replace(/8/g, "b");
  return MESES[t] ?? MESES[t.slice(0, 3)] ?? null;
}

export function formatoPeriodo(anio: number, mes: number) {
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

/** Acepta "2026-08", "08/2026", "ago-2026", "agosto 2026" → "2026-08" */
export function normalizarPeriodo(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const t = normalizarTexto(valor);

  let m = t.match(/\b(20\d{2})\s*[-/.]\s*(\d{1,2})\b/);
  if (m) {
    const mes = Number(m[2]);
    return mes >= 1 && mes <= 12 ? formatoPeriodo(Number(m[1]), mes) : null;
  }

  m = t.match(/\b(\d{1,2})\s*[-/.]\s*(20\d{2})\b/);
  if (m) {
    const mes = Number(m[1]);
    return mes >= 1 && mes <= 12 ? formatoPeriodo(Number(m[2]), mes) : null;
  }

  m = t.match(/\b([a-z]{3,10})\.?\s*[-/ ]?\s*(?:de\s+)?(20\d{2})\b/);
  if (m) {
    const mes = mesDesdeTexto(m[1]);
    if (mes) return formatoPeriodo(Number(m[2]), mes);
  }

  return null;
}

/** Extrae todas las fechas dd/mm/aaaa o dd-mmm-aaaa de un texto. */
export function fechasEnTexto(texto: string): Date[] {
  const t = normalizarTexto(texto);
  const fechas: Date[] = [];
  // "14/AGO/2026", "14-08-26" y, del OCR, "14AGO/2026" o "14/AG0/2026".
  const patron = /\b(\d{1,2})\s*(?:[-/.]\s*([a-z0-9]{3,10}|\d{1,2})|([a-z][a-z0-9]{2,9}))\.?\s*[-/.]\s*(20\d{2}|\d{2})\b/g;

  for (const m of t.matchAll(patron)) {
    const dia = Number(m[1]);
    const mes = mesDesdeTexto(m[2] ?? m[3]);
    let anio = Number(m[4]);
    if (anio < 100) anio += 2000;
    if (!mes || dia < 1 || dia > 31) continue;
    fechas.push(new Date(Date.UTC(anio, mes - 1, dia)));
  }

  return fechas;
}

/**
 * Mes al que corresponde un periodo facturado. Las empresas (p. ej.
 * Energía de Pereira) lo nombran por el mes en que termina la lectura:
 * 14-ago a 10-sep → septiembre. Restamos 5 días al final para que un
 * periodo 1-jul a 1-ago siga contando como julio.
 */
export function periodoDesdeRango(inicio: Date, fin: Date): string | null {
  if (!(fin > inicio)) return null;
  const referencia = new Date(fin.getTime() - 5 * 86_400_000);
  return formatoPeriodo(referencia.getUTCFullYear(), referencia.getUTCMonth() + 1);
}

export function diasEntre(inicio: Date, fin: Date) {
  return Math.round((fin.getTime() - inicio.getTime()) / 86_400_000);
}
