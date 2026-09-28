"use client";

import { FormEvent, useState } from "react";
import { supabase } from "../lib/supabase/cliente";
import Pantalla from "./Pantalla";

// Autenticación = "¿quién eres?". Supabase Auth guarda las contraseñas
// cifradas; la app nunca las ve ni las guarda en ninguna tabla.

function traducirError(mensaje: string) {
  if (/invalid login credentials/i.test(mensaje)) return "Correo o contraseña incorrectos.";
  if (/already registered|already exists/i.test(mensaje)) return "Ese correo ya tiene una cuenta. Ingresa con él.";
  if (/email not confirmed/i.test(mensaje)) return "Primero confirma tu correo con el enlace que te enviamos.";
  if (/password/i.test(mensaje) && /(6|characters|short)/i.test(mensaje)) return "La contraseña debe tener al menos 6 caracteres.";
  if (/rate limit|too many/i.test(mensaje)) return "Demasiados intentos. Espera un momento y vuelve a intentar.";
  if (/fetch/i.test(mensaje)) return "No hay conexión con el servidor. Revisa tu internet.";
  return "No se pudo completar. Intenta de nuevo.";
}

export default function AuthScreen() {
  const [modo, setModo] = useState<"ingresar" | "registrarse">("ingresar");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [nombre, setNombre] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setAviso("");
    if (!/^\S+@\S+\.\S+$/.test(correo)) return setError("Escribe un correo válido.");
    if (clave.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");

    setCargando(true);
    try {
      if (modo === "ingresar") {
        const { error } = await supabase().auth.signInWithPassword({ email: correo.trim(), password: clave });
        if (error) throw error;
      } else {
        const { data, error } = await supabase().auth.signUp({
          email: correo.trim(),
          password: clave,
          options: {
            data: { nombre_visible: nombre.trim().slice(0, 60) },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        if (!data.session) {
          setAviso("Te enviamos un correo para confirmar la cuenta. Abre el enlace y luego ingresa aquí.");
          setModo("ingresar");
        }
      }
    } catch (err) {
      setError(traducirError((err as Error).message ?? ""));
    } finally {
      setCargando(false);
    }
  };

  return (
    <Pantalla titulo="ElectriCOs" antetitulo="EDUCACIÓN ENERGÉTICA">
      <div className="hero-card">
        <span className="section-kicker">TU HOGAR</span>
        <h2>Mide, comprende y transforma tu consumo.</h2>
        <p>{modo === "ingresar" ? "Ingresa para ver el consumo de tu hogar." : "Crea tu cuenta para empezar a registrar."}</p>
      </div>

      <form className="form-card" onSubmit={enviar} noValidate>
        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={modo === "ingresar"} className={modo === "ingresar" ? "on" : ""} onClick={() => setModo("ingresar")}>
            Ingresar
          </button>
          <button type="button" role="tab" aria-selected={modo === "registrarse"} className={modo === "registrarse" ? "on" : ""} onClick={() => setModo("registrarse")}>
            Crear cuenta
          </button>
        </div>

        <div className="form-section">
        {modo === "registrarse" && (
          <label>
            ¿Cómo te llamamos?
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Solo tu nombre o un apodo" maxLength={60} autoComplete="nickname" />
          </label>
        )}
        <label>
          Correo
          <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="email" inputMode="email" required />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            autoComplete={modo === "ingresar" ? "current-password" : "new-password"}
            minLength={6}
            required
          />
        </label>
        </div>

        {error && <div className="error-message" role="alert">{error}</div>}
        {aviso && <div className="calculated-note"><strong>Revisa tu correo</strong><span>{aviso}</span></div>}

        <button className="primary-button" type="submit" disabled={cargando}>
          {cargando ? "Un momento…" : modo === "ingresar" ? "Ingresar" : "Crear cuenta"}
        </button>
      </form>

      <div className="info-note">
        <strong>Tus datos</strong>
        <span>Solo guardamos el consumo de energía de tu hogar: nada de nombres completos, direcciones ni fotos de facturas. Solo tú y tu docente pueden verlo.</span>
      </div>
    </Pantalla>
  );
}
