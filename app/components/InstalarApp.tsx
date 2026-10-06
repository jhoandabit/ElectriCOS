"use client";

// Tarjeta para instalar ElectriCOs en el celular (PWA): icono en la pantalla de inicio,
// pantalla completa y apertura sin conexión.
// Android/Chrome: botón "Instalar" (evento beforeinstallprompt). iPhone/Safari: no existe ese botón;
// se explican los pasos del menú Compartir.

import { useEffect, useState } from "react";

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

function yaInstalada(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function InstalarApp() {
  const [instalada, setInstalada] = useState(false);
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [esIphone, setEsIphone] = useState(false);

  useEffect(() => {
    setInstalada(yaInstalada());
    setEsIphone(/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    const guardar = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
    };
    const alInstalar = () => setInstalada(true);
    window.addEventListener("beforeinstallprompt", guardar);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", guardar);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  if (instalada) {
    return (
      <div className="info-note" role="status">
        <strong>✓ ElectriCOs está instalada en este celular</strong>
        <span>Ábrela desde su icono, como cualquier app.</span>
      </div>
    );
  }

  const instalar = async () => {
    if (!evento) return;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    if (outcome === "accepted") setInstalada(true);
    setEvento(null);
  };

  return (
    <div className="info-note" role="region" aria-label="Instalar ElectriCOs">
      <strong>📲 Instala ElectriCOs en tu celular</strong>
      {evento ? (
        <>
          <span>Queda con su icono, abre en pantalla completa y funciona sin conexión.</span>
          <button className="primary-button" onClick={instalar}>Instalar</button>
        </>
      ) : esIphone ? (
        <span>En Safari toca el botón <b>Compartir</b> (el cuadrado con la flecha) y elige <b>“Añadir a pantalla de inicio”</b>.</span>
      ) : (
        <span>En Chrome abre el menú <b>⋮</b> y elige <b>“Instalar aplicación”</b> o <b>“Añadir a pantalla de inicio”</b>.</span>
      )}
    </div>
  );
}
