import type { ReactNode } from "react";

type Props = {
  titulo: string;
  antetitulo?: string;
  icono?: string;
  onVolver?: () => void;
  accion?: ReactNode;
  pie?: ReactNode;
  children: ReactNode;
};

/** Marco común de todas las pantallas: encabezado, contenido y navegación. */
export default function Pantalla({ titulo, antetitulo = "ELECTRICOS", icono = "⚡", onVolver, accion, pie, children }: Props) {
  return (
    <main className="app-shell">
      <header className={"mobile-header" + (onVolver ? "" : " home-header")}>
        {onVolver && (
          <button className="icon-button" onClick={onVolver} aria-label="Volver">
            ←
          </button>
        )}
        <div>
          <span className="eyebrow">{antetitulo}</span>
          <h1>{titulo}</h1>
        </div>
        {accion ?? <div className="header-mark" aria-hidden="true">{icono}</div>}
      </header>
      <section className="page-content">{children}</section>
      {pie}
    </main>
  );
}
