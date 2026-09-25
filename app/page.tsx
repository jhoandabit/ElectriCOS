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

function preprocessInvoiceImage(file: File, mode: "gray" | "binary") {
  return new Promise<Blob>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const maxWidth = 2600;
      const scale = Math.min(1.35, maxWidth / image.naturalWidth);
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

        if (mode === "gray") {
          // Aumenta contraste sin destruir los trazos finos de la factura.
          y = Math.max(0, Math.min(255, Math.round((y - mean) * 1.55 + 128)));
        } else {
          // Binarización conservadora: evita que el fondo gris de la factura
          // se convierta en ruido negro.
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

function extractStructuredPdfData(text: string): Partial<FormState> {
  const clean = normalizeInvoiceFieldText(text);
  const result: Partial<FormState> = {};

  const municipality =
    clean.match(/municipio\s*:\s*\d*\s*([A-Za-z ]{3,30}?)(?=\s+-\s+servicio|\s+servicio\s*:|\s+ciclo\s*:|$)/i) ||
    clean.match(/municipio\s*:?\s*\d*\s*(Cartago|[A-Za-z]{3,30})/i);

  if (municipality) result.municipality = municipality[1].trim();

  const estrato = clean.match(/estrato\s*:\s*([1-6])\b/i);
  if (estrato) result.estrato = estrato[1];

  const days = clean.match(/d[ií]as\s+facturados\s*:?\s*(\d{1,3})\b/i);
  if (days) result.days = days[1];

  const periodRange = clean.match(
    /periodo\s+facturado\s*:?\s*(\d{1,2})\s*\/\s*([A-Za-z]{3,10})\s*\/\s*(\d{4})\s*-\s*(\d{1,2})\s*\/\s*([A-Za-z]{3,10})\s*\/\s*(\d{4})/i
  );

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

  if (periodRange) {
    const month = monthMap[periodRange[2].toLowerCase()];
    if (month) result.period = `${periodRange[3]}-${month}`;
  } else {
    const periodMonth = clean.match(/tarifa\s+a\s+mes\s+de\s*:?\s*([A-Za-z]{3,10})[-/]?(\d{4})/i);
    if (periodMonth) {
      const month = monthMap[periodMonth[1].toLowerCase()];
      if (month) result.period = `${periodMonth[2]}-${month}`;
    }
  }

  // IMPORTANTE: la tabla de liquidación puede dividir el consumo en
  // varios rangos tarifarios. Por ejemplo, una factura puede mostrar:
  //   0-173 → 173 kWh
  //   >173  → 180 kWh
  // El consumo real del período NO es 173 kWh, sino 173 + 180 = 353 kWh.
  //
  // La factura también suele contener las lecturas del medidor. Cuando están
  // disponibles, lectura actual - lectura anterior es la fuente más fiable
  // para el consumo total del período.
  const readingCandidates = Array.from(
    clean.matchAll(/\b(\d{4,6})\s+(\d{4,6})\s+(\d{2,4})\b/g)
  )
    .map((match) => ({
      current: Number(match[1]),
      previous: Number(match[2]),
      consumption: Number(match[3]),
    }))
    .filter(
      (item) =>
        item.current > item.previous &&
        item.current - item.previous === item.consumption &&
        item.consumption > 0 &&
        item.consumption < 2000
    );

  if (readingCandidates.length) {
    const reading = readingCandidates[0];
    result.previous = String(reading.previous);
    result.current = String(reading.current);
    result.kwh = String(reading.consumption);
  }

  // Fallback: si las lecturas no pudieron recuperarse, intentamos sumar
  // los consumos de las filas de "LIQUIDACIÓN DEL CONSUMO ACTUAL".
  // Rechazamos valores pequeños como "10", porque en esta estructura pueden
  // aparecer por una separación incorrecta de los elementos del PDF.
  if (!result.kwh) {
    const liquidationIndex = clean.search(/liquidaci[oó]n\\s+del\\s+consumo\\s+actual/i);
    const liquidation = liquidationIndex >= 0
      ? clean.slice(liquidationIndex, liquidationIndex + 1800)
      : clean;

    const consumptionSection = liquidation.match(
      /rango\\s+consumo\\s+kwh[\\s\\S]{0,1200}/i
    )?.[0] ?? liquidation;

    const candidates = Array.from(
      consumptionSection.matchAll(/(?:^|\s)(\d{2,4}(?:[.,]\d{1,2})?)(?=\s+(?:9\d{2}\.\d{4}|\d{5,6}))/g)
    )
      .map((match) => parseNumber(match[1]))
      .filter((value): value is number =>
        value !== null && value >= 20 && value < 2000
      );

    if (candidates.length) {
      // Evitamos duplicados producidos por la reconstrucción del texto.
      result.kwh = String(
        Number(candidates.reduce((sum, value) => sum + value, 0).toFixed(2))
      );
    }
  }

  return result;
}

async function extractInvoicePdf(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // PDF.js 6.x ya no expone "disableWorker" en DocumentInitParameters.
  // Configuramos explícitamente el worker para que la lectura del PDF
  // funcione también en producción con Next.js/Vercel.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url
  ).toString();

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
  }).promise;

  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const items = (content.items as Array<{
      str?: string;
      transform?: number[];
    }>)
      .filter((item) => item.str)
      .map((item) => ({
        text: item.str ?? "",
        x: item.transform?.[4] ?? 0,
        y: item.transform?.[5] ?? 0,
      }))
      .sort((a, b) => {
        const yDiff = Math.abs(b.y - a.y);
        return yDiff > 3 ? b.y - a.y : a.x - b.x;
      });

    const lines: Array<{ y: number; text: string }> = [];

    for (const item of items) {
      const previous = lines[lines.length - 1];

      if (!previous || Math.abs(previous.y - item.y) > 3) {
        lines.push({ y: item.y, text: item.text });
      } else {
        previous.text += ` ${item.text}`;
      }
    }

    pages.push(lines.map((line) => line.text.trim()).filter(Boolean).join("\n"));
    page.cleanup();
  }

  return {
    text: pages.join("\n\n"),
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

function extractKwhFromTsv(tsv: string) {
  if (!tsv) return null;

  type OcrWord = {
    lineKey: string;
    left: number;
    top: number;
    width: number;
    height: number;
    text: string;
    confidence: number;
  };

  const words: OcrWord[] = [];
  const lines = tsv.split(/\r?\n/);

  for (const line of lines.slice(1)) {
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
      lineKey: `${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}`,
      left,
      top,
      width,
      height,
      text,
      confidence: Number.isFinite(confidence) ? confidence : 0,
    });
  }

  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const grouped = new Map<string, OcrWord[]>();
  for (const word of words) {
    const list = grouped.get(word.lineKey) ?? [];
    list.push(word);
    grouped.set(word.lineKey, list);
  }

  // Buscamos específicamente el encabezado "Consumo kWh".
  // Después buscamos el primer número debajo de esa columna.
  // Esto evita confundir 156,574 (total energía) o $349,864 (total factura)
  // con el consumo de 173 kWh.
  for (const lineWords of grouped.values()) {
    lineWords.sort((a, b) => a.left - b.left);
    const lineText = normalize(lineWords.map((word) => word.text).join(" "));

    if (!lineText.includes("consumo") || !lineText.includes("kwh")) continue;

    const consumoWords = lineWords.filter((word) => normalize(word.text).includes("consumo"));
    const kwhWords = lineWords.filter((word) => normalize(word.text) === "kwh");

    const anchorWords = [...consumoWords, ...kwhWords];
    if (!anchorWords.length) continue;

    const left = Math.min(...anchorWords.map((word) => word.left));
    const right = Math.max(...anchorWords.map((word) => word.left + word.width));
    const centerX = (left + right) / 2;
    const headerBottom = Math.max(...anchorWords.map((word) => word.top + word.height));

    const candidates = words
      .filter((word) => word.top > headerBottom + 2 && word.top < headerBottom + 150)
      .filter((word) => {
        const center = word.left + word.width / 2;
        return Math.abs(center - centerX) <= 75;
      })
      .map((word) => ({
        ...word,
        value: parseNumber(word.text.replace(/[^0-9.,]/g, "")),
      }))
      .filter((word) =>
        word.value !== null &&
        word.value > 0 &&
        word.value < 2000 &&
        word.confidence >= 20
      )
      .sort((a, b) => a.top - b.top);

    if (candidates.length) {
      return String(candidates[0].value);
    }
  }

  return null;
}

function extractInvoiceData(text: string): Partial<FormState> {
  const clean = normalizeOcrText(text);
  const result: Partial<FormState> = {};

  // 1. Datos con etiquetas muy específicas.
  const estrato = clean.match(/(?:estrato|clase)\s*(?:socioecon[oó]mico)?[^\d]{0,15}([1-6])\b/i);
  if (estrato) result.estrato = estrato[1];

  const days = clean.match(
    /(?:d[ií]as\s+facturados|dias\s+facturados|d[ií]as)\s*[:\-]?\s*(\d{1,3})\b/i
  );
  if (days) result.days = days[1];

  const period =
    clean.match(/(?:periodo|per[ií]odo)\s*(?:facturado)?[^\d]{0,20}(\d{1,2})[\/-](\d{4})/i) ||
    clean.match(/(?:periodo|per[ií]odo)\s*(?:facturado)?[^\d]{0,20}(\d{4})[\/-](\d{1,2})/i);

  if (period) {
    const first = Number(period[1]);
    const second = Number(period[2]);
    const year = first > 12 ? first : second;
    const month = first > 12 ? second : first;
    if (year >= 2020 && month >= 1 && month <= 12) {
      result.period = `${year}-${String(month).padStart(2, "0")}`;
    }
  }

  // 2. Lecturas: solo aceptamos números enteros largos junto a la etiqueta.
  const previous = clean.match(
    /(?:lectura\s+anterior|lectura\s*ant\.?)[^\d]{0,35}(\d{3,8})\b/i
  );
  const current = clean.match(
    /(?:lectura\s+actual|lectura\s*act\.?)[^\d]{0,35}(\d{3,8})\b/i
  );
  if (previous) result.previous = previous[1];
  if (current) result.current = current[1];

  // 3. Municipio: preferimos la zona de datos técnicos y luego "municipio".
  const municipality =
    clean.match(/municipio\s*:\s*\d*\s*([A-Za-zÁÉÍÓÚáéíóúÑñ ]{3,40}?)(?=\s*-\s*servicio|\s+servicio\s*:|\s+ciclo\s*:|$)/i) ||
    clean.match(/municipio\s*:\s*\d*\s*([A-Za-zÁÉÍÓÚáéíóúÑñ]{3,30})/i);

  if (municipality) {
    result.municipality = municipality[1].trim();
  }

  // 4. Consumo: NO tomamos el primer número cercano a "energía".
  // En una factura aparecen muchos valores monetarios que también contienen
  // "energía". Priorizamos exclusivamente la fila de "Consumo kWh" dentro
  // de "LIQUIDACIÓN DEL CONSUMO ACTUAL".
  const liquidationIndex = clean.search(/liquidaci[oó]n\s+del\s+consumo\s+actual/i);
  const liquidation = liquidationIndex >= 0
    ? clean.slice(liquidationIndex, liquidationIndex + 1800)
    : clean;

  const kwhLabelIndex = liquidation.search(/consumo\s*kwh/i);

  if (kwhLabelIndex >= 0) {
    const afterLabel = liquidation.slice(kwhLabelIndex + 10, kwhLabelIndex + 500);
    const candidates = numberCandidates(afterLabel)
      .filter(({ value }) => value > 0 && value < 2000)
      .filter(({ raw }) => !/^\d{4}$/.test(raw));

    // El valor monetario suele tener 3 grupos/dígitos y aparece después
    // de "Valor kwh" o "Total energía"; evitamos esos campos.
    const monetaryIndex = afterLabel.search(/valor\s+kwh|total\s+energ[ií]a|subsidio|total\b/i);
    const beforeMoney = monetaryIndex >= 0 ? afterLabel.slice(0, monetaryIndex) : afterLabel;

    const firstConsumption = numberCandidates(beforeMoney)
      .filter(({ value }) => value > 0 && value < 2000)
      .filter(({ raw }) => !/^\d{4}$/.test(raw))[0];

    if (firstConsumption) {
      result.kwh = String(firstConsumption.value);
    } else if (candidates[0]) {
      result.kwh = String(candidates[0].value);
    }
  }

  // 5. Fallback muy restringido: solo cuando la factura dice explícitamente
  // "consumo" y luego un valor seguido por kWh.
  if (!result.kwh) {
    const explicitKwh = clean.match(
      /(?:consumo|consumo\s+actual)[^\d]{0,30}(\d{1,4}(?:[.,]\d{1,2})?)\s*kwh\b/i
    );
    if (explicitKwh) {
      const value = parseNumber(explicitKwh[1]);
      if (value !== null && value > 0 && value < 2000) {
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
      const extracted = extractStructuredPdfData(extractedPdf.text);

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
        { name: "imagen mejorada · página completa", mode: "gray" as const, psm: PSM.AUTO },
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
          const extracted = extractInvoiceData(text);
          const spatialKwh = typeof result.data.tsv === "string"
            ? extractKwhFromTsv(result.data.tsv)
            : null;

          if (spatialKwh) {
            extracted.kwh = spatialKwh;
          }

          const fieldCount = Object.keys(extracted).length;
          const score = scoreOcrText(text, confidence) + fieldCount * 25 + (spatialKwh ? 160 : 0);

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
            <label className="camera-dropzone">
              <input
                type="file"
                accept="image/*,.pdf,application/pdf"
                capture="environment"
                onChange={handleInvoiceFile}
              />
              <span className="camera-icon">📷</span>
              <strong>Tomar foto o seleccionar factura</strong>
              <small>Foto o PDF. Si el PDF contiene texto digital, ElectriCOs lo leerá directamente.</small>
            </label>

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
                {ocrFields.kwh && <span>Consumo detectado: <b>{ocrFields.kwh} kWh</b></span>}
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
