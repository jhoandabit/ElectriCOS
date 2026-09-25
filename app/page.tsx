"use client";

import { FormEvent, useMemo, useState } from "react";

type Screen = "home" | "manual";
type ConsumptionRecord = {
  municipality: string;
  estrato: string;
  people: number;
  period: string;
  kwh: number;
  previousReading: number | null;
  currentReading: number | null;
  billingDays: number | null;
};

const initialForm = {
  municipality: "",
  estrato: "",
  people: "1",
  period: "",
  kwh: "",
  previousReading: "",
  currentReading: "",
  billingDays: "",
};

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [form, setForm] = useState(initialForm);
  const [savedRecord, setSavedRecord] = useState<ConsumptionRecord | null>(null);
  const [error, setError] = useState("");

  const updateField = (field: keyof typeof initialForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const derivedKwh = useMemo(() => {
    const previous = Number(form.previousReading);
    const current = Number(form.currentReading);

    if (
      form.previousReading !== "" &&
      form.currentReading !== "" &&
      Number.isFinite(previous) &&
      Number.isFinite(current) &&
      current >= previous
    ) {
      return Number((current - previous).toFixed(2));
    }

    return null;
  }, [form.previousReading, form.currentReading]);

  const effectiveKwh = derivedKwh ?? Number(form.kwh);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const people = Number(form.people);
    const kwh = effectiveKwh;

    if (!form.municipality.trim()) {
      setError("Ingresa el municipio del hogar.");
      return;
    }

    if (!form.estrato) {
      setError("Selecciona el estrato residencial.");
      return;
    }

    if (!form.period) {
      setError("Selecciona el periodo de consumo.");
      return;
    }

    if (!Number.isFinite(people) || people < 1) {
      setError("El número de personas debe ser mayor o igual a 1.");
      return;
    }

    if (!Number.isFinite(kwh) || kwh <= 0) {
      setError("Ingresa un consumo válido en kWh.");
      return;
    }

    if (
      form.previousReading !== "" &&
      form.currentReading !== "" &&
      Number(form.currentReading) < Number(form.previousReading)
    ) {
      setError("La lectura actual no puede ser menor que la lectura anterior.");
      return;
    }

    const record: ConsumptionRecord = {
      municipality: form.municipality.trim(),
      estrato: form.estrato,
      people,
      period: form.period,
      kwh,
      previousReading:
        form.previousReading === "" ? null : Number(form.previousReading),
      currentReading:
        form.currentReading === "" ? null : Number(form.currentReading),
      billingDays: form.billingDays === "" ? null : Number(form.billingDays),
    };

    setSavedRecord(record);
    setError("");
  };

  const resetManual = () => {
    setForm(initialForm);
    setSavedRecord(null);
    setError("");
  };

  if (screen === "manual") {
    return (
      <main className="app-shell">
        <header className="mobile-header">
          <button className="icon-button" onClick={() => setScreen("home")} aria-label="Volver">
            ←
          </button>
          <div>
            <span className="eyebrow">ELECTRICOS</span>
            <h1>Mi consumo</h1>
          </div>
          <div className="header-mark">⚡</div>
        </header>

        <section className="page-content">
          <div className="intro-card">
            <span className="section-kicker">REGISTRO MANUAL</span>
            <h2>Registra tu consumo eléctrico</h2>
            <p>
              Estos datos alimentarán la línea base de tu hogar y los cálculos de
              huella, meta y progreso.
            </p>
          </div>

          {savedRecord ? (
            <section className="success-card" aria-live="polite">
              <div className="success-icon">✓</div>
              <div>
                <span className="section-kicker">REGISTRO PREPARADO</span>
                <h2>{savedRecord.kwh} kWh</h2>
                <p>
                  {savedRecord.period} · {savedRecord.municipality} · Estrato{" "}
                  {savedRecord.estrato}
                </p>
              </div>
            </section>
          ) : (
            <form className="form-card" onSubmit={handleSubmit}>
              <div className="form-section">
                <h3>Tu hogar</h3>

                <label>
                  Municipio
                  <input
                    value={form.municipality}
                    onChange={(event) => updateField("municipality", event.target.value)}
                    placeholder="Ej. Cartago"
                    autoComplete="address-level2"
                  />
                </label>

                <div className="field-grid">
                  <label>
                    Estrato
                    <select
                      value={form.estrato}
                      onChange={(event) => updateField("estrato", event.target.value)}
                    >
                      <option value="">Seleccionar</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                      <option value="5">5</option>
                      <option value="6">6</option>
                    </select>
                  </label>

                  <label>
                    Personas
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={form.people}
                      onChange={(event) => updateField("people", event.target.value)}
                      inputMode="numeric"
                    />
                  </label>
                </div>
              </div>

              <div className="form-section">
                <h3>Periodo y consumo</h3>

                <label>
                  Periodo de la factura
                  <input
                    type="month"
                    value={form.period}
                    onChange={(event) => updateField("period", event.target.value)}
                  />
                </label>

                <label>
                  Consumo eléctrico (kWh)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.kwh}
                    onChange={(event) => updateField("kwh", event.target.value)}
                    placeholder="Ej. 186"
                    inputMode="decimal"
                    disabled={derivedKwh !== null}
                  />
                  <span className="field-help">
                    Si ingresas las lecturas del medidor, calcularemos los kWh
                    automáticamente.
                  </span>
                </label>

                <div className="field-grid">
                  <label>
                    Lectura anterior
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.previousReading}
                      onChange={(event) =>
                        updateField("previousReading", event.target.value)
                      }
                      placeholder="Opcional"
                      inputMode="decimal"
                    />
                  </label>

                  <label>
                    Lectura actual
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.currentReading}
                      onChange={(event) =>
                        updateField("currentReading", event.target.value)
                      }
                      placeholder="Opcional"
                      inputMode="decimal"
                    />
                  </label>
                </div>

                {derivedKwh !== null && (
                  <div className="calculated-note">
                    <strong>{derivedKwh} kWh</strong>
                    <span>Consumo calculado a partir de las lecturas.</span>
                  </div>
                )}

                <label>
                  Días facturados
                  <input
                    type="number"
                    min="1"
                    max="120"
                    step="1"
                    value={form.billingDays}
                    onChange={(event) => updateField("billingDays", event.target.value)}
                    placeholder="Opcional"
                    inputMode="numeric"
                  />
                </label>
              </div>

              {error && <div className="error-message">{error}</div>}

              <button className="primary-button" type="submit">
                Guardar consumo
              </button>
            </form>
          )}

          {savedRecord && (
            <div className="result-card">
              <div>
                <span className="metric-label">CONSUMO REGISTRADO</span>
                <strong className="metric-value">{savedRecord.kwh} kWh</strong>
              </div>
              <div className="metric-row">
                <span>Personas</span>
                <strong>{savedRecord.people}</strong>
              </div>
              <div className="metric-row">
                <span>Periodo</span>
                <strong>{savedRecord.period}</strong>
              </div>
              <div className="metric-row">
                <span>Municipio</span>
                <strong>{savedRecord.municipality}</strong>
              </div>
              <div className="button-row">
                <button className="secondary-button" onClick={resetManual}>
                  Registrar otro mes
                </button>
                <button className="primary-button" onClick={() => setScreen("home")}>
                  Volver al inicio
                </button>
              </div>
            </div>
          )}
        </section>

        <nav className="bottom-nav" aria-label="Navegación principal">
          <button className="nav-item active" onClick={() => setScreen("home")}>
            <span>⌂</span>
            Inicio
          </button>
          <button className="nav-item" onClick={() => setScreen("manual")}>
            <span>▣</span>
            Consumo
          </button>
          <button className="nav-item" disabled>
            <span>◎</span>
            Meta
          </button>
          <button className="nav-item" disabled>
            <span>↗</span>
            Progreso
          </button>
        </nav>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="mobile-header home-header">
        <div>
          <span className="eyebrow">EDUCACIÓN ENERGÉTICA</span>
          <h1>ElectriCOs</h1>
        </div>
        <div className="header-mark">⚡</div>
      </header>

      <section className="page-content home-content">
        <div className="hero-card">
          <span className="section-kicker">TU HOGAR</span>
          <h2>Mide, comprende y transforma tu consumo.</h2>
          <p>
            Registra tu factura o ingresa el consumo manualmente. ElectriCOs
            convertirá esos datos en información útil para tu hogar.
          </p>
        </div>

        <section className="action-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">PRIMER PASO</span>
              <h2>Registra tu consumo</h2>
            </div>
          </div>

          <button className="action-card" onClick={() => setScreen("manual")}>
            <span className="action-icon">📷</span>
            <span>
              <strong>Escanear factura</strong>
              <small>Tomar una foto o cargar una factura.</small>
            </span>
            <b>›</b>
          </button>

          <button className="action-card" onClick={() => setScreen("manual")}>
            <span className="action-icon">✍️</span>
            <span>
              <strong>Ingresar manualmente</strong>
              <small>Escribir el consumo directamente.</small>
            </span>
            <b>›</b>
          </button>
        </section>

        <section className="preview-card">
          <div>
            <span className="metric-label">TU LÍNEA BASE</span>
            <strong>Próximamente</strong>
          </div>
          <span className="preview-icon">▥</span>
        </section>
      </section>

      <nav className="bottom-nav" aria-label="Navegación principal">
        <button className="nav-item active">
          <span>⌂</span>
          Inicio
        </button>
        <button className="nav-item" onClick={() => setScreen("manual")}>
          <span>▣</span>
          Consumo
        </button>
        <button className="nav-item" disabled>
          <span>◎</span>
          Meta
        </button>
        <button className="nav-item" disabled>
          <span>↗</span>
          Progreso
        </button>
      </nav>
    </main>
  );
}
