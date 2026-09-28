"use client";

import { useState } from "react";
import { recomendacionesPorReglas, type DatosParaRecomendar, type Recomendacion } from "../lib/calculos/recomendaciones";

/** Pide recomendaciones a la IA (con respaldo por reglas si no está disponible). */
export default function Recomendaciones({ datos }: { datos: DatosParaRecomendar }) {
  const [lista, setLista] = useState<Recomendacion[] | null>(null);
  const [fuente, setFuente] = useState<"ia" | "reglas">("reglas");
  const [cargando, setCargando] = useState(false);

  const pedir = async () => {
    setCargando(true);
    try {
      const r = await fetch("/api/recomendaciones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(datos),
      });
      if (!r.ok) throw new Error();
      const json = (await r.json()) as { fuente: "ia" | "reglas"; recomendaciones: Recomendacion[] };
      setLista(json.recomendaciones);
      setFuente(json.fuente);
    } catch {
      setLista(recomendacionesPorReglas(datos));
      setFuente("reglas");
    } finally {
      setCargando(false);
    }
  };

  return (
    <section className="intro-card" aria-label="Recomendaciones">
      <span className="section-kicker">RECOMENDACIONES</span>
      <h2>¿Qué pueden hacer en casa?</h2>
      {!lista ? (
        <button className="secondary-button full-button" onClick={pedir} disabled={cargando}>
          {cargando ? "Pensando…" : "Ver recomendaciones"}
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
          <small className="fuente-ayuda">
            {fuente === "ia"
              ? "Escritas por IA a partir de tus resultados. La IA no hace los cálculos: los interpreta. Verifícalas con sentido crítico."
              : "Generadas con reglas simples a partir de tus resultados (sin IA)."}
          </small>
        </>
      )}
    </section>
  );
}
