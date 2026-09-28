"use client";

import { FormEvent, useState } from "react";
import { sobre1000Metros } from "../lib/calculos/parametros";
import { guardarHogar, type Hogar } from "../lib/supabase/datos";

const MUNICIPIOS = ["Cartago", "Pereira", "Dosquebradas", "La Virginia", "Santa Rosa de Cabal", "Ansermanuevo", "Obando", "Alcalá", "Toro", "Zarzal", "Manizales", "Armenia", "Cali"];
const EMPRESAS = ["Energía de Pereira", "CHEC", "Celsia", "EPM", "Otra"];

type Props = { hogar?: Hogar | null; onGuardado: (h: Hogar) => void; onCancelar?: () => void };

export default function HogarForm({ hogar, onGuardado, onCancelar }: Props) {
  const [alias, setAlias] = useState(hogar?.alias ?? "Mi hogar");
  const [municipio, setMunicipio] = useState(hogar?.municipio ?? "");
  const [estrato, setEstrato] = useState(hogar ? String(hogar.estrato) : "");
  const [personas, setPersonas] = useState(hogar ? String(hogar.personas) : "");
  const [sobre1000, setSobre1000] = useState(hogar?.sobre_1000_msnm ?? false);
  const [empresa, setEmpresa] = useState(hogar?.empresa ?? "Energía de Pereira");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cambiarMunicipio = (valor: string) => {
    setMunicipio(valor);
    const sugerido = sobre1000Metros(valor);
    if (sugerido !== null) setSobre1000(sugerido);
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const nPersonas = Number(personas);
    if (municipio.trim().length < 2) return setError("Escribe el municipio.");
    if (!estrato) return setError("Selecciona el estrato.");
    if (!Number.isInteger(nPersonas) || nPersonas < 1 || nPersonas > 20) return setError("Las personas del hogar deben ser entre 1 y 20.");
    setGuardando(true);
    try {
      const guardado = await guardarHogar({
        id: hogar?.id,
        alias: alias.trim() || "Mi hogar",
        municipio: municipio.trim(),
        estrato: Number(estrato),
        personas: nPersonas,
        sobre_1000_msnm: sobre1000,
        empresa,
      });
      onGuardado(guardado);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form className="form-card" onSubmit={enviar} noValidate>
      <div className="form-section">
        <h3>{hogar ? "Datos del hogar" : "Cuéntanos de tu hogar"}</h3>
        <label>
          Nombre del hogar
          <input value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={40} placeholder="Mi hogar" />
          <span className="field-help">No uses direcciones ni apellidos. Por ejemplo: “Casa de la abuela”.</span>
        </label>
        <label>
          Municipio
          <input value={municipio} onChange={(e) => cambiarMunicipio(e.target.value)} list="municipios" placeholder="Ej. Cartago" />
          <datalist id="municipios">{MUNICIPIOS.map((m) => <option key={m} value={m} />)}</datalist>
        </label>
        <div className="field-grid">
          <label>
            Estrato
            <select value={estrato} onChange={(e) => setEstrato(e.target.value)}>
              <option value="">Seleccionar</option>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label>
            Personas
            <input type="number" min={1} max={20} value={personas} onChange={(e) => setPersonas(e.target.value)} inputMode="numeric" placeholder="Ej. 4" />
          </label>
        </div>
        <label>
          Empresa de energía
          <select value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
            {EMPRESAS.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
        <label className="check-row">
          <input type="checkbox" checked={sobre1000} onChange={(e) => setSobre1000(e.target.checked)} />
          <span>El municipio está a 1000 m sobre el nivel del mar o más</span>
        </label>
        <span className="field-help">Define el consumo de subsistencia de referencia: 173 kWh/mes por debajo de 1000 m y 130 kWh/mes por encima.</span>
      </div>

      {error && <div className="error-message" role="alert">{error}</div>}
      <div className="button-row">
        {onCancelar && <button type="button" className="secondary-button" onClick={onCancelar}>Cancelar</button>}
        <button className="primary-button" type="submit" disabled={guardando}>{guardando ? "Guardando…" : "Guardar hogar"}</button>
      </div>
    </form>
  );
}
