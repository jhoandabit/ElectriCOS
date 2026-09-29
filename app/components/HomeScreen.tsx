import { calcularLineaBase, MESES_MINIMOS_LINEA_BASE } from "../lib/calculos/motor";
import type { Parametro } from "../lib/calculos/parametros";
import { paraMotor, type Hogar, type Meta, type RegistroConsumo } from "../lib/supabase/datos";
import Creditos from "./Creditos";
import { mesCorto } from "./formato";
import ResultadoMes from "./ResultadoMes";

type Props = {
  hogar: Hogar;
  registros: RegistroConsumo[];
  meta: Meta | null;
  parametros: Record<string, Parametro>;
  onConsumo: () => void;
  onMeta: () => void;
};

/** Inicio: las tarjetas del último mes, la línea base y los créditos. Registrar queda en la pestaña Consumo. */
export default function HomeScreen({ hogar, registros, meta, parametros, onConsumo, onMeta }: Props) {
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
          <button className="primary-button full-button" onClick={onConsumo} style={{ marginTop: 16 }}>
            Registrar mi primera factura
          </button>
        </div>
      ) : (
        <ResultadoMes registro={ultimo} hogar={hogar} registros={registros} parametros={parametros} />
      )}

      <button className="preview-card" onClick={onMeta}>
        <div>
          <span className="metric-label">{meta ? "META ACTIVA" : "LÍNEA BASE"}</span>
          <strong>
            {meta
              ? `Consumir máximo ${meta.meta_kwh} kWh al mes (−${meta.porcentaje} %)`
              : lineaBase
                ? `Promedio de los últimos ${lineaBase.meses} meses (${mesCorto(lineaBase.desde)} a ${mesCorto(lineaBase.hasta)}): ${lineaBase.promedio.toLocaleString("es-CO")} kWh. ¡Ya puedes proponer una meta!`
                : `Faltan ${faltan} ${faltan === 1 ? "mes" : "meses"} para tener tu línea base.`}
          </strong>
        </div>
        <span className="preview-icon" aria-hidden="true">{meta ? "◎" : "▥"}</span>
      </button>
      <Creditos />
    </>
  );
}
