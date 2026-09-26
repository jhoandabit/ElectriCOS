import { extractNumberTokens, normalizeInvoiceText, normalizeMonthPeriod, parseLocaleNumber } from "./normalizer";
import { identifyInvoiceProvider } from "./templates";
import { validateConsumption } from "./validation";
import type { InvoiceEvidence, InvoiceField, InvoiceHistoryEntry, ParsedInvoice } from "./types";

function field<T extends string | number>(
  value: T | null,
  confidence: number,
  evidence: InvoiceEvidence[] = []
): InvoiceField<T> {
  return { value, confidence, evidence };
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function extractMunicipality(text: string) {
  const value = firstMatch(text, [
    /municipio\s*[:\-]?\s*(?:\d{1,4}\s+)?([A-Za-zÁÉÍÓÚáéíóúÑñ ]{3,40}?)(?=\s+(?:servicio|ciclo|estrato|ruta)\b)/i,
    /municipio\s*[:\-]?\s*(?:\d{1,4}\s+)?([A-Za-zÁÉÍÓÚáéíóúÑñ]{3,30})/i,
  ]);

  if (!value) return field<string>(null, 0);

  return field(value.replace(/\s+/g, " "), 85, [{
    source: "municipality-label",
    value,
    score: 85,
    reason: "Valor encontrado junto a una etiqueta de municipio.",
  }]);
}

function extractStratum(text: string) {
  const value = firstMatch(text, [
    /(?:estrato|strato|estr)\s*[:.]?\s*([1-6])\b/i,
    /(?:estrato|strato|estr)\D{0,8}([1-6])\b/i,
  ]);

  const number = value ? Number(value) : null;
  if (number === null || !Number.isInteger(number)) return field<number>(null, 0);

  return field(number, 85, [{
    source: "stratum-label",
    value: number,
    score: 85,
    reason: "Valor encontrado junto a una etiqueta de estrato.",
  }]);
}

function extractDays(text: string) {
  const value = firstMatch(text, [
    /d[ií]as\s+(?:facturados|facturad[oa]s)\s*[:.]?\s*(\d{1,3})\b/i,
    /d[ií]as\s+facturaci[oó]n\s*[:.]?\s*(\d{1,3})\b/i,
    /periodo\s+facturado\b.{0,100}?\b(\d{1,3})\b/i,
  ]);

  const number = value ? Number(value) : null;
  if (number === null || number < 1 || number > 120) return field<number>(null, 0);

  return field(number, 90, [{
    source: "billing-days-label",
    value: number,
    score: 90,
    reason: "Número encontrado asociado a los días facturados.",
  }]);
}

function extractReadings(text: string) {
  const tokens = extractNumberTokens(text)
    .filter((token) => token.value !== null)
    .map((token) => ({
      value: token.value as number,
      index: token.index,
    }));

  const large = tokens.filter(
    (token) =>
      Number.isInteger(token.value) &&
      token.value >= 1000 &&
      token.value <= 9999999
  );

  const candidates = new Map<string, { previous: number; current: number; kwh: number; score: number }>();

  for (const left of large) {
    for (const right of large) {
      if (left.value >= right.value) continue;

      const difference = right.value - left.value;
      if (difference < 1 || difference > 5000) continue;

      const distance = Math.abs(left.index - right.index);
      if (distance > 1800) continue;

      const nearbyText = text.slice(
        Math.max(0, Math.min(left.index, right.index) - 160),
        Math.min(text.length, Math.max(left.index, right.index) + 320)
      );

      let score = 30;

      if (/actual|lectura|medidor|activa|anterior/i.test(nearbyText)) score += 20;

      const explicitConsumption = nearbyText.match(
        /(?:consumo|actual|activa)\D{0,40}(\d{1,4}(?:[.,]\d{1,2})?)/i
      );

      if (explicitConsumption) {
        const parsed = parseLocaleNumber(explicitConsumption[1]);
        if (parsed !== null && Math.abs(parsed - difference) < 0.01) {
          score += 50;
        }
      }

      const key = `${left.value}-${right.value}-${difference}`;
      const current = candidates.get(key);
      if (!current || score > current.score) {
        candidates.set(key, {
          previous: left.value,
          current: right.value,
          kwh: difference,
          score,
        });
      }
    }
  }

  const best = [...candidates.values()].sort((a, b) => b.score - a.score)[0];

  if (!best) {
    return {
      previous: field<number>(null, 0),
      current: field<number>(null, 0),
      consumption: field<number>(null, 0),
    };
  }

  const evidence: InvoiceEvidence[] = [{
    source: "reading-difference",
    value: best.kwh,
    score: best.score,
    reason: `${best.current} - ${best.previous} = ${best.kwh}`,
  }];

  return {
    previous: field(best.previous, Math.min(95, best.score), evidence),
    current: field(best.current, Math.min(95, best.score), evidence),
    consumption: field(best.kwh, Math.min(95, best.score), evidence),
  };
}

function extractHistory(text: string): {
  entries: InvoiceHistoryEntry[];
  currentKwh: number | null;
  averageKwh: number | null;
  liquidationKwh: number[];
} {
  const entries: InvoiceHistoryEntry[] = [];
  const monthNames = "ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC";

  const rowPattern = new RegExp(
    `\\b(${monthNames})\\b\\s+(\\d{1,4}(?:[.,]\\d{1,2})?)`,
    "gi"
  );

  for (const match of text.matchAll(rowPattern)) {
    const kwh = parseLocaleNumber(match[2]);
    if (kwh !== null && kwh >= 0 && kwh <= 5000) {
      entries.push({ month: match[1].toUpperCase(), kwh });
    }
  }

  const actual =
    firstMatch(text, [
      /\bactual\b\s*[:.]?\s*(\d{1,4}(?:[.,]\d{1,2})?)/i,
      /\bact\b\s*[:.]?\s*(\d{1,4}(?:[.,]\d{1,2})?)/i,
    ]);

  const average =
    firstMatch(text, [
      /\bpromedio\b\s*[:.]?\s*(\d{1,4}(?:[.,]\d{1,2})?)/i,
      /\bprom\b\s*[:.]?\s*(\d{1,4}(?:[.,]\d{1,2})?)/i,
    ]);

  const liquidationText = text.match(
    /liquidaci[oó]n[\s\S]{0,1800}/i
  )?.[0] ?? "";

  const liquidationKwh: number[] = [];

  for (const match of liquidationText.matchAll(
    /(?:0\s*[-–]\s*\d+|>\s*\d+)\s+(\d{1,4}(?:[.,]\d{1,2})?)\b/g
  )) {
    const value = parseLocaleNumber(match[1]);
    if (value !== null && value >= 0 && value <= 5000) {
      liquidationKwh.push(value);
    }
  }

  return {
    entries,
    currentKwh: actual ? parseLocaleNumber(actual) : null,
    averageKwh: average ? parseLocaleNumber(average) : null,
    liquidationKwh,
  };
}

function extractInvoiceNumber(text: string) {
  const value = firstMatch(text, [
    /(?:factura|n[uú]mero\s+de\s+factura)\s*[:#]?\s*(\d{5,15})\b/i,
    /matr[ií]cula\s*[:#]?\s*(\d{5,15})\b/i,
  ]);

  return value
    ? field<string>(value, 80, [{
        source: "invoice-number-label",
        value,
        score: 80,
        reason: "Identificador encontrado junto a una etiqueta de factura.",
      }])
    : field<string>(null, 0);
}

function extractTariff(text: string) {
  const value = firstMatch(text, [
    /valor\s*kwh\s*[:.]?\s*(\d{2,5}[.,]\d{2,6})/i,
    /(?:tarifa|precio)\s*(?:por\s*)?kwh\s*[:.]?\s*(\d{2,5}[.,]\d{2,6})/i,
  ]);

  const number = value ? parseLocaleNumber(value) : null;

  return number !== null
    ? field<number>(number, 85, [{
        source: "tariff-label",
        value: number,
        score: 85,
        reason: "Valor encontrado junto a la tarifa por kWh.",
      }])
    : field<number>(null, 0);
}

export function parseInvoiceText(
  rawText: string,
  sourceType: ParsedInvoice["sourceType"] = "unknown"
): ParsedInvoice {
  const text = normalizeInvoiceText(rawText);
  const provider = identifyInvoiceProvider(text);
  const history = extractHistory(text);
  const readings = extractReadings(text);

  let consumptionValue = readings.consumption.value;

  const consumptionEvidence = [
    ...readings.consumption.evidence,
  ];

  if (history.currentKwh !== null) {
    const matchesReading =
      readings.consumption.value !== null &&
      Math.abs(history.currentKwh - readings.consumption.value) < 0.01;

    if (matchesReading) {
      consumptionEvidence.push({
        source: "history-current",
        value: history.currentKwh,
        score: 30,
        reason: "Valor encontrado junto a Actual/ACT y coincidente con las lecturas.",
      });
    }

    // "Actual" aparece en algunas facturas también dentro de la tabla de
    // días facturados. Solo lo usamos como consumo cuando coincide con una
    // evidencia energética independiente.
    if (consumptionValue === null) {
      consumptionValue = history.currentKwh;
    }
  }

  if (history.liquidationKwh.length) {
    const sum = history.liquidationKwh.reduce((total, value) => total + value, 0);

    consumptionEvidence.push({
      source: "liquidation-sum",
      value: sum,
      score: 35,
      reason: "Suma de componentes de la liquidación.",
    });

    if (consumptionValue === null) {
      consumptionValue = sum;
    }
  }

  const validation = validateConsumption({
    previousReading: readings.previous.value,
    currentReading: readings.current.value,
    consumptionKwh: consumptionValue,
    historyCurrentKwh: history.currentKwh,
    averageKwh: history.averageKwh,
    liquidationKwh: history.liquidationKwh,
  });

  const providerField = field(
    provider.id,
    provider.confidence,
    provider.confidence
      ? [{
          source: "provider-identification",
          value: provider.id,
          score: provider.confidence,
          reason: "Coincidencia con identificadores conocidos de la factura.",
        }]
      : []
  );

  return {
    sourceType,
    provider: providerField,
    municipality: extractMunicipality(text),
    stratum: extractStratum(text),
    billingPeriod: field(
      normalizeMonthPeriod(text),
      normalizeMonthPeriod(text) ? 85 : 0
    ),
    billingDays: extractDays(text),
    previousReading: readings.previous,
    currentReading: readings.current,
    consumptionKwh: field(
      consumptionValue,
      validation.consistent ? Math.min(99, 60 + validation.score / 4) : 55,
      consumptionEvidence
    ),
    averageKwh: field(
      history.averageKwh,
      history.averageKwh !== null ? 80 : 0,
      history.averageKwh !== null
        ? [{
            source: "history-average",
            value: history.averageKwh,
            score: 80,
            reason: "Valor encontrado junto a Promedio/PROM.",
          }]
        : []
    ),
    tariffValue: extractTariff(text),
    invoiceNumber: extractInvoiceNumber(text),
    history: history.entries,
    validation,
    rawText,
  };
}
