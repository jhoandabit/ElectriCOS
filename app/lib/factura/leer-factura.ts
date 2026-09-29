"use client";

// Orquesta la lectura de una factura (foto o PDF), TODO dentro del celular:
//   1. PDF digital → su texto (exacto, instantáneo).
//   2. Foto o PDF escaneado → PaddleOCR (ocr-paddle.ts).
// Siempre termina con la validación cruzada de validar.ts. Si el consumo no
// queda validado, la interfaz ofrece la lectura guiada (ocr-guiado.ts).
// Ninguna imagen se envía a servidores externos.

import { esPdf, leerPdf, prepararFoto } from "./archivos";
import { extraerDeTexto } from "./extraer-texto";
import { agruparEnRenglones, reconocer } from "./ocr-paddle";
import type { AvisoLectura, DatosFactura, FuenteLectura, ResultadoLectura } from "./tipos";
import { validarYCompletar } from "./validar";

type AlProgresar = (mensaje: string) => void;

function terminar(datos: DatosFactura, fuente: FuenteLectura, avisosExtra: AvisoLectura[], textoTecnico?: string): ResultadoLectura {
  const { datos: completos, avisos, confianzaConsumo } = validarYCompletar(datos);
  return { datos: completos, fuente, avisos: [...avisosExtra, ...avisos], confianzaConsumo, textoTecnico };
}

async function leerImagen(imagen: HTMLCanvasElement, alProgresar: AlProgresar): Promise<string> {
  alProgresar("Preparando el lector (la primera vez tarda un poco más)…");
  const lectura = reconocer(imagen);
  alProgresar("Leyendo la factura en tu celular…");
  const cajas = await lectura;
  return agruparEnRenglones(cajas).join("\n");
}

export async function leerFactura(archivo: File, alProgresar: AlProgresar): Promise<ResultadoLectura> {
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
  const texto = await leerImagen(foto.canvas, alProgresar);
  if (!texto.trim()) {
    avisos.push({
      nivel: "error",
      campo: "general",
      mensaje: "No se encontró texto en la foto. Tómala de frente, completa y con buena luz, o usa la lectura guiada.",
    });
  }
  return terminar(extraerDeTexto(texto), "ocr-local", avisos, texto);
}
