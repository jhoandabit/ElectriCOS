"use client";

// Lectura guiada: la persona encierra con el dedo la fila del medidor y
// leemos SOLO ese recuadro. Sin internet, sin cuentas y sin enviar la foto.
//
// Pasos (probados con fotos de facturas de Energía de Pereira):
//   1. Recortar a resolución completa y ampliar a ~1600 px de ancho.
//   2. Umbral de Otsu (blanco/negro automático).
//   3. Enderezar: el ángulo que deja los renglones más "nítidos".
//   4. Borrar las líneas de la tabla, que confunden al OCR.
//   5. Separar renglones y leer cada uno con Tesseract en modo "una línea".

import { cargarImagen, dimensiones } from "./archivos";
import { lecturasDesdeLineas, type FilaLecturas } from "./estructura";

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

/** Tinta (true) sin las líneas largas de la tabla. */
function tintaSinLineas(g: Gris, umbral: number) {
  const { ancho, alto } = g;
  const tinta = new Uint8Array(ancho * alto);
  for (let i = 0; i < tinta.length; i++) tinta[i] = g.datos[i] <= umbral ? 1 : 0;

  for (let y = 0; y < alto; y++) {
    let n = 0;
    for (let x = 0; x < ancho; x++) n += tinta[y * ancho + x];
    if (n > 0.45 * ancho) tinta.fill(0, y * ancho, (y + 1) * ancho);
  }
  for (let x = 0; x < ancho; x++) {
    let n = 0;
    for (let y = 0; y < alto; y++) n += tinta[y * ancho + x];
    if (n > 0.6 * alto) for (let y = 0; y < alto; y++) tinta[y * ancho + x] = 0;
  }
  return tinta;
}

/** Renglones: franjas horizontales con tinta, de al menos 8 px de alto. */
function franjas(tinta: Uint8Array, ancho: number, alto: number) {
  const conTinta: boolean[] = [];
  for (let y = 0; y < alto; y++) {
    let n = 0;
    for (let x = 0; x < ancho; x++) n += tinta[y * ancho + x];
    conTinta.push(n > 0);
  }
  const resultado: [number, number][] = [];
  let y = 0;
  while (y < alto) {
    if (!conTinta[y]) { y++; continue; }
    const inicio = y;
    while (y < alto && conTinta[y]) y++;
    if (y - inicio >= 8) resultado.push([inicio, y]);
  }
  return resultado;
}

/** Dibuja una franja limpia (negro sobre blanco) a 60 px de alto con margen. */
function canvasDeFranja(tinta: Uint8Array, ancho: number, alto: number, y0: number, y1: number) {
  const desde = Math.max(0, y0 - 3);
  const hasta = Math.min(alto, y1 + 3);
  const base = document.createElement("canvas");
  base.width = ancho;
  base.height = hasta - desde;
  const ctx = base.getContext("2d");
  if (!ctx) return base;
  const img = ctx.createImageData(ancho, base.height);
  for (let y = desde; y < hasta; y++) {
    for (let x = 0; x < ancho; x++) {
      const v = tinta[y * ancho + x] ? 0 : 255;
      const i = ((y - desde) * ancho + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const factor = 60 / base.height;
  const final = document.createElement("canvas");
  final.width = Math.round(ancho * factor) + 50;
  final.height = 110;
  const f = final.getContext("2d");
  if (!f) return base;
  f.fillStyle = "#fff";
  f.fillRect(0, 0, final.width, final.height);
  f.imageSmoothingQuality = "high";
  f.drawImage(base, 25, 25, final.width - 50, 60);
  return final;
}

export type ResultadoGuiado = {
  fila: FilaLecturas | null;
  lineas: string[];
  /** Recorte ampliado (a color) para que la persona compare. */
  recorteUrl: string;
};

export async function leerRecuadro(
  archivo: File,
  recuadro: Recuadro,
  alProgresar: (mensaje: string) => void
): Promise<ResultadoGuiado> {
  alProgresar("Recortando la fila…");
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
  const recorteUrl = recorte.toDataURL("image/jpeg", 0.85);

  alProgresar("Enderezando…");
  const umbral = umbralOtsu(aGris(recorte));
  const derecho = rotar(recorte, anguloParaEnderezar(recorte, umbral));
  const gris = aGris(derecho);
  const tinta = tintaSinLineas(gris, umbral);
  const renglones = franjas(tinta, gris.ancho, gris.alto);

  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("spa");
  const lineas: string[] = [];
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, user_defined_dpi: "300" });
    for (let i = 0; i < renglones.length; i++) {
      alProgresar(`Leyendo la fila (${i + 1}/${renglones.length})…`);
      const [y0, y1] = renglones[i];
      const r = await worker.recognize(canvasDeFranja(tinta, gris.ancho, gris.alto, y0, y1));
      const texto = r.data.text?.trim();
      if (texto) lineas.push(texto);
    }
  } finally {
    await worker.terminate().catch(() => undefined);
  }

  return { fila: lecturasDesdeLineas(lineas), lineas, recorteUrl };
}
