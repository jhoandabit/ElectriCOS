"use client";

import type { RegistroConsumo } from "../lib/supabase/datos";
import HistorialLista from "./HistorialLista";

type Props = {
  registros: RegistroConsumo[];
  onFactura: () => void;
  onManual: () => void;
  onCambio: () => Promise<void>;
};

/** Pestaña Consumo: registrar (factura o a mano) y el historial de meses. */
export default function ConsumoScreen({ registros, onFactura, onManual, onCambio }: Props) {
  return (
    <>
      <section className="action-section">
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
      <HistorialLista registros={registros} onCambio={onCambio} />
    </>
  );
}
