export function normalizeInvoiceText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .replace(/[\\u00a0]/g, " ")
    .replace(/[—–]/g, "-")
    .replace(/[|]/g, " ")
    .replace(/[ \\t]+/g, " ")
    .replace(/\\n{3,}/g, "\\n\\n")
    .trim();
}

export function normalizeLoose(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/[ \\t]+/g, " ")
    .trim();
}

export function parseLocaleNumber(value: string): number | null {
  const raw = value.trim().replace(/\\s/g, "");
  if (!raw) return null;

  // Colombian invoices use both 1.234,56 and 1234.56 conventions.
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");

  let normalized = raw;

  if (lastComma > lastDot) {
    normalized = raw.replace(/\\./g, "").replace(",", ".");
  } else if (lastDot > lastComma && raw.match(/\\.\\d{1,2}$/)) {
    normalized = raw.replace(/,/g, "");
  } else {
    normalized = raw.replace(/,/g, "");
  }

  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function uniqueNumbers(values: number[]) {
  return [...new Set(values.map((value) => Number(value)))]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

export function extractNumberTokens(text: string) {
  const matches = Array.from(
    text.matchAll(/(?<!\\d)\\d{1,7}(?:[.,]\\d{1,4})?(?!\\d)/g)
  );

  return matches.map((match) => ({
    raw: match[0],
    value: parseLocaleNumber(match[0]),
    index: match.index ?? 0,
  }));
}

export function normalizeMonth(month: string) {
  const map: Record<string, string> = {
    ene: "01", enero: "01",
    feb: "02", febrero: "02",
    mar: "03", marzo: "03",
    abr: "04", abril: "04",
    may: "05", mayo: "05",
    jun: "06", junio: "06",
    jul: "07", julio: "07",
    ago: "08", agosto: "08",
    sep: "09", sept: "09", septiembre: "09",
    oct: "10", octubre: "10",
    nov: "11", noviembre: "11",
    dic: "12", diciembre: "12",
  };

  return map[normalizeLoose(month)];
}

export function normalizeMonthPeriod(text: string) {
  const normalized = normalizeInvoiceText(text);
  const match = normalized.match(
    /(?:periodo(?:\\s+facturado)?|periodo)\\s*[:.]?\\s*(\\d{1,2})\\s*[\\/\\-]\\s*([A-Za-z]{3,12})\\s*[\\/\\-]\\s*(\\d{4})/
  );

  if (match) {
    const month = normalizeMonth(match[2]);
    if (month) return `${match[3]}-${month}`;
  }

  const numeric = normalized.match(
    /(?:periodo(?:\\s+facturado)?)\\s*[:.]?\\s*(\\d{4})\\s*[\\/-]\\s*(\\d{1,2})/
  );

  if (numeric) return `${numeric[1]}-${numeric[2].padStart(2, "0")}`;

  return null;
}
