"use client";

import { useState } from "react";
import { kwhMesNormalizado, redondear, type Registro } from "../lib/calculos/motor";
import { mesCorto, nombreMes } from "./formato";

type Props = {
  registros: Registro[];
  lineaBase: number | null;
  meta: number | null;
};

// Columnas: consumo de cada mes llevado a 30 días (una sola serie, un color).
// Líneas de referencia con etiqueta directa: línea base y meta.
// La tabla de Progreso muestra los mismos valores para quien no pueda ver el gráfico.

const ANCHO = 340;
const ALTO = 190;
const M = { arriba: 14, derecha: 58, abajo: 24, izquierda: 34 };

function maximoRedondo(v: number) {
  const paso = v > 400 ? 100 : 50;
  return Math.ceil(v / paso) * paso;
}

export default function GraficoConsumo({ registros, lineaBase, meta }: Props) {
  const [activo, setActivo] = useState<number | null>(null);
  const datos = registros.slice(-12).map((r) => ({ ...r, valor: kwhMesNormalizado(r) }));
  if (!datos.length) return null;

  const tope = maximoRedondo(Math.max(...datos.map((d) => d.valor), lineaBase ?? 0, meta ?? 0, 50));
  const anchoUtil = ANCHO - M.izquierda - M.derecha;
  const altoUtil = ALTO - M.arriba - M.abajo;
  const ranura = anchoUtil / datos.length;
  const barra = Math.min(24, ranura * 0.62);
  const y = (v: number) => M.arriba + altoUtil - (v / tope) * altoUtil;
  const base = y(0);
  const marcas = [0, tope / 2, tope];

  // Columna con esquinas redondeadas solo arriba (4 px) y recta en la base.
  const columna = (x: number, alto: number) => {
    const r = Math.min(4, alto / 2, barra / 2);
    const top = base - alto;
    return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barra - r} Q${x + barra},${top} ${x + barra},${top + r} V${base} Z`;
  };

  const d = activo !== null ? datos[activo] : null;

  return (
    <figure className="grafico">
      <figcaption>Consumo mensual (kWh, llevado a 30 días)</figcaption>
      <div className="grafico-lienzo">
        <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label="Gráfico de columnas del consumo mensual con la línea base y la meta">
          {marcas.map((m) => (
            <g key={m}>
              <line x1={M.izquierda} x2={ANCHO - M.derecha} y1={y(m)} y2={y(m)} className="g-grid" />
              <text x={M.izquierda - 6} y={y(m) + 4} textAnchor="end" className="g-eje">{Math.round(m)}</text>
            </g>
          ))}

          {datos.map((p, i) => {
            const x = M.izquierda + i * ranura + (ranura - barra) / 2;
            return (
              <g key={p.periodo}>
                <path d={columna(x, base - y(p.valor))} className={"g-col" + (activo === i ? " activa" : "")} />
                {(datos.length <= 6 || i % 2 === datos.length % 2 || i === datos.length - 1) && (
                  <text x={x + barra / 2} y={ALTO - 6} textAnchor="middle" className="g-eje">{mesCorto(p.periodo)}</text>
                )}
                {/* Zona de toque más grande que la columna */}
                <rect
                  x={M.izquierda + i * ranura}
                  y={M.arriba}
                  width={ranura}
                  height={altoUtil}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${nombreMes(p.periodo)}: ${redondear(p.valor)} kWh`}
                  onMouseEnter={() => setActivo(i)}
                  onMouseLeave={() => setActivo(null)}
                  onFocus={() => setActivo(i)}
                  onBlur={() => setActivo(null)}
                  onClick={() => setActivo(i)}
                />
              </g>
            );
          })}

          {lineaBase !== null && (
            <g>
              <line x1={M.izquierda} x2={ANCHO - M.derecha} y1={y(lineaBase)} y2={y(lineaBase)} className="g-ref-base" />
              <text x={ANCHO - M.derecha + 4} y={y(lineaBase) + 4} className="g-etiqueta">Base {Math.round(lineaBase)}</text>
            </g>
          )}
          {meta !== null && (
            <g>
              <line x1={M.izquierda} x2={ANCHO - M.derecha} y1={y(meta)} y2={y(meta)} className="g-ref-meta" />
              <text x={ANCHO - M.derecha + 4} y={y(meta) + (lineaBase !== null && Math.abs(y(meta) - y(lineaBase)) < 12 ? 14 : 4)} className="g-etiqueta">
                Meta {Math.round(meta)}
              </text>
            </g>
          )}
        </svg>

        {d && activo !== null && (
          <div
            className="g-tooltip"
            style={{ left: `${((M.izquierda + (activo + 0.5) * ranura) / ANCHO) * 100}%` }}
            role="status"
          >
            <strong>{nombreMes(d.periodo)}</strong>
            <span>{redondear(d.valor)} kWh en 30 días{d.dias && d.dias !== 30 ? ` (${redondear(d.kwh)} kWh en ${d.dias} días)` : ""}</span>
            {meta !== null && <span>{d.valor <= meta ? "✓ Dentro de la meta" : "✕ Por encima de la meta"}</span>}
          </div>
        )}
      </div>
    </figure>
  );
}
