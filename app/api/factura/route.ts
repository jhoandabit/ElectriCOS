import { NextResponse } from "next/server";
import { datosDesdeIa } from "../../lib/factura/desde-ia";
import { leerFacturaConIa, proveedoresDisponibles } from "../../lib/factura/ia";

export const runtime = "nodejs";
export const maxDuration = 60;

const MIMES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_BASE64 = 4_300_000; // Vercel limita el cuerpo a ~4,5 MB

// GET /api/factura → ¿hay IA configurada? (la interfaz lo usa para decidir)
export async function GET(request: Request) {
  const tokenOidc = request.headers.get("x-vercel-oidc-token");
  return NextResponse.json({ disponible: proveedoresDisponibles(tokenOidc).length > 0 });
}

// POST /api/factura { base64, mime, textoPdf? } → datos de la factura
// No se guarda nada: la imagen se envía al modelo y se descarta.
export async function POST(request: Request) {
  // Dentro de Vercel, el token OIDC del proyecto llega en este encabezado.
  const tokenOidc = request.headers.get("x-vercel-oidc-token");
  if (!proveedoresDisponibles(tokenOidc).length) {
    return NextResponse.json(
      { error: "La lectura con IA no está configurada en el servidor." },
      { status: 503 }
    );
  }

  let cuerpo: { base64?: unknown; mime?: unknown; textoPdf?: unknown };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const { base64, mime, textoPdf } = cuerpo;
  if (typeof base64 !== "string" || !base64 || typeof mime !== "string" || !MIMES.has(mime)) {
    return NextResponse.json({ error: "Envía una imagen JPG/PNG o un PDF." }, { status: 400 });
  }
  if (base64.length > MAX_BASE64) {
    return NextResponse.json({ error: "El archivo es muy pesado. Usa una foto más liviana." }, { status: 413 });
  }

  try {
    const { respuesta, proveedor } = await leerFacturaConIa(
      base64,
      mime,
      typeof textoPdf === "string" ? textoPdf : undefined,
      tokenOidc
    );

    return NextResponse.json({
      esFactura: respuesta.esFactura !== false,
      legible: respuesta.legible !== false,
      observaciones: respuesta.observaciones ?? null,
      datos: datosDesdeIa(respuesta),
      proveedor,
    });
  } catch (error) {
    console.error("[api/factura]", error);
    return NextResponse.json(
      { error: "La lectura con IA no está disponible en este momento. Se usó la lectura sin internet." },
      { status: 502 }
    );
  }
}
