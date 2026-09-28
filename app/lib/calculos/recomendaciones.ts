// Recomendaciones SIN IA: reglas simples a partir de los resultados del motor.
// Sirven de respaldo cuando la IA no está disponible y como punto de
// comparación en clase: ¿qué aporta la IA que no aporten estas reglas?

export const CATALOGO_ACCIONES = [
  "Desconectar cargadores y aparatos que quedan en espera",
  "Cambiar bombillos por LED",
  "Apagar las luces al salir de una habitación",
  "Revisar el empaque y la temperatura de la nevera",
  "Planchar toda la ropa en una sola sesión",
  "Lavar con carga completa",
  "Acortar el tiempo de la ducha eléctrica",
  "Aprovechar la luz natural durante el día",
  "Apagar del todo el televisor y el decodificador en la noche",
  "Usar ventilador en lugar de aire acondicionado",
];

export type DatosParaRecomendar = {
  kwhActual: number; // normalizado a 30 días
  promedio: number | null;
  tendencia: number | null; // kWh por mes
  personas: number;
  estrato: number;
  subsistencia: number; // 173 o 130
  meta: number | null;
  huellaKg: number;
};

export type Recomendacion = { titulo: string; detalle: string };

export function recomendacionesPorReglas(d: DatosParaRecomendar): Recomendacion[] {
  const r: Recomendacion[] = [];
  const porPersona = d.kwhActual / d.personas;

  if (d.promedio && d.kwhActual > d.promedio * 1.15) {
    r.push({
      titulo: "Este mes consumieron más que su promedio",
      detalle: `Van ${Math.round(d.kwhActual - d.promedio)} kWh por encima de la línea base. Piensen qué cambió: visitas, vacaciones, un electrodoméstico nuevo o uno que falla.`,
    });
  }
  if (d.tendencia !== null && d.tendencia > 5) {
    r.push({
      titulo: "El consumo viene subiendo",
      detalle: `La tendencia es de unos ${Math.round(d.tendencia)} kWh más cada mes. Revisen primero los equipos que están siempre conectados, como la nevera.`,
    });
  }
  if (d.kwhActual > d.subsistencia) {
    r.push({
      titulo: "Por encima del consumo de subsistencia",
      detalle: `El consumo de subsistencia de la zona es ${d.subsistencia} kWh/mes. No es un límite, pero lo que pasa de ahí suele pagarse a tarifa plena${d.estrato <= 3 ? " y sin subsidio" : ""}.`,
    });
  }
  if (porPersona > 60) {
    r.push({
      titulo: "Revisen la ducha eléctrica y la nevera",
      detalle: `Cada persona usa unos ${Math.round(porPersona)} kWh al mes. En muchos hogares, la ducha eléctrica y la nevera son los mayores consumos.`,
    });
  }
  if (d.meta !== null) {
    r.push(
      d.kwhActual <= d.meta
        ? { titulo: "¡Van cumpliendo la meta!", detalle: "Sigan con las acciones que eligieron y registren la próxima factura para confirmarlo." }
        : { titulo: "Todavía no llegan a la meta", detalle: `Les faltan ${Math.round(d.kwhActual - d.meta)} kWh. Escojan una acción más de la lista y repártanse responsables en la familia.` }
    );
  }
  r.push({
    titulo: "Lo que no se ve también consume",
    detalle: "Cargadores, televisores en espera y decodificadores gastan energía aunque parezcan apagados. Desconectarlos es la acción más fácil de empezar.",
  });
  return r.slice(0, 4);
}
