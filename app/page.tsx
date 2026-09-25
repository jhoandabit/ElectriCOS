"use client";

import { FormEvent, useMemo, useState } from "react";

type Screen = "home" | "manual";
type FormState = {
  municipality: string; estrato: string; people: string; period: string; kwh: string;
  previous: string; current: string; days: string;
};

const emptyForm: FormState = {
  municipality: "", estrato: "", people: "1", period: "", kwh: "",
  previous: "", current: "", days: "",
};

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [form, setForm] = useState(emptyForm);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const set = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError("");
  };

  const calculatedKwh = useMemo(() => {
    if (form.previous === "" || form.current === "") return null;
    const a = Number(form.previous), b = Number(form.current);
    return Number.isFinite(a) && Number.isFinite(b) && b >= a ? Number((b - a).toFixed(2)) : null;
  }, [form.previous, form.current]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const kwh = calculatedKwh ?? Number(form.kwh);
    if (!form.municipality.trim()) return setError("Ingresa el municipio.");
    if (!form.estrato) return setError("Selecciona el estrato.");
    if (!form.period) return setError("Selecciona el periodo.");
    if (Number(form.people) < 1) return setError("El número de personas debe ser mayor o igual a 1.");
    if (!Number.isFinite(kwh) || kwh <= 0) return setError("Ingresa un consumo válido en kWh.");
    if (form.previous !== "" && form.current !== "" && Number(form.current) < Number(form.previous)) {
      return setError("La lectura actual no puede ser menor que la anterior.");
    }
    setSaved(true);
  };

  const openManual = () => {
    setScreen("manual");
    setSaved(false);
    setError("");
  };

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
            <span className="section-kicker">REGISTRO MANUAL</span>
            <h2>Registra el consumo de tu hogar.</h2>
            <p>Estos datos serán la base para calcular tu línea base, huella, meta y progreso.</p>
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
                <label>Consumo (kWh)<input type="number" min="0" step="0.01" value={form.kwh} onChange={(e) => set("kwh", e.target.value)} placeholder="Ej. 186" inputMode="decimal" disabled={calculatedKwh !== null} /><span className="field-help">También puedes ingresar las lecturas y ElectriCOs calculará los kWh.</span></label>
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
              <div className="button-row"><button className="secondary-button" onClick={() => {setForm(emptyForm);setSaved(false)}}>Registrar otro mes</button><button className="primary-button" onClick={() => setScreen("home")}>Volver al inicio</button></div>
            </section>
          )}
        </section>

        <Nav screen={screen} onHome={() => setScreen("home")} onConsumption={() => setScreen("manual")} />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="mobile-header home-header"><div><span className="eyebrow">EDUCACIÓN ENERGÉTICA</span><h1>ElectriCOs</h1></div><div className="header-mark">⚡</div></header>
      <section className="page-content home-content">
        <div className="hero-card"><span className="section-kicker">TU HOGAR</span><h2>Mide, comprende y transforma tu consumo.</h2><p>Registra una factura o ingresa tus datos manualmente para comenzar.</p></div>
        <section className="action-section"><div className="section-heading"><span className="section-kicker">PRIMER PASO</span><h2>¿Cómo registrarás tu consumo?</h2></div>
          <button className="action-card" onClick={openManual}><span className="action-icon">📷</span><span><strong>Escanear factura</strong><small>Tomar una foto o cargar una factura.</small></span><b>›</b></button>
          <button className="action-card" onClick={openManual}><span className="action-icon">✍️</span><span><strong>Ingresar manualmente</strong><small>Escribir el consumo directamente.</small></span><b>›</b></button>
        </section>
        <section className="preview-card"><div><span className="metric-label">LÍNEA BASE</span><strong>Se construirá con tus registros.</strong></div><span className="preview-icon">▥</span></section>
      </section>
      <Nav screen={screen} onHome={() => setScreen("home")} onConsumption={() => setScreen("manual")} />
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
