"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";

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
};

function parseNumber(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function preprocessInvoiceImage(file: File, mode: "gray" | "binary") {
  return new Promise<Blob>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const maxWidth = 2600;
      const scale = Math.min(1.35, maxWidth / image.naturalWidth);
      const width = Math.max(1200, Math.round(image.naturalWidth * scale));
      const height = Math.round(image.naturalHeight * (width / image.naturalWidth));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        reject(new Error("No se pudo preparar la imagen."));
        return;
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, width, height);

      const imageData = context.getImageData(0, 0, width, height);
      const data = imageData.data;

      let sum = 0;
      const luminance = new Uint8Array(width * height);

      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const y = Math.round(
          0.299 * data[i] +
          0.587 * data[i + 1] +
          0.114 * data[i + 2]
        );
        luminance[p] = y;
        sum += y;
      }

      const mean = sum / luminance.length;

      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        let y = luminance[p];

        if (mode === "gray") {
          // Aumenta contraste sin destruir los trazos finos de la factura.
          y = Math.max(0, Math.min(255, Math.round((y - mean) * 1.55 + 128)));
        } else {
          // Binarización conservadora: evita que el fondo gris de la factura
          // se convierta en ruido negro.
          const threshold = mean - 8;
          y = luminance[p] < threshold ? 0 : 255;
        }

        data[i] = y;
        data[i + 1] = y;
        data[i + 2] = y;
        data[i + 3] = 255;
      }

      context.putImageData(imageData, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("No se pudo generar la imagen procesada."));
        },
        "image/jpeg",
        0.94
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo abrir la imagen."));
    };

    image.src = objectUrl;
  });
}

function scoreOcrText(text: string, confidence: number) {
  const normalized = text.toLowerCase();
  let score = confidence || 0;

  const usefulTerms = [
    "consumo",
    "energía",
    "energia",
    "kwh",
    "lectura",
    "actual",
    "anterior",
    "estrato",
    "periodo",
    "factura",
    "municipio",
    "total",
  ];

  for (const term of usefulTerms) {
    if (normalized.includes(term)) score += 4;
  }

  const numericMatches = text.match(/\b\d{2,4}(?:[.,]\d{1,2})?\b/g);
  score += Math.min(20, (numericMatches?.length ?? 0) * 1.5);

  return score;
}

function extractInvoiceData(text: string): Partial<FormState> {
  const clean = text.replace(/\r/g, " ").replace(/[|]/g, " ");
  const result: Partial<FormState> = {};

  const kwhPatterns = [
    /(?:consumo|energ[ií]a|kwh)[^\d]{0,35}(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:kwh)?/i,
    /(\d{1,4}(?:[.,]\d{1,2})?)\s*kwh\b/i,
  ];

  for (const pattern of kwhPatterns) {
    const match = clean.match(pattern);
    if (match) {
      const value = parseNumber(match[1]);
      if (value && value > 0 && value < 10000) {
        result.kwh = String(value);
        break;
      }
    }
  }

  const previous = clean.match(/(?:lectura\s+anterior|anterior)[^\d]{0,25}(\d{3,8})/i);
  const current = clean.match(/(?:lectura\s+actual|actual)[^\d]{0,25}(\d{3,8})/i);
  if (previous) result.previous = previous[1];
  if (current) result.current = current[1];

  const days = clean.match(/(?:d[ií]as|dias)\s*(?:facturados|facturados del periodo)?[^\d]{0,15}(\d{1,3})/i);
  if (days) result.days = days[1];

  const estrato = clean.match(/(?:estrato|clase)\s*(?:socioecon[oó]mico)?[^\d]{0,10}([1-6])/i);
  if (estrato) result.estrato = estrato[1];

  const period =
    clean.match(/(?:periodo|per[ií]odo)[^\d]{0,20}(\d{1,2})[\/-](\d{4})/i) ||
    clean.match(/(?:periodo|per[ií]odo)[^\d]{0,20}(\d{4})[\/-](\d{1,2})/i);

  if (period) {
    const first = Number(period[1]);
    const second = Number(period[2]);
    const year = first > 12 ? first : second;
    const month = first > 12 ? second : first;
    if (year >= 2020 && month >= 1 && month <= 12) {
      result.period = `${year}-${String(month).padStart(2, "0")}`;
    }
  }

  return result;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [form, setForm] = useState(emptyForm);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoicePreview, setInvoicePreview] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrRunning, setOcrRunning] = useState(false);

  const set = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError("");
  };

  const calculatedKwh = useMemo(() => {
    if (form.previous === "" || form.current === "") return null;
    const a = Number(form.previous);
    const b = Number(form.current);
    return Number.isFinite(a) && Number.isFinite(b) && b >= a
      ? Number((b - a).toFixed(2))
      : null;
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

  const openInvoice = () => {
    setScreen("invoice");
    setError("");
    setOcrStatus("");
  };

  const handleInvoiceFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Selecciona una imagen de la factura. El procesamiento PDF se incorporará después.");
      return;
    }

    setInvoiceFile(file);
    setInvoicePreview(URL.createObjectURL(file));
    setOcrText("");
    setOcrStatus("Factura lista. Pulsa “Leer factura”.");
    setError("");
  };

  const runOcr = async () => {
    if (!invoiceFile) {
      setError("Primero toma una foto o selecciona una imagen.");
      return;
    }

    setOcrRunning(true);
    setError("");
    setOcrText("");
    setOcrStatus("Preparando imagen para lectura…");

    let worker: Awaited<ReturnType<typeof import("tesseract.js").createWorker>> | null = null;

    try {
      const { createWorker, PSM } = await import("tesseract.js");

      worker = await createWorker("spa", 1, {
        logger: (message) => {
          if (message.status === "recognizing text" && typeof message.progress === "number") {
            setOcrStatus(`Analizando factura… ${Math.round(message.progress * 100)}%`);
          } else if (message.status) {
            setOcrStatus("Preparando reconocimiento…");
          }
        },
      });

      // PSM.AUTO es más apropiado para facturas completas con varias zonas.
      // Tesseract.js documenta que el aumento de resolución puede mejorar
      // notablemente el reconocimiento y permite ajustar el modo de segmentación.
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });

      const variants = [
        { name: "imagen mejorada", mode: "gray" as const },
        { name: "imagen de alto contraste", mode: "binary" as const },
      ];

      const results: Array<{ text: string; confidence: number; score: number; name: string }> = [];

      for (let index = 0; index < variants.length; index += 1) {
        const variant = variants[index];
        setOcrStatus(`Leyendo factura (${index + 1} de ${variants.length})…`);

        const processed = await preprocessInvoiceImage(invoiceFile, variant.mode);
        const result = await worker.recognize(processed);
        const text = result.data.text?.trim() ?? "";
        const confidence = typeof result.data.confidence === "number" ? result.data.confidence : 0;

        if (text) {
          results.push({
            text,
            confidence,
            score: scoreOcrText(text, confidence),
            name: variant.name,
          });
        }
      }

      if (!results.length) {
        setOcrStatus("No se encontró texto legible. Intenta con una foto completa, nítida y bien iluminada.");
        return;
      }

      results.sort((a, b) => b.score - a.score);
      const best = results[0];

      setOcrText(best.text);

      const extracted = extractInvoiceData(best.text);
      setForm((current) => ({ ...current, ...extracted }));

      if (best.confidence < 55) {
        setOcrStatus("Lectura realizada con baja confianza. Revisa los datos antes de continuar.");
      } else {
        setOcrStatus("Lectura terminada. Revisa y corrige los datos antes de guardar.");
      }
    } catch {
      setError("No fue posible procesar la factura. Puedes corregir los datos manualmente.");
      setOcrStatus("");
    } finally {
      if (worker) {
        await worker.terminate().catch(() => undefined);
      }
      setOcrRunning(false);
    }
  };

  const continueWithExtractedData = () => {
    setScreen("manual");
    setSaved(false);
    setError("");
  };

  if (screen === "invoice") {
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
            <h2>Fotografía tu factura.</h2>
            <p>La app leerá el texto de la imagen y propondrá los datos encontrados. Tú siempre los puedes corregir.</p>
          </div>

          <section className="scanner-card">
            <label className="camera-dropzone">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleInvoiceFile}
              />
              <span className="camera-icon">📷</span>
              <strong>Tomar foto o elegir una imagen</strong>
              <small>Usa una foto completa, bien iluminada y enfocada.</small>
            </label>

            {invoicePreview && (
              <div className="invoice-preview">
                <img src={invoicePreview} alt="Vista previa de la factura seleccionada" />
              </div>
            )}

            {invoiceFile && (
              <button className="primary-button" onClick={runOcr} disabled={ocrRunning}>
                {ocrRunning ? "Leyendo factura…" : "Leer factura"}
              </button>
            )}

            {ocrStatus && <div className="ocr-status">{ocrStatus}</div>}

            {ocrText && (
              <details className="ocr-details">
                <summary>Ver texto reconocido</summary>
                <pre>{ocrText}</pre>
              </details>
            )}

            {ocrText && (
              <button className="secondary-button full-button" onClick={continueWithExtractedData}>
                Revisar y completar datos
              </button>
            )}
          </section>

          {error && <div className="error-message">{error}</div>}

          <div className="info-note">
            <strong>Importante</strong>
            <span>El reconocimiento automático es una ayuda. Antes de guardar, verifica especialmente el valor de consumo en kWh.</span>
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
