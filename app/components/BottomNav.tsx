export type Seccion = "inicio" | "consumo" | "meta" | "progreso";

const ITEMS: { id: Seccion; icono: string; texto: string }[] = [
  { id: "inicio", icono: "⌂", texto: "Inicio" },
  { id: "consumo", icono: "▣", texto: "Consumo" },
  { id: "meta", icono: "◎", texto: "Meta" },
  { id: "progreso", icono: "↗", texto: "Progreso" },
];

export default function BottomNav({ activa, onIr }: { activa: Seccion; onIr: (s: Seccion) => void }) {
  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {ITEMS.map((i) => (
        <button
          key={i.id}
          className={"nav-item " + (activa === i.id ? "active" : "")}
          aria-current={activa === i.id ? "page" : undefined}
          onClick={() => onIr(i.id)}
        >
          <span aria-hidden="true">{i.icono}</span>
          {i.texto}
        </button>
      ))}
    </nav>
  );
}
