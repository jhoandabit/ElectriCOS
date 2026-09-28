"use client";

// Orquesta la lectura de una factura (foto o PDF):
//   1. IA de visión en el servidor, si está configurada.
//   2. Texto digital del PDF, como respaldo y segunda opinión.
//   3. OCR local (Tesseract) si no hay IA ni texto digital.
// Siempre termina con la validación cruzada de validar.ts.

import { esPdf, leerPdf, prepararFoto, prepararPdfParaIa, type ArchivoPreparado } from "./archivos";
import { extraerDeTexto } from "./extraer-texto";
import { ocrLocal } from "./ocr-local";
import type { AvisoLectura, DatosFactura, FuenteLectura, ResultadoLectura } from "./tipos";
import { combinarLecturas, validarYCompletar } from "./validar";

type AlProgresar = (mensaje: string) => void;

let iaDisponibleCache: Promise<boolean> | null = null;

export function iaDisponible() {
  iaDisponibleCache ??= fetch("/api/factura", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { disponible: false }))
    .then((j) => Boolean(j.disponible))
    .catch(() => false);
  return iaDisponibleCache;
}

type RespuestaServidor = {
  esFactura: boolean;
  legible: boolean;
  observaciones: string | null;
  datos: DatosFactura;
};

async function pedirIa(archivo: ArchivoPreparado, textoPdf?: string): Promise<RespuestaServidor> {
  const r = await fetch("/api/factura", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ base64: archivo.base64, mime: archivo.mime, textoPdf }),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.error || "No fue posible leer la factura con IA.");
  return json as RespuestaServidor;
}

const AVISO_SIN_IA: AvisoLectura = {
  nivel: "revisar",
  campo: "general",
  mensaje: "La lectura con IA no está disponible. Se usó la lectura sin internet.",
};

function terminar(
  datos: DatosFactura,
  fuente: FuenteLectura,
  avisosExtra: AvisoLectura[],
  textoTecnico?: string,
  iaFallo = false
): ResultadoLectura {
  const { datos: completos, avisos, confianzaConsumo } = validarYCompletar(datos);
  // Si la lectura sin IA salió bien, avisar del fallo de la IA solo confunde.
  const extra = iaFallo && confianzaConsumo < 80 ? [AVISO_SIN_IA, ...avisosExtra] : avisosExtra;
  return { datos: completos, fuente, avisos: [...extra, ...avisos], confianzaConsumo, textoTecnico };
}

export async function leerFactura(archivo: File, alProgresar: AlProgresar): Promise<ResultadoLectura> {
  const avisos: AvisoLectura[] = [];
  const conIa = await iaDisponible();
  let iaFallo = false;

  if (esPdf(archivo)) {
    alProgresar("Abriendo el PDF…");
    const pdf = await leerPdf(archivo);
    const local = pdf.escaneado ? null : extraerDeTexto(pdf.texto);

    if (conIa) {
      try {
        alProgresar("Leyendo la factura con inteligencia artificial…");
        const preparado = await prepararPdfParaIa(archivo, pdf);
        const ia = await pedirIa(preparado, pdf.escaneado ? undefined : pdf.texto);
        if (!ia.esFactura) avisos.push({ nivel: "error", campo: "general", mensaje: "El documento no parece una factura de energía." });
        if (ia.observaciones) avisos.push({ nivel: "revisar", campo: "general", mensaje: ia.observaciones });
        const datos = local ? combinarLecturas(ia.datos, local) : ia.datos;
        return terminar(datos, "ia", avisos, pdf.texto || undefined);
      } catch (e) {
        iaDisponibleCache = Promise.resolve(false);
        iaFallo = true;
        console.warn("[factura] IA no disponible:", (e as Error).message);
      }
    }

    if (local) {
      alProgresar("Analizando el texto del PDF…");
      return terminar(local, "pdf-texto", avisos, pdf.texto, iaFallo);
    }

    alProgresar("El PDF es una imagen escaneada. Leyendo sin conexión…");
    const texto = await ocrLocal(pdf.primeraPagina, alProgresar);
    return terminar(extraerDeTexto(texto), "ocr-local", avisos, texto, iaFallo);
  }

  if (!archivo.type.startsWith("image/")) {
    throw new Error("Selecciona una foto o un PDF de la factura.");
  }

  alProgresar("Preparando la foto…");
  const foto = await prepararFoto(archivo);

  if (conIa) {
    try {
      alProgresar("Leyendo la factura con inteligencia artificial…");
      const ia = await pedirIa(foto);
      if (!ia.esFactura) avisos.push({ nivel: "error", campo: "general", mensaje: "La foto no parece una factura de energía." });
      if (!ia.legible) avisos.push({ nivel: "error", campo: "general", mensaje: "La foto está muy borrosa. Tómala de nuevo con buena luz y sin sombras." });
      if (ia.observaciones) avisos.push({ nivel: "revisar", campo: "general", mensaje: ia.observaciones });
      return terminar(ia.datos, "ia", avisos);
    } catch (e) {
      // No volvemos a intentar la IA en esta sesión: evita esperas inútiles.
      iaDisponibleCache = Promise.resolve(false);
      iaFallo = true;
      console.warn("[factura] IA no disponible:", (e as Error).message);
    }
  }

  // Para leer sin conexión conviene más resolución que para la IA.
  const fotoOcr = await prepararFoto(archivo, 2600);
  const texto = await ocrLocal(fotoOcr.canvas, alProgresar);
  if (!texto) {
    avisos.push({ nivel: "error", campo: "general", mensaje: "No se encontró texto en la foto. Usa la lectura guiada o toma la foto de frente y con buena luz." });
  }
  return terminar(extraerDeTexto(texto), "ocr-local", avisos, texto, iaFallo);
}
