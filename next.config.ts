import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // OpenCV.js (lo usa PaddleOCR) trae código para Node.js que el navegador
  // nunca ejecuta; le decimos al empaquetador que ignore esos módulos.
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, crypto: false };
    }
    return config;
  },

  async headers() {
    return [
      {
        // "Aislamiento de origen": permite que el lector de fotos use varios
        // núcleos del celular a la vez (hilos de WebAssembly) → lee más rápido.
        // Requiere que todo lo que carga la página sea del mismo sitio o
        // tenga CORS (Supabase lo tiene).
        source: "/:ruta*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
      {
        // Modelos y motor del lector de fotos: no cambian, el celular los guarda.
        source: "/:carpeta(modelos|ort)/:archivo*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
