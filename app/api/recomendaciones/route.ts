import { NextResponse } from "next/server";
import { recomendacionesPorReglas, type DatosParaRecomendar, type Recomendacion } from "../../lib/calculos/recomendaciones";
import { generarJsonGemini, geminiConfigurado } from "../../lib/ia/gemini";

export const runtime = "nodejs";
export const maxDuration = 30;

// La IA recibe SOLO números ya calculados por el motor (nada personal) y
// devuelve recomendaciones en lenguaje sencillo. No calcula: explica.

const INSTRUCCIONES = `Eres un orientador de ahorro de energía para familias colombianas y estudiantes de colegio (9.º a 11.º).
Recibes resultados YA CALCULADOS del consumo eléctrico de un hogar. Tu tarea es interpretarlos y proponer acciones concretas.
Reglas:
- No hagas cálculos nuevos ni inventes cifras: usa solo los números que recibes.
- El consumo de subsistencia es una referencia regulatoria para subsidios, no un límite ni una meta.
- Lenguaje sencillo, cálido y concreto; tutea. Nada de culpa ni alarmismo.
- Máximo 4 recomendaciones, cada una con un título corto y un detalle de 1 o 2 frases.`;

const ESQUEMA = {
  type: "object",
  properties: {
    recomendaciones: {
      type: "array",
      items: {
        type: "object",
        properties: { titulo: { type: "string" }, detalle: { type: "string" } },
        required: ["titulo", "detalle"],
      },
    },
  },
  required: ["recomendaciones"],
};

function valido(d: Partial<DatosParaRecomendar>): d is DatosParaRecomendar {
  const n = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  const nn = (v: unknown) => v === null || n(v);
  return n(d.kwhActual) && nn(d.promedio) && nn(d.tendencia) && n(d.personas) && n(d.estrato) && n(d.subsistencia) && nn(d.meta) && n(d.huellaKg);
}

export async function POST(request: Request) {
  const datos = (await request.json().catch(() => ({}))) as Partial<DatosParaRecomendar>;
  if (!valido(datos)) return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });

  const reglas = recomendacionesPorReglas(datos);
  if (!geminiConfigurado()) return NextResponse.json({ fuente: "reglas", recomendaciones: reglas });

  try {
    const r = await generarJsonGemini<{ recomendaciones: Recomendacion[] }>({
      sistema: INSTRUCCIONES,
      partes: [
        {
          text: `Resultados del hogar:
- Consumo del mes (normalizado a 30 días): ${datos.kwhActual} kWh
- Línea base (promedio): ${datos.promedio ?? "aún no hay"} kWh
- Tendencia: ${datos.tendencia ?? "sin datos"} kWh por mes
- Personas: ${datos.personas} · Estrato: ${datos.estrato}
- Consumo de subsistencia de la zona: ${datos.subsistencia} kWh/mes
- Meta: ${datos.meta ?? "sin meta"} kWh
- Huella del mes: ${datos.huellaKg} kg CO2e`,
        },
      ],
      esquema: ESQUEMA,
      temperatura: 0.4,
    });
    const lista = (r.recomendaciones ?? []).filter((x) => x?.titulo && x?.detalle).slice(0, 4);
    if (!lista.length) throw new Error("Respuesta vacía");
    return NextResponse.json({ fuente: "ia", recomendaciones: lista });
  } catch (e) {
    console.error("[api/recomendaciones]", e);
    return NextResponse.json({ fuente: "reglas", recomendaciones: reglas });
  }
}
