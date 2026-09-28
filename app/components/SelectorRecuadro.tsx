"use client";

import { PointerEvent, useRef, useState } from "react";
import type { Recuadro } from "../lib/factura/ocr-guiado";

type Props = {
  src: string;
  valor: Recuadro | null;
  onCambio: (r: Recuadro | null) => void;
};

const limitar = (n: number) => Math.min(1, Math.max(0, n));

/** Muestra la foto y permite dibujar un recuadro arrastrando el dedo o el mouse. */
export default function SelectorRecuadro({ src, valor, onCambio }: Props) {
  const zona = useRef<HTMLDivElement>(null);
  const [inicio, setInicio] = useState<{ x: number; y: number } | null>(null);

  const punto = (e: PointerEvent<HTMLDivElement>) => {
    const r = zona.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: limitar((e.clientX - r.left) / r.width), y: limitar((e.clientY - r.top) / r.height) };
  };

  const alBajar = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = punto(e);
    setInicio(p);
    onCambio({ x: p.x, y: p.y, ancho: 0, alto: 0 });
  };

  const alMover = (e: PointerEvent<HTMLDivElement>) => {
    if (!inicio) return;
    const p = punto(e);
    onCambio({
      x: Math.min(inicio.x, p.x),
      y: Math.min(inicio.y, p.y),
      ancho: Math.abs(p.x - inicio.x),
      alto: Math.abs(p.y - inicio.y),
    });
  };

  const alSoltar = () => {
    setInicio(null);
    if (valor && (valor.ancho < 0.05 || valor.alto < 0.01)) onCambio(null);
  };

  return (
    <div
      ref={zona}
      className="selector-recuadro"
      onPointerDown={alBajar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={alSoltar}
    >
      <img src={src} alt="Foto de la factura: arrastra para encerrar la fila del medidor" draggable={false} />
      {valor && valor.ancho > 0 && (
        <div
          className="selector-marco"
          style={{
            left: `${valor.x * 100}%`,
            top: `${valor.y * 100}%`,
            width: `${valor.ancho * 100}%`,
            height: `${valor.alto * 100}%`,
          }}
        />
      )}
    </div>
  );
}
