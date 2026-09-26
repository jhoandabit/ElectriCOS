"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";

type Screen = "home" | "manual" | "invoice";
type FormState = {
  municipality: string;
  estrato: string;
  people: string;
  period: string;
  kwh: string;
  previous: string;
  current: string;
  days: string;
};

const emptyForm: FormState = {
  municipality: "",
  estrato: "",
  people: "1",
  period: "",
  kwh: "",
  previous: "",
  current: "",
  days: "",
};

function parseNumber(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function preprocessInvoiceImage(file: File, mode: "gray" | "binary" | "original") {
  return new Promise<Blob>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Tesseract funciona mejor cuando el texto llega con suficiente
      // resolución. En fotos de factura el documento puede ocupar solo una
      // parte de la imagen, por eso permitimos una ampliación mayor.
      const maxWidth = 3200;
      const scale = Math.min(1.8, maxWidth / image.naturalWidth);
      const width = Math.max(1200, Math.round(image.naturalWidth * scale));
      const height = Math.round(image.naturalHeight * (width / image.naturalWidth));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        reject(new Error("No se pudo preparar la imagen."));
        return;
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, width, height);

      const imageData = context.getImageData(0, 0, width, height);
      const data = imageData.data;

      let sum = 0;
      const luminance = new Uint8Array(width * height);

      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const y = Math.round(
          0.299 * data[i] +
          0.587 * data[i + 1] +
          0.114 * data[i + 2]
        );
        luminance[p] = y;
        sum += y;
      }

      const mean = sum / luminance.length;

      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        let y = luminance[p];

        if (mode === "original") {
          // Conservamos el color original. Algunas facturas usan texto
          // naranja/verde sobre fondo claro y el paso a gris puede reducir
          // demasiado el contraste de esos elementos.
          continue;
        }

        if (mode === "gray") {
          y = Math.max(0, Math.min(255, Math.round((y - mean) * 1.55 + 128)));
        } else {
          const threshold = mean - 8;
          y = luminance[p] < threshold ? 0 : 255;
        }

        data[i] = y;
        data[i + 1] = y;
        data[i + 2] = y;
        data[i + 3] = 255;
      }

      context.putImageData(imageData, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("No se pudo generar la imagen procesada."));
        },
        "image/jpeg",
        0.94
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo abrir la imagen."));
    };

    image.src = objectUrl;
  });
}

function scoreOcrText(text: string, confidence: number) {
  const normalized = text.toLowerCase();
  let score = confidence || 0;

  const usefulTerms = [
    "consumo",
    "energía",
    "energia",
    "kwh",
    "lectura",
    "actual",
    "anterior",
    "estrato",
    "periodo",
    "factura",
    "municipio",
    "total",
  ];

  for (const term of usefulTerms) {
    if (normalized.includes(term)) score += 4;
  }

  const numericMatches = text.match(/\b\d{2,4}(?:[.,]\d{1,2})?\b/g);
  score += Math.min(20, (numericMatches?.length ?? 0) * 1.5);

  return score;
}

function normalizeInvoiceFieldText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[|]/g, " ")
    .replace(/[—–]/g, "-")
    .replace(/[\u00a0]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

type PdfTextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

function normalizeLoose(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function nearbyPdfTextFlexible(
  items: PdfTextItem[],
  labelPattern: RegExp,
  maxYDistance = 55,
  maxXDistance = 700
) {
  const label = items.find((item) => labelPattern.test(normalizeLoose(item.text)));
  if (!label) return "";

  const candidates = items
    .filter((item) => {
      if (item === label) return false;

      const yDistance = Math.abs(item.y - label.y);
      const rightDistance = item.x - (label.x + label.width);
      const sameRow = yDistance <= maxYDistance && rightDistance >= -20 && rightDistance <= maxXDistance;

      const belowDistance = label.y - item.y;
      const sameColumn = belowDistance >= -5 && belowDistance <= maxYDistance && Math.abs(item.x - label.x) <= maxXDistance;

      return sameRow || sameColumn;
    })
    .sort((a, b) => {
      const da = Math.abs(a.y - label.y) + Math.max(0, -(a.x - label.x));
      const db = Math.abs(b.y - label.y) + Math.max(0, -(b.x - label.x));
      return da - db;
    });

  return candidates
    .slice(0, 8)
    .map((item) => item.text)
    .join(" ")
    .trim();
}

function nearbyPdfText(
  items: PdfTextItem[],
  labelPattern: RegExp,
  maxYDistance = 28,
  maxXDistance = 420
) {
  const label = items.find((item) => labelPattern.test(normalizeLoose(item.text)));
  if (!label) return "";

  return items
    .filter((item) => {
      const yDistance = Math.abs(item.y - label.y);
      const xDistance = item.x - (label.x + label.width);
      return (
        item !== label &&
        yDistance <= maxYDistance &&
        xDistance >= -8 &&
        xDistance <= maxXDistance
      );
    })
    .sort((a, b) => {
      const yDiff = Math.abs(a.y - label.y) - Math.abs(b.y - label.y);
      return yDiff !== 0 ? yDiff : a.x - b.x;
    })
    .map((item) => item.text)
    .join(" ");
}

function extractReadingFromText(text: string) {
  const tokens = Array.from(
    text.matchAll(/\b\d{1,6}(?:[.,]\d{1,2})?\b/g)
  ).map((match) => ({
    value: parseNumber(match[0]),
    index: match.index ?? 0,
  }));

  const readings = tokens
    .filter((token) => token.value !== null && Number.isInteger(token.value) && token.value >= 1000 && token.value <= 999999)
    .map((token) => token.value as number);

  const consumptions = tokens
    .filter((token) => token.value !== null && token.value >= 20 && token.value < 2000)
    .map((token) => token.value as number);

  // En OCR los tres números pueden quedar separados por palabras, columnas
  // o saltos de línea. Buscamos una relación matemática válida dentro de una
  // ventana razonable del texto, en vez de exigir que sean consecutivos.
  for (const a of readings) {
    for (const b of readings) {
      if (a === b) continue;

      const consumption = Math.abs(a - b);
      if (consumption < 20 || consumption >= 2000) continue;

      const aIndex = tokens.find((token) => token.value === a)?.index ?? 0;
      const bIndex = tokens.find((token) => token.value === b)?.index ?? 0;

      if (Math.abs(aIndex - bIndex) > 1200) continue;

      if (consumptions.some((value) => value === consumption)) {
        return {
          previous: String(Math.min(a, b)),
          current: String(Math.max(a, b)),
          kwh: String(consumption),
        };
      }
    }
  }

  return null;
}

type PdfRow = {
  y: number;
  items: PdfTextItem[];
  text: string;
  normalized: string;
};

function buildPdfRows(items: PdfTextItem[], tolerance = 2.5): PdfRow[] {
  const rows: PdfRow[] = [];

  for (const item of items) {
    let row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);

    if (!row) {
      row = {
        y: item.y,
        items: [],
        text: "",
        normalized: "",
      };
      rows.push(row);
    }

    row.items.push(item);
  }

  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
    row.text = row.items.map((item) => item.text.trim()).filter(Boolean).join(" ");
    row.normalized = normalizeLoose(row.text);
  }

  return rows.sort((a, b) => a.y - b.y);
}

function numericToken(value: string) {
  const cleaned = value.replace(/[^0-9.,-]/g, "");
  if (!cleaned) return null;
  return parseNumber(cleaned);
}

function extractPdfMeterReadings(rows: PdfRow[]) {
  // En la factura de Energía de Pereira la fila del medidor contiene:
  // GNS 19840 19487 353 1 353 267
  // Los dos primeros enteros de 4-6 dígitos después de GNS son
  // lectura actual y lectura anterior.
  const gnsRow = rows.find((row) => /\bgns\b/i.test(row.normalized));

  if (!gnsRow) return null;

  const gnsIndex = gnsRow.items.findIndex((item) => /^gns$/i.test(normalizeLoose(item.text)));
  const numbers = gnsRow.items
    .filter((item, index) => index > gnsIndex)
    .map((item) => ({
      item,
      value: numericToken(item.text),
    }))
    .filter(
      (entry): entry is { item: PdfTextItem; value: number } =>
        entry.value !== null &&
        Number.isInteger(entry.value) &&
        entry.value >= 1000 &&
        entry.value <= 999999
    );

  if (numbers.length < 2) return null;

  const current = numbers[0].value;
  const previous = numbers[1].value;
  const consumption = current - previous;

  if (consumption <= 0 || consumption >= 2000) return null;

  return {
    previous: String(previous),
    current: String(current),
    kwh: String(consumption),
  };
}

function extractPdfTariffConsumption(rows: PdfRow[]) {
  const consumptionValues: number[] = [];

  for (const row of rows) {
    const rateItems = row.items.filter((item) =>
      /^\d{3}[.,]\d{4}$/.test(item.text.trim())
    );

    for (const rateItem of rateItems) {
      // El consumo de cada franja está a la izquierda inmediata del valor
      // unitario. Esto evita sumar valores monetarios, históricos o lecturas
      // que estén en otras zonas de la factura.
      const candidates = row.items
        .filter((item) => {
          if (item.x >= rateItem.x) return false;

          const distance = rateItem.x - item.x;
          if (distance > 105) return false;

          return /^\d{2,4}$/.test(item.text.trim());
        })
        .map((item) => ({
          item,
          value: Number(item.text.trim()),
          distance: rateItem.x - item.x,
        }))
        .filter((entry) => entry.value >= 20 && entry.value < 2000)
        .sort((a, b) => a.distance - b.distance);

      if (candidates.length) {
        consumptionValues.push(candidates[0].value);
      }
    }
  }

  const unique = [...new Set(consumptionValues)];

  if (!unique.length) return null;

  return Number(unique.reduce((sum, value) => sum + value, 0).toFixed(2));
}

function extractPdfBasicFields(rows: PdfRow[], text: string): Partial<FormState> {
  const result: Partial<FormState> = {};

  // MUNICIPIO:
  // Ejemplo real: "147 Cartago Residencial 108"
  const serviceRow = rows.find(
    (row) =>
      /\bresidencial\b/i.test(row.normalized) &&
      /\bcartago\b/i.test(row.normalized)
  );

  if (serviceRow) {
    const match = serviceRow.text.match(
      /\b\d{1,4}\s+([A-Za-zÁÉÍÓÚáéíóúÑñ]{3,30})\s+residencial\b/i
    );

    if (match) {
      result.municipality = match[1].trim();
    }
  }

  if (!result.municipality) {
    const municipalityMatch = text.match(
      /\bmunicipio\s*(?:de)?\s*[:\-]?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ]{3,30})/i
    );

    if (municipalityMatch) {
      result.municipality = municipalityMatch[1].trim();
    }
  }

  // ESTRATO:
  // En la factura EEP aparece como "CT0172 4".
  const estratoRow = rows.find((row) => /\bct\d+\b/i.test(row.normalized));

  if (estratoRow) {
    const match = estratoRow.text.match(/\bct\d+\b[\s\S]*?\b([1-6])\b/i);
    if (match) result.estrato = match[1];
  }

  if (!result.estrato) {
    const match = text.match(/\bestrato\s*[:.]?\s*([1-6])\b/i);
    if (match) result.estrato = match[1];
  }

  // PERIODO Y DÍAS:
  // Ejemplo real: "14/AGO/2026 - 10/SEP/2026 28"
  const periodRow = rows.find((row) =>
    /\b\d{1,2}\/[A-Za-z]{3,10}\/\d{4}\b.*\b\d{1,2}\b/.test(row.text)
  );

  if (periodRow) {
    const match = periodRow.text.match(
      /(\d{1,2})\/([A-Za-z]{3,10})\/(\d{4})\s*[-–]\s*(\d{1,2})\/([A-Za-z]{3,10})\/(\d{4})\s+(\d{1,3})\b/i
    );

    if (match) {
      const monthMap: Record<string, string> = {
        ene: "01", enero: "01",
        feb: "02", febrero: "02",
        mar: "03", marzo: "03",
        abr: "04", abril: "04",
        may: "05", mayo: "05",
        jun: "06", junio: "06",
        jul: "07", julio: "07",
        ago: "08", agosto: "08",
        sep: "09", septiembre: "09",
        oct: "10", octubre: "10",
        nov: "11", noviembre: "11",
        dic: "12", diciembre: "12",
      };

      const month = monthMap[match[2].toLowerCase()];
      if (month) {
        result.period = match[3] + "-" + month;
      }

      result.days = match[7];
    }
  }

  if (!result.period) {
    const fallback = text.match(
      /periodo[\s\S]{0,100}?(\d{1,2})\s*[/\-]\s*([A-Za-z]{3,10})\s*[/\-]\s*(\d{4})/i
    );

    if (fallback) {
      const monthMap: Record<string, string> = {
        ene: "01", enero: "01",
        feb: "02", febrero: "02",
        mar: "03", marzo: "03",
        abr: "04", abril: "04",
        may: "05", mayo: "05",
        jun: "06", junio: "06",
        jul: "07", julio: "07",
        ago: "08", agosto: "08",
        sep: "09", septiembre: "09",
        oct: "10", octubre: "10",
        nov: "11", noviembre: "11",
        dic: "12", diciembre: "12",
      };

      const month = monthMap[fallback[2].toLowerCase()];
      if (month) result.period = fallback[3] + "-" + month;
    }
  }

  return result;
}

function extractStructuredPdfData(
  text: string,
  items: PdfTextItem[] = []
): Partial<FormState> {
  const result = extractPdfBasicFields(
    buildPdfRows(items),
    text
  );

  const rows = buildPdfRows(items);

  // FUENTE 1: tabla de liquidación por franjas.
  const tariffKwh = extractPdfTariffConsumption(rows);

  // FUENTE 2: lecturas del medidor.
  const meter = extractPdfMeterReadings(rows);

  // La decisión del consumo se hace con evidencia cruzada:
  // - si ambas fuentes coinciden, esa es la lectura;
  // - si solo una existe, se usa esa fuente;
  // - si difieren, se conserva la lectura de la liquidación, porque es el
  //   valor explícitamente facturado, y no una resta accidental de otra tabla.
  if (tariffKwh !== null && meter) {
    if (tariffKwh === Number(meter.kwh)) {
      result.kwh = String(tariffKwh);
      result.previous = meter.previous;
      result.current = meter.current;
    } else {
      result.kwh = String(tariffKwh);
    }
  } else if (tariffKwh !== null) {
    result.kwh = String(tariffKwh);
  } else if (meter) {
    result.kwh = meter.kwh;
    result.previous = meter.previous;
    result.current = meter.current;
  }

  // Último respaldo: únicamente si no hubo evidencia estructurada.
  if (!result.kwh) {
    const reading = extractReadingFromText(normalizeInvoiceFieldText(text));
    if (reading) Object.assign(result, reading);
  }

  return result;
}

async function extractInvoicePdf(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url
  ).toString();

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
  }).promise;

  const pages: string[] = [];
  const allItems: PdfTextItem[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const items = (content.items as Array<{
      str?: string;
      transform?: number[];
      width?: number;
      height?: number;
    }>)
      .filter((item) => item.str?.trim())
      .map((item) => ({
        text: item.str ?? "",
        x: item.transform?.[4] ?? 0,
        y: item.transform?.[5] ?? 0,
        width: item.width ?? 0,
        height: item.height ?? Math.abs(item.transform?.[3] ?? 0),
      }));

    allItems.push(...items);

    const ordered = [...items].sort((a, b) => {
      const yDiff = Math.abs(b.y - a.y);
      return yDiff > 3 ? b.y - a.y : a.x - b.x;
    });

    const lines: Array<{ y: number; text: string }> = [];

    for (const item of ordered) {
      const previous = lines[lines.length - 1];

      if (!previous || Math.abs(previous.y - item.y) > 3) {
        lines.push({ y: item.y, text: item.text });
      } else {
        previous.text += " " + item.text;
      }
    }

    pages.push(lines.map((line) => line.text.trim()).filter(Boolean).join("\n"));
    page.cleanup();
  }

  return {
    text: pages.join("\n\n"),
    items: allItems,
    pages: pdf.numPages,
  };
}

function normalizeOcrText(text: string) {
  return text
    .replace(/\r/g, " ")
    .replace(/[|]/g, " ")
    .replace(/[—–]/g, "-")
    .replace(/[\u00a0]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

type InvoiceProvider = "eep" | "epm" | "celsia" | "other";

function detectInvoiceProvider(text: string, fileName = ""): InvoiceProvider {
  const source = normalizeLoose(text + " " + fileName);

  if (source.includes("energia de pereira") || source.includes("empresa de energia de pereira") || source.includes("eepvm05") || source.split(" ").includes("eep")) {
    return "eep";
  }

  if (source.includes("empresas publicas de medellin") || source.includes("empresa de servicios publicos de medellin") || source.split(" ").includes("epm")) {
    return "epm";
  }

  if (source.includes("celsia")) {
    return "celsia";
  }

  return "other";
}

function invoiceProviderLabel(provider: InvoiceProvider) {
  if (provider === "eep") return "Energía de Pereira";
  if (provider === "epm") return "EPM";
  if (provider === "celsia") return "Celsia";
  return "Otro proveedor";
}

function numberCandidates(text: string) {
  const matches = text.match(/\b\d{1,4}(?:[.,]\d{1,3})?\b/g) ?? [];
  return matches
    .map((raw) => ({
      raw,
      value: parseNumber(raw),
    }))
    .filter((item): item is { raw: string; value: number } =>
      item.value !== null
    );
}

type OcrWord = {
  lineKey: string;
  left: number;
  top: number;
  width: number;
  height: number;
  text: string;
  confidence: number;
};

function parseOcrWords(tsv: string): OcrWord[] {
  const words: OcrWord[] = [];

  for (const line of tsv.split(/\r?\n/).slice(1)) {
    const parts = line.split("\t");
    if (parts.length < 12) continue;

    const text = parts.slice(11).join("\t").trim();
    const left = Number(parts[6]);
    const top = Number(parts[7]);
    const width = Number(parts[8]);
    const height = Number(parts[9]);
    const confidence = Number(parts[10]);

    if (!text || !Number.isFinite(left) || !Number.isFinite(top)) continue;

    words.push({
      lineKey: parts.slice(1, 5).join("-"),
      left,
      top,
      width,
      height,
      text,
      confidence: Number.isFinite(confidence) ? confidence : 0,
    });
  }

  return words;
}

function ocrNormalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function ocrNumber(value: string) {
  const raw = value.replace(/[^0-9.,]/g, "");
  if (!raw) return null;
  return parseNumber(raw);
}

function ocrRows(words: OcrWord[], tolerance = 12) {
  const rows: OcrWord[][] = [];

  for (const word of [...words].sort((a, b) => a.top - b.top || a.left - b.left)) {
    let row = rows.find((candidate) =>
      Math.abs(candidate[0].top - word.top) <= tolerance
    );

    if (!row) {
      row = [];
      rows.push(row);
    }

    row.push(word);
  }

  for (const row of rows) {
    row.sort((a, b) => a.left - b.left);
  }

  return rows;
}

/**
 * Busca el consumo exclusivamente dentro de la sección visual
 * "LIQUIDACIÓN DEL CONSUMO ACTUAL".
 *
 * Esto es deliberadamente diferente al parser de texto plano:
 * en una foto de factura existen muchas cifras (históricos, lecturas,
 * valores monetarios). El consumo se debe localizar por región.
 */
function extractLiquidationKwhFromTsv(tsv: string) {
  const words = parseOcrWords(tsv);
  if (!words.length) return null;

  const normalizedWords = words.map((word) => ({
    ...word,
    normalized: ocrNormalize(word.text),
  }));

  const liquidationWords = normalizedWords.filter((word) =>
    /liquidaci[oó]n/.test(word.normalized) ||
    word.normalized === "liquidacion"
  );

  const consumptionWords = normalizedWords.filter((word) =>
    word.normalized === "consumo"
  );

  let heading: OcrWord | null = null;

  for (const liquidacion of liquidationWords) {
    const nearbyConsumption = consumptionWords.find(
      (consumo) =>
        Math.abs(consumo.top - liquidacion.top) <= 70 &&
        Math.abs(consumo.left - liquidacion.left) <= 900
    );

    if (nearbyConsumption) {
      heading = liquidacion;
      break;
    }
  }

  if (!heading) {
    heading =
      liquidationWords.sort((a, b) => a.top - b.top)[0] ?? null;
  }

  if (!heading) return null;

  const sectionTop = Math.min(...liquidationWords.map((word) => word.top));
  const nextSectionCandidates = normalizedWords.filter(
    (word) =>
      word.top > heading!.top + 25 &&
      word.top < heading!.top + 650 &&
      (
        word.normalized.includes("informacion") ||
        word.normalized.includes("acuerdos") ||
        word.normalized.includes("ultimo") ||
        word.normalized === "aseo"
      )
  );

  const sectionBottom = nextSectionCandidates.length
    ? Math.min(...nextSectionCandidates.map((word) => word.top)) - 5
    : heading.top + 330;

  const candidates = normalizedWords
    .filter(
      (word) =>
        word.top > sectionTop + 20 &&
        word.top < sectionBottom &&
        word.confidence >= 18
    )
    .map((word) => ({
      ...word,
      value: ocrNumber(word.text),
    }))
    .filter(
      (word): word is typeof word & { value: number } =>
        word.value !== null &&
        Number.isInteger(word.value) &&
        word.value >= 20 &&
        word.value < 2000
    );

  // Agrupar por filas: en EEP esperamos 173 y 180 en filas distintas.
  const rows = ocrRows(candidates, 14);
  const rowValues: number[] = [];

  for (const row of rows) {
    const values = [...new Set(
      row
        .map((word) => word.value)
        .filter((value): value is number => value !== undefined)
    )];

    if (!values.length) continue;

    // En la tabla de liquidación puede aparecer más de un número entero.
    // Tomamos el primer candidato de consumo de la fila, no dinero ni tarifa.
    rowValues.push(values[0]);
  }

  const plausible = [...new Set(rowValues.filter((value) => value >= 20 && value < 2000))];

  // Preferimos dos franjas. Para la factura EEP de referencia:
  // 173 + 180 = 353.
  if (plausible.length >= 2) {
    const pair = plausible.slice(0, 2);
    return String(Number(pair.reduce((sum, value) => sum + value, 0).toFixed(2)));
  }

  if (plausible.length === 1) {
    return String(plausible[0]);
  }

  return null;
}

/**
 * Extrae lecturas únicamente de una fila que contenga "GNS" u otra
 * marca de medidor. Nunca convierte una resta arbitraria encontrada
 * en cualquier lugar de la factura en consumo.
 */
function extractOcrMeterReadings(tsv: string) {
  const words = parseOcrWords(tsv);
  const rows = ocrRows(words, 14);

  for (const row of rows) {
    const gnsIndex = row.findIndex((word) =>
      /^(gns|gms|gws)$/i.test(ocrNormalize(word.text))
    );

    if (gnsIndex < 0) continue;

    const numbers = row
      .slice(gnsIndex + 1)
      .map((word) => ({
        value: ocrNumber(word.text),
        confidence: word.confidence,
      }))
      .filter(
        (item): item is { value: number; confidence: number } =>
          item.value !== null &&
          Number.isInteger(item.value) &&
          item.value >= 1000 &&
          item.value <= 999999 &&
          item.confidence >= 15
      );

    if (numbers.length < 2) continue;

    const current = numbers[0].value;
    const previous = numbers[1].value;
    const difference = current - previous;

    if (difference <= 0 || difference >= 2000) continue;

    return {
      previous: String(previous),
      current: String(current),
      kwh: String(difference),
    };
  }

  return null;
}

function extractKwhFromTsv(tsv: string) {
  return extractLiquidationKwhFromTsv(tsv);
}

function extractInvoiceData(text: string, tsv = ""): Partial<FormState> {
  const clean = normalizeOcrText(text);
  const result: Partial<FormState> = {};

  const municipality =
    clean.match(
      /municipio\s*[:\-]?\s*(?:\d{1,4}\s+)?([A-Za-zÁÉÍÓÚáéíóúÑñ]{3,30})(?=\s*[-:]?\s*servicio|\s+ciclo|$)/i
    ) ||
    clean.match(
      /municipio\s*[:\-]?\s*(?:\d{1,4}\s+)?([A-Za-zÁÉÍÓÚáéíóúÑñ]{3,30})/i
    );

  if (municipality) result.municipality = municipality[1].trim();

  const estrato =
    clean.match(/(?:estrato|est|clase)\s*(?:socioeconom[oó]mico)?\s*[:.]?\s*0?([1-6])\b/i);

  if (estrato) result.estrato = estrato[1];

  const days =
    clean.match(/d[ií]as\s+facturados\s*[:.\-]?\s*(\d{1,3})\b/i) ||
    clean.match(/d[ií]as\s+facturados[\s\S]{0,50}?(\d{1,3})\b/i);

  if (days) result.days = days[1];

  const monthMap: Record<string, string> = {
    ene: "01", enero: "01",
    feb: "02", febrero: "02",
    mar: "03", marzo: "03",
    abr: "04", abril: "04",
    may: "05", mayo: "05",
    jun: "06", junio: "06",
    jul: "07", julio: "07",
    ago: "08", agosto: "08",
    sep: "09", septiembre: "09",
    oct: "10", octubre: "10",
    nov: "11", noviembre: "11",
    dic: "12", diciembre: "12",
  };

  const periodWithMonth = clean.match(
    /(?:periodo|per[ií]odo)(?:\s+facturado)?[\s:]*(\d{1,2})\s*[/\-]\s*([A-Za-z]{3,10})\s*[/\-]\s*(\d{4})/i
  );

  const periodNumeric = clean.match(
    /(?:periodo|per[ií]odo)(?:\s+facturado)?[\s:]*(\d{1,2})\s*[/\-]\s*(\d{4})/i
  );

  if (periodWithMonth) {
    const month = monthMap[periodWithMonth[2].toLowerCase()];
    if (month) result.period = periodWithMonth[3] + "-" + month;
  } else if (periodNumeric) {
    const first = Number(periodNumeric[1]);
    const second = Number(periodNumeric[2]);
    const year = first > 12 ? first : second;
    const month = first > 12 ? second : first;

    if (year >= 2020 && month >= 1 && month <= 12) {
      result.period = year + "-" + String(month).padStart(2, "0");
    }
  }

  const liquidationKwh = tsv ? extractLiquidationKwhFromTsv(tsv) : null;
  const meter = tsv ? extractOcrMeterReadings(tsv) : null;

  // Para fotografías, la tabla de liquidación es la fuente primaria.
  // Las lecturas solo confirman el resultado cuando la resta coincide.
  if (liquidationKwh !== null && meter) {
    if (Number(liquidationKwh) === Number(meter.kwh)) {
      result.kwh = liquidationKwh;
      result.previous = meter.previous;
      result.current = meter.current;
    } else {
      result.kwh = liquidationKwh;
    }
  } else if (liquidationKwh !== null) {
    result.kwh = liquidationKwh;
  } else if (meter) {
    result.kwh = meter.kwh;
    result.previous = meter.previous;
    result.current = meter.current;
  }

  if (!result.kwh) {
    const reading = extractReadingFromText(clean);
    if (reading) Object.assign(result, reading);
  }

  if (!result.kwh) {
    const explicitKwh = clean.match(
      /(?:consumo\s+kwh|consumo\s+actual|consumo)[^\d]{0,35}(\d{1,4}(?:[.,]\d{1,2})?)\s*kwh\b/i
    );

    if (explicitKwh) {
      const value = parseNumber(explicitKwh[1]);
      if (value !== null && value >= 20 && value < 2000) {
        result.kwh = String(value);
      }
    }
  }

  return result;
}

function extractInvoiceData(text: string): Partial<FormState> {
  const clean = normalizeOcrText(text);
  const result: Partial<FormState> = {};

  const municipality =
    clean.match(
      /municipio\\s*[:\\-]?\\s*(?:\\d{1,4}\\s+)?([A-Za-zÁÉÍÓÚáéíóúÑñ]{3,30})(?=\\s*[-:]?\\s*servicio|\\s+ciclo|$)/i
    ) ||
    clean.match(
      /municipio\\s*[:\\-]?\\s*(?:\\d{1,4}\\s+)?([A-Za-zÁÉÍÓÚáéíóúÑñ]{3,30})/i
    );

  if (municipality) result.municipality = municipality[1].trim();

  const estrato =
    clean.match(/(?:estrato|est|clase)\\s*(?:socioeconom[oó]mico)?\\s*[:.]?\\s*0?([1-6])\\b/i);

  if (estrato) result.estrato = estrato[1];

  const days =
    clean.match(/d[ií]as\\s+facturados\\s*[:.\\-]?\\s*(\\d{1,3})\\b/i) ||
    clean.match(/d[ií]as\\s+facturados[\\s\\S]{0,50}?(\\d{1,3})\\b/i);

  if (days) result.days = days[1];

  const monthMap: Record<string, string> = {
    ene: "01", enero: "01",
    feb: "02", febrero: "02",
    mar: "03", marzo: "03",
    abr: "04", abril: "04",
    may: "05", mayo: "05",
    jun: "06", junio: "06",
    jul: "07", julio: "07",
    ago: "08", agosto: "08",
    sep: "09", septiembre: "09",
    oct: "10", octubre: "10",
    nov: "11", noviembre: "11",
    dic: "12", diciembre: "12",
  };

  const periodWithMonth = clean.match(
    /(?:periodo|per[ií]odo)(?:\\s+facturado)?[\\s:]*(\\d{1,2})\\s*[/\\-]\\s*([A-Za-z]{3,10})\\s*[/\\-]\\s*(\\d{4})/i
  );

  const periodNumeric = clean.match(
    /(?:periodo|per[ií]odo)(?:\\s+facturado)?[\\s:]*(\\d{1,2})\\s*[/\\-]\\s*(\\d{4})/i
  );

  if (periodWithMonth) {
    const month = monthMap[periodWithMonth[2].toLowerCase()];
    if (month) result.period = periodWithMonth[3] + "-" + month;
  } else if (periodNumeric) {
    const first = Number(periodNumeric[1]);
    const second = Number(periodNumeric[2]);
    const year = first > 12 ? first : second;
    const month = first > 12 ? second : first;

    if (year >= 2020 && month >= 1 && month <= 12) {
      result.period = year + "-" + String(month).padStart(2, "0");
    }
  }

  // La lectura del medidor es la fuente prioritaria para el consumo.
  const reading = extractReadingFromText(clean);
  if (reading) {
    Object.assign(result, reading);
  }

  // Para OCR nunca confiamos en el primer número después de "Consumo kWh":
  // puede ser 10, 173 u otro valor parcial de la tabla tarifaria.
  // Si no tenemos lecturas, dejamos que la extracción espacial del TSV
  // proporcione candidatos válidos.
  if (!result.kwh) {
    const explicitKwh = clean.match(
      /(?:consumo\\s+kwh|consumo\\s+actual|consumo)[^\\d]{0,35}(\\d{1,4}(?:[.,]\\d{1,2})?)\\s*kwh\\b/i
    );

    if (explicitKwh) {
      const value = parseNumber(explicitKwh[1]);
      if (value !== null && value >= 20 && value < 2000) {
        result.kwh = String(value);
      }
    }
  }

  return result;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [form, setForm] = useState(emptyForm);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoicePreview, setInvoicePreview] = useState("");
  const [invoiceIsPdf, setInvoiceIsPdf] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrFields, setOcrFields] = useState<Partial<FormState>>({});
  const [ocrProvider, setOcrProvider] = useState<InvoiceProvider>("other");

  const set = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError("");
  };

  const calculatedKwh = useMemo(() => {
    if (form.previous === "" || form.current === "") return null;
    const a = Number(form.previous);
    const b = Number(form.current);
    return Number.isFinite(a) && Number.isFinite(b) && b >= a
      ? Number((b - a).toFixed(2))
      : null;
  }, [form.previous, form.current]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const kwh = calculatedKwh ?? Number(form.kwh);
    if (!form.municipality.trim()) return setError("Ingresa el municipio.");
    if (!form.estrato) return setError("Selecciona el estrato.");
    if (!form.period) return setError("Selecciona el periodo.");
    if (Number(form.people) < 1) return setError("El número de personas debe ser mayor o igual a 1.");
    if (!Number.isFinite(kwh) || kwh <= 0) return setError("Ingresa un consumo válido en kWh.");
    if (form.previous !== "" && form.current !== "" && Number(form.current) < Number(form.previous)) {
      return setError("La lectura actual no puede ser menor que la anterior.");
    }
    setSaved(true);
  };

  const openManual = () => {
    setScreen("manual");
    setSaved(false);
    setError("");
  };

  const openInvoice = () => {
    setScreen("invoice");
    setError("");
    setOcrStatus("");
  };

  const handleInvoiceFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage = file.type.startsWith("image/");

    if (!isPdf && !isImage) {
      setError("Selecciona una factura en imagen o PDF.");
      return;
    }

    setInvoiceFile(file);
    setInvoiceIsPdf(isPdf);
    setInvoicePreview(isPdf ? "" : URL.createObjectURL(file));
    setOcrText("");
    setOcrFields({});
    setOcrProvider("other");
    setOcrStatus(
      isPdf
        ? "Factura PDF seleccionada. Extrayendo datos directamente del documento…"
        : "Factura seleccionada. Iniciando lectura automática…"
    );
    setError("");

    if (isPdf) {
      void runPdfExtraction(file);
    } else {
      void runOcr(file);
    }
  };

  const runPdfExtraction = async (file: File) => {
    setOcrRunning(true);
    setError("");
    setOcrText("");
    setOcrFields({});
    setOcrStatus("Extrayendo texto y estructura del PDF…");

    try {
      const extractedPdf = await extractInvoicePdf(file);
      const extracted = extractStructuredPdfData(extractedPdf.text, extractedPdf.items);

      setOcrProvider(detectInvoiceProvider(extractedPdf.text, file.name));
      setOcrText(extractedPdf.text);
      setOcrFields(extracted);
      setForm((current) => ({ ...current, ...extracted }));

      if (!extracted.kwh) {
        setOcrStatus("PDF leído, pero no se identificó automáticamente el consumo. Revisa los datos.");
      } else {
        setOcrStatus(`Factura PDF leída correctamente · ${extractedPdf.pages} página`);
      }
    } catch {
      setError("No fue posible leer el PDF. Si es una factura escaneada, puedes usar una fotografía.");
      setOcrStatus("");
    } finally {
      setOcrRunning(false);
    }
  };

  const runOcr = async (sourceFile?: File) => {
    const fileToProcess = sourceFile ?? invoiceFile;

    if (!fileToProcess) {
      setError("Primero toma una foto o selecciona una imagen.");
      return;
    }

    setOcrRunning(true);
    setError("");
    setOcrText("");
    setOcrStatus("Preparando imagen para lectura…");

    let worker: Awaited<ReturnType<typeof import("tesseract.js").createWorker>> | null = null;

    try {
      const { createWorker, PSM } = await import("tesseract.js");

      worker = await createWorker("spa", 1, {
        logger: (message) => {
          if (message.status === "recognizing text" && typeof message.progress === "number") {
            setOcrStatus(`Analizando factura… ${Math.round(message.progress * 100)}%`);
          } else if (message.status) {
            setOcrStatus("Preparando reconocimiento…");
          }
        },
      });

      // PSM.AUTO es más apropiado para facturas completas con varias zonas.
      // Tesseract.js documenta que el aumento de resolución puede mejorar
      // notablemente el reconocimiento y permite ajustar el modo de segmentación.
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });

      const variants = [
        { name: "foto original · página completa", mode: "original" as const, psm: PSM.AUTO },
        { name: "foto original · bloque", mode: "original" as const, psm: PSM.SINGLE_BLOCK },
        { name: "imagen mejorada · página completa", mode: "gray" as const, psm: PSM.AUTO },
        { name: "imagen mejorada · bloque", mode: "gray" as const, psm: PSM.SINGLE_BLOCK },
        { name: "imagen mejorada · texto disperso", mode: "gray" as const, psm: PSM.SPARSE_TEXT },
        { name: "alto contraste · texto disperso", mode: "binary" as const, psm: PSM.SPARSE_TEXT },
      ];

      const results: Array<{
        text: string;
        confidence: number;
        score: number;
        name: string;
        extracted: Partial<FormState>;
      }> = [];

      for (let index = 0; index < variants.length; index += 1) {
        const variant = variants[index];
        setOcrStatus(`Leyendo factura (${index + 1} de ${variants.length})…`);

        await worker.setParameters({
          tessedit_pageseg_mode: variant.psm,
          preserve_interword_spaces: "1",
          user_defined_dpi: "300",
        });

        const processed = await preprocessInvoiceImage(fileToProcess, variant.mode);
        const result = await worker.recognize(
          processed,
          {},
          { tsv: true }
        );
        const text = result.data.text?.trim() ?? "";
        const confidence = typeof result.data.confidence === "number" ? result.data.confidence : 0;

        if (text) {
          const extracted = extractInvoiceData(text, typeof result.data.tsv === "string" ? result.data.tsv : "");
          const spatialKwh = typeof result.data.tsv === "string"
            ? extractLiquidationKwhFromTsv(result.data.tsv)
            : null;

          // Nunca sustituimos un consumo validado por lecturas con un número
          // obtenido únicamente por posición. La posición se usa como
          // respaldo, no como fuente principal.
          if (!extracted.kwh && spatialKwh) {
            extracted.kwh = spatialKwh;
          }

          const hasValidatedReading =
            Boolean(extracted.previous && extracted.current && extracted.kwh) &&
            Number(extracted.current) - Number(extracted.previous) === Number(extracted.kwh);

          const fieldCount = Object.keys(extracted).length;
          const score =
            scoreOcrText(text, confidence) +
            fieldCount * 25 +
            (hasValidatedReading ? 220 : 0) +
            (spatialKwh && Number(spatialKwh) >= 20 ? 60 : 0);

          results.push({
            text,
            confidence,
            score,
            name: variant.name,
            extracted,
          });
        }
      }

      if (!results.length) {
        setOcrStatus("No se encontró texto legible. Intenta con una foto completa, nítida y bien iluminada.");
        return;
      }

      results.sort((a, b) => b.score - a.score);
      const best = results[0];

      setOcrProvider(detectInvoiceProvider(best.text, fileToProcess.name));
      setOcrText(best.text);
      setOcrFields(best.extracted);
      setForm((current) => ({ ...current, ...best.extracted }));

      if (best.confidence < 55) {
        setOcrStatus("Lectura realizada con baja confianza. Revisa los datos antes de continuar.");
      } else {
        setOcrStatus("Lectura terminada. Revisa y corrige los datos antes de guardar.");
      }
    } catch {
      setError("No fue posible procesar la factura. Puedes corregir los datos manualmente.");
      setOcrStatus("");
    } finally {
      if (worker) {
        await worker.terminate().catch(() => undefined);
      }
      setOcrRunning(false);
    }
  };

  const continueWithExtractedData = () => {
    setScreen("manual");
    setSaved(false);
    setError("");
  };

  if (screen === "invoice") {
    return (
      <main className="app-shell">
        <header className="mobile-header">
          <button className="icon-button" onClick={() => setScreen("home")} aria-label="Volver">←</button>
          <div><span className="eyebrow">ELECTRICOS</span><h1>Escanear factura</h1></div>
          <div className="header-mark">📷</div>
        </header>

        <section className="page-content">
          <div className="intro-card">
            <span className="section-kicker">LECTURA DE FACTURA</span>
            <h2>Fotografía tu factura.</h2>
            <p>La app leerá el texto de la imagen y propondrá los datos encontrados. Tú siempre los puedes corregir.</p>
          </div>

          <section className="scanner-card">
            <div className="invoice-source-grid">
              <label className="invoice-source-button invoice-camera-button">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleInvoiceFile}
                />
                <span className="invoice-source-icon">📷</span>
                <strong>Tomar foto</strong>
                <small>Usar la cámara para fotografiar la factura.</small>
              </label>

              <label className="invoice-source-button invoice-pdf-button">
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleInvoiceFile}
                />
                <span className="invoice-source-icon">📄</span>
                <strong>Seleccionar PDF</strong>
                <small>Cargar una factura PDF digital.</small>
              </label>
            </div>

            {invoicePreview && !invoiceIsPdf && (
              <div className="invoice-preview">
                <img src={invoicePreview} alt="Vista previa de la factura seleccionada" />
              </div>
            )}

            {invoiceFile && invoiceIsPdf && (
              <div className="pdf-selected-card">
                <span className="pdf-icon">PDF</span>
                <div>
                  <strong>{invoiceFile.name}</strong>
                  <small>Factura digital · lectura directa del documento</small>
                </div>
              </div>
            )}

            {ocrRunning && (
              <div className="ocr-status ocr-status-running">
                <span className="ocr-spinner" aria-hidden="true" />
                <span>{ocrStatus || "Analizando factura…"}</span>
              </div>
            )}

            {!ocrRunning && ocrStatus && (
              <div className="ocr-status">
                <strong>{ocrStatus}</strong>
                <span>
                  Empresa detectada: <b>{invoiceProviderLabel(ocrProvider)}</b>
                </span>
                {ocrFields.kwh && (
                  <span>
                    Consumo detectado: <b>{ocrFields.kwh} kWh</b>
                  </span>
                )}
              </div>
            )}

            {ocrText && (
              <section className="detected-card" aria-label="Datos detectados">
                <div className="detected-header">
                  <div>
                    <span className="section-kicker">LECTURA INTELIGENTE</span>
                    <h3>Datos encontrados</h3>
                  </div>
                  <span className="detected-badge">Revisar</span>
                </div>

                <div className="detected-grid">
                  <div className={"detected-field primary " + (ocrFields.kwh ? "detected-ok" : "detected-missing")}>
                    <span>Consumo</span>
                    <strong>{ocrFields.kwh ? `${ocrFields.kwh} kWh` : "No detectado"}</strong>
                  </div>
                  <div className={"detected-field " + (ocrFields.municipality ? "detected-ok" : "detected-missing")}>
                    <span>Municipio</span>
                    <strong>{ocrFields.municipality || "No detectado"}</strong>
                  </div>
                  <div className={"detected-field " + (ocrFields.estrato ? "detected-ok" : "detected-missing")}>
                    <span>Estrato</span>
                    <strong>{ocrFields.estrato || "No detectado"}</strong>
                  </div>
                  <div className={"detected-field " + (ocrFields.period ? "detected-ok" : "detected-missing")}>
                    <span>Periodo</span>
                    <strong>{ocrFields.period || "No detectado"}</strong>
                  </div>
                  <div className={"detected-field " + (ocrFields.days ? "detected-ok" : "detected-missing")}>
                    <span>Días facturados</span>
                    <strong>{ocrFields.days || "No detectado"}</strong>
                  </div>
                  <div className={"detected-field " + (ocrFields.previous && ocrFields.current ? "detected-ok" : "detected-missing")}>
                    <span>Lecturas</span>
                    <strong>
                      {ocrFields.previous && ocrFields.current
                        ? `${ocrFields.previous} → ${ocrFields.current}`
                        : "No detectadas"}
                    </strong>
                  </div>
                </div>

                <div className="detected-note">
                  <span>✓</span>
                  <p>Los datos detectados se cargarán en el formulario para que puedas verificarlos y corregirlos.</p>
                </div>

                <button className="secondary-button full-button" onClick={continueWithExtractedData}>
                  Revisar y completar datos
                </button>
              </section>
            )}

            {ocrText && (
              <details className="ocr-details">
                <summary>Ver texto técnico reconocido</summary>
                <pre>{ocrText}</pre>
              </details>
            )}
          </section>

          {error && <div className="error-message">{error}</div>}

          <div className="info-note">
            <strong>Importante</strong>
            <span>El reconocimiento automático es una ayuda. Antes de guardar, verifica especialmente el valor de consumo en kWh.</span>
          </div>
        </section>

        <Nav screen={screen} onHome={() => setScreen("home")} onConsumption={openManual} />
      </main>
    );
  }

  if (screen === "manual") {
    return (
      <main className="app-shell">
        <header className="mobile-header">
          <button className="icon-button" onClick={() => setScreen("home")} aria-label="Volver">←</button>
          <div><span className="eyebrow">ELECTRICOS</span><h1>Mi consumo</h1></div>
          <div className="header-mark">⚡</div>
        </header>

        <section className="page-content">
          <div className="intro-card">
            <span className="section-kicker">REGISTRO DE CONSUMO</span>
            <h2>Verifica los datos de tu hogar.</h2>
            <p>Los datos pueden venir de una factura o ser ingresados manualmente.</p>
          </div>

          {saved ? (
            <section className="success-card">
              <div className="success-icon">✓</div>
              <div><span className="section-kicker">REGISTRO VALIDADO</span><h2>{calculatedKwh ?? Number(form.kwh)} kWh</h2><p>{form.period} · {form.municipality}</p></div>
            </section>
          ) : (
            <form className="form-card" onSubmit={submit}>
              <div className="form-section">
                <h3>Tu hogar</h3>
                <label>Municipio<input value={form.municipality} onChange={(e) => set("municipality", e.target.value)} placeholder="Ej. Cartago" /></label>
                <div className="field-grid">
                  <label>Estrato<select value={form.estrato} onChange={(e) => set("estrato", e.target.value)}><option value="">Seleccionar</option>{[1,2,3,4,5,6].map(n => <option key={n}>{n}</option>)}</select></label>
                  <label>Personas<input type="number" min="1" value={form.people} onChange={(e) => set("people", e.target.value)} inputMode="numeric" /></label>
                </div>
              </div>

              <div className="form-section">
                <h3>Consumo eléctrico</h3>
                <label>Periodo<input type="month" value={form.period} onChange={(e) => set("period", e.target.value)} /></label>
                <label>Consumo (kWh)<input type="number" min="0" step="0.01" value={form.kwh} onChange={(e) => set("kwh", e.target.value)} placeholder="Ej. 186" inputMode="decimal" disabled={calculatedKwh !== null} /><span className="field-help">Si ingresas las lecturas, ElectriCOs calculará los kWh automáticamente.</span></label>
                <div className="field-grid">
                  <label>Lectura anterior<input type="number" min="0" step="0.01" value={form.previous} onChange={(e) => set("previous", e.target.value)} placeholder="Opcional" inputMode="decimal" /></label>
                  <label>Lectura actual<input type="number" min="0" step="0.01" value={form.current} onChange={(e) => set("current", e.target.value)} placeholder="Opcional" inputMode="decimal" /></label>
                </div>
                {calculatedKwh !== null && <div className="calculated-note"><strong>{calculatedKwh} kWh</strong><span>Consumo calculado a partir de las lecturas.</span></div>}
                <label>Días facturados<input type="number" min="1" max="120" value={form.days} onChange={(e) => set("days", e.target.value)} placeholder="Opcional" inputMode="numeric" /></label>
              </div>

              {error && <div className="error-message">{error}</div>}
              <button className="primary-button" type="submit">Validar consumo</button>
            </form>
          )}

          {saved && (
            <section className="result-card">
              <span className="metric-label">CONSUMO DEL PERIODO</span>
              <strong className="metric-value">{calculatedKwh ?? Number(form.kwh)} kWh</strong>
              <div className="metric-row"><span>Personas</span><strong>{form.people}</strong></div>
              <div className="metric-row"><span>Estrato</span><strong>{form.estrato}</strong></div>
              <div className="metric-row"><span>Municipio</span><strong>{form.municipality}</strong></div>
              <div className="button-row"><button className="secondary-button" type="button" onClick={() => {setForm(emptyForm);setSaved(false);}}>Registrar otro mes</button><button className="primary-button" type="button" onClick={() => setScreen("home")}>Volver al inicio</button></div>
            </section>
          )}
        </section>

        <Nav screen={screen} onHome={() => setScreen("home")} onConsumption={openManual} />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="mobile-header home-header"><div><span className="eyebrow">EDUCACIÓN ENERGÉTICA</span><h1>ElectriCOs</h1></div><div className="header-mark">⚡</div></header>
      <section className="page-content home-content">
        <div className="hero-card"><span className="section-kicker">TU HOGAR</span><h2>Mide, comprende y transforma tu consumo.</h2><p>Registra una factura o ingresa tus datos manualmente para comenzar.</p></div>
        <section className="action-section"><div className="section-heading"><span className="section-kicker">PRIMER PASO</span><h2>¿Cómo registrarás tu consumo?</h2></div>
          <button className="action-card" onClick={openInvoice}><span className="action-icon">📷</span><span><strong>Escanear factura</strong><small>Tomar una foto o cargar una factura.</small></span><b>›</b></button>
          <button className="action-card" onClick={openManual}><span className="action-icon">✍️</span><span><strong>Ingresar manualmente</strong><small>Escribir el consumo directamente.</small></span><b>›</b></button>
        </section>
        <section className="preview-card"><div><span className="metric-label">LÍNEA BASE</span><strong>Se construirá con tus registros.</strong></div><span className="preview-icon">▥</span></section>
      </section>
      <Nav screen={screen} onHome={() => setScreen("home")} onConsumption={openManual} />
    </main>
  );
}

function Nav({ screen, onHome, onConsumption }: { screen: Screen; onHome: () => void; onConsumption: () => void }) {
  return <nav className="bottom-nav" aria-label="Navegación principal">
    <button className={"nav-item " + (screen === "home" ? "active" : "")} onClick={onHome}><span>⌂</span>Inicio</button>
    <button className={"nav-item " + (screen === "manual" ? "active" : "")} onClick={onConsumption}><span>▣</span>Consumo</button>
    <button className="nav-item" disabled><span>◎</span>Meta</button>
    <button className="nav-item" disabled><span>↗</span>Progreso</button>
  </nav>;
}
