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
