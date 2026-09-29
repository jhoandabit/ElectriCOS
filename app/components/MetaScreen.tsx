"use client";

import { useState } from "react";
import { calcularLineaBase, calcularMeta, huellaKg, MESES_MINIMOS_LINEA_BASE, redondear } from "../lib/calculos/motor";
import type { Parametro } from "../lib/calculos/parametros";
import { CATALOGO_ACCIONES } from "../lib/calculos/recomendaciones";
import {
  actualizarAccionesHechas,
  cerrarMeta,
  crearMeta,
  paraMotor,
  type Hogar,
  type Meta,
  type RegistroConsumo,
} from "../lib/supabase/datos";
import { mesSiguiente, nombreMes } from "./formato";

type Props = {
  hogar: Hogar;
  registros: RegistroConsumo[];
  meta: Meta | null;
  parametros: Record<string, Parametro>;
  onCambio: () => Promise<void>;
  onRegistrar: () => void;
};

const OPCIONES = [3, 5, 10, 15];

export default function MetaScreen({ hogar, registros, meta, parametros, onCambio, onRegistrar }: Props) {
  const [porcentaje, setPorcentaje] = useState(5);
  const [acciones, setAcciones] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const factor = parametros.factor_emision_sin.valor;

  const ejecutar = async (tarea: () => Promise<void>) => {
    setOcupado(true);
    setError("");
    try {
      await tarea();
      await onCambio();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  // ---------- Hay una meta activa ----------
  if (meta) {
    const ultimos = registros.filter((r) => r.periodo >= meta.inicio);
    const alternar = (accion: string) => {
      const hechas = meta.acciones_hechas.includes(accion)
        ? meta.acciones_hechas.filter((a) => a !== accion)
        : [...meta.acciones_hechas, accion];
      void ejecutar(() => actualizarAccionesHechas(meta.id, hechas));
    };
    const cerrar = (estado: "cumplida" | "cerrada") => {
      const texto = estado === "cumplida" ? "¿Marcar la meta como cumplida?" : "¿Cerrar la meta sin cumplirla? Luego podrás proponer otra.";
      if (window.confirm(texto)) void ejecutar(() => cerrarMeta(meta.id, estado));
    };

    return (
      <>
        <section className="result-card">
          <span className="metric-label">META ACTIVA DESDE {nombreMes(meta.inicio).toUpperCase()}</span>
          <strong className="metric-value">{meta.meta_kwh} kWh/mes</strong>
          <p className="metric-note">
            Línea base {meta.linea_base.promedio_kwh} kWh ({meta.linea_base.meses} meses) − {meta.porcentaje} % ={" "}
            {meta.meta_kwh} kWh. Menos {redondear(huellaKg(meta.linea_base.promedio_kwh - meta.meta_kwh, factor))} kg CO₂e al mes.
          </p>
          <p className="metric-note">
            {ultimos.length
              ? `Llevan ${ultimos.length} ${ultimos.length === 1 ? "mes" : "meses"} registrados desde el inicio. Mira el detalle en Progreso.`
              : "Registren la próxima factura para ver si se cumple."}
          </p>
        </section>

        <section className="form-card">
          <div className="form-section">
            <h3>Acciones del hogar</h3>
            {meta.acciones.map((a) => (
              <label key={a} className="check-row">
                <input type="checkbox" checked={meta.acciones_hechas.includes(a)} onChange={() => alternar(a)} disabled={ocupado} />
                <span>{a}</span>
              </label>
            ))}
            <span className="field-help">
              {meta.acciones_hechas.length} de {meta.acciones.length} acciones en marcha.
            </span>
          </div>
          {error && <div className="error-message" role="alert">{error}</div>}
          <div className="button-row">
            <button className="secondary-button" onClick={() => cerrar("cerrada")} disabled={ocupado}>Cerrar meta</button>
            <button className="primary-button" onClick={() => cerrar("cumplida")} disabled={ocupado}>¡La cumplimos!</button>
          </div>
        </section>
      </>
    );
  }

  // ---------- Sin meta: primero la línea base ----------
  const lineaBase = calcularLineaBase(paraMotor(registros));
  if (!lineaBase) {
    const faltan = MESES_MINIMOS_LINEA_BASE - registros.length;
    return (
      <>
        <div className="intro-card">
          <span className="section-kicker">LÍNEA BASE</span>
          <h2>Faltan {faltan} {faltan === 1 ? "mes" : "meses"} de consumo para proponer una meta.</h2>
          <p>
            Para saber si tu casa está ahorrando, primero hay que conocer cuánto consume normalmente: el <b>promedio</b> de al menos{" "}
            {MESES_MINIMOS_LINEA_BASE} meses. Con uno o dos, un solo mes raro (visitas, vacaciones) cambiaría todo.
          </p>
          <p>
            <b>La forma más rápida:</b> vuelve a leer tu factura. Casi todas traen impresos los últimos 6 meses (kWh y días), y ElectriCOs los
            guarda junto con el mes actual.
          </p>
        </div>
        <button className="primary-button full-button" onClick={onRegistrar}>Registrar consumo</button>
      </>
    );
  }

  const metaKwh = calcularMeta(lineaBase.promedio, porcentaje);
  const inicio = mesSiguiente(lineaBase.hasta);
  const alternarNueva = (a: string) => setAcciones((x) => (x.includes(a) ? x.filter((y) => y !== a) : [...x, a]));

  const crear = () => {
    if (!acciones.length) return setError("Elige al menos una acción para lograr la meta.");
    void ejecutar(() => crearMeta(hogar.id, lineaBase, porcentaje, metaKwh, inicio, acciones));
  };

  return (
    <>
      <section className="result-card">
        <span className="metric-label">
          LÍNEA BASE · {nombreMes(lineaBase.desde).toUpperCase()} A {nombreMes(lineaBase.hasta).toUpperCase()}
        </span>
        <strong className="metric-value">{lineaBase.promedio} kWh/mes</strong>
        <div className="stat-grid">
          <div className="stat"><span>Mínimo</span><strong>{lineaBase.minimo} kWh</strong></div>
          <div className="stat"><span>Máximo</span><strong>{lineaBase.maximo} kWh</strong></div>
          <div className="stat"><span>Variación</span><strong>± {lineaBase.desviacion} kWh ({lineaBase.variacionPct} %)</strong></div>
          <div className="stat">
            <span>Tendencia</span>
            <strong>{lineaBase.tendencia > 0 ? "▲ sube" : lineaBase.tendencia < 0 ? "▼ baja" : "= estable"} {Math.abs(lineaBase.tendencia)} kWh/mes</strong>
          </div>
        </div>
        <p className="metric-note">Valores llevados a meses de 30 días, con los últimos {lineaBase.meses} meses.</p>
      </section>

      <section className="form-card">
        <div className="form-section">
          <h3>¿Cuánto quieren reducir?</h3>
          <div className="segmented" role="radiogroup" aria-label="Porcentaje de reducción">
            {OPCIONES.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={porcentaje === p} className={porcentaje === p ? "on" : ""} onClick={() => setPorcentaje(p)}>
                {p} %
              </button>
            ))}
          </div>
          <div className="calculated-note">
            <strong>Meta: {metaKwh} kWh/mes</strong>
            <span>
              {lineaBase.promedio} × (1 − {porcentaje}/100) = {metaKwh} kWh. Ahorro de {redondear(lineaBase.promedio - metaKwh)} kWh y{" "}
              {redondear(huellaKg(lineaBase.promedio - metaKwh, factor))} kg CO₂e cada mes, desde {nombreMes(inicio)}.
            </span>
          </div>
        </div>

        <div className="form-section">
          <h3>¿Qué harán para lograrlo?</h3>
          {CATALOGO_ACCIONES.map((a) => (
            <label key={a} className="check-row">
              <input type="checkbox" checked={acciones.includes(a)} onChange={() => alternarNueva(a)} />
              <span>{a}</span>
            </label>
          ))}
        </div>

        {error && <div className="error-message" role="alert">{error}</div>}
        <button className="primary-button" onClick={crear} disabled={ocupado}>{ocupado ? "Guardando…" : "Proponer esta meta"}</button>
        <span className="field-help">
          Tip: una meta pequeña que se cumple enseña más que una grande que se abandona. Para {hogar.personas} personas, empiecen con 5 %.
        </span>
      </section>
    </>
  );
}
