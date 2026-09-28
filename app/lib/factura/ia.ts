// Lectura de facturas con un modelo de visión (solo en el servidor).
// Proveedores, en orden: Vercel AI Gateway (se autentica solo dentro de
// Vercel, sin claves), Gemini (GEMINI_API_KEY) y Claude (ANTHROPIC_API_KEY).
// Si uno falla se prueba el siguiente. Este archivo solo se importa desde app/api,
// así que las claves nunca llegan al navegador.

import { generarJsonGemini } from "../ia/gemini";

export type RespuestaIa = {
  esFactura: boolean;
  legible: boolean;
  empresa: string | null;
  municipio: string | null;
  estrato: number | null;
  periodoInicio: string | null;
  periodoFin: string | null;
  periodoMes: string | null;
  diasFacturados: number | null;
  lecturaAnterior: number | null;
  lecturaActual: number | null;
  factorMultiplicador: number | null;
  consumoKwh: number | null;
  promedioKwh: number | null;
  valorKwh: number | null;
  totalPagar: number | null;
  historico: { periodo: string; kwh: number }[];
  observaciones: string | null;
};

export type Proveedor = "vercel" | "gemini" | "claude";

const INSTRUCCIONES = `Eres un lector experto de facturas de energía eléctrica de Colombia (Energía de Pereira, CHEC, Celsia, EPM y otras).
Recibes una foto o un PDF de una factura. Extrae SOLO lo que se ve en el documento; si un dato no aparece o no es legible, devuelve null. Nunca inventes ni estimes.

Reglas:
- Números: en Colombia el punto separa miles y la coma los decimales ("1.234,5" = 1234.5). Devuelve números JSON sin separadores de miles.
- consumoKwh: energía ACTIVA consumida en el periodo actual, en kWh. Si la factura divide el consumo en varias filas (por cambio de tarifa, subsidio/contribución o franjas), devuelve la SUMA del periodo. No confundas el consumo con el valor en pesos, con el consumo de subsistencia, con el promedio ni con meses anteriores.
- lecturaAnterior y lecturaActual: lecturas del medidor de energía activa, tal como aparecen.
- factorMultiplicador: solo si la factura lo muestra (en hogares suele ser 1).
- estrato: número de 1 a 6 del uso residencial. Si el uso no es residencial, null.
- periodoInicio y periodoFin: fechas del periodo facturado o de consumo, formato AAAA-MM-DD. Si solo aparece el mes, usa periodoMes con formato AAAA-MM.
- diasFacturados: días del periodo si aparecen.
- promedioKwh: consumo promedio que muestre la factura.
- valorKwh: costo unitario del kWh (CU) en pesos.
- totalPagar: total a pagar en pesos.
- historico: la gráfica o tabla de consumos de meses anteriores, [{periodo:"AAAA-MM", kwh}]. Solo si los meses y valores se pueden leer; máximo 12.
- empresa: nombre de la empresa que emite la factura.
- municipio: municipio donde se presta el servicio (no el domicilio de la empresa).
- esFactura: false si la imagen no es una factura de energía. legible: false si está tan borrosa que no se puede leer el consumo.
- observaciones: una frase breve si algo te genera duda (p. ej. "la foto está cortada en la parte de lecturas").
- NO devuelvas nombres de personas, direcciones, cédulas ni números de cuenta.`;

const ESQUEMA_JSON = {
  type: "object",
  properties: {
    esFactura: { type: "boolean" },
    legible: { type: "boolean" },
    empresa: { type: ["string", "null"] },
    municipio: { type: ["string", "null"] },
    estrato: { type: ["integer", "null"] },
    periodoInicio: { type: ["string", "null"] },
    periodoFin: { type: ["string", "null"] },
    periodoMes: { type: ["string", "null"] },
    diasFacturados: { type: ["integer", "null"] },
    lecturaAnterior: { type: ["number", "null"] },
    lecturaActual: { type: ["number", "null"] },
    factorMultiplicador: { type: ["number", "null"] },
    consumoKwh: { type: ["number", "null"] },
    promedioKwh: { type: ["number", "null"] },
    valorKwh: { type: ["number", "null"] },
    totalPagar: { type: ["number", "null"] },
    historico: {
      type: "array",
      items: {
        type: "object",
        properties: { periodo: { type: "string" }, kwh: { type: "number" } },
        required: ["periodo", "kwh"],
      },
    },
    observaciones: { type: ["string", "null"] },
  },
  required: [
    "esFactura", "legible", "empresa", "municipio", "estrato", "periodoInicio", "periodoFin",
    "periodoMes", "diasFacturados", "lecturaAnterior", "lecturaActual", "factorMultiplicador",
    "consumoKwh", "promedioKwh", "valorKwh", "totalPagar", "historico", "observaciones",
  ],
} as const;

/** Credencial para Vercel AI Gateway: clave explícita o token OIDC del proyecto. */
function credencialGateway(tokenOidc?: string | null) {
  return process.env.AI_GATEWAY_API_KEY || tokenOidc || process.env.VERCEL_OIDC_TOKEN || null;
}

/** Proveedores utilizables, en el orden en que se intentan. */
export function proveedoresDisponibles(tokenOidc?: string | null): Proveedor[] {
  const lista: Proveedor[] = [];
  if (credencialGateway(tokenOidc) || process.env.VERCEL === "1") lista.push("vercel");
  if (process.env.GEMINI_API_KEY) lista.push("gemini");
  if (process.env.ANTHROPIC_API_KEY) lista.push("claude");

  const preferido = process.env.IA_PROVEEDOR?.toLowerCase() as Proveedor | undefined;
  if (preferido && lista.includes(preferido)) {
    return [preferido, ...lista.filter((p) => p !== preferido)];
  }
  return lista;
}

function mensajeContexto(textoPdf?: string) {
  if (!textoPdf) return "Lee esta factura.";
  return `Lee esta factura. Como apoyo, este es el texto digital extraído del mismo PDF (puede venir desordenado):\n"""\n${textoPdf.slice(0, 8000)}\n"""`;
}

async function conGemini(base64: string, mime: string, textoPdf?: string): Promise<RespuestaIa> {
  return generarJsonGemini<RespuestaIa>({
    sistema: INSTRUCCIONES,
    partes: [{ inlineData: { mimeType: mime, data: base64 } }, { text: mensajeContexto(textoPdf) }],
    esquema: ESQUEMA_JSON,
  });
}

async function conClaude(base64: string, mime: string, textoPdf?: string): Promise<RespuestaIa> {
  const modelo = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
  const bloqueArchivo =
    mime === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: mime, data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mime, data: base64 } };

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: 1500,
      temperature: 0,
      system: INSTRUCCIONES,
      tools: [{ name: "registrar_factura", description: "Registra los datos leídos de la factura.", input_schema: ESQUEMA_JSON }],
      tool_choice: { type: "tool", name: "registrar_factura" },
      messages: [{ role: "user", content: [bloqueArchivo, { type: "text", text: mensajeContexto(textoPdf) }] }],
    }),
  });

  if (!r.ok) throw new Error(`Claude respondió ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const json = await r.json();
  const uso = json?.content?.find((b: { type: string }) => b.type === "tool_use");
  if (!uso?.input) throw new Error("Claude no devolvió datos estructurados.");
  return uso.input as RespuestaIa;
}

/** Intenta cada proveedor disponible hasta que uno responda. */
export async function leerFacturaConIa(
  base64: string,
  mime: string,
  textoPdf?: string,
  tokenOidc?: string | null
): Promise<{ respuesta: RespuestaIa; proveedor: Proveedor }> {
  const errores: string[] = [];
  for (const proveedor of proveedoresDisponibles(tokenOidc)) {
    try {
      const respuesta =
        proveedor === "vercel"
          ? await conGateway(base64, mime, textoPdf, tokenOidc)
          : proveedor === "gemini"
            ? await conGemini(base64, mime, textoPdf)
            : await conClaude(base64, mime, textoPdf);
      return { respuesta, proveedor };
    } catch (e) {
      errores.push((e as Error).message);
    }
  }
  throw new Error(errores.join(" | ") || "No hay proveedores de IA configurados.");
}
