// Llamada a Gemini con respuesta JSON estructurada (solo en el servidor).
// La usan el lector de facturas y las recomendaciones.

// Si Google retira un modelo, probamos el siguiente de la lista.
const MODELOS = ["gemini-3.5-flash", "gemini-3-flash-preview", "gemini-2.5-flash"];

/** Gemini usa un subconjunto de OpenAPI: "nullable" en lugar de tipos múltiples. */
export function esquemaGemini(esquema: unknown): unknown {
  if (Array.isArray(esquema)) return esquema.map(esquemaGemini);
  if (!esquema || typeof esquema !== "object") return esquema;
  const salida: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(esquema)) {
    if (clave === "type" && Array.isArray(valor)) {
      salida.type = String(valor.find((t) => t !== "null")).toUpperCase();
      if (valor.includes("null")) salida.nullable = true;
    } else if (clave === "type") {
      salida.type = String(valor).toUpperCase();
    } else {
      salida[clave] = esquemaGemini(valor);
    }
  }
  return salida;
}

export function geminiConfigurado() {
  return Boolean(process.env.GEMINI_API_KEY);
}

type Parte = { text: string } | { inlineData: { mimeType: string; data: string } };

export async function generarJsonGemini<T>(opciones: {
  sistema: string;
  partes: Parte[];
  esquema: unknown;
  temperatura?: number;
}): Promise<T> {
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) throw new Error("Falta GEMINI_API_KEY.");
  const modelos = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL, ...MODELOS] : MODELOS;
  const cuerpo = JSON.stringify({
    systemInstruction: { parts: [{ text: opciones.sistema }] },
    contents: [{ role: "user", parts: opciones.partes }],
    generationConfig: {
      temperature: opciones.temperatura ?? 0,
      responseMimeType: "application/json",
      responseSchema: esquemaGemini(opciones.esquema),
    },
  });

  let ultimoError = "";
  for (const modelo of modelos) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": clave },
      body: cuerpo,
    });
    if (r.status === 404) {
      ultimoError = `El modelo ${modelo} no existe.`;
      continue;
    }
    if (!r.ok) throw new Error(`Gemini respondió ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const json = await r.json();
    const texto: string | undefined = json?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("");
    if (!texto) throw new Error("Gemini no devolvió contenido.");
    return JSON.parse(texto) as T;
  }
  throw new Error(ultimoError || "No hay un modelo de Gemini disponible.");
}
