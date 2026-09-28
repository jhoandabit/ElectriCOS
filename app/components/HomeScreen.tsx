import { calcularLineaBase, MESES_MINIMOS_LINEA_BASE } from "../lib/calculos/motor";
import type { Parametro } from "../lib/calculos/parametros";
import { paraMotor, type Hogar, type Meta, type RegistroConsumo } from "../lib/supabase/datos";
import ResultadoMes from "./ResultadoMes";

type Props = {
  hogar: Hogar;
  registros: RegistroConsumo[];
  meta: Meta | null;
  parametros: Record<string, Parametro>;
  onFactura: () => void;
  onManual: () => void;
  onMeta: () => void;
};

export default function HomeScreen({ hogar, registros, meta, parametros, onFactura, onManual, onMeta }: Props) {
  const ultimo = registros[registros.length - 1];
  const lineaBase = calcularLineaBase(paraMotor(registros));
  const faltan = Math.max(0, MESES_MINIMOS_LINEA_BASE - registros.length);

  return (
    <>
      {!ultimo ? (
        <div className="hero-card">
          <span className="section-kicker">{hogar.alias.toUpperCase()}</span>
          <h2>Mide, comprende y transforma tu consumo.</h2>
          <p>Registra tu primera factura para conocer el consumo y la huella de tu hogar.</p>
        </div>
      ) : (
        <ResultadoMes registro={ultimo} hogar={hogar} registros={registros} parametros={parametros} />
      )}

      <section className="action-section">
        <div className="section-heading">
          <span className="section-kicker">{ultimo ? "NUEVO REGISTRO" : "PRIMER PASO"}</span>
          <h2>¿Cómo registrarás tu consumo?</h2>
        </div>
        <button className="action-card" onClick={onFactura}>
          <span className="action-icon" aria-hidden="true">📷</span>
          <span><strong>Leer factura</strong><small>Foto o PDF de la empresa de energía.</small></span>
          <b aria-hidden="true">›</b>
        </button>
        <button className="action-card" onClick={onManual}>
          <span className="action-icon" aria-hidden="true">✍️</span>
          <span><strong>Ingresar manualmente</strong><small>Escribir las lecturas o el consumo.</small></span>
          <b aria-hidden="true">›</b>
        </button>
      </section>

      <button className="preview-card" onClick={onMeta}>
        <div>
          <span className="metric-label">{meta ? "META ACTIVA" : "LÍNEA BASE"}</span>
          <strong>
            {meta
              ? `Consumir máximo ${meta.meta_kwh} kWh al mes (−${meta.porcentaje} %)`
              : lineaBase
                ? `Promedio de ${lineaBase.meses} meses: ${lineaBase.promedio} kWh. ¡Ya puedes proponer una meta!`
                : `Faltan ${faltan} ${faltan === 1 ? "mes" : "meses"} para tener tu línea base.`}
          </strong>
        </div>
        <span className="preview-icon" aria-hidden="true">{meta ? "◎" : "▥"}</span>
      </button>
    </>
  );
}
