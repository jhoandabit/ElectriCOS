import type { AvisoLectura, DatosFactura } from "./tipos";

// Rangos razonables para un hogar colombiano. Fuera de ellos no
// rechazamos el dato, pero pedimos que el estudiante lo revise.
const KWH_MIN = 5;
const KWH_MAX = 3000;
const KWH_TIPICO_MAX = 1200;

function redondear(n: number, d = 2) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

/** Consumo según las lecturas del medidor, contemplando el reinicio del contador. */
export function consumoPorLecturas(datos: Pick<DatosFactura, "lecturaAnterior" | "lecturaActual" | "factorMultiplicador">) {
  const { lecturaAnterior: a, lecturaActual: b } = datos;
  if (a === null || b === null) return null;
  const factor = datos.factorMultiplicador && datos.factorMultiplicador > 0 ? datos.factorMultiplicador : 1;

  if (b >= a) return redondear((b - a) * factor);

  // El medidor dio la vuelta (p. ej. 99 950 → 00 120): solo si la anterior
  // estaba cerca del máximo y la actual cerca de cero. Si no, las lecturas
  // están al revés o mal escritas (500 → 400 NO son 900 kWh).
  const digitos = String(Math.trunc(a)).length;
  const tope = 10 ** digitos;
  if (a < tope * 0.9 || b > tope * 0.1) return null;
  const diferencia = tope - a + b;
  return diferencia > 0 && diferencia < KWH_MAX ? redondear(diferencia * factor) : null;
}

/**
 * Completa lo que se pueda deducir y devuelve avisos para la persona.
 * No inventa datos: solo calcula lo que se sigue de otros campos.
 */
export function validarYCompletar(entrada: DatosFactura): {
  datos: DatosFactura;
  avisos: AvisoLectura[];
  confianzaConsumo: number;
} {
  const datos: DatosFactura = { ...entrada, historico: [...entrada.historico] };
  const avisos: AvisoLectura[] = [];
  let confianza = 0;

  // Estrato
  if (datos.estrato !== null && !(Number.isInteger(datos.estrato) && datos.estrato >= 1 && datos.estrato <= 6)) {
    avisos.push({ nivel: "revisar", campo: "estrato", mensaje: `El estrato leído (${datos.estrato}) no es válido; debe estar entre 1 y 6.` });
    datos.estrato = null;
  }

  // Días facturados
  if (datos.diasFacturados !== null && (datos.diasFacturados < 15 || datos.diasFacturados > 70)) {
    avisos.push({ nivel: "revisar", campo: "diasFacturados", mensaje: `Los días facturados (${datos.diasFacturados}) son poco usuales. Verifícalos.` });
  }

  // Consumo vs. lecturas: es la validación más importante.
  const porLecturas = consumoPorLecturas(datos);

  if (datos.consumoKwh !== null && porLecturas !== null) {
    const diferencia = Math.abs(datos.consumoKwh - porLecturas);
    const tolerancia = Math.max(1, porLecturas * 0.01);

    if (diferencia <= tolerancia) {
      confianza = 95;
      avisos.push({ nivel: "ok", campo: "consumoKwh", mensaje: "El consumo coincide con la diferencia entre las lecturas del medidor." });
    } else {
      confianza = 45;
      avisos.push({
        nivel: "revisar",
        campo: "consumoKwh",
        mensaje: `La factura indica ${datos.consumoKwh} kWh, pero las lecturas dan ${porLecturas} kWh. Revisa cuál es el correcto.`,
      });
    }
  } else if (datos.consumoKwh === null && porLecturas !== null) {
    datos.consumoKwh = porLecturas;
    confianza = 80;
    avisos.push({ nivel: "ok", campo: "consumoKwh", mensaje: "El consumo se calculó con las lecturas del medidor." });
  } else if (datos.consumoKwh !== null) {
    confianza = 65;
  }

  if (datos.consumoKwh !== null) {
    if (datos.consumoKwh < KWH_MIN || datos.consumoKwh > KWH_MAX) {
      confianza = Math.min(confianza, 30);
      avisos.push({ nivel: "error", campo: "consumoKwh", mensaje: `${datos.consumoKwh} kWh está fuera del rango de un hogar. Revisa el valor.` });
    } else if (datos.consumoKwh > KWH_TIPICO_MAX) {
      avisos.push({ nivel: "revisar", campo: "consumoKwh", mensaje: `${datos.consumoKwh} kWh es un consumo muy alto para un hogar. Confírmalo.` });
    }

    // Comparación con el promedio o el histórico de la misma factura.
    const referencia =
      datos.promedioKwh ??
      (datos.historico.length
        ? datos.historico.reduce((s, p) => s + p.kwh, 0) / datos.historico.length
        : null);

    if (referencia && referencia > 0) {
      const razon = datos.consumoKwh / referencia;
      if (razon > 0.4 && razon < 2.5) confianza = Math.min(100, confianza + 5);
      else {
        avisos.push({
          nivel: "revisar",
          campo: "consumoKwh",
          mensaje: `El consumo (${datos.consumoKwh} kWh) es muy distinto del promedio de la factura (${redondear(referencia, 0)} kWh).`,
        });
        confianza = Math.min(confianza, 50);
      }
    }
  } else {
    avisos.push({ nivel: "error", campo: "consumoKwh", mensaje: "No se encontró el consumo en kWh. Escríbelo a mano." });
  }

  // Histórico: descarta puntos absurdos y ordena por fecha.
  datos.historico = datos.historico
    .filter((p) => /^20\d{2}-(0[1-9]|1[0-2])$/.test(p.periodo) && p.kwh >= 0 && p.kwh < KWH_MAX)
    .sort((a, b) => a.periodo.localeCompare(b.periodo));

  // Valor del kWh: en Colombia suele estar entre 500 y 1500 pesos.
  if (datos.valorKwh !== null && (datos.valorKwh < 200 || datos.valorKwh > 3000)) {
    avisos.push({ nivel: "revisar", campo: "valorKwh", mensaje: `El valor del kWh ($${datos.valorKwh}) parece incorrecto.` });
  }

  // Periodo en el futuro
  if (datos.periodo) {
    const [anio, mes] = datos.periodo.split("-").map(Number);
    const hoy = new Date();
    const limite = hoy.getFullYear() * 12 + hoy.getMonth() + 1;
    if (anio * 12 + mes > limite + 1 || anio < 2015) {
      avisos.push({ nivel: "revisar", campo: "periodo", mensaje: `El periodo ${datos.periodo} no parece correcto.` });
    }
  }

  if (datos.periodo && datos.periodoEstimado) {
    avisos.push({
      nivel: "revisar",
      campo: "periodo",
      mensaje: `El periodo (${datos.periodo}) no se pudo leer y se dedujo de la fecha de emisión. Confírmalo en la factura.`,
    });
  }

  const faltan: string[] = [];
  if (!datos.municipio) faltan.push("municipio");
  if (!datos.estrato) faltan.push("estrato");
  if (!datos.periodo) faltan.push("periodo");
  if (faltan.length) {
    avisos.push({ nivel: "revisar", campo: "general", mensaje: `Completa a mano: ${faltan.join(", ")}.` });
  }

  return { datos, avisos, confianzaConsumo: confianza };
}
