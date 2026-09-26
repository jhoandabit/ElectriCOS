import type { InvoiceTemplate, InvoiceProviderId } from "./types";

export const GENERIC_INVOICE_REGIONS: NonNullable<InvoiceTemplate["regions"]> = [
  { name: "encabezado", x: 0.02, y: 0.02, width: 0.96, height: 0.18, psm: 6 },
  { name: "consumo", x: 0.02, y: 0.18, width: 0.96, height: 0.24, psm: 6 },
  { name: "periodo", x: 0.02, y: 0.38, width: 0.96, height: 0.16, psm: 6 },
  { name: "liquidacion", x: 0.02, y: 0.50, width: 0.96, height: 0.22, psm: 6 },
  { name: "totales", x: 0.02, y: 0.68, width: 0.96, height: 0.30, psm: 6 },
];

export const INVOICE_TEMPLATES: InvoiceTemplate[] = [
  {
    id: "epm",
    name: "EPM",
    aliases: [
      "epm",
      "empresas publicas de medellin",
      "empresa de servicios publicos de medellin",
    ],
    anchors: [
      "historico de consumos",
      "valores facturados",
      "lectura actual",
      "lectura anterior",
      "consumo energia",
      "promedio de los ultimos",
    ],
    fieldHints: {
      municipality: ["municipio"],
      stratum: ["estrato"],
      billingPeriod: ["periodo", "calculo consumo"],
      billingDays: ["dias fact", "dias de consumo"],
      previousReading: ["lectura anterior"],
      currentReading: ["lectura actual"],
      consumptionKwh: ["consumo", "kwh", "consumo energia"],
      averageKwh: ["prom", "promedio"],
      tariffValue: ["costo", "kwh"],
      invoiceNumber: ["factura", "contrato"],
    },
  },
  {
    id: "eep",
    name: "Empresa de Energía de Pereira",
    aliases: [
      "empresa de energia de pereira",
      "energia de pereira",
      "eep",
      "eepvm05",
      "municipio de cartago",
    ],
    anchors: [
      "documento equivalente electronico",
      "servicios publicos domiciliarios",
      "energia electrica",
      "informacion de consumo",
      "liquidacion del consumo actual",
    ],
    fieldHints: {
      municipality: ["municipio"],
      stratum: ["estrato"],
      billingPeriod: ["periodo facturado"],
      billingDays: ["dias facturados"],
      previousReading: ["lectura anterior"],
      currentReading: ["actual"],
      consumptionKwh: ["consumo kwh", "consumo"],
      averageKwh: ["promedio", "prom"],
      tariffValue: ["valor kwh"],
      invoiceNumber: ["factura", "matricula"],
    },
    regions: [
      { name: "datos-tecnicos", x: 0.02, y: 0.03, width: 0.48, height: 0.16, psm: 6 },
      { name: "historico", x: 0.08, y: 0.19, width: 0.43, height: 0.13, psm: 6 },
      { name: "medidor", x: 0.02, y: 0.30, width: 0.55, height: 0.08, psm: 6 },
      { name: "periodo", x: 0.02, y: 0.38, width: 0.55, height: 0.07, psm: 6 },
      { name: "liquidacion", x: 0.02, y: 0.43, width: 0.55, height: 0.11, psm: 6 },
    ],
  },
];

export function identifyInvoiceProvider(text: string): {
  id: InvoiceProviderId;
  confidence: number;
} {
  const normalized = text
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase();

  let best: { id: InvoiceProviderId; confidence: number } = {
    id: "generic",
    confidence: 0,
  };

  for (const template of INVOICE_TEMPLATES) {
    let score = 0;

    for (const alias of template.aliases) {
      if (normalized.includes(alias)) score += 20;
    }

    for (const anchor of template.anchors) {
      if (normalized.includes(anchor)) score += 10;
    }

    if (score > best.confidence) {
      best = { id: template.id, confidence: Math.min(100, score) };
    }
  }

  return best;
}

export function getInvoiceTemplate(id: InvoiceProviderId) {
  return INVOICE_TEMPLATES.find((template) => template.id === id) ?? null;
}
