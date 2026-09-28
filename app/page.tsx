"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { leerFactura } from "./lib/factura/leer-factura";
import type { AvisoLectura, DatosFactura, FuenteLectura, ResultadoLectura } from "./lib/factura/tipos";
import { consumoPorLecturas } from "./lib/factura/validar";

type Screen = "home" | "manual" | "invoice";
type FormState = {
  municipality: string;
  estrato: string;
  people: string;
  period: string;
  kwh: string;
  previous: string;
  current: string;
  days: string;
  factor: string;
};

const emptyForm: FormState = {
  municipality: "",
  estrato: "",
  people: "1",
  period: "",
  kwh: "",
  previous: "",
  current: "",
  days: "",
  factor: "",
};

const texto = (v: number | string | null | undefined) => (v === null || v === undefined ? "" : String(v));

function formularioDesdeFactura(d: DatosFactura): Partial<FormState> {
  const campos: Partial<FormState> = {
    municipality: texto(d.municipio),
    estrato: texto(d.estrato),
    period: texto(d.periodo),
    kwh: texto(d.consumoKwh),
    days: texto(d.diasFacturados),
    factor: texto(d.factorMultiplicador),
  };

  // Solo pasamos las lecturas si cuadran con el consumo; si no, el formulario
  // recalcularía un valor distinto al que la persona ya revisó.
  const porLecturas = consumoPorLecturas(d);
  if (porLecturas !== null && d.consumoKwh !== null && Math.abs(porLecturas - d.consumoKwh) <= Math.max(1, d.consumoKwh * 0.01)) {
    campos.previous = texto(d.lecturaAnterior);
    campos.current = texto(d.lecturaActual);
  }

  // No borramos lo que la persona ya escribió con campos vacíos.
  return Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== "")) as Partial<FormState>;
}

const ETIQUETA_FUENTE: Record<FuenteLectura, string> = {
  ia: "Lectura inteligente",
  "pdf-texto": "Texto del PDF",
  "ocr-local": "Lectura sin conexión",
  manual: "Manual",
};

function Aviso({ aviso }: { aviso: AvisoLectura }) {
  const icono = aviso.nivel === "ok" ? "✓" : aviso.nivel === "revisar" ? "!" : "✕";
  return (
    <li className={"aviso aviso-" + aviso.nivel}>
      <span aria-hidden="true">{icono}</span>
      <p>{aviso.mensaje}</p>
    </li>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [form, setForm] = useState(emptyForm);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoicePreview, setInvoicePreview] = useState("");
  const [estado, setEstado] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const [lectura, setLectura] = useState<ResultadoLectura | null>(null);
  // Datos completos de la última factura (histórico, promedio, tarifa…)
  // para las siguientes etapas: diagnóstico, huella y metas.
  const [, setFacturaActual] = useState<DatosFactura | null>(null);

  const set = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError("");
  };

  const calculatedKwh = useMemo(() => {
    if (form.previous === "" || form.current === "") return null;
    const anterior = Number(form.previous);
    const actual = Number(form.current);
    if (!Number.isFinite(anterior) || !Number.isFinite(actual)) return null;
    return consumoPorLecturas({
      lecturaAnterior: anterior,
      lecturaActual: actual,
      factorMultiplicador: form.factor ? Number(form.factor) : null,
    });
  }, [form.previous, form.current, form.factor]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const kwh = calculatedKwh ?? Number(form.kwh);
    if (!form.municipality.trim()) return setError("Ingresa el municipio.");
    if (!form.estrato) return setError("Selecciona el estrato.");
    if (!form.period) return setError("Selecciona el periodo.");
    if (Number(form.people) < 1) return setError("El número de personas debe ser mayor o igual a 1.");
    if (!Number.isFinite(kwh) || kwh <= 0) return setError("Ingresa un consumo válido en kWh.");
    if (form.previous !== "" && form.current !== "" && calculatedKwh === null) {
      return setError("Las lecturas no son coherentes. Revisa la lectura anterior y la actual.");
    }
    setSaved(true);
  };

  const openManual = () => {
    setScreen("manual");
    setSaved(false);
    setError("");
  };

  const openInvoice = () => {
    setScreen("invoice");
    setError("");
  };

  const handleInvoiceFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite volver a elegir el mismo archivo
    if (!file) return;

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf && !file.type.startsWith("image/")) {
      setError("Selecciona una factura en imagen o PDF.");
      return;
    }

    if (invoicePreview) URL.revokeObjectURL(invoicePreview);
    setInvoiceFile(file);
    setInvoicePreview(isPdf ? "" : URL.createObjectURL(file));
    setLectura(null);
    setError("");
    setLeyendo(true);
    setEstado("Preparando la factura…");

    try {
      const resultado = await leerFactura(file, setEstado);
      setLectura(resultado);
      setFacturaActual(resultado.datos);
      setForm((actual) => ({ ...actual, ...formularioDesdeFactura(resultado.datos) }));
      setEstado("");
    } catch (e) {
      setError((e as Error).message || "No fue posible leer la factura. Puedes ingresar los datos a mano.");
      setEstado("");
    } finally {
      setLeyendo(false);
    }
  };

  const continueWithExtractedData = () => {
    setScreen("manual");
    setSaved(false);
    setError("");
  };

  if (screen === "invoice") {
    const d = lectura?.datos;
    const campo = (valor: string | number | null | undefined, sufijo = "") =>
      valor === null || valor === undefined || valor === "" ? "No detectado" : `${valor}${sufijo}`;
    const clase = (ok: boolean, principal = false) =>
      "detected-field " + (principal ? "primary " : "") + (ok ? "detected-ok" : "detected-missing");
    const confianza = lectura?.confianzaConsumo ?? 0;
    const nivelConfianza = confianza >= 80 ? "alta" : confianza >= 55 ? "media" : "baja";

    return (
      <main className="app-shell">
        <header className="mobile-header">
          <button className="icon-button" onClick={() => setScreen("home")} aria-label="Volver">←</button>
          <div><span className="eyebrow">ELECTRICOS</span><h1>Escanear factura</h1></div>
          <div className="header-mark">📷</div>
        </header>

        <section className="page-content">
          <div className="intro-card">
            <span className="section-kicker">LECTURA DE FACTURA</span>
            <h2>Fotografía o sube tu factura.</h2>
            <p>Funciona con Energía de Pereira, CHEC, Celsia, EPM y otras. ElectriCOs propone los datos y tú los confirmas.</p>
          </div>

          <section className="scanner-card">
            <label className={"camera-dropzone" + (leyendo ? " is-disabled" : "")}>
              <input
                type="file"
                accept="image/*,.pdf,application/pdf"
                onChange={handleInvoiceFile}
                disabled={leyendo}
              />
              <span className="camera-icon">📷</span>
              <strong>{invoiceFile ? "Elegir otra factura" : "Tomar foto o seleccionar factura"}</strong>
              <small>Foto (de frente, completa y con buena luz) o PDF descargado de la empresa.</small>
            </label>

            {invoicePreview && (
              <div className="invoice-preview">
                <img src={invoicePreview} alt="Vista previa de la factura seleccionada" />
              </div>
            )}

            {invoiceFile && !invoicePreview && (
              <div className="pdf-selected-card">
                <span className="pdf-icon">PDF</span>
                <div>
                  <strong>{invoiceFile.name}</strong>
                  <small>Factura en PDF</small>
                </div>
              </div>
            )}

            {leyendo && (
              <div className="ocr-status ocr-status-running" role="status">
                <span className="ocr-spinner" aria-hidden="true" />
                <span>{estado || "Analizando factura…"}</span>
              </div>
            )}

            {lectura && d && (
              <section className="detected-card" aria-label="Datos detectados">
                <div className="detected-header">
                  <div>
                    <span className="section-kicker">{ETIQUETA_FUENTE[lectura.fuente].toUpperCase()}</span>
                    <h3>{d.empresaNombre ?? "Datos encontrados"}</h3>
                  </div>
                  <span className={"detected-badge confianza-" + nivelConfianza}>Confianza {nivelConfianza}</span>
                </div>

                <div className="detected-grid">
                  <div className={clase(d.consumoKwh !== null, true)}>
                    <span>Consumo</span>
                    <strong>{campo(d.consumoKwh, " kWh")}</strong>
                  </div>
                  <div className={clase(Boolean(d.municipio))}>
                    <span>Municipio</span>
                    <strong>{campo(d.municipio)}</strong>
                  </div>
                  <div className={clase(d.estrato !== null)}>
                    <span>Estrato</span>
                    <strong>{campo(d.estrato)}</strong>
                  </div>
                  <div className={clase(Boolean(d.periodo))}>
                    <span>Periodo</span>
                    <strong>{campo(d.periodo)}</strong>
                  </div>
                  <div className={clase(d.diasFacturados !== null)}>
                    <span>Días facturados</span>
                    <strong>{campo(d.diasFacturados)}</strong>
                  </div>
                  <div className={clase(d.lecturaAnterior !== null && d.lecturaActual !== null)}>
                    <span>Lecturas</span>
                    <strong>
                      {d.lecturaAnterior !== null && d.lecturaActual !== null
                        ? `${d.lecturaAnterior} → ${d.lecturaActual}`
                        : "No detectadas"}
                    </strong>
                  </div>
                  {d.promedioKwh !== null && (
                    <div className="detected-field detected-ok">
                      <span>Promedio</span>
                      <strong>{d.promedioKwh} kWh</strong>
                    </div>
                  )}
                  {d.valorKwh !== null && (
                    <div className="detected-field detected-ok">
                      <span>Valor del kWh</span>
                      <strong>${d.valorKwh.toLocaleString("es-CO")}</strong>
                    </div>
                  )}
                </div>

                {d.historico.length > 0 && (
                  <div className="historico-mini" aria-label="Histórico de consumo">
                    <span className="metric-label">HISTÓRICO EN LA FACTURA</span>
                    <div className="historico-barras">
                      {(() => {
                        const max = Math.max(...d.historico.map((p) => p.kwh), d.consumoKwh ?? 0, 1);
                        return d.historico.map((p) => (
                          <div key={p.periodo} className="historico-barra" title={`${p.periodo}: ${p.kwh} kWh`}>
                            <i style={{ height: `${Math.max(6, (p.kwh / max) * 100)}%` }} />
                            <small>{p.periodo.slice(5)}</small>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                {lectura.avisos.length > 0 && (
                  <ul className="avisos">
                    {lectura.avisos.map((a, i) => <Aviso key={i} aviso={a} />)}
                  </ul>
                )}

                <button className="secondary-button full-button" onClick={continueWithExtractedData}>
                  Revisar y completar datos
                </button>
              </section>
            )}

            {lectura?.textoTecnico && (
              <details className="ocr-details">
                <summary>Ver texto técnico reconocido</summary>
                <pre>{lectura.textoTecnico}</pre>
              </details>
            )}
          </section>

          {error && <div className="error-message">{error}</div>}

          <div className="info-note">
            <strong>Importante</strong>
            <span>La lectura automática es una ayuda. Antes de guardar, verifica el consumo en kWh. La factura no se guarda: solo se usan los datos que confirmes.</span>
          </div>
        </section>

        <Nav screen={screen} onHome={() => setScreen("home")} onConsumption={openManual} />
      </main>
    );
  }

  if (screen === "manual") {
    return (
      <main className="app-shell">
        <header className="mobile-header">
          <button className="icon-button" onClick={() => setScreen("home")} aria-label="Volver">←</button>
          <div><span className="eyebrow">ELECTRICOS</span><h1>Mi consumo</h1></div>
          <div className="header-mark">⚡</div>
        </header>

        <section className="page-content">
          <div className="intro-card">
            <span className="section-kicker">REGISTRO DE CONSUMO</span>
            <h2>Verifica los datos de tu hogar.</h2>
            <p>Los datos pueden venir de una factura o ser ingresados manualmente.</p>
          </div>

          {saved ? (
            <section className="success-card">
              <div className="success-icon">✓</div>
              <div><span className="section-kicker">REGISTRO VALIDADO</span><h2>{calculatedKwh ?? Number(form.kwh)} kWh</h2><p>{form.period} · {form.municipality}</p></div>
            </section>
          ) : (
            <form className="form-card" onSubmit={submit}>
              <div className="form-section">
                <h3>Tu hogar</h3>
                <label>Municipio<input value={form.municipality} onChange={(e) => set("municipality", e.target.value)} placeholder="Ej. Cartago" /></label>
                <div className="field-grid">
                  <label>Estrato<select value={form.estrato} onChange={(e) => set("estrato", e.target.value)}><option value="">Seleccionar</option>{[1,2,3,4,5,6].map(n => <option key={n}>{n}</option>)}</select></label>
                  <label>Personas<input type="number" min="1" value={form.people} onChange={(e) => set("people", e.target.value)} inputMode="numeric" /></label>
                </div>
              </div>

              <div className="form-section">
                <h3>Consumo eléctrico</h3>
                <label>Periodo<input type="month" value={form.period} onChange={(e) => set("period", e.target.value)} /></label>
                <label>Consumo (kWh)<input type="number" min="0" step="0.01" value={form.kwh} onChange={(e) => set("kwh", e.target.value)} placeholder="Ej. 186" inputMode="decimal" disabled={calculatedKwh !== null} /><span className="field-help">Si ingresas las lecturas, ElectriCOs calculará los kWh automáticamente.</span></label>
                <div className="field-grid">
                  <label>Lectura anterior<input type="number" min="0" step="0.01" value={form.previous} onChange={(e) => set("previous", e.target.value)} placeholder="Opcional" inputMode="decimal" /></label>
                  <label>Lectura actual<input type="number" min="0" step="0.01" value={form.current} onChange={(e) => set("current", e.target.value)} placeholder="Opcional" inputMode="decimal" /></label>
                </div>
                {calculatedKwh !== null && <div className="calculated-note"><strong>{calculatedKwh} kWh</strong><span>Consumo calculado a partir de las lecturas.</span></div>}
                <label>Días facturados<input type="number" min="1" max="120" value={form.days} onChange={(e) => set("days", e.target.value)} placeholder="Opcional" inputMode="numeric" /></label>
              </div>

              {error && <div className="error-message">{error}</div>}
              <button className="primary-button" type="submit">Validar consumo</button>
            </form>
          )}

          {saved && (
            <section className="result-card">
              <span className="metric-label">CONSUMO DEL PERIODO</span>
              <strong className="metric-value">{calculatedKwh ?? Number(form.kwh)} kWh</strong>
              <div className="metric-row"><span>Personas</span><strong>{form.people}</strong></div>
              <div className="metric-row"><span>Estrato</span><strong>{form.estrato}</strong></div>
              <div className="metric-row"><span>Municipio</span><strong>{form.municipality}</strong></div>
              <div className="button-row"><button className="secondary-button" type="button" onClick={() => {setForm(emptyForm);setSaved(false);}}>Registrar otro mes</button><button className="primary-button" type="button" onClick={() => setScreen("home")}>Volver al inicio</button></div>
            </section>
          )}
        </section>

        <Nav screen={screen} onHome={() => setScreen("home")} onConsumption={openManual} />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="mobile-header home-header"><div><span className="eyebrow">EDUCACIÓN ENERGÉTICA</span><h1>ElectriCOs</h1></div><div className="header-mark">⚡</div></header>
      <section className="page-content home-content">
        <div className="hero-card"><span className="section-kicker">TU HOGAR</span><h2>Mide, comprende y transforma tu consumo.</h2><p>Registra una factura o ingresa tus datos manualmente para comenzar.</p></div>
        <section className="action-section"><div className="section-heading"><span className="section-kicker">PRIMER PASO</span><h2>¿Cómo registrarás tu consumo?</h2></div>
          <button className="action-card" onClick={openInvoice}><span className="action-icon">📷</span><span><strong>Escanear factura</strong><small>Tomar una foto o cargar una factura.</small></span><b>›</b></button>
          <button className="action-card" onClick={openManual}><span className="action-icon">✍️</span><span><strong>Ingresar manualmente</strong><small>Escribir el consumo directamente.</small></span><b>›</b></button>
        </section>
        <section className="preview-card"><div><span className="metric-label">LÍNEA BASE</span><strong>Se construirá con tus registros.</strong></div><span className="preview-icon">▥</span></section>
      </section>
      <Nav screen={screen} onHome={() => setScreen("home")} onConsumption={openManual} />
    </main>
  );
}

function Nav({ screen, onHome, onConsumption }: { screen: Screen; onHome: () => void; onConsumption: () => void }) {
  return <nav className="bottom-nav" aria-label="Navegación principal">
    <button className={"nav-item " + (screen === "home" ? "active" : "")} onClick={onHome}><span>⌂</span>Inicio</button>
    <button className={"nav-item " + (screen === "manual" ? "active" : "")} onClick={onConsumption}><span>▣</span>Consumo</button>
    <button className="nav-item" disabled><span>◎</span>Meta</button>
    <button className="nav-item" disabled><span>↗</span>Progreso</button>
  </nav>;
}

