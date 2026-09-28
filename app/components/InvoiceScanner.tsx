"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { leerFactura } from "../lib/factura/leer-factura";
import { leerRecuadro, type Recuadro, type ResultadoGuiado } from "../lib/factura/ocr-guiado";
import type { AvisoLectura, DatosFactura, FuenteLectura, ResultadoLectura } from "../lib/factura/tipos";
import { validarYCompletar } from "../lib/factura/validar";
import SelectorRecuadro from "./SelectorRecuadro";

export type MetodoLectura = FuenteLectura | "guiada";

const ETIQUETA_FUENTE: Record<MetodoLectura, string> = {
  ia: "Lectura inteligente",
  "pdf-texto": "Texto del PDF",
  "ocr-local": "Lectura sin conexión",
  guiada: "Lectura guiada",
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

type Props = { onUsar: (lectura: ResultadoLectura, metodo: MetodoLectura) => void };

export default function InvoiceScanner({ onUsar }: Props) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState("");
  const [estado, setEstado] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const [lectura, setLectura] = useState<ResultadoLectura | null>(null);
  const [metodo, setMetodo] = useState<MetodoLectura>("ocr-local");
  const [error, setError] = useState("");
  const [guiaAbierta, setGuiaAbierta] = useState(false);
  const [recuadro, setRecuadro] = useState<Recuadro | null>(null);
  const [guiado, setGuiado] = useState<ResultadoGuiado | null>(null);
  const refGuia = useRef<HTMLElement>(null);

  // Al abrir la lectura guiada, llevar la pantalla hasta ella.
  useEffect(() => {
    if (guiaAbierta) refGuia.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [guiaAbierta]);

  // Libera la memoria de la vista previa al salir o al cambiar de foto.
  useEffect(() => () => { if (vistaPrevia) URL.revokeObjectURL(vistaPrevia); }, [vistaPrevia]);

  const elegirArchivo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite volver a elegir el mismo archivo
    if (!file) return;

    const esPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!esPdf && !file.type.startsWith("image/")) {
      setError("Selecciona una foto o un PDF de la factura.");
      return;
    }

    setArchivo(file);
    setVistaPrevia(esPdf ? "" : URL.createObjectURL(file));
    setLectura(null);
    setGuiaAbierta(false);
    setRecuadro(null);
    setGuiado(null);
    setError("");
    setLeyendo(true);
    setEstado("Preparando la factura…");

    try {
      const resultado = await leerFactura(file, setEstado);
      setLectura(resultado);
      setMetodo(resultado.fuente);
      if (!esPdf && resultado.fuente !== "ia" && resultado.confianzaConsumo < 80) setGuiaAbierta(true);
    } catch (e) {
      setError((e as Error).message || "No fue posible leer la factura. Puedes ingresar los datos a mano.");
    } finally {
      setLeyendo(false);
      setEstado("");
    }
  };

  const leerFilaMedidor = async () => {
    if (!archivo || !recuadro || !lectura) return;
    setLeyendo(true);
    setError("");
    try {
      const r = await leerRecuadro(archivo, recuadro, setEstado);
      setGuiado(r);
      if (!r.fila) {
        setError("No se encontraron las lecturas en ese recuadro. Encierra solo la fila del medidor (Activa) o escribe los números mirando la imagen ampliada.");
        return;
      }
      const datos: DatosFactura = {
        ...lectura.datos,
        lecturaAnterior: r.fila.lecturaAnterior,
        lecturaActual: r.fila.lecturaActual,
        consumoKwh: r.fila.consumoKwh,
        factorMultiplicador: r.fila.factorMultiplicador ?? lectura.datos.factorMultiplicador,
        promedioKwh: r.fila.promedioKwh ?? lectura.datos.promedioKwh,
      };
      const v = validarYCompletar(datos);
      setLectura({
        ...lectura,
        datos: v.datos,
        confianzaConsumo: v.confianzaConsumo,
        avisos: [{ nivel: "ok", campo: "consumoKwh", mensaje: "Lecturas tomadas de la fila que encerraste." }, ...v.avisos],
      });
      setMetodo("guiada");
      setGuiaAbierta(false);
    } catch (e) {
      setError((e as Error).message || "No fue posible leer el recuadro.");
    } finally {
      setLeyendo(false);
      setEstado("");
    }
  };

  const d = lectura?.datos;
  const campo = (valor: string | number | null | undefined, sufijo = "") =>
    valor === null || valor === undefined || valor === "" ? "No detectado" : `${valor}${sufijo}`;
  const clase = (ok: boolean, principal = false) =>
    "detected-field " + (principal ? "primary " : "") + (ok ? "detected-ok" : "detected-missing");
  const confianza = lectura?.confianzaConsumo ?? 0;
  const nivelConfianza = confianza >= 80 ? "alta" : confianza >= 55 ? "media" : "baja";

  return (
    <>
      <div className="intro-card">
        <span className="section-kicker">LECTURA DE FACTURA</span>
        <h2>Fotografía o sube tu factura.</h2>
        <p>Funciona con Energía de Pereira, CHEC, Celsia, EPM y otras. ElectriCOs propone los datos y tú los confirmas.</p>
      </div>

      <section className="scanner-card">
        <div className={"fuente-grid" + (leyendo ? " is-disabled" : "")}>
          <label className="fuente-boton">
            <input type="file" accept="image/*" capture="environment" onChange={elegirArchivo} disabled={leyendo} />
            <span aria-hidden="true">📷</span>
            <strong>Tomar foto</strong>
          </label>
          <label className="fuente-boton">
            <input type="file" accept="image/*" onChange={elegirArchivo} disabled={leyendo} />
            <span aria-hidden="true">🖼️</span>
            <strong>Galería</strong>
          </label>
          <label className="fuente-boton">
            <input type="file" accept="application/pdf,.pdf" onChange={elegirArchivo} disabled={leyendo} />
            <span aria-hidden="true">📄</span>
            <strong>PDF</strong>
          </label>
        </div>
        <small className="fuente-ayuda">
          El PDF que descargas de la empresa es lo más preciso. Si usas foto: de frente, completa, con buena luz y sin sombras.
        </small>

        {vistaPrevia && !guiaAbierta && (
          <div className="invoice-preview">
            <img src={vistaPrevia} alt="Vista previa de la factura seleccionada" />
          </div>
        )}

        {archivo && !vistaPrevia && (
          <div className="pdf-selected-card">
            <span className="pdf-icon">PDF</span>
            <div>
              <strong>{archivo.name}</strong>
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

        {vistaPrevia && guiaAbierta && (
          <section className="guia-card" aria-label="Lectura guiada" ref={refGuia}>
            <span className="section-kicker">LECTURA GUIADA · SIN INTERNET</span>
            <h3>{lectura && lectura.confianzaConsumo < 55 ? "No pudimos leer el consumo. Ayúdanos:" : "Encierra la fila del medidor"}</h3>
            <p>
              Arrastra el dedo sobre la foto para encerrar la fila <b>Activa</b>: la que tiene el número del medidor, la lectura
              actual, la anterior y el consumo. Deja un poco de margen.
            </p>
            <SelectorRecuadro src={vistaPrevia} valor={recuadro} onCambio={setRecuadro} />
            <div className="button-row">
              <button className="secondary-button" type="button" onClick={() => setGuiaAbierta(false)} disabled={leyendo}>
                Cancelar
              </button>
              <button className="primary-button" type="button" onClick={leerFilaMedidor} disabled={!recuadro || leyendo}>
                Leer esta fila
              </button>
            </div>
          </section>
        )}

        {lectura && d && (
          <section className="detected-card" aria-label="Datos detectados">
            <div className="detected-header">
              <div>
                <span className="section-kicker">{ETIQUETA_FUENTE[metodo].toUpperCase()}</span>
                <h3>{d.empresaNombre ?? "Datos encontrados"}</h3>
              </div>
              <span className={"detected-badge confianza-" + nivelConfianza}>Confianza {nivelConfianza}</span>
            </div>

            <div className="detected-grid">
              <div className={clase(d.consumoKwh !== null, true)}>
                <span>Consumo</span>
                <strong>{campo(d.consumoKwh, " kWh")}</strong>
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
                  {d.lecturaAnterior !== null && d.lecturaActual !== null ? `${d.lecturaAnterior} → ${d.lecturaActual}` : "No detectadas"}
                </strong>
              </div>
              <div className={clase(Boolean(d.municipio))}>
                <span>Municipio</span>
                <strong>{campo(d.municipio)}</strong>
              </div>
              <div className={clase(d.estrato !== null)}>
                <span>Estrato</span>
                <strong>{campo(d.estrato)}</strong>
              </div>
              {d.valorKwh !== null && (
                <div className="detected-field detected-ok">
                  <span>Valor del kWh</span>
                  <strong>${d.valorKwh.toLocaleString("es-CO", { maximumFractionDigits: 2 })}</strong>
                </div>
              )}
              {d.historico.length > 0 && (
                <div className="detected-field detected-ok">
                  <span>Meses anteriores</span>
                  <strong>{d.historico.length}</strong>
                </div>
              )}
            </div>

            {lectura.avisos.length > 0 && (
              <ul className="avisos">
                {lectura.avisos.map((a, i) => <Aviso key={i} aviso={a} />)}
              </ul>
            )}

            <button className="primary-button full-button" onClick={() => onUsar(lectura, metodo)}>
              Revisar y guardar
            </button>
          </section>
        )}

        {vistaPrevia && lectura && !leyendo && !guiaAbierta && (
          <button className="secondary-button full-button" type="button" onClick={() => setGuiaAbierta(true)}>
            {lectura.confianzaConsumo >= 80 ? "Corregir leyendo la fila del medidor" : "Leer la fila del medidor"}
          </button>
        )}

        {guiado && (
          <div className="guia-recorte">
            <span className="metric-label">FILA LEÍDA (AMPLIADA)</span>
            <img src={guiado.recorteUrl} alt="Recorte ampliado de la fila del medidor" />
            {!guiado.fila && <small>Si no se lee bien, escribe las lecturas en el formulario mirando esta imagen.</small>}
          </div>
        )}

        {lectura?.textoTecnico && (
          <details className="ocr-details">
            <summary>Ver texto técnico reconocido</summary>
            <pre>{lectura.textoTecnico}</pre>
          </details>
        )}
      </section>

      {error && <div className="error-message" role="alert">{error}</div>}

      <div className="info-note">
        <strong>Importante</strong>
        <span>La lectura automática es una ayuda: verifica el consumo antes de guardar. La factura no se guarda; solo los datos de consumo que confirmes.</span>
      </div>
    </>
  );
}
