import type { InvoiceTemplate, InvoiceProviderId } from "./types";

export const INVOICE_TEMPLATES: InvoiceTemplate[] = [
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
