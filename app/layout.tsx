import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegistrarSW from "./RegistrarSW";

export const metadata: Metadata = {
  title: "ElectriCOs",
  description: "Educación energética familiar.",
  appleWebApp: { capable: true, title: "ElectriCOs", statusBarStyle: "default" },
  icons: { apple: "/iconos/icono-192.png" },
};
export const viewport: Viewport = { themeColor: "#b84c08" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
