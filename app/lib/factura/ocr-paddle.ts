"use client";

// Lector de texto en imágenes con PaddleOCR (PP-OCRv6 tiny), 100 % en el
// celular: la foto NUNCA sale del dispositivo, no hay claves ni cuentas.
// Es inteligencia artificial "en el borde": dos redes neuronales pequeñas
// (≈ 6 MB) que corren en el navegador con ONNX Runtime Web.
//   1. Detección: encuentra las cajas donde hay texto.
//   2. Reconocimiento: lee el texto de cada caja.
// Licencia Apache-2.0 · https://github.com/PaddlePaddle/PaddleOCR

type Punto = [number, number];
export type CajaTexto = { texto: string; confianza: number; poligono: Punto[] };

type Ocr = { predict: (entrada: Blob | HTMLCanvasElement) => Promise<{ items: { text: string; score: number; poly: Punto[] }[] }[]> };

const MODELO_DETECCION = "PP-OCRv6_tiny_det";
const MODELO_RECONOCIMIENTO = "PP-OCRv6_tiny_rec";

let instancia: Promise<Ocr> | null = null;

/** Usa los modelos servidos desde nuestro dominio; si no están, los oficiales. */
async function rutaModelo(nombre: string) {
  const local = `/modelos/${nombre}_onnx_infer.tar`;
  try {
    const r = await fetch(local, { method: "HEAD" });
    if (r.ok) return { url: local };
  } catch {
    /* sin red o sin archivo: se usa la ruta oficial */
  }
  return undefined; // el SDK usa su dirección oficial por defecto
}

/** Carga el lector una sola vez (la primera vez descarga ≈ 6 MB de modelos). */
export function cargarLector(): Promise<Ocr> {
  instancia ??= (async () => {
    const { PaddleOCR } = await import("@paddleocr/paddleocr-js");
    const [det, rec] = await Promise.all([rutaModelo(MODELO_DETECCION), rutaModelo(MODELO_RECONOCIMIENTO)]);
    const ocr = await PaddleOCR.create({
      textDetectionModelName: MODELO_DETECCION,
      textRecognitionModelName: MODELO_RECONOCIMIENTO,
      ...(det ? { textDetectionModelAsset: det } : {}),
      ...(rec ? { textRecognitionModelAsset: rec } : {}),
      worker: true, // en segundo plano: la pantalla no se congela
      ortOptions: { backend: "auto", wasmPaths: "/ort/" }, // WebGPU si existe; si no, WebAssembly
    });
    return ocr as unknown as Ocr;
  })().catch((e) => {
    instancia = null; // permitir reintentar
    throw e;
  });
  return instancia;
}

/** Empieza a cargar el lector sin esperar (al abrir la pantalla de factura). */
export function precargarLector() {
  void cargarLector().catch(() => undefined);
}

export async function reconocer(imagen: Blob | HTMLCanvasElement): Promise<CajaTexto[]> {
  const ocr = await cargarLector();
  const [resultado] = await ocr.predict(imagen);
  return (resultado?.items ?? [])
    .filter((i) => i.text?.trim())
    .map((i) => ({ texto: i.text.trim(), confianza: i.score, poligono: i.poly }));
}

// ---------- De cajas sueltas a renglones ----------

type Caja = CajaTexto & { x0: number; x1: number; cy: number; alto: number };

function medir(c: CajaTexto): Caja {
  const xs = c.poligono.map((p) => p[0]);
  const ys = c.poligono.map((p) => p[1]);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  return { ...c, x0: Math.min(...xs), x1: Math.max(...xs), cy: (y0 + y1) / 2, alto: Math.max(1, y1 - y0) };
}

/**
 * Arma renglones encadenando cajas de izquierda a derecha: cada caja se une
 * al renglón cuyo ÚLTIMO elemento está a su altura. Así una foto un poco
 * torcida no parte la fila del medidor en dos.
 */
export function agruparEnRenglones(cajas: CajaTexto[]): string[] {
  const medidas = cajas.map(medir).sort((a, b) => a.x0 - b.x0);
  const renglones: Caja[][] = [];

  for (const c of medidas) {
    let mejor: Caja[] | null = null;
    let distancia = Infinity;
    for (const r of renglones) {
      const ultima = r[r.length - 1];
      if (ultima.x1 > c.x0 + c.alto) continue; // se solapa: no es la continuación
      const d = Math.abs(ultima.cy - c.cy);
      if (d < Math.max(ultima.alto, c.alto) * 0.55 && d < distancia) {
        mejor = r;
        distancia = d;
      }
    }
    if (mejor) mejor.push(c);
    else renglones.push([c]);
  }

  return renglones
    .sort((a, b) => a[0].cy - b[0].cy)
    .map((r) => r.map((c) => c.texto).join("  "));
}

// ---------- Texto vertical (valores escritos de lado en gráficos de barras) ----------

function girar90(origen: HTMLCanvasElement, horario: boolean) {
  const c = document.createElement("canvas");
  c.width = origen.height;
  c.height = origen.width;
  const ctx = c.getContext("2d");
  if (!ctx) return origen;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  if (horario) {
    ctx.translate(c.width, 0);
    ctx.rotate(Math.PI / 2);
  } else {
    ctx.translate(0, c.height);
    ctx.rotate(-Math.PI / 2);
  }
  ctx.drawImage(origen, 0, 0);
  return c;
}

/**
 * Algunas facturas (p. ej. Celsia) escriben los kWh DE LADO dentro de las
 * barras del gráfico ("119 kWh" de abajo hacia arriba). El lector normal no
 * los entiende. Aquí se usan los rótulos de los meses (SEP NOV … Actual) para
 * ubicar cada columna, se recorta la franja que queda encima de cada rótulo,
 * se gira 90° y se lee. Devuelve un renglón "119 kWh  112 kWh  …" en el orden
 * de los meses, o null si no se pudo leer TODAS las columnas.
 */
export async function leerTextoVertical(imagen: HTMLCanvasElement, cajas: CajaTexto[]): Promise<string | null> {
  const rotulos = cajas
    .filter((c) => /^(ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic|actual)\.?$/i.test(c.texto.trim()))
    .map((c) => {
      const xs = c.poligono.map((p) => p[0]);
      const ys = c.poligono.map((p) => p[1]);
      return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, y0: Math.min(...ys), cy: (Math.min(...ys) + Math.max(...ys)) / 2 };
    });
  if (rotulos.length < 4) return null;
  // Los rótulos del gráfico están en un mismo renglón: se toma el grupo más grande.
  const grupos = rotulos.map((r) => rotulos.filter((o) => Math.abs(o.cy - r.cy) < 12));
  const fila = grupos.sort((a, b) => b.length - a.length)[0].sort((a, b) => a.cx - b.cx);
  if (fila.length < 4) return null;
  const pasos = fila.slice(1).map((r, i) => r.cx - fila[i].cx).sort((a, b) => a - b);
  const paso = pasos[Math.floor(pasos.length / 2)];
  if (!(paso > 10)) return null;

  // Cajas horizontales (textos normales) para no meter en el recorte, por
  // ejemplo, el "Promedio últimos 6 meses: 275 kWh" que está encima del gráfico.
  const horizontales = cajas.map((c) => {
    const xs = c.poligono.map((p) => p[0]);
    const ys = c.poligono.map((p) => p[1]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }).filter((c) => c.x1 - c.x0 > (c.y1 - c.y0) * 2);

  const textos: string[] = [];
  for (const r of fila) {
    const sx = Math.max(0, Math.round(r.cx - paso * 0.3));
    const sw = Math.min(imagen.width - sx, Math.round(paso * 0.6));
    let sy = Math.max(0, Math.round(r.y0 - paso * 2.4)); // la zona de las barras, encima del rótulo
    for (const h of horizontales) {
      if (h.x1 > sx && h.x0 < sx + sw && h.y1 < r.y0 - 8 && h.y1 + 2 > sy) sy = Math.round(h.y1 + 2);
    }
    const sh = Math.round(r.y0 - 2 - sy);
    if (sw < 8 || sh < 8) return null;
    const factor = Math.min(3, Math.max(1, 48 / sw));
    const recorte = document.createElement("canvas");
    recorte.width = Math.round(sw * factor);
    recorte.height = Math.round(sh * factor);
    const ctx = recorte.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(imagen, sx, sy, sw, sh, 0, 0, recorte.width, recorte.height);

    // Primero girando a la derecha (texto escrito de abajo hacia arriba); si no, a la izquierda.
    let valor: string | null = null;
    for (const horario of [true, false]) {
      const leido = (await reconocer(girar90(recorte, horario))).map((c) => c.texto).join(" ");
      const m = leido.match(/(\d{1,4})\s*k\s*w/i) ?? leido.match(/\b(\d{2,4})\b/);
      if (m) {
        valor = m[1];
        break;
      }
    }
    if (valor === null) return null; // si falta una columna, los meses quedarían corridos
    textos.push(`${valor} kWh`);
  }
  return textos.join("  ");
}
