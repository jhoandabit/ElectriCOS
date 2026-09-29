"use client";

// Contenedor principal de ElectriCOs.
// Flujo: sesión → hogar → pantallas (Inicio, Consumo, Meta, Progreso).
// Aquí vive el estado compartido; cada pantalla está en app/components/.

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import AuthScreen from "./components/AuthScreen";
import BottomNav, { type Seccion } from "./components/BottomNav";
import ConsumoForm from "./components/ConsumoForm";
import ConsumoScreen from "./components/ConsumoScreen";
import HogarForm from "./components/HogarForm";
import HomeScreen from "./components/HomeScreen";
import InvoiceScanner, { type MetodoLectura } from "./components/InvoiceScanner";
import MetaScreen from "./components/MetaScreen";
import Pantalla from "./components/Pantalla";
import ProgresoScreen from "./components/ProgresoScreen";
import { PARAMETROS_POR_DEFECTO, type Parametro } from "./lib/calculos/parametros";
import type { ResultadoLectura } from "./lib/factura/tipos";
import { supabase, supabaseConfigurado } from "./lib/supabase/cliente";
import {
  listarRegistros,
  obtenerHogar,
  obtenerMetaActiva,
  obtenerParametros,
  type Hogar,
  type Meta,
  type RegistroConsumo,
} from "./lib/supabase/datos";

type Vista = Seccion | "factura" | "formulario" | "hogar";

const PARAMETROS_INICIALES = Object.fromEntries(PARAMETROS_POR_DEFECTO.map((p) => [p.clave, p]));

export default function App() {
  const [sesion, setSesion] = useState<Session | null | undefined>(undefined);
  const [hogar, setHogar] = useState<Hogar | null | undefined>(undefined);
  const [registros, setRegistros] = useState<RegistroConsumo[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [parametros, setParametros] = useState<Record<string, Parametro>>(PARAMETROS_INICIALES);
  const [vista, setVista] = useState<Vista>("inicio");
  const [lectura, setLectura] = useState<{ resultado: ResultadoLectura; metodo: MetodoLectura } | null>(null);
  const [error, setError] = useState("");

  // ---------- Sesión ----------
  useEffect(() => {
    if (!supabaseConfigurado()) return;
    const cliente = supabase();
    cliente.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data } = cliente.auth.onAuthStateChange((_evento, nueva) => setSesion(nueva));
    return () => data.subscription.unsubscribe();
  }, []);

  // ---------- Datos del hogar ----------
  const cargarDatos = useCallback(async (h: Hogar) => {
    const [r, m] = await Promise.all([listarRegistros(h.id), obtenerMetaActiva(h.id)]);
    setRegistros(r);
    setMeta(m);
  }, []);

  const recargar = useCallback(async () => {
    if (hogar) await cargarDatos(hogar);
  }, [hogar, cargarDatos]);

  useEffect(() => {
    if (!sesion) {
      setHogar(undefined);
      setRegistros([]);
      setMeta(null);
      return;
    }
    let vigente = true;
    (async () => {
      try {
        setError("");
        const [h, p] = await Promise.all([obtenerHogar(), obtenerParametros()]);
        if (!vigente) return;
        setParametros(p);
        setHogar(h);
        if (h) await cargarDatos(h);
      } catch (e) {
        if (vigente) setError((e as Error).message);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [sesion, cargarDatos]);

  const ir = (v: Vista) => {
    setVista(v);
    setError("");
    window.scrollTo({ top: 0 });
  };

  const salir = async () => {
    await supabase().auth.signOut();
    ir("inicio");
  };

  // ---------- Estados previos a la app ----------
  if (!supabaseConfigurado()) {
    return (
      <Pantalla titulo="ElectriCOs">
        <div className="error-message">
          Falta configurar Supabase: agrega NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en las variables de entorno.
        </div>
      </Pantalla>
    );
  }
  if (sesion === undefined) {
    return (
      <Pantalla titulo="ElectriCOs">
        <div className="ocr-status ocr-status-running" role="status"><span className="ocr-spinner" aria-hidden="true" /><span>Cargando…</span></div>
      </Pantalla>
    );
  }
  if (!sesion) return <AuthScreen />;

  if (hogar === undefined) {
    return (
      <Pantalla titulo="ElectriCOs">
        {error ? <div className="error-message" role="alert">{error}</div> : (
          <div className="ocr-status ocr-status-running" role="status"><span className="ocr-spinner" aria-hidden="true" /><span>Cargando tu hogar…</span></div>
        )}
      </Pantalla>
    );
  }
  if (hogar === null) {
    return (
      <Pantalla titulo="Bienvenido" antetitulo="PRIMER PASO" icono="⌂" accion={<button className="text-button" onClick={salir}>Salir</button>}>
        <div className="intro-card">
          <span className="section-kicker">TU HOGAR</span>
          <h2>Antes de empezar</h2>
          <p>Estos datos sirven para calcular el consumo por persona y el consumo de subsistencia de referencia.</p>
        </div>
        <HogarForm onGuardado={(h) => { setHogar(h); void cargarDatos(h); }} />
      </Pantalla>
    );
  }

  // ---------- App ----------
  const seccion: Seccion = vista === "factura" || vista === "formulario" ? "consumo" : vista === "hogar" ? "inicio" : vista;
  const nav = <BottomNav activa={seccion} onIr={(s) => ir(s)} />;
  const errorGlobal = error && <div className="error-message" role="alert">{error}</div>;

  switch (vista) {
    case "factura":
      return (
        <Pantalla titulo="Leer factura" icono="📷" onVolver={() => ir("consumo")} pie={nav}>
          <InvoiceScanner
            onUsar={(resultado, metodo) => {
              setLectura({ resultado, metodo });
              ir("formulario");
            }}
          />
        </Pantalla>
      );

    case "formulario":
      return (
        <Pantalla titulo="Mi consumo" onVolver={() => ir(lectura ? "factura" : "consumo")} pie={nav}>
          <ConsumoForm
            key={lectura ? "factura" : "manual"}
            hogar={hogar}
            registros={registros}
            parametros={parametros}
            lectura={lectura?.resultado}
            metodo={lectura?.metodo}
            onGuardado={recargar}
            onHogar={setHogar}
            onTerminar={() => {
              setLectura(null);
              ir("inicio");
            }}
          />
        </Pantalla>
      );

    case "hogar":
      return (
        <Pantalla titulo="Mi hogar" icono="⌂" onVolver={() => ir("inicio")} pie={nav}>
          <HogarForm hogar={hogar} onGuardado={(h) => { setHogar(h); ir("inicio"); }} onCancelar={() => ir("inicio")} />
          <button className="secondary-button full-button" onClick={salir}>Cerrar sesión</button>
        </Pantalla>
      );

    case "consumo":
      return (
        <Pantalla titulo="Consumo" icono="▣" pie={nav}>
          {errorGlobal}
          <ConsumoScreen
            registros={registros}
            onFactura={() => { setLectura(null); ir("factura"); }}
            onManual={() => { setLectura(null); ir("formulario"); }}
            onCambio={recargar}
          />
        </Pantalla>
      );

    case "meta":
      return (
        <Pantalla titulo="Meta" icono="◎" pie={nav}>
          {errorGlobal}
          <MetaScreen hogar={hogar} registros={registros} meta={meta} parametros={parametros} onCambio={recargar} onRegistrar={() => ir("consumo")} />
        </Pantalla>
      );

    case "progreso":
      return (
        <Pantalla titulo="Progreso" icono="↗" pie={nav}>
          {errorGlobal}
          <ProgresoScreen hogar={hogar} registros={registros} meta={meta} parametros={parametros} />
        </Pantalla>
      );

    default:
      return (
        <Pantalla
          titulo="ElectriCOs"
          antetitulo={hogar.alias.toUpperCase()}
          accion={<button className="icon-button" onClick={() => ir("hogar")} aria-label="Mi hogar y cuenta">⚙</button>}
          pie={nav}
        >
          {errorGlobal}
          <HomeScreen
            hogar={hogar}
            registros={registros}
            meta={meta}
            parametros={parametros}
            onConsumo={() => ir("consumo")}
            onMeta={() => ir("meta")}
          />
        </Pantalla>
      );
  }
}
