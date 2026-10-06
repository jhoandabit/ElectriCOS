"use client";

// Orquesta la lectura de una factura (foto o PDF), TODO dentro del celular:
//   1. PDF digital → su texto (exacto, instantáneo).
//   2. Foto o PDF escaneado → PaddleOCR (ocr-paddle.ts).
// Siempre termina con la validación cruzada de validar.ts. Si el consumo no
// queda validado, la interfaz ofrece la lectura guiada (ocr-guiado.ts).
// Ninguna imagen se envía a servidores externos.

import { esPdf, girarLienzo, leerPdf, prepararFoto, reducirLienzo, soltarLienzo } from "./archivos";
import { paso } from "./diagnostico";
import { extraerDeTexto } from "./extraer-texto";
import { agruparEnRenglones, leerGraficoDeBarras, reconocer } from "./ocr-paddle";
import { filasDeTabla, textoDeFila, zonaDelEstrato, type FilaTabla } from "./geometria";
import { detectarGiro } from "./orientacion";
import type { AvisoLectura, DatosFactura, FuenteLectura, Giro, ResultadoLectura } from "./tipos";
import { validarYCompletar } from "./validar";

type AlProgresar = (mensaje: string) => void;

function terminar(datos: DatosFactura, fuente: FuenteLectura, avisosExtra: AvisoLectura[], textoTecnico?: string, giro?: Giro): ResultadoLectura {
  const { datos: completos, avisos, confianzaConsumo } = validarYCompletar(datos);
  return { datos: completos, fuente, avisos: [...avisosExtra, ...avisos], confianzaConsumo, textoTecnico, giro };
}

/**
 * Lectura de prueba (versión pequeña de la foto, girada `giro`) para saber cómo está girada.
 * Una foto del celular puede venir con el texto de lado sin marca de rotación.
 */
async function textoDePrueba(foto: HTMLCanvasElement, giro: Giro): Promise<string> {
  const pequena = reducirLienzo(foto, 1100);
  const girada = girarLienzo(pequena, giro);
  try {
    return (await reconocer(girada)).map((c) => c.texto).join("\n");
  } finally {
    if (girada !== pequena) soltarLienzo(girada);
    if (pequena !== foto) soltarLienzo(pequena);
  }
}

/** Relee solo un rectángulo de la foto, ampliado. */
async function leerZona(imagen: HTMLCanvasElement, z: { x: number; y: number; ancho: number; alto: number }): Promise<string> {
  const sx = Math.max(0, Math.round(z.x));
  const sy = Math.max(0, Math.round(z.y));
  const sw = Math.min(imagen.width - sx, Math.round(z.ancho));
  const sh = Math.min(imagen.height - sy, Math.round(z.alto));
  if (sw < 6 || sh < 6) return "";
  const factor = Math.min(8, Math.max(2, 120 / sh));
  const margen = Math.round(20 * factor * 0.5);
  const recorte = document.createElement("canvas");
  recorte.width = Math.round(sw * factor) + margen * 2;
  recorte.height = Math.round(sh * factor) + margen * 2;
  const ctx = recorte.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, recorte.width, recorte.height);
  ctx.drawImage(imagen, sx, sy, sw, sh, margen, margen, Math.round(sw * factor), Math.round(sh * factor));
  try {
    const cajas = await reconocer(recorte);
    return cajas.map((c) => c.texto).join(" ").trim();
  } finally {
    soltarLienzo(recorte);
  }
}

async function leerZonaDelEstrato(imagen: HTMLCanvasElement, cajas: Awaited<ReturnType<typeof reconocer>>): Promise<string> {
  const z = zonaDelEstrato(cajas);
  if (!z) return "";
  const t = await leerZona(imagen, z);
  if (!t) return "";
  return z.ancla === "estrato" ? `Estrato: ${t}` : `% Subsidio: ${t}`;
}

const medianaDe = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/**
 * Un kWh mal leído (256 → 216) rompe el precio por kWh de su fila (pesos ÷ kWh). Las filas
 * cuyo precio se sale más de 10 % del típico se releen ampliadas; se queda con la lectura
 * cuyo precio se parece más al de las demás filas.
 */
async function corregirFilasSospechosas(imagen: HTMLCanvasElement, filas: FilaTabla[]): Promise<FilaTabla[]> {
  const precio = (f: FilaTabla, kwh: number) => (f.valor ? (Number(f.valor.replace(/[.,]/g, "")) || 0) / kwh : 0);
  const precios = filas.filter((f) => f.valor).map((f) => precio(f, f.kwh)).filter((p) => p > 0);
  if (precios.length < 4) return filas;
  const tipico = medianaDe(precios);
  const resultado: FilaTabla[] = [];
  for (const f of filas) {
    const p = precio(f, f.kwh);
    if (!f.valor || p === 0 || Math.abs(p - tipico) / tipico <= 0.1) {
      resultado.push(f);
      continue;
    }
    const texto = await leerZona(imagen, f.zonaKwh).catch(() => "");
    const nuevo = Number((texto.match(/\d{2,4}/) ?? [])[0]);
    paso(`${f.mes}: kWh sospechoso (${f.kwh}), releído como "${texto}"`);
    if (Number.isFinite(nuevo) && nuevo >= 1 && nuevo < 3000 && Math.abs(precio(f, nuevo) - tipico) < Math.abs(p - tipico)) {
      resultado.push({ ...f, kwh: nuevo });
    } else {
      resultado.push(f);
    }
  }
  return resultado;
}

async function leerImagen(imagen: HTMLCanvasElement, alProgresar: AlProgresar): Promise<string> {
  alProgresar("Preparando el lector (la primera vez tarda un poco más)…");
  const lectura = reconocer(imagen);
  alProgresar("Leyendo la factura en tu celular…");
  const cajas = await lectura;
  paso(`lectura principal: terminó (${cajas.length} cajas de texto)`);
  let texto = agruparEnRenglones(cajas).join("\n");

  // La tabla de "últimos consumos" también se lee POR POSICIÓN (mes → kWh → valor → días),
  // porque en una foto torcida los renglones se mezclan con el gráfico de barras. Va primero:
  // el extractor se queda con la primera fila de cada mes.
  let filasTabla = filasDeTabla(cajas);
  paso(`tabla por posición: ${filasTabla.length} meses`);
  if (filasTabla.length) {
    filasTabla = await corregirFilasSospechosas(imagen, filasTabla).catch(() => filasTabla);
    texto = `${filasTabla.map(textoDeFila).join("\n")}\n${texto}`;
  }

  // El estrato es un solo dígito suelto y el lector suele descartarlo: si falta, se lee otra vez
  // solo esa zona, ampliada.
  if (extraerDeTexto(texto).estrato === null) {
    const extra = await leerZonaDelEstrato(imagen, cajas).catch(() => "");
    paso(`estrato: lectura de la zona ${extra ? "con texto" : "sin texto"}`);
    if (extra) texto += `\n${extra}`;
  }

  // Gráfico de "últimos consumos": se leen las columnas por separado y se
  // agregan al texto en un formato que extraer-texto entiende:
  //   "119 kWh  112 kWh  …  314 kWh" / "SEP  NOV  …  Actual".
  // Una columna ilegible queda en 0 y la validación la descarta (se escribe a mano).
  // Si la tabla de "últimos consumos" ya trajo los meses anteriores, no se vuelve a leer el
  // gráfico: son decenas de lecturas seguidas y en el iPhone la memoria no alcanza.
  const tablaYaLeida = extraerDeTexto(texto).historico.length >= 6;
  if (tablaYaLeida) paso("gráfico de barras: omitido (la tabla ya trajo los meses)");
  if (!tablaYaLeida && /\b(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\b/i.test(texto)) {
    alProgresar("Leyendo el gráfico de consumos…");
    paso("gráfico de barras: empieza");
    const g = await leerGraficoDeBarras(imagen, cajas).catch(() => null);
    paso(`gráfico de barras: terminó (${g ? "leído" : "sin datos"})`);
    if (g) {
      const valores = [...g.valores, g.actual].map((v) => `${v ?? 0} kWh`).join("  ");
      texto += `\n${valores}\n${g.meses.join("  ")}  Actual`;
    }
  }
  return texto;
}

/**
 * Lee una factura. `textoPrevio` es el texto de las partes ya leídas de la
 * MISMA factura (cuando la persona la fotografía por partes: encabezado,
 * energía, resumen…). Los textos se unen y se analizan juntos.
 */
export async function leerFactura(archivo: File, alProgresar: AlProgresar, textoPrevio = ""): Promise<ResultadoLectura> {
  const avisos: AvisoLectura[] = [];

  if (esPdf(archivo)) {
    alProgresar("Abriendo el PDF…");
    const pdf = await leerPdf(archivo);
    if (!pdf.escaneado) {
      alProgresar("Analizando el texto del PDF…");
      return terminar(extraerDeTexto(pdf.texto), "pdf-texto", avisos, pdf.texto);
    }
    const texto = await leerImagen(pdf.primeraPagina, alProgresar);
    return terminar(extraerDeTexto(texto), "ocr-local", avisos, texto);
  }

  if (!archivo.type.startsWith("image/")) {
    throw new Error("Selecciona una foto o un PDF de la factura.");
  }

  alProgresar("Preparando la foto…");
  const foto = await prepararFoto(archivo, 2000);
  paso(`foto preparada para leer: ${foto.canvas.width}x${foto.canvas.height}`);
  alProgresar("Revisando cómo quedó la foto…");
  const { giro, puntajes } = await detectarGiro((g) => textoDePrueba(foto.canvas, g));
  paso(`orientación: giro ${giro}° (puntajes ${JSON.stringify(puntajes)})`);
  let lienzo = foto.canvas;
  if (giro) {
    alProgresar("La foto estaba de lado: enderezándola…");
    lienzo = girarLienzo(foto.canvas, giro);
    soltarLienzo(foto.canvas); // la versión sin girar ya no hace falta
  }
  const nuevo = await leerImagen(lienzo, alProgresar);
  soltarLienzo(lienzo); // ya no se usa: se libera la memoria de la foto grande
  const texto = textoPrevio ? `${textoPrevio}\n${nuevo}` : nuevo;
  if (!nuevo.trim()) {
    avisos.push({
      nivel: "error",
      campo: "general",
      mensaje: "No se encontró texto en la foto. Tómala de frente, completa y con buena luz, o usa la lectura guiada.",
    });
  }
  return terminar(extraerDeTexto(texto), "ocr-local", avisos, texto, giro);
}
