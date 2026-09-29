"use client";

// Lectura guiada: la persona encierra con el dedo UNA parte de la factura
// (la fila del medidor, la línea del periodo, los días…) y leemos SOLO ese
// recuadro con PaddleOCR. Sin internet ni cuentas, y la foto
// no sale del celular.
//
// Pasos:
//   1. Recortar a resolución completa y ampliar a ~1600 px de ancho.
//   2. Leer el recorte con PaddleOCR y armar los renglones.
//   3. Si no aparece ningún dato, enderezar el recorte
//      (el ángulo que deja los renglones más "nítidos") y leer otra vez.

import { cargarImagen, dimensiones } from "./archivos";
import { datosDeRecorte, type DatosRecorte } from "./extraer-texto";
import { agruparEnRenglones, reconocer } from "./ocr-paddle";

export type Recuadro = { x: number; y: number; ancho: number; alto: number }; // 0 a 1

type Gris = { datos: Uint8ClampedArray; ancho: number; alto: number };

function aGris(canvas: HTMLCanvasElement): Gris {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No se pudo procesar la imagen.");
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const datos = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let i = 0, p = 0; i < img.length; i += 4, p++) {
    datos[p] = 0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2];
  }
  return { datos, ancho: canvas.width, alto: canvas.height };
}

function umbralOtsu(g: Gris) {
  const hist = new Array(256).fill(0);
  for (const v of g.datos) hist[v]++;
  const total = g.datos.length;
  let sumaTotal = 0;
  for (let i = 0; i < 256; i++) sumaTotal += i * hist[i];
  let sumaFondo = 0, pesoFondo = 0, mejor = 0, umbral = 128;
  for (let t = 0; t < 256; t++) {
    pesoFondo += hist[t];
    if (!pesoFondo) continue;
    const pesoFrente = total - pesoFondo;
    if (!pesoFrente) break;
    sumaFondo += t * hist[t];
    const mf = sumaFondo / pesoFondo;
    const mt = (sumaTotal - sumaFondo) / pesoFrente;
    const varianza = pesoFondo * pesoFrente * (mf - mt) ** 2;
    if (varianza > mejor) { mejor = varianza; umbral = t; }
  }
  return umbral;
}

function rotar(origen: HTMLCanvasElement, grados: number) {
  const c = document.createElement("canvas");
  c.width = origen.width;
  c.height = origen.height;
  const ctx = c.getContext("2d");
  if (!ctx) return origen;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((grados * Math.PI) / 180);
  ctx.drawImage(origen, -origen.width / 2, -origen.height / 2);
  return c;
}

function escalar(origen: HTMLCanvasElement, factor: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(origen.width * factor));
  c.height = Math.max(1, Math.round(origen.height * factor));
  const ctx = c.getContext("2d");
  if (!ctx) return origen;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(origen, 0, 0, c.width, c.height);
  return c;
}

/** Ángulo (−4° a 4°) con el que los renglones quedan más horizontales. */
function anguloParaEnderezar(canvas: HTMLCanvasElement, umbral: number) {
  const chico = escalar(canvas, Math.min(1, 600 / canvas.width));
  let mejor = { angulo: 0, puntaje: -1 };
  for (let a = -4; a <= 4.001; a += 0.25) {
    const g = aGris(rotar(chico, a));
    const filas = new Array(g.alto).fill(0);
    for (let y = 0; y < g.alto; y++) {
      for (let x = 0; x < g.ancho; x++) if (g.datos[y * g.ancho + x] <= umbral) filas[y]++;
    }
    const media = filas.reduce((s, v) => s + v, 0) / filas.length;
    const varianza = filas.reduce((s, v) => s + (v - media) ** 2, 0) / filas.length;
    if (varianza > mejor.puntaje) mejor = { angulo: a, puntaje: varianza };
  }
  return mejor.angulo;
}

export type ResultadoGuiado = {
  /** Solo lo que se leyó en el recorte (vacío si no se encontró nada). */
  datos: DatosRecorte;
  lineas: string[];
  /** Recorte ampliado (a color) para que la persona compare. */
  recorteUrl: string;
};

export async function leerRecuadro(
  archivo: File,
  recuadro: Recuadro,
  alProgresar: (mensaje: string) => void
): Promise<ResultadoGuiado> {
  alProgresar("Recortando la parte que encerraste…");
  const imagen = await cargarImagen(archivo);
  const { ancho, alto } = dimensiones(imagen);
  const sx = Math.round(recuadro.x * ancho);
  const sy = Math.round(recuadro.y * alto);
  const sw = Math.max(10, Math.round(recuadro.ancho * ancho));
  const sh = Math.max(10, Math.round(recuadro.alto * alto));

  const factor = Math.min(4, Math.max(1, 1600 / sw));
  const recorte = document.createElement("canvas");
  recorte.width = Math.round(sw * factor);
  recorte.height = Math.round(sh * factor);
  const ctx = recorte.getContext("2d");
  if (!ctx) throw new Error("No se pudo recortar la imagen.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, recorte.width, recorte.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(imagen, sx, sy, sw, sh, 0, 0, recorte.width, recorte.height);
  if ("close" in imagen) imagen.close(); // soltar la foto completa enseguida
  const recorteUrl = recorte.toDataURL("image/jpeg", 0.85);

  alProgresar("Leyendo esa parte…");
  let lineas = agruparEnRenglones(await reconocer(recorte));
  let datos = datosDeRecorte(lineas);

  if (!Object.keys(datos).length) {
    alProgresar("Enderezando y leyendo otra vez…");
    const umbral = umbralOtsu(aGris(recorte));
    const derecho = rotar(recorte, anguloParaEnderezar(recorte, umbral));
    const segunda = agruparEnRenglones(await reconocer(derecho));
    const otra = datosDeRecorte(segunda);
    if (Object.keys(otra).length) {
      lineas = segunda;
      datos = otra;
    }
  }

  return { datos, lineas, recorteUrl };
}
