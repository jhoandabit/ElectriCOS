"use client";

import { useState } from "react";
import { kwhMesNormalizado, redondear } from "../lib/calculos/motor";
import { borrarRegistro, type RegistroConsumo } from "../lib/supabase/datos";
import { nombreMes } from "./formato";

const co = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 1 });

const FUENTE: Record<RegistroConsumo["fuente"], string> = { factura: "Factura", manual: "Manual", historico: "Histórico" };

export default function HistorialLista({ registros, onCambio }: { registros: RegistroConsumo[]; onCambio: () => Promise<void> }) {
  const [borrando, setBorrando] = useState<string | null>(null);
  // Confirmación dentro de la lista (el aviso del navegador tarda en iPhone).
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [error, setError] = useState("");

  const borrar = async (r: RegistroConsumo) => {
    setConfirmar(null);
    setBorrando(r.id);
    setError("");
    try {
      await borrarRegistro(r.id);
      await onCambio();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBorrando(null);
    }
  };

  if (!registros.length) return <p className="vacio">Todavía no hay consumos registrados.</p>;

  return (
    <section className="historial" aria-label="Historial de consumo">
      <div className="section-heading">
        <span className="section-kicker">HISTORIAL</span>
        <h2>{registros.length} {registros.length === 1 ? "mes registrado" : "meses registrados"}</h2>
      </div>
      <ul>
        {[...registros].reverse().map((r) => (
          <li key={r.id} className={confirmar === r.id ? "por-borrar" : undefined}>
            {confirmar === r.id ? (
              <>
                <div>
                  <strong>¿Borrar {nombreMes(r.periodo)}?</strong>
                  <small>{co(redondear(r.consumo_kwh))} kWh · no se puede deshacer</small>
                </div>
                <div className="confirmar-borrar">
                  <button className="secondary-button chico" onClick={() => setConfirmar(null)}>No</button>
                  <button className="peligro-button chico" onClick={() => borrar(r)}>Sí, borrar</button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <strong>{nombreMes(r.periodo)}</strong>
                  <small>
                    {FUENTE[r.fuente]}
                    {r.dias ? ` · ${r.dias} días · ${co(redondear(kwhMesNormalizado({ periodo: r.periodo, kwh: r.consumo_kwh, dias: r.dias })))} kWh en 30 días` : ""}
                  </small>
                </div>
                <b>{co(redondear(r.consumo_kwh))} kWh</b>
                <button
                  className="icon-button chico"
                  aria-label={`Borrar ${nombreMes(r.periodo)}`}
                  onClick={() => setConfirmar(r.id)}
                  disabled={borrando === r.id}
                >
                  {borrando === r.id ? "…" : "✕"}
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {error && <div className="error-message" role="alert">{error}</div>}
    </section>
  );
}
