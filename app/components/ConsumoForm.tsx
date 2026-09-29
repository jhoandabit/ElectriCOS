"use client";

import { FormEvent, useMemo, useState } from "react";
import type { Parametro } from "../lib/calculos/parametros";
import type { ResultadoLectura } from "../lib/factura/tipos";
import { consumoPorLecturas } from "../lib/factura/validar";
import {
  guardarHogar,
  guardarRegistro,
  importarHistorico,
  registrarFactura,
  type Hogar,
  type NuevoRegistro,
  type RegistroConsumo,
} from "../lib/supabase/datos";
import { mesActual, mesAnterior, nombreMes } from "./formato";
import type { MetodoLectura } from "./InvoiceScanner";
import ResultadoMes from "./ResultadoMes";

type Props = {
  hogar: Hogar;
  registros: RegistroConsumo[];
  parametros: Record<string, Parametro>;
  lectura?: ResultadoLectura | null;
  metodo?: MetodoLectura;
  onGuardado: () => Promise<void>;
  onHogar: (h: Hogar) => void;
  onTerminar: () => void;
};

type Campos = { periodo: string; kwh: string; anterior: string; actual: string; factor: string; dias: string; valorKwh: string };

const txt = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

function camposIniciales(lectura?: ResultadoLectura | null): Campos {
  const d = lectura?.datos;
  if (!d) return { periodo: mesActual(), kwh: "", anterior: "", actual: "", factor: "", dias: "", valorKwh: "" };
  // Solo usamos las lecturas si cuadran con el consumo: si no, el formulario
  // recalcularía un valor distinto al que la persona revisó.
  const porLecturas = consumoPorLecturas(d);
  const cuadran = porLecturas !== null && d.consumoKwh !== null && Math.abs(porLecturas - d.consumoKwh) <= Math.max(1, d.consumoKwh * 0.01);
  return {
    periodo: d.periodo ?? mesActual(),
    kwh: txt(d.consumoKwh),
    anterior: cuadran ? txt(d.lecturaAnterior) : "",
    actual: cuadran ? txt(d.lecturaActual) : "",
    factor: cuadran ? txt(d.factorMultiplicador) : "",
    dias: txt(d.diasFacturados),
    valorKwh: txt(d.valorKwh),
  };
}

export default function ConsumoForm({ hogar, registros, parametros, lectura, metodo, onGuardado, onHogar, onTerminar }: Props) {
  const [c, setC] = useState<Campos>(() => camposIniciales(lectura));
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [guardadoMes, setGuardadoMes] = useState<string | null>(null);
  const [avisoTraza, setAvisoTraza] = useState("");
  const [importados, setImportados] = useState<number | null>(null);
  // Por defecto se guardan también los meses anteriores que trae la factura:
  // así la familia tiene su promedio (línea base) desde el primer día.
  const [conHistorico, setConHistorico] = useState(true);
  // Meses anteriores: una sola tabla editable, llena con lo que se leyó de
  // la factura; lo que falte (foto borrosa, columna mal leída) se escribe.
  const [aMano, setAMano] = useState<Record<string, { kwh: string; dias: string }>>({});

  const set = (k: keyof Campos, v: string) => {
    setC((x) => ({ ...x, [k]: v }));
    setError("");
  };

  const porLecturas = useMemo(() => {
    if (c.anterior === "" || c.actual === "") return null;
    return consumoPorLecturas({
      lecturaAnterior: Number(c.anterior),
      lecturaActual: Number(c.actual),
      factorMultiplicador: c.factor ? Number(c.factor) : null,
    });
  }, [c.anterior, c.actual, c.factor]);

  const existeMes = registros.some((r) => r.periodo === c.periodo);
  const d = lectura?.datos;
  const hogarDistinto = d && ((d.estrato && d.estrato !== hogar.estrato) || (d.municipio && d.municipio.toLowerCase() !== hogar.municipio.toLowerCase()));
  const historicoNuevo = (d?.historico ?? []).filter((p) => p.periodo < c.periodo && !registros.some((r) => r.periodo === p.periodo));
  // ¿Mensual o bimestral? El salto entre los meses que trae la factura
  // (Celsia en fincas: SEP NOV ENE… = cada 2 meses). Sin datos: mensual.
  const leidos = new Map(historicoNuevo.map((p) => [p.periodo, p]));
  const aIndice = (p: string) => Number(p.slice(0, 4)) * 12 + Number(p.slice(5, 7)) - 1;
  const saltos = [...(d?.historico ?? []).map((p) => p.periodo), c.periodo]
    .sort()
    .map((p, i, arr) => (i ? aIndice(p) - aIndice(arr[i - 1]) : 0))
    .filter((x) => x > 0 && x <= 3);
  const salto = saltos.length ? [...saltos].sort((x, y) => saltos.filter((v) => v === y).length - saltos.filter((v) => v === x).length)[0] : 1;
  const diasTipicos = salto > 1 ? Math.round(salto * 30.4) : null;
  const mesesPrevios: string[] = [];
  let mesFila = c.periodo;
  for (let k = 0; k < 6; k++) {
    for (let j = 0; j < salto; j++) mesFila = mesAnterior(mesFila);
    if (!registros.some((r) => r.periodo === mesFila)) mesesPrevios.unshift(mesFila);
  }
  const valorFila = (m: string) => ({
    kwh: aMano[m]?.kwh ?? (leidos.has(m) ? String(leidos.get(m)!.kwh) : ""),
    dias: aMano[m]?.dias ?? (leidos.get(m)?.dias !== undefined ? String(leidos.get(m)!.dias) : diasTipicos && leidos.size ? String(diasTipicos) : ""),
  });
  const escritos = mesesPrevios
    .filter((m) => valorFila(m).kwh)
    .map((m) => ({ periodo: m, kwh: Number(valorFila(m).kwh), dias: valorFila(m).dias ? Number(valorFila(m).dias) : undefined }));
  const ponerAMano = (m: string, campo: "kwh" | "dias", v: string) =>
    setAMano((x) => ({ ...x, [m]: { ...valorFila(m), ...x[m], [campo]: v } }));

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const kwh = porLecturas ?? Number(c.kwh);
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(c.periodo)) return setError("Selecciona el mes del periodo.");
    if (c.periodo > mesActual()) return setError("El periodo no puede ser un mes futuro.");
    if (c.anterior !== "" && c.actual !== "" && porLecturas === null) return setError("Las lecturas no son coherentes: revisa la anterior y la actual.");
    if (!Number.isFinite(kwh) || kwh <= 0 || kwh >= 5000) return setError("Ingresa un consumo válido en kWh (entre 1 y 4999).");
    const dias = c.dias ? Number(c.dias) : null;
    if (dias !== null && (!Number.isInteger(dias) || dias < 1 || dias > 120)) return setError("Los días facturados deben estar entre 1 y 120.");
    for (const p of escritos) {
      if (!Number.isFinite(p.kwh) || p.kwh <= 0 || p.kwh >= 5000) return setError(`Revisa los kWh de ${nombreMes(p.periodo)} (entre 1 y 4999).`);
      if (p.dias !== undefined && (!Number.isInteger(p.dias) || p.dias < 1 || p.dias > 120)) return setError(`Revisa los días de ${nombreMes(p.periodo)} (entre 1 y 120).`);
    }

    const nuevo: NuevoRegistro = {
      periodo: c.periodo,
      consumo_kwh: Math.round(kwh * 100) / 100,
      dias,
      lectura_anterior: c.anterior ? Number(c.anterior) : null,
      lectura_actual: c.actual ? Number(c.actual) : null,
      valor_kwh: c.valorKwh ? Number(c.valorKwh) : null,
      fuente: lectura ? "factura" : "manual",
    };

    setGuardando(true);
    try {
      const id = await guardarRegistro(hogar.id, nuevo);
      if (lectura) {
        // La traza es evidencia, no bloquea: si falla, el consumo ya quedó guardado.
        await registrarFactura(hogar.id, id, metodo ?? lectura.fuente, lectura.confianzaConsumo, lectura.datos, nuevo).catch(() =>
          setAvisoTraza("El consumo se guardó, pero no la traza de la lectura.")
        );
      }
      const meses = conHistorico ? escritos : [];
      if (meses.length) {
        // Tampoco bloquea: si falla, se puede reintentar con el botón de después.
        try {
          setImportados(await importarHistorico(hogar.id, meses));
        } catch {
          setAvisoTraza("El consumo se guardó, pero no los meses anteriores. Puedes intentarlo de nuevo abajo.");
        }
      }
      await onGuardado();
      setGuardadoMes(c.periodo);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const importar = async () => {
    setError("");
    try {
      const n = await importarHistorico(hogar.id, historicoNuevo);
      await onGuardado();
      setImportados(n);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const actualizarHogar = async () => {
    if (!d) return;
    try {
      const h = await guardarHogar({ ...hogar, estrato: d.estrato ?? hogar.estrato, municipio: d.municipio ?? hogar.municipio });
      onHogar(h);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (guardadoMes) {
    const registro = registros.find((r) => r.periodo === guardadoMes);
    return (
      <>
        <section className="success-card">
          <div className="success-icon">✓</div>
          <div>
            <span className="section-kicker">CONSUMO GUARDADO</span>
            <h2>{nombreMes(guardadoMes)}</h2>
            {avisoTraza && <p>{avisoTraza}</p>}
          </div>
        </section>

        {registro && <ResultadoMes registro={registro} hogar={hogar} registros={registros} parametros={parametros} />}

        {historicoNuevo.length > 0 && importados === null && (
          <section className="intro-card">
            <span className="section-kicker">HISTÓRICO DE LA FACTURA</span>
            <h2>La factura trae {historicoNuevo.length} meses anteriores.</h2>
            <p>Si los agregas, ya tendrás tu línea base y podrás proponer una meta hoy mismo.</p>
            <button className="primary-button full-button" onClick={importar}>Agregar meses anteriores</button>
          </section>
        )}
        {importados !== null && (
          <div className="calculated-note">
            <strong>{importados} {importados === 1 ? "mes anterior agregado" : "meses anteriores agregados"} desde la factura</strong>
            <span>Con ellos ElectriCOs calcula tu promedio y ya puedes proponer una meta en la pestaña Meta.</span>
          </div>
        )}

        {hogarDistinto && (
          <div className="info-note">
            <strong>La factura dice otra cosa</strong>
            <span>
              Según la factura: {d?.municipio ?? hogar.municipio}, estrato {d?.estrato ?? hogar.estrato}. Tu hogar tiene {hogar.municipio}, estrato {hogar.estrato}.
            </span>
            <button className="secondary-button" onClick={actualizarHogar}>Usar los datos de la factura</button>
          </div>
        )}

        {error && <div className="error-message" role="alert">{error}</div>}
        <button className="primary-button full-button" onClick={onTerminar}>Listo</button>
      </>
    );
  }

  return (
    <form className="form-card" onSubmit={enviar} noValidate>
      <div className="form-section">
        <h3>{lectura ? "Revisa lo que leímos" : "Consumo del mes"}</h3>
        <label>
          Mes del periodo
          <input type="month" value={c.periodo} max={mesActual()} onChange={(e) => set("periodo", e.target.value)} />
          <span className="field-help">El mes en que termina el periodo facturado.</span>
        </label>
        {existeMes && <div className="aviso aviso-revisar"><span aria-hidden="true">!</span><p>Ya hay un consumo de {nombreMes(c.periodo)}. Si guardas, se reemplaza.</p></div>}

        <div className="field-grid">
          <label>
            Lectura anterior
            <input type="number" min={0} step="1" value={c.anterior} onChange={(e) => set("anterior", e.target.value)} placeholder="Opcional" inputMode="numeric" />
          </label>
          <label>
            Lectura actual
            <input type="number" min={0} step="1" value={c.actual} onChange={(e) => set("actual", e.target.value)} placeholder="Opcional" inputMode="numeric" />
          </label>
        </div>
        {porLecturas !== null ? (
          <div className="calculated-note"><strong>{porLecturas} kWh</strong><span>Consumo = lectura actual − lectura anterior{c.factor && c.factor !== "1" ? ` × ${c.factor}` : ""}.</span></div>
        ) : (
          <label>
            Consumo (kWh)
            <input type="number" min={1} step="0.01" value={c.kwh} onChange={(e) => set("kwh", e.target.value)} placeholder="Ej. 186" inputMode="decimal" />
            <span className="field-help">Si escribes las lecturas del medidor, ElectriCOs calcula el consumo.</span>
          </label>
        )}

        <div className="field-grid">
          <label>
            Días facturados
            <input type="number" min={1} max={120} value={c.dias} onChange={(e) => set("dias", e.target.value)} placeholder="Opcional" inputMode="numeric" />
          </label>
          <label>
            Valor del kWh ($)
            <input type="number" min={0} step="0.0001" value={c.valorKwh} onChange={(e) => set("valorKwh", e.target.value)} placeholder="Opcional" inputMode="decimal" />
          </label>
        </div>
      </div>

      {mesesPrevios.length > 0 && (
        <div className="form-section historico-factura">
          <h3>Meses anteriores{salto > 1 ? " (cobro cada 2 meses)" : ""}</h3>
          <p className="field-help">
            {leidos.size === 0
              ? lectura
                ? "No pudimos leer los meses anteriores. Búscalos en la tabla o gráfico de \"últimos consumos\" de la factura y escríbelos: así tendrás tu promedio de una vez."
                : "Si tienes los consumos de meses anteriores, escríbelos aquí y tendrás tu promedio de una vez."
              : leidos.size < mesesPrevios.length
                ? `Leímos ${leidos.size} de ${mesesPrevios.length} en la factura. Revísalos y completa los que falten mirando la factura.`
                : "Estos son los que trae la factura. Revísalos; puedes corregir cualquier número."}
          </p>
          <table className="tabla-a-mano">
            <thead>
              <tr><th>Mes</th><th>kWh</th><th>Días</th></tr>
            </thead>
            <tbody>
              {mesesPrevios.map((m) => {
                const v = valorFila(m);
                return (
                  <tr key={m} className={leidos.has(m) && aMano[m] === undefined ? "leido" : ""}>
                    <td>{nombreMes(m)}</td>
                    <td>
                      <input type="number" inputMode="numeric" min={1} max={4999} aria-label={`kWh de ${nombreMes(m)}`} value={v.kwh} onChange={(e) => ponerAMano(m, "kwh", e.target.value)} placeholder="kWh" />
                    </td>
                    <td>
                      <input type="number" inputMode="numeric" min={1} max={120} aria-label={`Días de ${nombreMes(m)}`} value={v.dias} onChange={(e) => ponerAMano(m, "dias", e.target.value)} placeholder="días" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {escritos.length > 0 && (
            <label className="check-row">
              <input type="checkbox" checked={conHistorico} onChange={(e) => setConHistorico(e.target.checked)} />
              <span>Guardar también estos {escritos.length} {escritos.length === 1 ? "mes" : "meses"} (recomendado)</span>
            </label>
          )}
        </div>
      )}

      {error && <div className="error-message" role="alert">{error}</div>}
      <button className="primary-button" type="submit" disabled={guardando}>{guardando ? "Guardando…" : "Guardar consumo"}</button>
    </form>
  );
}
