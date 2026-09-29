// Prepara los archivos del lector de fotos (PaddleOCR) antes de compilar.
// Se ejecuta solo con `npm run build` y `npm run dev` (prebuild / predev).
//
//   1. Copia el motor ONNX Runtime Web (WebAssembly) a public/ort/
//   2. Descarga los modelos PP-OCRv6 tiny a public/modelos/
//
// Así el celular descarga todo desde nuestro propio dominio (rápido y sin
// depender de servidores externos). Si la descarga falla, la app usa la
// dirección oficial de PaddlePaddle como respaldo.

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const raiz = process.cwd();
const ORT_ORIGEN = join(raiz, "node_modules", "onnxruntime-web", "dist");
const ORT_DESTINO = join(raiz, "public", "ort");
const MODELOS_DESTINO = join(raiz, "public", "modelos");
const BASE = "https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0";
const MODELOS = ["PP-OCRv6_tiny_det", "PP-OCRv6_tiny_rec"];

// 1. Motor ONNX Runtime Web
mkdirSync(ORT_DESTINO, { recursive: true });
if (existsSync(ORT_ORIGEN)) {
  const archivos = readdirSync(ORT_ORIGEN).filter((f) => /^ort-wasm.*\.(wasm|mjs)$/.test(f));
  for (const f of archivos) copyFileSync(join(ORT_ORIGEN, f), join(ORT_DESTINO, f));
  console.log(`[ocr] ${archivos.length} archivos de ONNX Runtime copiados a public/ort`);
} else {
  console.warn("[ocr] No se encontró onnxruntime-web: ejecuta npm install");
}

// 2. Modelos
mkdirSync(MODELOS_DESTINO, { recursive: true });
for (const nombre of MODELOS) {
  const archivo = join(MODELOS_DESTINO, `${nombre}_onnx_infer.tar`);
  if (existsSync(archivo) && statSync(archivo).size > 100_000) {
    console.log(`[ocr] ${nombre}: ya estaba`);
    continue;
  }
  try {
    const r = await fetch(`${BASE}/${nombre}_onnx_infer.tar`, { signal: AbortSignal.timeout(120_000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const datos = Buffer.from(await r.arrayBuffer());
    writeFileSync(archivo, datos);
    console.log(`[ocr] ${nombre}: descargado (${(datos.length / 1e6).toFixed(1)} MB)`);
  } catch (e) {
    console.warn(`[ocr] ${nombre}: no se pudo descargar (${e.message}); se usará la dirección oficial`);
  }
}
