import type { InvoiceEvidence, InvoiceValidation } from "./types";

function near(a: number | null, b: number | null, tolerance = 0.01) {
  return a !== null && b !== null && Math.abs(a - b) <= tolerance;
}

export function validateConsumption(params: {
  previousReading: number | null;
  currentReading: number | null;
  consumptionKwh: number | null;
  historyCurrentKwh?: number | null;
  averageKwh?: number | null;
  liquidationKwh?: number[];
}): InvoiceValidation {
  const {
    previousReading,
    currentReading,
    consumptionKwh,
    historyCurrentKwh = null,
    liquidationKwh = [],
    averageKwh = null,
  } = params;

  const checks: InvoiceValidation["checks"] = [];
  let score = 0;

  const readingDifference =
    previousReading !== null &&
    currentReading !== null &&
    currentReading >= previousReading
      ? currentReading - previousReading
      : null;

  if (readingDifference !== null && consumptionKwh !== null) {
    const passed = near(readingDifference, consumptionKwh);
    checks.push({
      name: "diferencia_lecturas",
      passed,
      expected: readingDifference,
      actual: consumptionKwh,
      detail: passed
        ? "La lectura actual menos la anterior coincide con el consumo."
        : "Las lecturas no coinciden con el consumo reconocido.",
    });
    if (passed) score += 45;
  }

  if (historyCurrentKwh !== null && consumptionKwh !== null) {
    const passed = near(historyCurrentKwh, consumptionKwh);
    checks.push({
      name: "consumo_actual",
      passed,
      expected: historyCurrentKwh,
      actual: consumptionKwh,
      detail: passed
        ? "El consumo coincide con el valor marcado como actual."
        : "El consumo no coincide con el valor actual del histórico.",
    });
    if (passed) score += 30;
  }

  if (liquidationKwh.length && consumptionKwh !== null) {
    const sum = liquidationKwh.reduce((total, value) => total + value, 0);
    const passed = near(sum, consumptionKwh);
    checks.push({
      name: "liquidacion",
      passed,
      expected: sum,
      actual: consumptionKwh,
      detail: passed
        ? "La suma de los componentes de liquidación coincide con el consumo."
        : "La liquidación no coincide con el consumo reconocido.",
    });
    if (passed) score += 35;
  }

  if (averageKwh !== null && consumptionKwh !== null) {
    const plausible = consumptionKwh > 0 && averageKwh > 0;
    checks.push({
      name: "promedio",
      passed: plausible,
      expected: averageKwh,
      actual: consumptionKwh,
      detail: plausible
        ? "El promedio se considera un dato contextual, no el consumo actual."
        : "El promedio no es válido como dato contextual.",
    });
    if (plausible) score += 5;
  }

  const strongChecks = checks.filter((check) => check.passed).length;
  const consistent =
    consumptionKwh !== null &&
    consumptionKwh > 0 &&
    (score >= 75 || (strongChecks >= 2 && score >= 60));

  return {
    consistent,
    score,
    checks,
  };
}

export function buildConsumptionEvidence(params: {
  previousReading: number | null;
  currentReading: number | null;
  historyCurrentKwh?: number | null;
  liquidationKwh?: number[];
}) {
  const evidence: InvoiceEvidence[] = [];
  const { previousReading, currentReading, historyCurrentKwh, liquidationKwh = [] } = params;

  if (
    previousReading !== null &&
    currentReading !== null &&
    currentReading >= previousReading
  ) {
    evidence.push({
      source: "meter-reading-difference",
      value: currentReading - previousReading,
      score: 45,
      reason: "Lectura actual menos lectura anterior.",
    });
  }

  if (historyCurrentKwh !== null && historyCurrentKwh !== undefined) {
    evidence.push({
      source: "history-current",
      value: historyCurrentKwh,
      score: 30,
      reason: "Valor asociado al indicador Actual del histórico.",
    });
  }

  if (liquidationKwh.length) {
    evidence.push({
      source: "liquidation-sum",
      value: liquidationKwh.reduce((total, value) => total + value, 0),
      score: 35,
      reason: "Suma de los componentes de consumo de la liquidación.",
    });
  }

  return evidence;
}
