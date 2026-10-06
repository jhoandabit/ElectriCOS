// Lector determinístico: extrae datos del TEXTO de una factura
// (texto digital de un PDF o texto reconocido por OCR).
// No necesita internet ni claves. Es el respaldo cuando la IA no está
// disponible y la segunda opinión cuando sí lo está.

import { detectarEmpresa } from "./empresas";
import { extraerPorEstructura, lecturasDesdeLineas } from "./estructura";
import {
  diasEntre,
  fechasEnTexto,
  formatoPeriodo,
  mesDesdeTexto,
  normalizarPeriodo,
  normalizarTexto,
  parseNumeroCO,
  periodoDesdeRango,
} from "./texto";
import { DATOS_VACIOS, NOMBRES_EMPRESA, type DatosFactura, type PuntoHistorico } from "./tipos";

// Municipios atendidos por las empresas del Eje Cafetero y norte del Valle.
// Se usan solo cuando la factura no trae la etiqueta "Municipio".
const MUNICIPIOS_CONOCIDOS = [
  "Pereira", "Dosquebradas", "La Virginia", "Cartago", "Santa Rosa de Cabal",
  "Marsella", "Belén de Umbría", "Apía", "Balboa", "Guática", "La Celia",
  "Mistrató", "Pueblo Rico", "Quinchía", "Santuario", "Manizales",
  "Chinchiná", "Villamaría", "Armenia", "Calarcá", "Ansermanuevo", "Toro",
  "Obando", "Alcalá", "Ulloa", "El Águila", "Zarzal", "Roldanillo",
  "La Unión", "Tuluá", "Buga", "Palmira", "Cali", "Jamundí", "Medellín",
];

// Primero los valores con 4 decimales exactos ("905.0529", el valor del kWh): sin esto
// se leían como "905.052" y se tomaban por miles (905 052), fuera de rango.
const NUM = String.raw`(\d{1,4}[.,]\d{4}(?!\d)|\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,4})?)`;

function primerNumeroTras(texto: string, etiqueta: RegExp, ventana = 60): number | null {
  const m = texto.match(new RegExp("(?:" + etiqueta.source + ")" + String.raw`[^\d\n]{0,25}` + `[\\s\\S]{0,${ventana}}?` + NUM, "i"));
  // El patrón anterior toma el primer número tras la etiqueta dentro de la ventana.
  return m ? parseNumeroCO(m[m.length - 1]) : null;
}

/** Número mínimo de letras que hay que cambiar para pasar de a a b (Levenshtein). */
export function distanciaEdicion(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const arriba = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = arriba;
    }
  }
  return fila[b.length];
}

/**
 * Si el texto contiene un municipio conocido, devuelve su nombre bien escrito.
 * Corrige lecturas como "Cartago Serviclo" (OCR que pegó la palabra siguiente)
 * y, en nombres largos, hasta 2 letras mal leídas ("Ctago", "Cmrtag" → Cartago).
 */
export function municipioConocido(candidato: string | null): string | null {
  if (!candidato) return null;
  const c = normalizarTexto(candidato);
  const ordenados = [...MUNICIPIOS_CONOCIDOS].sort((a, b) => b.length - a.length);
  const exacto = ordenados.find((m) => new RegExp(`(^|\\s)${normalizarTexto(m)}($|\\s)`).test(c));
  if (exacto) return exacto;

  // Tolerancia a errores del OCR: se compara la primera palabra (o dos) del
  // candidato con cada municipio de 6 letras o más. Nombres cortos como
  // "Toro" o "Cali" se parecen a demasiadas palabras y no se corrigen.
  const palabras = c.split(" ");
  const opciones = [palabras[0], palabras.slice(0, 2).join(" "), palabras.slice(0, 3).join(" ")];
  let mejor: { nombre: string; d: number } | null = null;
  for (const m of MUNICIPIOS_CONOCIDOS) {
    const n = normalizarTexto(m);
    if (n.length < 6) continue;
    for (const o of opciones) {
      if (o.length < 4) continue;
      const d = distanciaEdicion(o, n);
      if (d <= 2 && (!mejor || d < mejor.d)) mejor = { nombre: m, d };
    }
  }
  return mejor?.nombre ?? candidato;
}

/** Nombre conocido si el texto es (o se parece mucho a) un municipio de la lista. */
function conocidoONada(candidato: string | null | undefined): string | null {
  if (!candidato) return null;
  const r = municipioConocido(candidato);
  return r && MUNICIPIOS_CONOCIDOS.includes(r) ? r : null;
}

/**
 * Municipio del inmueble, de la pista más confiable a la menos:
 *   1. Etiqueta "Municipio: 147 Cartago" (EEP).
 *   2. Alumbrado público: "ALCALDIA CARTAGO", "MUNICIPIO DE CARTAGO" (lo cobra el municipio del inmueble).
 *   3. Dirección del inmueble: "Dir. inmueble: … - CARTAGO" (Celsia).
 *   4. El municipio conocido que más aparece.
 *   5. Lo que diga la etiqueta aunque no esté en la lista.
 * Ojo: textos legales como "…en los municipios de Buga, Cartago…" NO cuentan
 * como etiqueta (antes daban "Buga" en la factura de Celsia).
 */
function buscarMunicipio(t: string): string | null {
  const etiqueta = t.match(/\bmunicipi[oc0]\s*[:.]\s*(?:\d{1,5}\s*[-.]?\s*)?([a-z][a-z .]{2,30}?)(?=\s{2,}|\s*[-,:/(]|\s+(?:depto|departamento|ciclo|estrato|servicio|barrio|ruta|valle|risaralda|caldas)|\n|$)/);
  const deEtiqueta = conocidoONada(etiqueta?.[1]);
  if (deEtiqueta) return deEtiqueta;

  for (const m of t.matchAll(/\b(?:alcaldia(?:\s+(?:municipal\s+)?de)?|municipio\s+de)\s+([a-z][a-z .]{2,30})/g)) {
    const nombre = conocidoONada(m[1].trim());
    if (nombre) return nombre;
  }

  const direccion = t.match(/dir(?:eccion)?\.?\s*(?:del\s*)?inmueble\s*:?[^\n]*/);
  if (direccion) {
    const enLinea = MUNICIPIOS_CONOCIDOS.map((nombre) => ({ nombre, pos: direccion[0].lastIndexOf(normalizarTexto(nombre)) }))
      .filter((x) => x.pos >= 0)
      .sort((x, y) => y.pos - x.pos);
    if (enLinea.length) return enLinea[0].nombre;
  }

  let mejor: { nombre: string; veces: number } | null = null;
  for (const nombre of MUNICIPIOS_CONOCIDOS) {
    const veces = t.split(normalizarTexto(nombre)).length - 1;
    if (veces > 0 && (!mejor || veces > mejor.veces)) mejor = { nombre, veces };
  }
  if (mejor) return mejor.nombre;

  const candidato = etiqueta?.[1].trim();
  if (candidato && candidato.length >= 3 && !/\d/.test(candidato)) return candidato.replace(/\b\w/g, (c) => c.toUpperCase());
  return null;
}

function buscarEstrato(t: string): number | null {
  const patrones = [
    // El OCR a veces lee ":" como ";" o "," ("Estrato; 4").
    /estrato\s*(?:socio\s*economico)?\s*[:;,.\-]?\s*0?([1-6])\b/,
    /\best\.?\s*[:.]?\s*0?([1-6])\b/,
    /residencial\s*(?:estrato\s*)?[-:]?\s*0?([1-6])\b/,
    /\bres\.?\s*0?([1-6])\b/,
    /\bclase\s*(?:de\s*)?(?:uso|servicio)?\s*[:.]?\s*residencial\s*0?([1-6])\b/,
  ];
  for (const p of patrones) {
    const m = t.match(p);
    if (m) return Number(m[1]);
  }
  return null;
}

/**
 * Respaldo cuando el periodo no se pudo leer (letra muy pequeña en la foto):
 * la "Fecha de emisión" suele leerse bien porque está en letra grande.
 * La factura se emite pocos días después de la última lectura
 * (EEP: lectura 10 sep, emisión 14 sep), así que el mes de la lectura es
 * el de la fecha de emisión menos 5 días. Es una ESTIMACIÓN: se avisa.
 */
export function periodoDesdeEmision(t: string): string | null {
  const m = t.match(/fecha\s*de\s*(?:emi[a-z]*|expedi[a-z]*)?\s*[:;.]?\s*(\d{1,2}\s*[/\-.]\s*[a-z0-9]{2,10}\s*[/\-.]\s*20\d{2})/);
  if (!m) return null;
  const [emision] = fechasEnTexto(m[1]);
  if (!emision) return null;
  const referencia = new Date(emision.getTime() - 5 * 86_400_000);
  return formatoPeriodo(referencia.getUTCFullYear(), referencia.getUTCMonth() + 1);
}

function periodoFuturo(periodo: string) {
  const [anio, mes] = periodo.split("-").map(Number);
  const hoy = new Date();
  return anio * 12 + mes > hoy.getFullYear() * 12 + hoy.getMonth() + 2;
}

/** Mismo mes, con el año más frecuente (y posible) entre las fechas del texto. */
export function repararAnio(t: string, periodo: string): string | null {
  const mes = Number(periodo.split("-")[1]);
  const conteo = new Map<number, number>();
  for (const m of t.matchAll(/\b(20\d{2})\b/g)) {
    const anio = Number(m[1]);
    if (!periodoFuturo(formatoPeriodo(anio, mes)) && anio >= 2015) conteo.set(anio, (conteo.get(anio) ?? 0) + 1);
  }
  const mejor = [...conteo.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
  return mejor ? formatoPeriodo(mejor[0], mes) : null;
}

function buscarDias(t: string): number | null {
  const m =
    t.match(/d[i1]as\s*(?:facturados|de\s*consumo|fact\.?|consumo)\s*[:.\-]?\s*(\d{1,3})\b/) ??
    t.match(/d[i1]as\s*(?:facturados|de\s*consumo)[\s\S]{0,40}?\b(\d{2})\b/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 120 ? n : null;
}

function buscarPeriodo(t: string): { periodo: string | null; dias: number | null } {
  // 1. "Periodo facturado: 15/jul/2026 - 14/ago/2026"
  const etiqueta = t.search(/per[i1]odo\s*(?:facturado|de\s*facturacion|de\s*consumo|consumo)?/);
  if (etiqueta >= 0) {
    const zona = t.slice(etiqueta, etiqueta + 140);
    const fechas = fechasEnTexto(zona);
    if (fechas.length >= 2) {
      return { periodo: periodoDesdeRango(fechas[0], fechas[1]), dias: diasEntre(fechas[0], fechas[1]) + 1 };
    }
    const directo = normalizarPeriodo(zona.replace(/^per[i1]odo\s*(?:facturado|de\s*facturacion|de\s*consumo|consumo)?\s*[:.]?/, ""));
    if (directo) return { periodo: directo, dias: null };
  }

  // 2. "Mes facturado: agosto de 2026" / "Factura del mes de agosto 2026"
  const mes = t.match(/mes\s*(?:facturado|de\s*consumo|de)?\s*[:.]?\s*([a-z]{3,10})\.?\s*(?:de\s*)?(20\d{2})/);
  if (mes) {
    const n = mesDesdeTexto(mes[1]);
    if (n) return { periodo: formatoPeriodo(Number(mes[2]), n), dias: null };
  }

  // 3. "Desde 15/07/2026 hasta 14/08/2026"
  const rango = t.match(/desde\s*([\d/.\-a-z]{8,12})\s*hasta\s*([\d/.\-a-z]{8,12})/);
  if (rango) {
    const [a] = fechasEnTexto(rango[1]);
    const [b] = fechasEnTexto(rango[2]);
    if (a && b) return { periodo: periodoDesdeRango(a, b), dias: diasEntre(a, b) + 1 };
  }

  return { periodo: null, dias: null };
}

/**
 * Busca tres números SEGUIDOS donde |A − B| = C (lectura, lectura,
 * diferencia). Exigir que estén juntos evita emparejar valores sueltos
 * del histórico de consumo.
 */
function buscarTripleLecturas(t: string) {
  const tokens = Array.from(t.matchAll(/\b\d{1,3}(?:[.,]\d{3})+\b|\b\d{1,7}(?:[.,]\d{1,2})?\b/g))
    .map((m) => parseNumeroCO(m[0]))
    .filter((v): v is number => v !== null);

  for (let i = 0; i + 2 < tokens.length; i++) {
    const [a, b, c] = [tokens[i], tokens[i + 1], tokens[i + 2]];
    if (!Number.isInteger(a) || !Number.isInteger(b) || Math.max(a, b) < 100) continue;
    const consumo = Math.abs(a - b);
    if (consumo < 5 || consumo >= 3000 || consumo !== c) continue;
    // Descarta años (2025 2026 1) y fechas.
    if (a >= 1990 && a <= 2100 && b >= 1990 && b <= 2100) continue;
    return { anterior: Math.min(a, b), actual: Math.max(a, b), consumo };
  }
  return null;
}

function buscarLecturasEtiquetadas(t: string) {
  const anterior = primerNumeroTras(t, /lectura\s*anterior/, 40);
  const actual = primerNumeroTras(t, /lectura\s*actual/, 40);
  return {
    anterior: anterior !== null && anterior >= 0 ? anterior : null,
    actual: actual !== null && actual >= 0 ? actual : null,
  };
}

function buscarConsumo(t: string): number | null {
  const patrones = [
    // "Consumo: 186 kWh" / "Consumo facturado 186 kwh"
    new RegExp(String.raw`consumo\s*(?:total|facturado|del\s*periodo|activa|energia\s*activa|mes)?\s*(?:\(?kwh\)?)?\s*[:.\-]?\s*` + NUM + String.raw`\s*kwh`),
    // "Consumo kWh 186"
    new RegExp(String.raw`consumo\s*(?:total\s*)?\(?kwh\)?\s*[:.\-]?\s*` + NUM + String.raw`\b`),
    // "186 kWh" cerca de la palabra consumo
    new RegExp(String.raw`consumo[\s\S]{0,60}?\b` + NUM + String.raw`\s*kwh`),
  ];
  for (const p of patrones) {
    const m = t.match(p);
    if (m) {
      const n = parseNumeroCO(m[1]);
      if (n !== null && n >= 5 && n < 3000) return n;
    }
  }
  return null;
}

function buscarHistorico(t: string): PuntoHistorico[] {
  const puntos = new Map<string, number>();
  // "ago/26 186", "agosto 2026: 186 kWh". Ignora fechas como "15-ago-2026 - 14".
  const patron = /\b(ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic)[a-z]*\.?\s*[-/ ]?\s*(20\d{2}|\d{2})\b\s*[:\-]?\s+(\d{1,4}(?:[.,]\d{1,2})?)\b(?!\s*[-/.]\s*\d)/g;

  for (const m of t.matchAll(patron)) {
    // Si el mes viene precedido por "15-" o "15/", es parte de una fecha.
    const antes = t.slice(Math.max(0, (m.index ?? 0) - 3), m.index ?? 0);
    if (/\d\s?[-/.]\s?$/.test(antes)) continue;
    const mes = mesDesdeTexto(m[1]);
    const kwh = parseNumeroCO(m[3]);
    if (!mes || kwh === null || kwh < 5 || kwh >= 3000) continue;
    let anio = Number(m[2]);
    if (anio < 100) anio += 2000;
    puntos.set(formatoPeriodo(anio, mes), kwh);
  }

  return [...puntos.entries()]
    .map(([periodo, kwh]) => ({ periodo, kwh }))
    .sort((a, b) => a.periodo.localeCompare(b.periodo))
    .slice(-12);
}

/**
 * Valor del kWh en el detalle de cobros, comprobado con su total:
 *   "501  314  Consumo Activa  Estandar  KWH  981.92  Excluido  308,323"
 *   → 314 × 981,92 = 308.323 ✓
 * Si no hay total que lo confirme, se acepta solo si está en un rango razonable.
 */
function valorEnLineaDeConsumo(t: string, consumo: number | null): number | null {
  for (const linea of t.split("\n")) {
    if (!/consumo\s*(?:activa|energia|kwh)|energia\s*activa/.test(linea) || !/\bkwh\b/.test(linea)) continue;
    const despues = linea.slice(linea.search(/\bkwh\b/) + 3);
    const nums = Array.from(despues.matchAll(/-?\d[\d.,]*/g)).map((m) => parseNumeroCO(m[0])).filter((n): n is number => n !== null);
    const precio = nums.find((n) => n >= 250 && n <= 3000);
    if (precio === undefined) continue;
    if (consumo && nums.some((n) => Math.abs(n - consumo * precio) <= Math.max(2, consumo * precio * 0.001))) return precio;
    if (!consumo) return precio;
  }
  return null;
}

export function extraerDeTexto(textoOriginal: string): DatosFactura {
  const t = normalizarTexto(textoOriginal);
  const datos: DatosFactura = { ...DATOS_VACIOS, historico: [] };

  const empresa = detectarEmpresa(t);
  datos.empresa = empresa.id;
  datos.empresaNombre = empresa.id === "otra" ? null : NOMBRES_EMPRESA[empresa.id];

  datos.municipio = buscarMunicipio(t);
  datos.estrato = buscarEstrato(t);

  const periodo = buscarPeriodo(t);
  datos.periodo = periodo.periodo;
  datos.diasFacturados = buscarDias(t) ?? periodo.dias;

  const factor = primerNumeroTras(t, /factor\s*(?:multiplicador|de\s*multiplicacion|mult\.?)/, 20);
  datos.factorMultiplicador = factor !== null && factor > 0 && factor <= 1000 ? factor : null;

  const etiquetadas = buscarLecturasEtiquetadas(t);
  const triple = buscarTripleLecturas(t);

  if (etiquetadas.anterior !== null && etiquetadas.actual !== null) {
    datos.lecturaAnterior = etiquetadas.anterior;
    datos.lecturaActual = etiquetadas.actual;
  } else if (triple) {
    datos.lecturaAnterior = triple.anterior;
    datos.lecturaActual = triple.actual;
  }

  datos.consumoKwh = buscarConsumo(t) ?? triple?.consumo ?? null;

  const promedio = primerNumeroTras(t, /(?:consumo\s*)?promedio(?:\s*(?:ultimos|de\s*los\s*ultimos)\s*\d+\s*meses)?/, 30);
  datos.promedioKwh = promedio !== null && promedio >= 5 && promedio < 3000 ? promedio : null;

  const valorKwh = primerNumeroTras(t, /(?:valor|costo|precio|tarifa)\s*(?:unitario\s*)?(?:del\s*)?(?:kwh|unitario)|\bcu\b/, 30);
  // Un kWh cuesta entre ~250 y ~3000 pesos. Números menores junto a la
  // etiqueta suelen ser otra cosa (Celsia: "Valor kWh:  kWh subsidiados: 173").
  datos.valorKwh = valorKwh !== null && valorKwh >= 250 && valorKwh <= 3000 ? valorKwh : null;

  const total = primerNumeroTras(t, /total\s*a\s*pagar|valor\s*a\s*pagar|total\s*factura|pague\s*hasta/, 40);
  datos.totalPagar = total !== null && total >= 1000 ? total : null;

  datos.historico = buscarHistorico(t);

  // Los patrones por estructura son más confiables que los de etiqueta
  // cuando la fila completa cuadra (p. ej. la fila del medidor).
  const e = extraerPorEstructura(textoOriginal);
  if (e.consumoKwh !== undefined && e.lecturaAnterior !== undefined) {
    datos.lecturaAnterior = e.lecturaAnterior;
    datos.lecturaActual = e.lecturaActual ?? null;
    datos.factorMultiplicador = e.factorMultiplicador ?? datos.factorMultiplicador;
    datos.consumoKwh = e.consumoKwh;
  } else if (datos.consumoKwh === null && e.consumoKwh !== undefined) {
    datos.consumoKwh = e.consumoKwh;
  }
  datos.promedioKwh = e.promedioKwh ?? datos.promedioKwh;
  if (e.periodo) datos.periodo = e.periodo;
  if (e.diasFacturados) datos.diasFacturados = e.diasFacturados;
  // "147 Cartago  Residencial" (EEP). Solo se usa si es un municipio conocido:
  // en una foto de Celsia daba "Clasificaciónc  Residencial" → "Clasificaciónc".
  const municipioEstructura = conocidoONada(e.municipio);
  if (municipioEstructura) datos.municipio = municipioEstructura;
  else if (!datos.municipio && e.municipio) datos.municipio = e.municipio;
  datos.municipio = municipioConocido(datos.municipio);
  if (e.historico && e.historico.length >= datos.historico.length) datos.historico = e.historico;
  // Año imposible (el OCR confunde 6 y 8: "12/SEP/2028"): se conserva el mes
  // y se toma el año que más se repite en las demás fechas de la factura.
  // Se marca como estimado para que la persona lo confirme.
  if (datos.periodo && periodoFuturo(datos.periodo)) {
    const reparado = repararAnio(t, datos.periodo);
    if (reparado) {
      // Los meses anteriores se calcularon con el año equivocado: se corrigen igual.
      const salto = Number(reparado.slice(0, 4)) - Number(datos.periodo.slice(0, 4));
      datos.historico = datos.historico.map((p) => ({ ...p, periodo: `${Number(p.periodo.slice(0, 4)) + salto}${p.periodo.slice(4)}` }));
      datos.periodoEstimado = true;
    }
    datos.periodo = reparado;
  }
  if (!datos.periodo) {
    datos.periodo = periodoDesdeEmision(t);
    if (datos.periodo) datos.periodoEstimado = true;
  }
  // Días ilegibles: se asume un mes de 30 días. Es NEUTRO para los cálculos
  // (normalizar a 30 días no cambia el consumo) y se marca como supuesto
  // para que la persona lo corrija si la factura dice otro número.
  if (datos.diasFacturados === null && datos.consumoKwh !== null) {
    datos.diasFacturados = 30;
    datos.diasEstimados = true;
  }
  if (e.estrato && datos.estrato === null) datos.estrato = e.estrato;
  if (e.valorKwh) datos.valorKwh = e.valorKwh;
  const deLinea = valorEnLineaDeConsumo(t, datos.consumoKwh);
  if (deLinea) datos.valorKwh = deLinea;
  if (e.totalPagar) datos.totalPagar = e.totalPagar;

  return datos;
}

export type DatosRecorte = Partial<
  Pick<DatosFactura, "lecturaAnterior" | "lecturaActual" | "consumoKwh" | "factorMultiplicador" | "promedioKwh" | "periodo" | "diasFacturados" | "estrato" | "historico">
>;

/**
 * Lectura guiada: la persona encierra UNA parte de la factura (la fila del
 * medidor, la línea del periodo, los días…). Devuelve solo lo que se LEYÓ en
 * ese recorte; nada estimado ni supuesto.
 */
export function datosDeRecorte(lineas: string[]): DatosRecorte {
  const r: DatosRecorte = {};
  const fila = lecturasDesdeLineas(lineas);
  if (fila) {
    r.lecturaAnterior = fila.lecturaAnterior;
    r.lecturaActual = fila.lecturaActual;
    r.consumoKwh = fila.consumoKwh;
    if (fila.factorMultiplicador !== null) r.factorMultiplicador = fila.factorMultiplicador;
    if (fila.promedioKwh !== null) r.promedioKwh = fila.promedioKwh;
  }
  const d = extraerDeTexto(lineas.join("\n"));
  if (d.periodo && !d.periodoEstimado) r.periodo = d.periodo;
  if (d.diasFacturados && !d.diasEstimados) r.diasFacturados = d.diasFacturados;
  if (d.estrato) r.estrato = d.estrato;
  if (d.historico.length >= 2) r.historico = d.historico; // la tabla de "últimos consumos"
  return r;
}
