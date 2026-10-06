// Lectura por POSICIÓN de las cajas de texto del OCR (sin depender de cómo se junten en renglones).
// Una foto torcida o con la tabla pegada al gráfico de barras puede mezclar renglones; aquí cada
// dato se busca por su lugar en la hoja: el mes, y hacia la derecha su kWh, su valor y sus días.
// Es lógica pura (sin navegador) para poder probarla.

export type CajaPos = { texto: string; poligono: [number, number][] };

type Ficha = { t: string; cx: number; cy: number; h: number; x1: number };

const MES = /^(ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic)\.?$/;

function fichas(cajas: CajaPos[]): Ficha[] {
  const r: Ficha[] = [];
  for (const c of cajas) {
    const xs = c.poligono.map((p) => p[0]);
    const ys = c.poligono.map((p) => p[1]);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys);
    const texto = c.texto.trim();
    if (!texto) continue;
    for (const m of texto.matchAll(/\S+/g)) {
      const centro = ((m.index ?? 0) + m[0].length / 2) / texto.length;
      r.push({ t: m[0].toLowerCase(), cx: x0 + centro * (x1 - x0), cy: (y0 + y1) / 2, h: Math.max(1, y1 - y0), x1 });
    }
  }
  return r;
}

const mediana = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/** Primer elemento a la derecha de `desde`, a su altura, que cumple `vale`; el más cercano. */
function aLaDerecha(todas: Ficha[], desde: Ficha, tolerancia: number, vale: (t: string) => boolean): Ficha | undefined {
  return todas
    .filter((f) => f !== desde && f.cx > desde.cx && Math.abs(f.cy - desde.cy) <= tolerancia && vale(f.t))
    .sort((a, b) => a.cx - b.cx)[0];
}

/**
 * Tabla "Consumo últimos seis meses": una línea por mes con el formato "ABR 278 218,067 30"
 * (mes, kWh, valor, días). Devuelve [] si no encuentra una columna de al menos 3 meses.
 */
export function lineasDeTabla(cajas: CajaPos[]): string[] {
  const todas = fichas(cajas);
  const meses = todas.filter((f) => MES.test(f.t));
  if (meses.length < 3) return [];
  const h = mediana(todas.map((f) => f.h));

  // La columna de meses: mismos x, distinta altura (el gráfico de barras los pone en un RENGLÓN).
  let mejor: Ficha[] = [];
  for (const m of meses) {
    const col = meses.filter((o) => Math.abs(o.cx - m.cx) < h * 1.5).sort((a, b) => a.cy - b.cy);
    const distintos = col.filter((o, i) => i === 0 || o.cy - col[i - 1].cy > h * 0.6);
    if (distintos.length > mejor.length) mejor = distintos;
  }
  if (mejor.length < 3) return [];
  const paso = mediana(mejor.slice(1).map((m, i) => m.cy - mejor[i].cy));
  const tol = paso * 0.5;

  const lineas: string[] = [];
  for (const m of mejor) {
    const kwh = aLaDerecha(todas, m, tol, (t) => /^\d{2,4}$/.test(t));
    if (!kwh) continue;
    const valor = aLaDerecha(todas, kwh, tol, (t) => /^\$?\d{1,3}([.,]\d{3})+$|^\d{5,7}$/.test(t));
    const dias = valor ? aLaDerecha(todas, valor, tol, (t) => /^\d{2}$/.test(t) && Number(t) >= 15 && Number(t) <= 75) : undefined;
    lineas.push(`${m.t.toUpperCase()} ${kwh.t} ${valor ? valor.t : "0,000"}${dias ? ` ${dias.t}` : ""}`);
  }
  return lineas.length >= 3 ? lineas : [];
}

/**
 * Zona de la foto donde debería estar el estrato: a la derecha de la palabra "Estrato" (o, si el
 * lector la perdió, a la derecha de "Subsidio", donde queda "-49.05  Estrato: 1").
 * Devuelve el rectángulo en píxeles de la imagen leída.
 */
export function zonaDelEstrato(cajas: CajaPos[]): { x: number; y: number; ancho: number; alto: number; ancla: "estrato" | "subsidio" } | null {
  const todas = fichas(cajas);
  const est = todas.find((f) => /^estrato/.test(f.t));
  const sub = todas.find((f) => /^subsidio/.test(f.t));
  const f = est ?? sub;
  if (!f) return null;
  return {
    x: f.x1,
    y: f.cy - f.h * 1.3,
    ancho: f.h * (est ? 6 : 16),
    alto: f.h * 2.6,
    ancla: est ? "estrato" : "subsidio",
  };
}
