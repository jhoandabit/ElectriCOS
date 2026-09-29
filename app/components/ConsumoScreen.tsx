"use client";

import { useState } from "react";
import type { Parametro } from "../lib/calculos/parametros";
import type { Hogar, RegistroConsumo } from "../lib/supabase/datos";
import { nombreMes } from "./formato";
import HistorialLista from "./HistorialLista";
import ResultadoMes from "./ResultadoMes";

type Props = {
  hogar: Hogar;
  registros: RegistroConsumo[];
  parametros: Record<string, Parametro>;
  onFactura: () => void;
  onManual: () => void;
  onCambio: () => Promise<void>;
};

/** Pestaña Consumo: registrar, ver el diagnóstico de un mes (tarjetas) y el historial. */
export default function ConsumoScreen({ hogar, registros, parametros, onFactura, onManual, onCambio }: Props) {
  const ultimo = registros[registros.length - 1];
  const [periodo, setPeriodo] = useState<string | null>(null);
  const visto = registros.find((r) => r.periodo === periodo) ?? ultimo;

  return (
    <>
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

      {visto && (
        <>
          {registros.length > 1 && (
            <label className="selector-mes">
              <span>Ver el mes</span>
              <select value={visto.periodo} onChange={(e) => setPeriodo(e.target.value)}>
                {[...registros].reverse().map((r) => (
                  <option key={r.periodo} value={r.periodo}>{nombreMes(r.periodo)}</option>
                ))}
              </select>
            </label>
          )}
          <ResultadoMes key={visto.periodo} registro={visto} hogar={hogar} registros={registros} parametros={parametros} />
        </>
      )}

      <HistorialLista registros={registros} onCambio={onCambio} />
    </>
  );
}
