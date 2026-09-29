import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ElectriCOs",
    short_name: "ElectriCOs",
    description: "Educación energética familiar: mide, comprende y transforma tu consumo.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f5f2",
    theme_color: "#b84c08",
    lang: "es",
    orientation: "portrait",
    categories: ["education", "utilities"],
    id: "/",
    scope: "/",
    icons: [
      { src: "/iconos/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/iconos/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/iconos/icono-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/iconos/icono-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
