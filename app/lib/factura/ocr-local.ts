"use client";

// OCR local con Tesseract.js: funciona sin internet ni claves, pero es
// menos preciso que la IA con fotos torcidas o mal iluminadas.

type AlProgresar = (mensaje: string) => void;

function versionContrastada(origen: HTMLCanvasElement) {
  const canvas = document.createElement("canvas");
  canvas.width = origen.width;
  canvas.height = origen.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return origen;
  ctx.drawImage(origen, 0, 0);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;

  let suma = 0;
  for (let i = 0; i < d.length; i += 4) suma += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  const media = suma / (d.length / 4);

  for (let i = 0; i < d.length; i += 4) {
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = Math.max(0, Math.min(255, Math.round((y - media) * 1.6 + 150)));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function puntaje(texto: string, confianza: number) {
  const t = texto.toLowerCase();
  const terminos = ["consumo", "kwh", "lectura", "anterior", "actual", "estrato", "periodo", "municipio", "factura", "energia", "energía"];
  return confianza + terminos.filter((x) => t.includes(x)).length * 6;
}

/** Devuelve el mejor texto entre la imagen original y una versión contrastada. */
export async function ocrLocal(canvas: HTMLCanvasElement, alProgresar: AlProgresar): Promise<string> {
  const { createWorker, PSM } = await import("tesseract.js");
  let paso = 1;
  const worker = await createWorker("spa", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        alProgresar(`Leyendo sin conexión (${paso}/2)… ${Math.round(m.progress * 100)} %`);
      }
    },
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
    });

    const resultados: { texto: string; puntaje: number }[] = [];
    for (const variante of [canvas, versionContrastada(canvas)]) {
      const r = await worker.recognize(variante);
      const texto = r.data.text?.trim() ?? "";
      if (texto) resultados.push({ texto, puntaje: puntaje(texto, r.data.confidence ?? 0) });
      paso++;
    }

    resultados.sort((a, b) => b.puntaje - a.puntaje);
    return resultados[0]?.texto ?? "";
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}
