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

/**
 * Diagnóstico de un mes, escrito para cualquier familia: cada tarjeta
 * responde UNA pregunta, con el número grande, qué significa y de dónde sale.
 */
export default function ResultadoMes({ registro, hogar, registros, parametros }: Props) {
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

  // Barra "básico vs. este mes": el máximo de la escala es el mayor de los dos.
  const escala = Math.max(normalizado, vsSub.referencia) * 1.05;

  return (
    <section className="result-card explicado" aria-label={`Resultado de ${nombreMes(registro.periodo)}`}>
      <span className="metric-label">{nombreMes(registro.periodo).toUpperCase()}</span>

      {/* 1. Energía */}
      <article className="dato">
        <h3><span aria-hidden="true">⚡</span> ¿Cuánta energía usó tu casa?</h3>
        <strong className="dato-valor">{num(kwh)} kWh</strong>
        <p className="dato-sub">{dias ? `en ${dias} días · unos ${num(kwh / dias)} kWh por día` : "en el periodo facturado"}</p>
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
      </article>

      {/* 2. Dinero */}
      {costo !== null && (
        <article className="dato">
          <h3><span aria-hidden="true">💵</span> ¿Cuánto costó esa energía?</h3>
          <strong className="dato-valor">{pesos(costo)}</strong>
          {dias && <p className="dato-sub">unos {pesos(costo / dias)} por día</p>}
          <p className="cuenta">
            Cada kWh costó {precio(registro.valor_kwh!)}: {num(kwh)} × {precio(registro.valor_kwh!)} ≈ <b>{pesos(costo)}</b>
          </p>
          <p>Es solo la energía. El total de la factura también cobra otras cosas, como alumbrado público y aseo.</p>
        </article>
      )}

      {/* 3. Gases */}
      <article className="dato">
        <h3><span aria-hidden="true">🌎</span> ¿Cuánta contaminación produjo?</h3>
        <strong className="dato-valor">{num(huella)} kg de CO₂</strong>
        <p className="dato-sub">{comparacionPeso(huella)}</p>
        <p>
          Para producir electricidad, algunas plantas del país queman carbón o gas y sueltan gases que calientan el planeta. El principal es el
          <b> CO₂</b> (dióxido de carbono). A esto se le llama <b>huella de carbono</b>.
        </p>
        <p className="cuenta">
          En Colombia, cada kWh produjo en promedio {num(factor.valor, 3)} kg ({num(factor.valor * 1000, 0)} gramos) de CO₂:{" "}
          {num(kwh)} × {num(factor.valor, 3)} = <b>{num(huella)} kg</b>
        </p>
      </article>

      {/* 4. Por persona */}
      <article className="dato">
        <h3><span aria-hidden="true">👨‍👩‍👧</span> ¿Cuánto le toca a cada persona?</h3>
        <strong className="dato-valor">{num(kwh / personas)} kWh</strong>
        <p className="dato-sub">y {num(huella / personas)} kg de CO₂ por persona</p>
        <p className="cuenta">
          Repartimos entre las {personas} {personas === 1 ? "persona" : "personas"} de la casa: {num(kwh)} ÷ {personas} = <b>{num(kwh / personas)} kWh</b>{" "}
          y {num(huella)} ÷ {personas} = <b>{num(huella / personas)} kg</b>
        </p>
        <p>Sirve para comparar casas donde vive distinto número de personas.</p>
      </article>

      {/* 5. Frente a lo básico */}
      <article className="dato">
        <h3><span aria-hidden="true">🏠</span> ¿Es mucho o poco?</h3>
        <strong className="dato-valor">
          {vsSub.porEncima ? `${num(vsSub.diferencia, 0)} kWh más que lo básico` : "Dentro de lo básico"}
        </strong>
        {vsSub.porEncima && <p className="dato-sub">{num(veces)} veces lo básico</p>}
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
          necesita unos <b>{num(vsSub.referencia, 0)} kWh al mes</b> para lo básico. Se llama <b>consumo de subsistencia</b>. No es un límite: nadie
          corta la energía por pasarse.
        </p>
        <p>{fraseEstrato(hogar.estrato, vsSub.referencia)}</p>
      </article>

      {/* 6. Frente a otros meses */}
      <article className="dato">
        <h3><span aria-hidden="true">📅</span> ¿Comparado con otros meses?</h3>
        {lineaBase && vsPromedio !== null ? (
          <>
            <strong className="dato-valor">
              {vsPromedio > 0 ? `${num(vsPromedio, 0)} % más` : vsPromedio < 0 ? `${num(-vsPromedio, 0)} % menos` : "Igual"}
            </strong>
            <p className="dato-sub">que tu promedio de {num(lineaBase.promedio)} kWh</p>
            <p>
              El promedio sale de los {lineaBase.meses} meses anteriores, todos llevados a 30 días.
              {vsPromedio > 15 ? " Vale la pena preguntarse qué cambió: visitas, aparatos nuevos, más horas en casa…" : ""}
              {vsPromedio < -5 ? " ¡Buen trabajo! Sigan así." : ""}
            </p>
          </>
        ) : (
          <p>
            Para comparar hacen falta al menos 3 meses. Cuando leas una factura, ElectriCOs guarda también los meses anteriores que trae
            impresos.
          </p>
        )}
      </article>

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
