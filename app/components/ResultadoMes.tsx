"use client";

import { useState, type ReactNode } from "react";
import { calcularLineaBase, comparacionConPromedio, comparacionSubsistencia, huellaKg, kwhMesNormalizado } from "../lib/calculos/motor";
import type { Parametro } from "../lib/calculos/parametros";
import { paraMotor, type Hogar, type RegistroConsumo } from "../lib/supabase/datos";
import { nombreMes } from "./formato";

type Props = {
  registro: RegistroConsumo;
  hogar: Hogar;
  registros: RegistroConsumo[];
  parametros: Record<string, Parametro>;
};

// Números como se escriben en Colombia: 1.234,5
const num = (n: number, decimales = 1) => n.toLocaleString("es-CO", { maximumFractionDigits: decimales });
const pesos = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
const precio = (n: number) => "$" + n.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Frase sobre el subsidio o la contribución según el estrato (Ley 142 de 1994). */
function fraseEstrato(estrato: number, subsistencia: number) {
  if (estrato <= 3) {
    return `En estrato ${estrato}, el Gobierno ayuda a pagar (subsidio) solo los primeros ${subsistencia} kWh. Lo que pase de ahí se paga a precio completo.`;
  }
  if (estrato === 4) return "En estrato 4 no hay subsidio ni recargo: toda la energía se paga a precio normal.";
  return `En estrato ${estrato} se paga un recargo del 20 % (contribución) que ayuda a pagar los subsidios de los estratos 1, 2 y 3.`;
}

/** Una imagen para sentir cuánto son esos kilos (es una comparación de peso, nada más). */
function comparacionPeso(kg: number) {
  if (kg >= 120) return "más de lo que pesa una persona adulta";
  if (kg >= 50) return "casi lo que pesa una persona adulta";
  if (kg >= 20) return "casi lo que pesa un niño";
  return "menos de lo que pesa un niño";
}

type Tarjeta = {
  id: string;
  icono: string;
  pregunta: string;
  valor: string;
  sub: string;
  tono?: "alerta" | "bien";
  detalle: ReactNode;
};

/**
 * Diagnóstico de un mes en seis tarjetas. Cerradas muestran la pregunta y el
 * número; al tocarlas (o con Enter) se amplían con la explicación y la cuenta.
 * Con mouse, al pasar por encima crecen un poco para invitar a tocarlas.
 */
export default function ResultadoMes({ registro, hogar, registros, parametros }: Props) {
  const [abierta, setAbierta] = useState<string | null>(null);

  const factor = parametros.factor_emision_sin;
  const subsistencia = parametros[hogar.sobre_1000_msnm ? "subsistencia_sobre_1000" : "subsistencia_bajo_1000"];

  const kwh = registro.consumo_kwh;
  const dias = registro.dias && registro.dias > 0 ? registro.dias : null;
  const normalizado = kwhMesNormalizado({ periodo: registro.periodo, kwh, dias });
  const huella = huellaKg(kwh, factor.valor);
  const personas = hogar.personas;
  // Promedio con los meses ANTERIORES a este, para comparar de forma justa.
  const lineaBase = calcularLineaBase(paraMotor(registros.filter((r) => r.periodo < registro.periodo)));
  const vsPromedio = lineaBase ? comparacionConPromedio(normalizado, lineaBase.promedio) : null;
  const vsSub = comparacionSubsistencia(normalizado, hogar.sobre_1000_msnm, parametros.subsistencia_bajo_1000.valor, parametros.subsistencia_sobre_1000.valor);
  const veces = normalizado / vsSub.referencia;
  const costo = registro.valor_kwh ? kwh * registro.valor_kwh : null;
  const tieneLecturas = registro.lectura_anterior !== null && registro.lectura_actual !== null;
  const escala = Math.max(normalizado, vsSub.referencia) * 1.05; // barras "lo básico vs. tu casa"

  const tarjetas: Tarjeta[] = [
    {
      id: "energia",
      icono: "⚡",
      pregunta: "¿Cuánta energía?",
      valor: `${num(kwh)} kWh`,
      sub: dias ? `en ${dias} días · ${num(kwh / dias)} por día` : "en el periodo facturado",
      detalle: (
        <>
          <p>
            El <b>kWh</b> (kilovatio-hora) es la unidad con que se mide la energía eléctrica. Aparece en tu factura como <b>consumo</b>.
          </p>
          {tieneLecturas && (
            <p className="cuenta">
              El contador pasó de {num(registro.lectura_anterior!, 0)} a {num(registro.lectura_actual!, 0)}:{" "}
              {num(registro.lectura_actual!, 0)} − {num(registro.lectura_anterior!, 0)} = <b>{num(kwh)} kWh</b>
            </p>
          )}
          {dias && dias !== 30 && (
            <p className="cuenta">
              Los meses no duran lo mismo. Para comparar, lo llevamos a 30 días: {num(kwh)} ÷ {dias} × 30 = <b>{num(normalizado)} kWh</b>
            </p>
          )}
        </>
      ),
    },
    ...(costo !== null
      ? [
          {
            id: "costo",
            icono: "💵",
            pregunta: "¿Cuánto costó?",
            valor: pesos(costo),
            sub: dias ? `unos ${pesos(costo / dias)} por día` : "solo la energía",
            detalle: (
              <>
                <p className="cuenta">
                  Cada kWh costó {precio(registro.valor_kwh!)}: {num(kwh)} × {precio(registro.valor_kwh!)} ≈ <b>{pesos(costo)}</b>
                </p>
                <p>Es solo la energía. El total de la factura también cobra otras cosas, como alumbrado público y aseo.</p>
              </>
            ),
          } satisfies Tarjeta,
        ]
      : []),
    {
      id: "co2",
      icono: "🌎",
      pregunta: "¿Cuánta contaminación?",
      valor: `${num(huella)} kg`,
      sub: "de CO₂",
      detalle: (
        <>
          <p>
            Pesa {comparacionPeso(huella)}. Para producir electricidad, algunas plantas del país queman carbón o gas y sueltan gases que
            calientan el planeta. El principal es el <b>CO₂</b> (dióxido de carbono). A esto se le llama <b>huella de carbono</b>.
          </p>
          <p className="cuenta">
            En Colombia, cada kWh produjo en promedio {num(factor.valor, 3)} kg ({num(factor.valor * 1000, 0)} gramos) de CO₂: {num(kwh)} ×{" "}
            {num(factor.valor, 3)} = <b>{num(huella)} kg</b>
          </p>
        </>
      ),
    },
    {
      id: "persona",
      icono: "👨‍👩‍👧",
      pregunta: "¿Por persona?",
      valor: `${num(kwh / personas)} kWh`,
      sub: `y ${num(huella / personas)} kg de CO₂`,
      detalle: (
        <>
          <p className="cuenta">
            Repartimos entre las {personas} {personas === 1 ? "persona" : "personas"} de la casa: {num(kwh)} ÷ {personas} ={" "}
            <b>{num(kwh / personas)} kWh</b> y {num(huella)} ÷ {personas} = <b>{num(huella / personas)} kg</b>
          </p>
          <p>Sirve para comparar casas donde vive distinto número de personas.</p>
        </>
      ),
    },
    {
      id: "basico",
      icono: "🏠",
      pregunta: "¿Mucho o poco?",
      valor: vsSub.porEncima ? `${num(veces)} veces` : "Lo básico",
      sub: vsSub.porEncima ? `lo básico (${num(vsSub.referencia, 0)} kWh)` : `hasta ${num(vsSub.referencia, 0)} kWh`,
      tono: vsSub.porEncima ? "alerta" : "bien",
      detalle: (
        <>
          <p>
            <b>{vsSub.porEncima ? `${num(vsSub.diferencia, 0)} kWh más que lo básico` : "Tu casa está dentro de lo básico"}</b> (en un mes de 30 días).
          </p>
          <div className="barras" aria-hidden="true">
            <div className="barra-fila">
              <span>Lo básico</span>
              <div className="barra"><i className="barra-basico" style={{ width: `${(vsSub.referencia / escala) * 100}%` }} /></div>
              <b>{num(vsSub.referencia, 0)}</b>
            </div>
            <div className="barra-fila">
              <span>Tu casa</span>
              <div className="barra"><i className={vsSub.porEncima ? "barra-casa encima" : "barra-casa"} style={{ width: `${(normalizado / escala) * 100}%` }} /></div>
              <b>{num(normalizado, 0)}</b>
            </div>
          </div>
          <p>
            El Gobierno calcula que un hogar {hogar.sobre_1000_msnm ? "de clima frío (a 1000 metros de altura o más)" : "de clima cálido (a menos de 1000 metros de altura)"}{" "}
            necesita unos <b>{num(vsSub.referencia, 0)} kWh al mes</b> para lo básico. Se llama <b>consumo de subsistencia</b>. No es un límite:
            nadie corta la energía por pasarse.
          </p>
          <p>{fraseEstrato(hogar.estrato, vsSub.referencia)}</p>
        </>
      ),
    },
    {
      id: "meses",
      icono: "📅",
      pregunta: "¿Y otros meses?",
      valor:
        vsPromedio === null ? "—" : vsPromedio > 0 ? `+${num(vsPromedio, 0)} %` : vsPromedio < 0 ? `−${num(-vsPromedio, 0)} %` : "Igual",
      sub: lineaBase ? `vs. tu promedio (${num(lineaBase.promedio, 0)} kWh)` : "faltan meses",
      tono: vsPromedio === null ? undefined : vsPromedio > 15 ? "alerta" : vsPromedio < -5 ? "bien" : undefined,
      detalle: lineaBase && vsPromedio !== null ? (
        <p>
          Este mes (llevado a 30 días) usaron <b>{num(normalizado)} kWh</b>; su promedio de los {lineaBase.meses} meses anteriores es{" "}
          <b>{num(lineaBase.promedio)} kWh</b>: {vsPromedio > 0 ? `${num(vsPromedio, 0)} % más` : vsPromedio < 0 ? `${num(-vsPromedio, 0)} % menos` : "lo mismo"}.
          {vsPromedio > 15 ? " Vale la pena preguntarse qué cambió: visitas, aparatos nuevos, más horas en casa…" : ""}
          {vsPromedio < -5 ? " ¡Buen trabajo! Sigan así." : ""}
        </p>
      ) : (
        <p>
          Para comparar hacen falta al menos 3 meses. Cuando leas una factura, ElectriCOs guarda también los meses anteriores que trae
          impresos.
        </p>
      ),
    },
  ];

  return (
    <section className="result-card explicado" aria-label={`Resultado de ${nombreMes(registro.periodo)}`}>
      <div className="tarjetas-cabecera">
        <span className="metric-label">{nombreMes(registro.periodo).toUpperCase()}</span>
        <small>Toca una tarjeta para ver la explicación</small>
      </div>

      <div className="tarjetas">
        {tarjetas.map((t) => {
          const abiertaEsta = abierta === t.id;
          return (
            <article key={t.id} className={"tarjeta" + (abiertaEsta ? " abierta" : "") + (t.tono ? ` tono-${t.tono}` : "")}>
              <button
                type="button"
                className="tarjeta-cara"
                aria-expanded={abiertaEsta}
                aria-controls={`detalle-${t.id}`}
                onClick={() => setAbierta(abiertaEsta ? null : t.id)}
              >
                <span className="tarjeta-pregunta"><span aria-hidden="true">{t.icono}</span> {t.pregunta}</span>
                <strong className="tarjeta-valor">{t.valor}</strong>
                <span className="tarjeta-sub">{t.sub}</span>
                <span className="tarjeta-mas" aria-hidden="true">{abiertaEsta ? "Cerrar ✕" : "Ver más +"}</span>
              </button>
              {abiertaEsta && (
                <div className="tarjeta-detalle" id={`detalle-${t.id}`}>
                  {t.detalle}
                </div>
              )}
            </article>
          );
        })}
      </div>

      <details className="explicacion">
        <summary>¿De dónde salen estos datos?</summary>
        <p>
          <b>0,22 kg de CO₂ por kWh:</b> {factor.fuente}. La UPME es la entidad del Gobierno que planea la energía del país (
          <a href={factor.url} target="_blank" rel="noreferrer">ver documento</a>).
        </p>
        <p>
          <b>{num(subsistencia.valor, 0)} kWh de subsistencia:</b> {subsistencia.fuente}.
        </p>
        <p>Los demás números salen de tu factura: lecturas del contador, días y valor del kWh.</p>
      </details>
    </section>
  );
}
