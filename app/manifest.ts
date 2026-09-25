import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ElectriCOs",
    short_name: "ElectriCOs",
    description: "Educación energética familiar: mide, comprende y transforma tu consumo.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7f4",
    theme_color: "#1f7a45",
    lang: "es",
    orientation: "portrait",
    categories: ["education", "utilities"],
  };
}
