import { calcularLineaBase, evaluarAvance, huellaKg, kwhMesNormalizado, redondear } from "../lib/calculos/motor";
import type { Parametro } from "../lib/calculos/parametros";
import { paraMotor, type Hogar, type Meta, type RegistroConsumo } from "../lib/supabase/datos";
import { nombreMes } from "./formato";
import GraficoConsumo from "./GraficoConsumo";
import Recomendaciones from "./Recomendaciones";

type Props = { hogar: Hogar; registros: RegistroConsumo[]; meta: Meta | null; parametros: Record<string, Parametro> };

export default function ProgresoScreen({ hogar, registros, meta, parametros }: Props) {
  if (!registros.length) {
    return (
      <div className="intro-card">
        <span className="section-kicker">PROGRESO</span>
        <h2>Aún no hay datos.</h2>
        <p>Cuando registres consumos, aquí verás cómo cambia tu hogar mes a mes.</p>
      </div>
    );
  }

  const factor = parametros.factor_emision_sin.valor;
  const motor = paraMotor(registros);
  const lineaBaseCalc = calcularLineaBase(motor);
  const promedio = meta ? meta.linea_base.promedio_kwh : lineaBaseCalc?.promedio ?? null;
  const ultimoValorKwh = [...registros].reverse().find((r) => r.valor_kwh)?.valor_kwh ?? null;
  const avance = meta ? evaluarAvance(motor, meta.linea_base.promedio_kwh, meta.meta_kwh, meta.inicio, factor, ultimoValorKwh) : [];
  const total = avance.reduce(
    (s, a) => ({ kwh: s.kwh + a.ahorroKwh, kg: s.kg + a.ahorroKgCo2e, pesos: s.pesos + (a.ahorroPesos ?? 0) }),
    { kwh: 0, kg: 0, pesos: 0 }
  );
  const ultimo = registros[registros.length - 1];
  const kwhUltimo = kwhMesNormalizado({ periodo: ultimo.periodo, kwh: ultimo.consumo_kwh, dias: ultimo.dias });

  return (
    <>
      <section className="result-card">
        <GraficoConsumo registros={motor} lineaBase={promedio} meta={meta?.meta_kwh ?? null} />
      </section>

      {meta && (
        <section className="result-card">
          <span className="metric-label">DESDE {nombreMes(meta.inicio).toUpperCase()}</span>
          {avance.length ? (
            <>
              <strong className="metric-value">
                {avance.filter((a) => a.cumple).length} de {avance.length} {avance.length === 1 ? "mes" : "meses"} en la meta
              </strong>
              <div className="stat-grid">
                <div className="stat"><span>Energía ahorrada</span><strong>{redondear(total.kwh)} kWh</strong></div>
                <div className="stat"><span>Emisiones evitadas</span><strong>{redondear(total.kg)} kg CO₂e</strong></div>
                {ultimoValorKwh && <div className="stat"><span>Dinero (aprox.)</span><strong>${Math.round(total.pesos).toLocaleString("es-CO")}</strong></div>}
              </div>
              <p className="metric-note">Un valor negativo significa que se consumió más que la línea base.</p>
            </>
          ) : (
            <p className="metric-note">Registren la factura de {nombreMes(meta.inicio)} para ver el primer resultado.</p>
          )}
        </section>
      )}

      <section className="tabla-card" aria-label="Tabla de consumos">
        <table>
          <caption>Consumo por mes</caption>
          <thead>
            <tr>
              <th scope="col">Mes</th>
              <th scope="col">kWh</th>
              <th scope="col">kWh/30 d</th>
              <th scope="col">kg CO₂e</th>
              {meta && <th scope="col">Meta</th>}
            </tr>
          </thead>
          <tbody>
            {[...registros].reverse().map((r) => {
              const n = kwhMesNormalizado({ periodo: r.periodo, kwh: r.consumo_kwh, dias: r.dias });
              const evaluado = avance.find((a) => a.periodo === r.periodo);
              return (
                <tr key={r.id}>
                  <th scope="row">{nombreMes(r.periodo)}</th>
                  <td>{redondear(r.consumo_kwh)}</td>
                  <td>{redondear(n)}</td>
                  <td>{redondear(huellaKg(r.consumo_kwh, factor))}</td>
                  {meta && <td>{evaluado ? (evaluado.cumple ? "✓ Sí" : "✕ No") : "—"}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <Recomendaciones
        datos={{
          kwhActual: redondear(kwhUltimo),
          promedio,
          tendencia: lineaBaseCalc?.tendencia ?? null,
          personas: hogar.personas,
          estrato: hogar.estrato,
          subsistencia: parametros[hogar.sobre_1000_msnm ? "subsistencia_sobre_1000" : "subsistencia_bajo_1000"].valor,
          meta: meta?.meta_kwh ?? null,
          huellaKg: redondear(huellaKg(ultimo.consumo_kwh, factor)),
        }}
      />
    </>
  );
}
