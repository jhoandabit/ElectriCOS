// Orientación de la foto.
// Una foto tomada con el celular puede quedar con el texto de lado o de cabeza SIN marca
// de rotación (EXIF = 1): la app no tiene cómo saberlo y el lector de texto lee basura.
// Aquí se decide el giro con una lectura de prueba (pequeña) por orientación: la que
// reconoce más palabras propias de una factura es la derecha. Lógica pura: se prueba en Node.

import { normalizarTexto } from "./texto";
import type { Giro } from "./tipos";

/** Palabras que casi cualquier factura de energía trae (sin tildes, en minúscula). */
const PALABRAS = [
  "kwh", "consumo", "estrato", "municipio", "periodo", "activa", "lectura", "servicio", "energia",
  "subsidio", "residencial", "valor", "total", "factura", "informacion", "liquidacion", "suscriptor",
  "tecnicos", "documento", "cobro", "matricula", "emision", "alumbrado", "aseo", "calidad", "medidor",
  "cliente", "usuario", "pagar", "tarifa", "empresa", "facturado", "contribucion",
];

/** Cuántas palabras clave distintas aparecen en el texto. */
export function puntajeOrientacion(texto: string): number {
  const t = normalizarTexto(texto);
  return PALABRAS.filter((p) => t.includes(p)).length;
}

/** Con tantas palabras clave la foto se da por derecha y no se prueba nada más. */
const SUFICIENTE = 3;
/** Un giro solo se acepta si mejora al menos en 2 palabras la foto tal como llegó. */
const VENTAJA = 2;

/**
 * Decide cuánto girar la foto. `leer(giro)` devuelve el texto que el lector reconoce en una
 * versión PEQUEÑA de la foto girada así. Primero se prueba sin girar (lo normal: una sola
 * lectura de prueba); solo si no alcanza se prueban 270° (de lado, la foto de arriba hacia
 * abajo), 90° y 180°.
 */
export async function detectarGiro(
  leer: (giro: Giro) => Promise<string>
): Promise<{ giro: Giro; puntajes: Partial<Record<Giro, number>> }> {
  const puntajes: Partial<Record<Giro, number>> = {};
  puntajes[0] = puntajeOrientacion(await leer(0));
  if (puntajes[0] >= SUFICIENTE) return { giro: 0, puntajes };

  let mejor: Giro = 0;
  let mejorPuntaje = puntajes[0];
  for (const g of [270, 90, 180] as Giro[]) {
    puntajes[g] = puntajeOrientacion(await leer(g));
    if (puntajes[g]! > mejorPuntaje) {
      mejor = g;
      mejorPuntaje = puntajes[g]!;
    }
    if (mejorPuntaje >= SUFICIENTE) break;
  }
  return mejor !== 0 && mejorPuntaje >= VENTAJA && mejorPuntaje >= puntajes[0] + VENTAJA
    ? { giro: mejor, puntajes }
    : { giro: 0, puntajes };
}

// ---------- Del recuadro dibujado sobre la foto derecha a la foto original ----------

export type Rect = { x: number; y: number; ancho: number; alto: number }; // fracciones de 0 a 1

/** Dónde cae un punto (fracciones 0-1) de la foto ORIGINAL en la foto ya girada `giro` (horario). */
export function puntoGirado(x: number, y: number, giro: Giro): [number, number] {
  if (giro === 90) return [1 - y, x];
  if (giro === 270) return [y, 1 - x];
  if (giro === 180) return [1 - x, 1 - y];
  return [x, y];
}

/**
 * La persona dibuja el recuadro sobre la foto ya derecha; el recorte se hace sobre la foto
 * original (sin girar, a resolución completa) y se gira después. Esta es la inversa de
 * `puntoGirado` aplicada al recuadro.
 */
export function recuadroEnOriginal(r: Rect, giro: Giro): Rect {
  if (giro === 90) return { x: r.y, y: 1 - (r.x + r.ancho), ancho: r.alto, alto: r.ancho };
  if (giro === 270) return { x: 1 - (r.y + r.alto), y: r.x, ancho: r.alto, alto: r.ancho };
  if (giro === 180) return { x: 1 - (r.x + r.ancho), y: 1 - (r.y + r.alto), ancho: r.ancho, alto: r.alto };
  return r;
}
