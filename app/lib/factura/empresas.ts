import { normalizarTexto } from "./texto";
import type { EmpresaId } from "./tipos";

type Firma = { id: EmpresaId; alias: string[]; pistas: string[] };

// Palabras que suelen aparecer en cada factura. Los alias pesan más
// que las pistas porque son nombres propios de la empresa.
const FIRMAS: Firma[] = [
  {
    id: "energia-pereira",
    alias: [
      "empresa de energia de pereira",
      "energia de pereira",
      "energia de perera", // así aparece, con error, en algunas facturas
      "eepvm05",
      "web-eepvm05",
      "eep.com.co",
      "eep s.a",
      "eeps.a",
    ],
    pistas: [
      "liquidacion del consumo actual",
      "informacion de consumo",
      "documento equivalente electronico",
      "periodo facturado",
      "alumbrado publico ctg",
      "clt consumo lectura tomada",
    ],
  },
  {
    id: "chec",
    alias: ["chec", "central hidroelectrica de caldas", "chec.com.co"],
    pistas: ["grupo epm", "manizales"],
  },
  {
    id: "celsia",
    alias: ["celsia", "celsia.com", "epsa"],
    pistas: ["componentes de la formula tarifaria", "consumo de los ultimos 6 meses"],
  },
  {
    id: "epm",
    alias: ["empresas publicas de medellin", "epm.com.co", "epm e.s.p"],
    pistas: ["historico de consumos", "valores facturados"],
  },
];

function contienePalabra(texto: string, frase: string) {
  const escapada = frase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escapada}($|[^a-z0-9])`).test(texto);
}

export function detectarEmpresa(texto: string): { id: EmpresaId; puntaje: number } {
  const t = normalizarTexto(texto);
  let mejor: { id: EmpresaId; puntaje: number } = { id: "otra", puntaje: 0 };

  for (const firma of FIRMAS) {
    let puntaje = 0;
    for (const a of firma.alias) if (contienePalabra(t, a)) puntaje += 30;
    for (const p of firma.pistas) if (contienePalabra(t, p)) puntaje += 8;
    if (puntaje > mejor.puntaje) mejor = { id: firma.id, puntaje };
  }

  return mejor.puntaje >= 20 ? mejor : { id: "otra", puntaje: mejor.puntaje };
}

/** Normaliza el nombre de empresa que devuelve la IA a nuestro catálogo. */
export function empresaDesdeNombre(nombre: string | null | undefined): EmpresaId {
  if (!nombre) return "otra";
  const t = normalizarTexto(nombre);
  if (t.includes("pereira") || /\beep\b/.test(t)) return "energia-pereira";
  if (t.includes("chec") || t.includes("caldas")) return "chec";
  if (t.includes("celsia") || t.includes("epsa")) return "celsia";
  if (t.includes("epm") || t.includes("medellin")) return "epm";
  return "otra";
}
