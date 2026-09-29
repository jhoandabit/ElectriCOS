"use client";

import { useState } from "react";
import { recomendacionesPorReglas, type DatosParaRecomendar, type Recomendacion } from "../lib/calculos/recomendaciones";

/**
 * Recomendaciones generadas con reglas a partir de los resultados del motor.
 * Sin IA en la nube: se calculan en el celular y se pueden leer y discutir
 * en lib/calculos/recomendaciones.ts.
 */
export default function Recomendaciones({ datos }: { datos: DatosParaRecomendar }) {
  const [lista, setLista] = useState<Recomendacion[] | null>(null);

  return (
    <section className="intro-card" aria-label="Recomendaciones">
      <span className="section-kicker">RECOMENDACIONES</span>
      <h2>¿Qué pueden hacer en casa?</h2>
      {!lista ? (
        <button className="secondary-button full-button" onClick={() => setLista(recomendacionesPorReglas(datos))}>
          Ver recomendaciones
        </button>
      ) : (
        <>
          <ul className="recomendaciones">
            {lista.map((r) => (
              <li key={r.titulo}>
                <strong>{r.titulo}</strong>
                <p>{r.detalle}</p>
              </li>
            ))}
          </ul>
          <small className="fuente-ayuda">Calculadas con reglas a partir de tus resultados.</small>
        </>
      )}
    </section>
  );
}
