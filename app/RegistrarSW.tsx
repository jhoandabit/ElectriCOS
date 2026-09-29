"use client";
import { useEffect } from "react";

/** Registra el service worker (public/sw.js) para poder instalar la app. */
export default function RegistrarSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return null;
}
