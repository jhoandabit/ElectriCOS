"use client";

// Consejos de ahorro que aparecen solos, como un aviso dentro de la app (no es una notificación
// del celular: no necesita permisos ni instalación y funciona sin conexión).
// Sale a los pocos segundos de entrar y luego cada ~90 s; se cierra solo o con un toque.
// Los primeros avisos usan los datos del hogar (reglas de recomendaciones.ts); después, consejos generales.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calcularLineaBase, huellaKg, kwhMesNormalizado, redondear } from "../lib/calculos/motor";
import type { Parametro } from "../lib/calculos/parametros";
import { recomendacionesPorReglas } from "../lib/calculos/recomendaciones";
import { paraMotor, type Hogar, type Meta, type RegistroConsumo } from "../lib/supabase/datos";

type Consejo = { icono: string; tono: string; titulo: string; texto: string };

const GENERALES: Consejo[] = [
  { icono: "🔌", tono: "#fff2e8", titulo: "Aparatos en espera", texto: "Cargadores, televisor y decodificador siguen gastando energía aunque parezcan apagados. Desconéctalos o usa una regleta con interruptor." },
  { icono: "💡", tono: "#fff8d6", titulo: "Bombillos LED", texto: "Un bombillo LED gasta mucho menos energía que uno incandescente y dura más. Cambiar los que más se usan es el ahorro más fácil." },
  { icono: "🧊", tono: "#e6f1fb", titulo: "La nevera", texto: "Está prendida todo el día, así que cuenta mucho. Revisa que el empaque cierre bien y no la abras más de lo necesario." },
  { icono: "☀️", tono: "#fff8d6", titulo: "Luz natural", texto: "Abre cortinas y ventanas durante el día: es luz gratis y no hace falta prender bombillos." },
  { icono: "👕", tono: "#f2f7e6", titulo: "Plancha y lavadora", texto: "Plancha toda la ropa en una sola sesión y lava con la carga completa: se calienta y arranca menos veces." },
  { icono: "🚿", tono: "#e6f1fb", titulo: "Ducha eléctrica", texto: "Calentar agua gasta mucha energía. Acortar la ducha unos minutos se nota en la factura." },
  { icono: "🌬️", tono: "#f2f7e6", titulo: "Ventilador", texto: "Si el calor lo permite, un ventilador consume mucho menos que un aire acondicionado." },
  { icono: "🌙", tono: "#eceaf8", titulo: "Antes de dormir", texto: "Apaga luces, televisor y decodificador. Revisar la casa antes de acostarse toma un minuto." },
  { icono: "📈", tono: "#fff2e8", titulo: "Mira tu avance", texto: "Registrar cada factura te muestra si el consumo baja. Lo que se mide se puede mejorar." },
  { icono: "🌎", tono: "#f2f7e6", titulo: "Cada kWh cuenta", texto: "Ahorrar energía en casa también reduce la contaminación que produce generarla. ¡Todos podemos aportar!" },
];

const LLAVE_APAGADO = "electricos-consejos-apagados";
const LLAVE_INDICE = "electricos-consejo-indice";

function leer(llave: string): string | null {
  try {
    return localStorage.getItem(llave);
  } catch {
    return null;
  }
}
function guardar(llave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(llave);
    else localStorage.setItem(llave, valor);
  } catch {
    /* sin almacenamiento */
  }
}

/** Preferencia de la persona: ¿quiere ver los consejos emergentes? */
export function usarConsejosActivos(): [boolean, (v: boolean) => void] {
  const [activos, setActivos] = useState(true);
  useEffect(() => setActivos(leer(LLAVE_APAGADO) !== "1"), []);
  const cambiar = useCallback((v: boolean) => {
    setActivos(v);
    guardar(LLAVE_APAGADO, v ? null : "1");
  }, []);
  return [activos, cambiar];
}

type Props = {
  /** false mientras la persona llena un formulario o lee una factura: ahí no se interrumpe. */
  permitido: boolean;
  activos: boolean;
  onApagar: () => void;
  hogar: Hogar;
  registros: RegistroConsumo[];
  meta: Meta | null;
  parametros: Record<string, Parametro>;
};

const ESPERA_INICIAL_MS = 20_000;
const ENTRE_AVISOS_MS = 90_000;
const VISIBLE_MS = 12_000;

export default function ConsejoEmergente({ permitido, activos, onApagar, hogar, registros, meta, parametros }: Props) {
  const consejos = useMemo<Consejo[]>(() => {
    const contextuales: Consejo[] = [];
    const ordenados = paraMotor(registros);
    const ultimo = ordenados[ordenados.length - 1];
    if (ultimo) {
      const base = calcularLineaBase(ordenados.slice(0, -1));
      const lb = calcularLineaBase(ordenados);
      const factor = parametros.factor_emision_sin.valor;
      const reglas = recomendacionesPorReglas({
        kwhActual: redondear(kwhMesNormalizado(ultimo)),
        promedio: base?.promedio ?? null,
        tendencia: lb?.tendencia ?? null,
        personas: hogar.personas,
        estrato: hogar.estrato,
        subsistencia: parametros[hogar.sobre_1000_msnm ? "subsistencia_sobre_1000" : "subsistencia_bajo_1000"].valor,
        meta: meta?.meta_kwh ?? null,
        huellaKg: redondear(huellaKg(ultimo.kwh, factor)),
      });
      for (const r of reglas.slice(0, 3)) contextuales.push({ icono: "🏠", tono: "#fff2e8", titulo: r.titulo, texto: r.detalle });
    }
    return [...contextuales, ...GENERALES];
  }, [hogar, registros, meta, parametros]);

  const [visible, setVisible] = useState<Consejo | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const indice = useRef(0);
  const consejosRef = useRef(consejos);
  consejosRef.current = consejos;

  useEffect(() => {
    indice.current = Number(leer(LLAVE_INDICE)) || 0;
  }, []);

  const ocultar = useCallback(() => {
    setCerrando(true);
    window.setTimeout(() => {
      setVisible(null);
      setCerrando(false);
    }, 250);
  }, []);

  // Programa los avisos: el primero a los 20 s y luego cada 90 s, solo con la pantalla visible.
  useEffect(() => {
    if (!activos || !permitido) {
      setVisible(null);
      return;
    }
    let ocultarEn: number | undefined;
    const mostrar = () => {
      if (document.visibilityState !== "visible") return;
      const lista = consejosRef.current;
      const c = lista[indice.current % lista.length];
      indice.current += 1;
      guardar(LLAVE_INDICE, String(indice.current));
      setCerrando(false);
      setVisible(c);
      window.clearTimeout(ocultarEn);
      ocultarEn = window.setTimeout(ocultar, VISIBLE_MS);
    };
    const primero = window.setTimeout(mostrar, ESPERA_INICIAL_MS);
    const ciclo = window.setInterval(mostrar, ENTRE_AVISOS_MS);
    return () => {
      window.clearTimeout(primero);
      window.clearInterval(ciclo);
      window.clearTimeout(ocultarEn);
    };
  }, [activos, permitido, ocultar]);

  if (!visible || !activos || !permitido) return null;

  return (
    <aside className={"consejo-emergente" + (cerrando ? " saliendo" : "")} role="status" aria-live="polite" aria-label="Consejo de ahorro">
      <div className="consejo-icono" style={{ background: visible.tono }} aria-hidden="true">{visible.icono}</div>
      <div className="consejo-cuerpo">
        <span className="section-kicker">CONSEJO DE AHORRO</span>
        <strong>{visible.titulo}</strong>
        <p>{visible.texto}</p>
        <button className="text-button" onClick={onApagar}>No mostrar más consejos</button>
      </div>
      <button className="icon-button chico" onClick={ocultar} aria-label="Cerrar consejo">✕</button>
      <span className="consejo-barra" style={{ animationDuration: `${VISIBLE_MS}ms` }} aria-hidden="true" />
    </aside>
  );
}
