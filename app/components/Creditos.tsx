/* eslint-disable @next/next/no-img-element */

// Quiénes hacen ElectriCOs: el Club de Ciencias RMB Conciencia de la
// I. E. Ramón Martínez Benítez (Cartago). Se muestra en el ingreso y en Inicio.

export function Logos({ alto = 72 }: { alto?: number }) {
  return (
    <div className="logos" aria-label="I. E. Ramón Martínez Benítez y Club de Ciencias RMB Conciencia">
      <img src="/marca/escudo-rmb.png" alt="Escudo de la I. E. Ramón Martínez Benítez" height={alto} width={Math.round((alto * 113) / 132)} />
      <img src="/marca/rmb-conciencia.png" alt="Logo del Club de Ciencias RMB Conciencia" height={alto} width={Math.round((alto * 296) / 560)} />
    </div>
  );
}

export default function Creditos() {
  return (
    <footer className="creditos">
      <Logos alto={64} />
      <p>
        ElectriCOs es un proyecto del <b>Club de Ciencias RMB Conciencia</b> de la <b>I. E. Ramón Martínez Benítez</b> (Cartago, Valle del
        Cauca), hecho por estudiantes de 9.º a 11.º.
      </p>
      <small>Los colores se inspiran en la factura de Energía de Pereira. ElectriCOs es un proyecto escolar y no pertenece a esa empresa.</small>
    </footer>
  );
}
