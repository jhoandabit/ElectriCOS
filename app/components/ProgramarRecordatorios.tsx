"use client";

import { useEffect } from "react";
import { programarRecordatorios } from "../lib/notificaciones/apk";

/** Dentro de la APK: deja programados los avisos del día 10 y 20 (o los cancela si se apagaron los consejos). */
export default function ProgramarRecordatorios({ activos }: { activos: boolean }) {
  useEffect(() => {
    void programarRecordatorios(activos);
  }, [activos]);
  return null;
}
