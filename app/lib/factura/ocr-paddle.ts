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

type Rotulo = { texto: string; cx: number; y0: number; cy: number };

/**
 * Gráfico de barras de "últimos consumos". Se ubica cada columna por su
 * rótulo (SEP NOV … o MAR ABR … ACT PROM) y se busca el valor encima:
 *   1. Un número escrito derecho encima del rótulo (Energía de Pereira).
 *   2. Si no hay, se recorta la franja, se gira 90° y se lee (Celsia escribe
 *      "119 kWh" de lado dentro de la barra).
 * Devuelve los meses en orden, su valor (null si no se pudo leer) y el valor
 * de la barra "Actual" si existe.
 */
export async function leerGraficoDeBarras(
  imagen: HTMLCanvasElement,
  cajas: CajaTexto[]
): Promise<{ meses: string[]; valores: (number | null)[]; actual: number | null } | null> {
  const medidas = cajas.map((c) => {
    const xs = c.poligono.map((p) => p[0]);
    const ys = c.poligono.map((p) => p[1]);
    return { texto: c.texto.trim(), x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  });

  // El lector a veces junta varios rótulos en una caja ("MAR ABR MAY … ACTPROM")
  // o varios números ("256 280"): se separan y se estima el centro de cada uno
  // por su posición dentro del texto.
  type Ficha = { texto: string; cx: number; y0: number; y1: number };
  const fichas = (patron: RegExp, soloCajasDe?: RegExp): Ficha[] =>
    medidas
      // Para los rótulos: solo cajas hechas ÚNICAMENTE de meses ("MAR ABR…"), no
      // palabras que los contienen ("Marsella", "Activa", "Promedio…").
      .filter((m) => !soloCajasDe || m.texto.replace(soloCajasDe, "").replace(/[\s.\-/|]/g, "") === "")
      .flatMap((m) =>
      Array.from(m.texto.matchAll(patron)).map((f) => {
        const i = f.index ?? 0;
        const centro = (i + f[0].length / 2) / Math.max(1, m.texto.length);
        return { texto: f[0], cx: m.x0 + centro * (m.x1 - m.x0), y0: m.y0, y1: m.y1 };
      })
    );

  const MESES_ROTULO = /actual|act|prom(?:edio)?|ene|feb|mar|abr|may|jun|jul|ago|sept?|oct|nov|dic/gi;
  const rotulos: Rotulo[] = fichas(MESES_ROTULO, MESES_ROTULO)
    .map((f) => ({ texto: f.texto.toLowerCase(), cx: f.cx, y0: f.y0, cy: (f.y0 + f.y1) / 2 }));
  const grupos = rotulos.map((r) => rotulos.filter((o) => Math.abs(o.cy - r.cy) < 12));
  const fila = (grupos.sort((a, b) => b.length - a.length)[0] ?? []).sort((a, b) => a.cx - b.cx);
  const meses = fila.filter((r) => !/^(act|prom)/.test(r.texto));
  const act = fila.find((r) => /^(act|actual)$/.test(r.texto));
  if (meses.length < 3 || !act) return null;
  const pasos = fila.slice(1).map((r, i) => r.cx - fila[i].cx).sort((a, b) => a - b);
  const paso = pasos[Math.floor(pasos.length / 2)];
  if (!(paso > 10)) return null;

  const horizontales = medidas.filter((c) => c.x1 - c.x0 > (c.y1 - c.y0) * 1.2);
  // Números sueltos escritos derechos (solo cajas horizontales y sin letras raras).
  const numeros = fichas(/\b\d{2,4}\b/g).filter((f) =>
    horizontales.some((h) => f.cx >= h.x0 && f.cx <= h.x1 && f.y0 === h.y0 && /^[\d\s.,kwhKWH]+$/.test(h.texto))
  );

  const leerColumna = async (r: Rotulo): Promise<number | null> => {
    const sx = Math.max(0, Math.round(r.cx - paso * 0.3));
    const sw = Math.min(imagen.width - sx, Math.round(paso * 0.6));
    const techo = r.y0 - paso * 2.6;
    // 1. Número derecho encima del rótulo, dentro de la columna (el más cercano).
    const derechos = numeros
      .filter((h) => h.cx > r.cx - paso * 0.45 && h.cx < r.cx + paso * 0.45 && h.y1 < r.y0 - 1 && h.y0 > techo)
      .sort((a, b) => b.y1 - a.y1);
    if (derechos.length) return Number(derechos[0].texto);

    // 2. Texto de lado: recortar la franja (sin textos horizontales de arriba), girar y leer.
    let sy = Math.max(0, Math.round(techo));
    for (const h of horizontales) {
      if (h.x1 > sx && h.x0 < sx + sw && h.y1 < r.y0 - 8 && h.y1 + 2 > sy && h.x1 - h.x0 > paso) sy = Math.round(h.y1 + 2);
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
    for (const horario of [true, false]) {
      const leido = (await reconocer(girar90(recorte, horario))).map((c) => c.texto).join(" ");
      const m = leido.match(/(\d{1,4})\s*k\s*w/i) ?? leido.match(/\b(\d{2,4})\b/);
      if (m) return Number(m[1]);
    }
    return null;
  };

  const valores: (number | null)[] = [];
  for (const r of meses) valores.push(await leerColumna(r));
  if (valores.filter((v) => v !== null).length < 2) return null;
  return { meses: meses.map((r) => r.texto.toUpperCase()), valores, actual: await leerColumna(act) };
}
