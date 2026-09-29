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

function lienzo(ancho: number, alto: number) {
  const c = document.createElement("canvas");
  c.width = ancho;
  c.height = alto;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, ancho, alto);
    ctx.imageSmoothingQuality = "high";
  }
  return { c, ctx };
}

/** Borde blanco alrededor, para que el texto no quede pegado al borde. */
function conMargen(origen: HTMLCanvasElement, m: number) {
  const { c, ctx } = lienzo(origen.width + 2 * m, origen.height + 2 * m);
  ctx?.drawImage(origen, m, m);
  return c;
}

function ampliar(origen: HTMLCanvasElement, f: number) {
  const { c, ctx } = lienzo(Math.round(origen.width * f), Math.round(origen.height * f));
  ctx?.drawImage(origen, 0, 0, c.width, c.height);
  return c;
}

/**
 * Gris con más contraste: el texto oscuro queda casi negro y el color de la
 * barra (naranja, azul…) se aclara, sin perder los bordes suaves de las letras.
 */
function contrastar(origen: HTMLCanvasElement) {
  const { c, ctx } = lienzo(origen.width, origen.height);
  if (!ctx) return origen;
  ctx.drawImage(origen, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const p = img.data;
  for (let i = 0; i < p.length; i += 4) {
    const gris = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    p[i] = p[i + 1] = p[i + 2] = Math.max(0, Math.min(255, (gris - 60) * 1.8));
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * Entre lecturas distintas de la misma barra: la que más se repite y, si
 * empatan, la de más dígitos (el error típico es perder uno: "121" → "12").
 */
export function elegirLectura(valores: number[]): number {
  const veces = (v: number) => valores.filter((x) => x === v).length;
  return [...valores].sort((a, b) => veces(b) - veces(a) || String(b).length - String(a).length)[0];
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
    const techo = r.y0 - paso * 4; // la barra más alta puede estar lejos del rótulo
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
    // En fotos pequeñas el texto de lado mide pocos píxeles: se amplía más.
    const factor = Math.min(4, Math.max(1, 64 / sw));
    const recorte = document.createElement("canvas");
    recorte.width = Math.round(sw * factor);
    recorte.height = Math.round(sh * factor);
    const ctx = recorte.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(imagen, sx, sy, sw, sh, 0, 0, recorte.width, recorte.height);

    // Varios intentos: la franja tal cual, con más contraste y más ampliada.
    // El texto de Celsia se lee de abajo hacia arriba (giro horario); el giro
    // contrario queda de respaldo para otras facturas. Se agrega un margen
    // blanco: sin él, el primer dígito (pegado al borde) se pierde ("121" → "12").
    // Si dos intentos coinciden, ese es el valor.
    const intentos: [HTMLCanvasElement, boolean][] = [
      [recorte, true],
      [contrastar(recorte), true],
      [ampliar(recorte, 1.5), true],
    ];
    const conKwh: number[] = [];
    let suelto: number | null = null;
    const probar = async (lienzo: HTMLCanvasElement, horario: boolean) => {
      const leido = (await reconocer(conMargen(girar90(lienzo, horario), 16))).map((c) => c.texto).join(" ");
      const m = leido.match(/(\d{1,4})\s*k\s*w/i);
      if (m) {
        const v = Number(m[1]);
        const repetido = conKwh.includes(v);
        conKwh.push(v);
        return repetido ? v : null;
      }
      const n = leido.match(/\b(\d{2,4})\b/);
      if (n && suelto === null) suelto = Number(n[1]);
      return null;
    };
    for (const [lienzo, horario] of intentos) {
      const v = await probar(lienzo, horario);
      if (v !== null) return v;
    }
    if (!conKwh.length) {
      for (const lienzo of [recorte, contrastar(recorte)]) {
        const v = await probar(lienzo, false);
        if (v !== null) return v;
      }
    }
    if (conKwh.length) return elegirLectura(conKwh);
    return suelto;
  };

  const valores: (number | null)[] = [];
  for (const r of meses) valores.push(await leerColumna(r));
  if (valores.filter((v) => v !== null).length < 2) return null;
  return { meses: meses.map((r) => r.texto.toUpperCase()), valores, actual: await leerColumna(act) };
}
