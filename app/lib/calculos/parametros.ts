// Parámetros oficiales. Son los valores por defecto: la tabla
// energy_parameters de Supabase guarda los mismos datos con su fuente,
// y la app usa la versión de la base de datos cuando está disponible.

export type Parametro = {
  clave: string;
  valor: number;
  unidad: string;
  vigencia: number; // año al que corresponde el dato
  fuente: string;
  url: string;
};

/**
 * Factor de emisión del Sistema Interconectado Nacional (SIN) para
 * inventarios de GEI / consumo de energía eléctrica, año 2024.
 * 0,220 tCO2e/MWh = 0,220 kg CO2e/kWh.
 * Es el último factor OFICIAL para inventarios (Res. UPME 000085 de 2026).
 * La UPME publica cada año con retraso: el de 2025/2026 llegará después.
 * Valores preliminares (p. ej. 0,097) no se usan hasta que sean oficiales.
 * OJO: no usar los factores "MDL" (0,660 eólica/solar; 0,607 y 0,554 otros
 * proyectos, misma resolución): son para proyectos de reducción de
 * emisiones, no para estimar la huella de un consumo.
 */
export const FACTOR_EMISION_SIN: Parametro = {
  clave: "factor_emision_sin",
  valor: 0.22,
  unidad: "kg CO2e/kWh",
  vigencia: 2024,
  fuente: "UPME · Resolución 000085 de 2026, art. 1: factor del SIN 2024 para inventarios de GEI",
  url: "https://docs.upme.gov.co/Normatividad/085_2026.pdf",
};

/** Consumo de subsistencia (referencia para subsidios, NO un máximo ni una meta). */
export const SUBSISTENCIA_BAJO_1000: Parametro = {
  clave: "subsistencia_bajo_1000",
  valor: 173,
  unidad: "kWh/mes",
  vigencia: 2004,
  fuente: "UPME · Resolución 355 de 2004, art. 1 (< 1000 m s. n. m.)",
  url: "https://gestornormativo.creg.gov.co/gestor/entorno/docs/resolucion_upme_0355_2004.htm",
};

export const SUBSISTENCIA_SOBRE_1000: Parametro = {
  clave: "subsistencia_sobre_1000",
  valor: 130,
  unidad: "kWh/mes",
  vigencia: 2004,
  fuente: "UPME · Resolución 355 de 2004, art. 1 (≥ 1000 m s. n. m.)",
  url: "https://gestornormativo.creg.gov.co/gestor/entorno/docs/resolucion_upme_0355_2004.htm",
};

export const PARAMETROS_POR_DEFECTO: Parametro[] = [FACTOR_EMISION_SIN, SUBSISTENCIA_BAJO_1000, SUBSISTENCIA_SOBRE_1000];

/**
 * Altitud aproximada (m s. n. m.) de municipios de la zona. Solo sirve para
 * proponer el valor de subsistencia; la persona puede cambiarlo.
 */
export const ALTITUD_MUNICIPIOS: Record<string, number> = {
  cartago: 917,
  "la virginia": 899,
  pereira: 1411,
  dosquebradas: 1450,
  "santa rosa de cabal": 1701,
  manizales: 2150,
  armenia: 1483,
  ansermanuevo: 1030,
  obando: 975,
  alcala: 1190,
  toro: 1000,
  zarzal: 916,
  "la union": 975,
  roldanillo: 966,
  tulua: 960,
  buga: 969,
  cali: 1018,
  palmira: 1001,
};

export function sobre1000Metros(municipio: string | null | undefined): boolean | null {
  if (!municipio) return null;
  const clave = municipio.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const altitud = ALTITUD_MUNICIPIOS[clave];
  return altitud === undefined ? null : altitud >= 1000;
}
