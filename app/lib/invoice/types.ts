export type InvoiceSourceType = "pdf-text" | "image-ocr" | "unknown";

export type InvoiceProviderId =
  | "eep"
  | "epm"
  | "celsia"
  | "afinia"
  | "air-e"
  | "enel"
  | "generic";

export type InvoiceFieldKey =
  | "provider"
  | "municipality"
  | "stratum"
  | "billingPeriod"
  | "billingDays"
  | "previousReading"
  | "currentReading"
  | "consumptionKwh"
  | "averageKwh"
  | "tariffValue"
  | "invoiceNumber";

export type InvoiceEvidence = {
  source: string;
  value: string | number;
  score: number;
  reason: string;
};

export type InvoiceField<T = string | number> = {
  value: T | null;
  confidence: number;
  evidence: InvoiceEvidence[];
};

export type InvoiceValidation = {
  consistent: boolean;
  score: number;
  checks: Array<{
    name: string;
    passed: boolean;
    expected?: string | number;
    actual?: string | number;
    detail: string;
  }>;
};

export type InvoiceHistoryEntry = {
  month: string;
  kwh: number;
};

export type ParsedInvoice = {
  sourceType: InvoiceSourceType;
  provider: InvoiceField<InvoiceProviderId>;
  municipality: InvoiceField<string>;
  stratum: InvoiceField<number>;
  billingPeriod: InvoiceField<string>;
  billingDays: InvoiceField<number>;
  previousReading: InvoiceField<number>;
  currentReading: InvoiceField<number>;
  consumptionKwh: InvoiceField<number>;
  averageKwh: InvoiceField<number>;
  tariffValue: InvoiceField<number>;
  invoiceNumber: InvoiceField<string>;
  history: InvoiceHistoryEntry[];
  validation: InvoiceValidation;
  rawText: string;
};

export type InvoiceTemplate = {
  id: InvoiceProviderId;
  name: string;
  aliases: string[];
  anchors: string[];
  regions?: {
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    psm: number;
  }[];
  fieldHints: Partial<Record<InvoiceFieldKey, string[]>>;
};
