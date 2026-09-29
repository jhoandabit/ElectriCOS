"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { leerFactura } from "../lib/factura/leer-factura";
import { leerRecuadro, type Recuadro, type ResultadoGuiado } from "../lib/factura/ocr-guiado";
import { esIOS, precargarLector } from "../lib/factura/ocr-paddle";
import type { AvisoLectura, DatosFactura, FuenteLectura, ResultadoLectura } from "../lib/factura/tipos";
import { validarYCompletar } from "../lib/factura/validar";
import SelectorRecuadro from "./SelectorRecuadro";

export type MetodoLectura = FuenteLectura | "guiada";

const ETIQUETA_FUENTE: Record<MetodoLectura, string> = {
  "pdf-texto": "Texto del PDF",
  "ocr-local": "Lectura de la foto",
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

type Props = {
  onUsar: (lectura: ResultadoLectura, metodo: MetodoLectura) => void;
  /** La página se recargó mientras la persona elegía la foto (pasa en iPhone). */
  recargada?: boolean;
};

/**
 * Marca "eligiendo foto". Si el celular recarga la página mientras la cámara
 * está abierta, al volver la app regresa a esta pantalla en vez de a Inicio.
 */
export const MARCA_ELIGIENDO = "electricos-eligiendo-foto";
const marcar = () => {
  try {
    localStorage.setItem(MARCA_ELIGIENDO, String(Date.now()));
  } catch {
    /* navegación privada: no pasa nada */
  }
};
const desmarcar = () => {
  try {
    localStorage.removeItem(MARCA_ELIGIENDO);
  } catch {
    /* sin almacenamiento */
  }
};

export default function InvoiceScanner({ onUsar, recargada = false }: Props) {
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

  // Empieza a descargar el lector de fotos mientras la persona elige el archivo.
  useEffect(() => {
    precargarLector();
  }, []);

  // Libera la memoria de la vista previa al salir o al cambiar de foto.
  useEffect(() => () => { if (vistaPrevia) URL.revokeObjectURL(vistaPrevia); }, [vistaPrevia]);

  const [partes, setPartes] = useState(0);

  const esPdfArchivo = (f: File) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");

  /**
   * Lee una o varias fotos. Varias fotos se tratan como PARTES de la misma
   * factura (encabezado, energía, resumen…): sus textos se unen.
   * Con `sumar`, se agregan a lo que ya se leyó.
   */
  const leerArchivos = async (files: File[], sumar: boolean) => {
    if (!files.length) return;
    const pdf = files.find(esPdfArchivo);
    if (pdf && files.length > 1) {
      setError("Elige un solo PDF, o varias fotos de la misma factura.");
      return;
    }
    if (!pdf && files.some((f) => !f.type.startsWith("image/"))) {
      setError("Selecciona una foto o un PDF de la factura.");
      return;
    }

    const ultimo = files[files.length - 1];
    setArchivo(ultimo);
    // La foto original NO se muestra (en iPhone pesa ≈ 50 MB en memoria);
    // al terminar se muestra la versión reducida que usó el lector.
    setVistaPrevia("");
    setGuiaAbierta(false);
    setRecuadro(null);
    setGuiado(null);
    setError("");
    setLeyendo(true);
    setEstado("Preparando la factura…");

    try {
      let previo = sumar && lectura?.fuente === "ocr-local" ? lectura.textoTecnico ?? "" : "";
      let resultado: ResultadoLectura | null = null;
      let n = sumar ? partes : 0;
      for (const [i, file] of files.entries()) {
        const aviso = files.length > 1 ? `Parte ${i + 1} de ${files.length}: ` : sumar ? `Parte ${n + 1}: ` : "";
        resultado = await leerFactura(file, (m) => setEstado(aviso + m), previo);
        previo = resultado.textoTecnico ?? previo;
        n += 1;
      }
      if (!resultado) return;
      if (resultado.miniatura) setVistaPrevia(resultado.miniatura);
      setPartes(pdf ? 0 : n);
      if (n > 1) {
        resultado = {
          ...resultado,
          avisos: [{ nivel: "ok", campo: "general", mensaje: `Se unieron ${n} partes de la factura.` }, ...resultado.avisos],
        };
      }
      setLectura(resultado);
      setMetodo(resultado.fuente);
      if (!pdf && resultado.confianzaConsumo < 80 && n === 1) setGuiaAbierta(true);
    } catch (e) {
      setError((e as Error).message || "No fue posible leer la factura. Puedes ingresar los datos a mano.");
    } finally {
      desmarcar();
      setLeyendo(false);
      setEstado("");
    }
  };

  const elegirArchivo = (sumar: boolean) => (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ""; // permite volver a elegir el mismo archivo
    if (!files.length) desmarcar();
    if (!sumar) setLectura(null);
    void leerArchivos(files, sumar);
  };

  const leerFilaMedidor = async () => {
    if (!archivo || !recuadro || !lectura) return;
    setLeyendo(true);
    setError("");
    try {
      // En iPhone se recorta la foto reducida: abrir otra vez la original
      // (12–24 MP) puede dejar a Safari sin memoria.
      const fuente =
        esIOS() && vistaPrevia
          ? new File([await (await fetch(vistaPrevia)).blob()], "factura.jpg", { type: "image/jpeg" })
          : archivo;
      const r = await leerRecuadro(fuente, recuadro, setEstado);
      setGuiado(r);
      const nuevos = r.datos;
      if (!Object.keys(nuevos).length) {
        setError(
          "No encontramos datos en esa parte. Encierra una sola línea: la fila del medidor (Activa) o la del periodo y los días. Si tampoco funciona, escribe los datos mirando la imagen ampliada."
        );
        return;
      }
      // Lo leído en el recorte reemplaza lo que faltaba o era estimado.
      const datos: DatosFactura = {
        ...lectura.datos,
        ...nuevos,
        periodoEstimado: nuevos.periodo ? false : lectura.datos.periodoEstimado,
        diasEstimados: nuevos.diasFacturados ? false : lectura.datos.diasEstimados,
      };
      const encontrados = [
        nuevos.consumoKwh !== undefined && "lecturas y consumo",
        nuevos.periodo && "periodo",
        nuevos.diasFacturados && "días facturados",
        nuevos.estrato && "estrato",
        nuevos.historico && `${nuevos.historico.length} meses anteriores`,
      ].filter(Boolean);
      const v = validarYCompletar(datos);
      setLectura({
        ...lectura,
        datos: v.datos,
        confianzaConsumo: v.confianzaConsumo,
        avisos: [{ nivel: "ok", campo: "general", mensaje: `Tomado de la parte que encerraste: ${encontrados.join(", ")}.` }, ...v.avisos],
      });
      if (nuevos.consumoKwh !== undefined) setMetodo("guiada");
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

      {recargada && !lectura && !leyendo && (
        <div className="info-note" role="status">
          <strong>Vuelve a elegir la foto</strong>
          <span>
            El celular recargó la página mientras elegías o leías la foto (le faltó memoria). Elígela otra vez. Si vuelve a pasar, cierra
            otras pestañas y apps, toma la foto con la cámara normal del celular y súbela desde <b>Galería</b>, o tómala por partes.
          </span>
        </div>
      )}

      <section className="scanner-card">
        <div className={"fuente-grid" + (leyendo ? " is-disabled" : "")}>
          <label className="fuente-boton">
            <input type="file" accept="image/*" capture="environment" onClick={marcar} onChange={elegirArchivo(false)} disabled={leyendo} />
            <span aria-hidden="true">📷</span>
            <strong>Tomar foto</strong>
          </label>
          <label className="fuente-boton">
            <input type="file" accept="image/*" multiple onClick={marcar} onChange={elegirArchivo(false)} disabled={leyendo} />
            <span aria-hidden="true">🖼️</span>
            <strong>Galería</strong>
          </label>
          <label className="fuente-boton">
            <input type="file" accept="application/pdf,.pdf" onClick={marcar} onChange={elegirArchivo(false)} disabled={leyendo} />
            <span aria-hidden="true">📄</span>
            <strong>PDF</strong>
          </label>
        </div>
        <small className="fuente-ayuda">
          El PDF que descargas de la empresa es lo más preciso. Si usas foto: de frente, completa, con buena luz y sin
          sombras. Si la factura no se ve bien en una sola foto, tómala <b>por partes</b> (encabezado, energía,
          resumen): en Galería puedes elegir varias a la vez. La foto se lee dentro de tu celular y no se envía a
          ningún servidor.
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
            <span className="section-kicker">LECTURA GUIADA</span>
            <h3>{lectura && lectura.confianzaConsumo < 55 ? "No pudimos leer el consumo. Ayúdanos:" : "Encierra la parte que falta"}</h3>
            <p>
              Arrastra el dedo sobre la foto para encerrar <b>una sola línea</b>, con un poco de margen:
            </p>
            <ul className="guia-opciones">
              <li>la fila <b>Activa</b> (número del medidor, lecturas y consumo),</li>
              <li>la línea <b>Periodo facturado</b> y <b>Días facturados</b>, o</li>
              <li>la tabla de <b>consumos de los últimos meses</b>.</li>
            </ul>
            <SelectorRecuadro src={vistaPrevia} valor={recuadro} onCambio={setRecuadro} />
            <div className="button-row">
              <button className="secondary-button" type="button" onClick={() => setGuiaAbierta(false)} disabled={leyendo}>
                Cancelar
              </button>
              <button className="primary-button" type="button" onClick={leerFilaMedidor} disabled={!recuadro || leyendo}>
                Leer esta parte
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
              <div className={clase(Boolean(d.periodo) && !d.periodoEstimado)}>
                <span>Periodo{d.periodoEstimado ? " (estimado)" : ""}</span>
                <strong>{campo(d.periodo)}</strong>
              </div>
              <div className={clase(d.diasFacturados !== null && !d.diasEstimados)}>
                <span>Días facturados{d.diasEstimados ? " (supuesto)" : ""}</span>
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
          <label className="secondary-button full-button boton-archivo">
            <input type="file" accept="image/*" multiple onClick={marcar} onChange={elegirArchivo(true)} />
            ➕ Agregar otra parte de la factura (foto){partes > 1 ? ` · ${partes} partes leídas` : ""}
          </label>
        )}

        {vistaPrevia && lectura && !leyendo && !guiaAbierta && (
          <button className="secondary-button full-button" type="button" onClick={() => setGuiaAbierta(true)}>
            {lectura.confianzaConsumo >= 80 ? "Leer una parte de la factura (periodo, días o medidor)" : "Leer la fila del medidor"}
          </button>
        )}

        {guiado && (
          <div className="guia-recorte">
            <span className="metric-label">PARTE LEÍDA (AMPLIADA)</span>
            <img src={guiado.recorteUrl} alt="Recorte ampliado de la parte que encerraste" />
            {!Object.keys(guiado.datos).length && <small>Si no se lee bien, escribe los datos en el formulario mirando esta imagen.</small>}
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
