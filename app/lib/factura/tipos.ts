// Modelo único de datos de una factura de energía.
// Todas las fuentes (IA, texto del PDF, OCR local, ingreso manual)
// producen este mismo objeto, y el motor de cálculo solo lee este modelo.

export type FuenteLectura = "ia" | "pdf-texto" | "ocr-local" | "manual";

export type EmpresaId =
  | "energia-pereira"
  | "chec"
  | "celsia"
  | "epm"
  | "otra";

export type PuntoHistorico = {
  /** Periodo en formato AAAA-MM */
  periodo: string;
  kwh: number;
};

export type DatosFactura = {
  empresa: EmpresaId;
  empresaNombre: string | null;
  municipio: string | null;
  estrato: number | null;
  /** Mes principal facturado, formato AAAA-MM */
  periodo: string | null;
  diasFacturados: number | null;
  lecturaAnterior: number | null;
  lecturaActual: number | null;
  /** Factor multiplicador del medidor (casi siempre 1 en hogares) */
  factorMultiplicador: number | null;
  consumoKwh: number | null;
  promedioKwh: number | null;
  /** Costo unitario del kWh en pesos (CU) */
  valorKwh: number | null;
  /** Valor total a pagar en pesos */
  totalPagar: number | null;
  historico: PuntoHistorico[];
};

export type AvisoLectura = {
  nivel: "ok" | "revisar" | "error";
  campo: keyof DatosFactura | "general";
  mensaje: string;
};

export type ResultadoLectura = {
  datos: DatosFactura;
  fuente: FuenteLectura;
  avisos: AvisoLectura[];
  /** 0 a 100: qué tan seguros estamos del consumo en kWh */
  confianzaConsumo: number;
  /** Texto crudo (solo para depuración, nunca se guarda) */
  textoTecnico?: string;
};

export const DATOS_VACIOS: DatosFactura = {
  empresa: "otra",
  empresaNombre: null,
  municipio: null,
  estrato: null,
  periodo: null,
  diasFacturados: null,
  lecturaAnterior: null,
  lecturaActual: null,
  factorMultiplicador: null,
  consumoKwh: null,
  promedioKwh: null,
  valorKwh: null,
  totalPagar: null,
  historico: [],
};

export const NOMBRES_EMPRESA: Record<EmpresaId, string> = {
  "energia-pereira": "Energía de Pereira",
  chec: "CHEC",
  celsia: "Celsia",
  epm: "EPM",
  otra: "Otra empresa",
};
