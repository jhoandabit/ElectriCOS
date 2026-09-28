import { calcularLineaBase, comparacionConPromedio, comparacionSubsistencia, huellaKg, kwhMesNormalizado, redondear } from "../lib/calculos/motor";
import type { Parametro } from "../lib/calculos/parametros";
import { paraMotor, type Hogar, type RegistroConsumo } from "../lib/supabase/datos";
import { nombreMes } from "./formato";

type Props = {
  registro: RegistroConsumo;
  hogar: Hogar;
  registros: RegistroConsumo[];
  parametros: Record<string, Parametro>;
};

/** Diagnóstico de un mes: consumo, huella y comparaciones. */
export default function ResultadoMes({ registro, hogar, registros, parametros }: Props) {
  const factor = parametros.factor_emision_sin;
  const subsistencia = parametros[hogar.sobre_1000_msnm ? "subsistencia_sobre_1000" : "subsistencia_bajo_1000"];

  const kwh = registro.consumo_kwh;
  const normalizado = kwhMesNormalizado({ periodo: registro.periodo, kwh, dias: registro.dias });
  const huella = huellaKg(kwh, factor.valor);
  // Línea base con los meses ANTERIORES a este, para comparar de forma justa.
  const lineaBase = calcularLineaBase(paraMotor(registros.filter((r) => r.periodo < registro.periodo)));
  const vsPromedio = lineaBase ? comparacionConPromedio(normalizado, lineaBase.promedio) : null;
  const vsSub = comparacionSubsistencia(normalizado, hogar.sobre_1000_msnm, parametros.subsistencia_bajo_1000.valor, parametros.subsistencia_sobre_1000.valor);

  return (
    <section className="result-card" aria-label={`Resultado de ${nombreMes(registro.periodo)}`}>
      <span className="metric-label">{nombreMes(registro.periodo).toUpperCase()}</span>
      <strong className="metric-value">{redondear(kwh)} kWh</strong>
      {registro.dias && registro.dias !== 30 && (
        <p className="metric-note">
          {registro.dias} días facturados · equivale a <b>{redondear(normalizado)} kWh</b> en un mes de 30 días
        </p>
      )}

      <div className="stat-grid">
        <div className="stat">
          <span>Huella del mes</span>
          <strong>{redondear(huella)} kg CO₂e</strong>
        </div>
        <div className="stat">
          <span>Por persona</span>
          <strong>{redondear(kwh / hogar.personas)} kWh · {redondear(huella / hogar.personas)} kg</strong>
        </div>
        {vsPromedio !== null && (
          <div className="stat">
            <span>Frente a tu promedio</span>
            <strong>
              {vsPromedio > 0 ? "▲" : vsPromedio < 0 ? "▼" : "="} {Math.abs(vsPromedio)} % {vsPromedio > 0 ? "más" : vsPromedio < 0 ? "menos" : ""}
            </strong>
          </div>
        )}
        <div className="stat">
          <span>Subsistencia ({vsSub.referencia} kWh)</span>
          <strong>{vsSub.porEncima ? `${Math.round(vsSub.diferencia)} kWh por encima` : "Por debajo"}</strong>
        </div>
        {registro.valor_kwh && (
          <div className="stat">
            <span>Energía del mes</span>
            <strong>${Math.round(kwh * registro.valor_kwh).toLocaleString("es-CO")}</strong>
          </div>
        )}
      </div>

      <details className="explicacion">
        <summary>¿Cómo se calcula?</summary>
        <p>
          Huella = consumo × factor de emisión = {redondear(kwh)} kWh × {factor.valor} kg CO₂e/kWh = {redondear(huella, 2)} kg CO₂e.
        </p>
        <p>
          Factor: {factor.fuente} (<a href={factor.url} target="_blank" rel="noreferrer">fuente</a>). El consumo de subsistencia
          ({subsistencia.fuente}) es la referencia para subsidios, no un límite.
        </p>
        {lineaBase && <p>Tu promedio ({lineaBase.promedio} kWh) sale de {lineaBase.meses} meses anteriores, llevados a 30 días.</p>}
      </details>
    </section>
  );
}
