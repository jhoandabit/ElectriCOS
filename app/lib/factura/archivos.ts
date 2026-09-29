"use client";

// Lectura de archivos en el navegador: texto de PDFs, render de páginas
// y fotos redimensionadas para el lector de texto. Nada sale del celular.

const LADO_MAXIMO = 2000; // px: suficiente para leer una factura, liviano para subir

export function esPdf(archivo: File) {
  return archivo.type === "application/pdf" || archivo.name.toLowerCase().endsWith(".pdf");
}

export async function cargarImagen(archivo: Blob): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap respeta la orientación EXIF de las fotos del celular.
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(archivo, { imageOrientation: "from-image" });
    } catch {
      /* algunos navegadores no aceptan la opción; seguimos con <img> */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo abrir la imagen.")); };
    img.src = url;
  });
}

export function dimensiones(imagen: ImageBitmap | HTMLImageElement) {
  return {
    ancho: "naturalWidth" in imagen ? imagen.naturalWidth : imagen.width,
    alto: "naturalHeight" in imagen ? imagen.naturalHeight : imagen.height,
  };
}

/** Reduce la foto (por defecto a máx. 2000 px) y la dibuja en un lienzo. */
export async function prepararFoto(
  archivo: File,
  ladoMaximo = LADO_MAXIMO
): Promise<{ canvas: HTMLCanvasElement }> {
  const imagen = await cargarImagen(archivo);
  const { ancho, alto } = dimensiones(imagen);
  const escala = Math.min(1, ladoMaximo / Math.max(ancho, alto));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(ancho * escala);
  canvas.height = Math.round(alto * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar la imagen.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(imagen, 0, 0, canvas.width, canvas.height);

  return { canvas };
}

async function cargarPdfjs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
  return pdfjs;
}

export type PdfLeido = {
  texto: string;
  paginas: number;
  /** true si el PDF casi no tiene texto (factura escaneada) */
  escaneado: boolean;
  /** Primera página como imagen, para el lector de texto (PDF escaneado) */
  primeraPagina: HTMLCanvasElement;
};

/** Extrae el texto ordenado por renglones y dibuja la primera página. */
export async function leerPdf(archivo: File): Promise<PdfLeido> {
  const pdfjs = await cargarPdfjs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) }).promise;
  const paginasTexto: string[] = [];
  const maxPaginas = Math.min(pdf.numPages, 4);

  for (let n = 1; n <= maxPaginas; n++) {
    const pagina = await pdf.getPage(n);
    const contenido = await pagina.getTextContent();
    const items = (contenido.items as Array<{ str?: string; transform?: number[] }>)
      .filter((i) => i.str?.trim())
      .map((i) => ({ texto: i.str as string, x: i.transform?.[4] ?? 0, y: i.transform?.[5] ?? 0 }))
      .sort((a, b) => (Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x));

    const renglones: { y: number; texto: string }[] = [];
    for (const item of items) {
      const ultimo = renglones[renglones.length - 1];
      if (ultimo && Math.abs(ultimo.y - item.y) <= 3) ultimo.texto += "  " + item.texto;
      else renglones.push({ y: item.y, texto: item.texto });
    }
    paginasTexto.push(renglones.map((r) => r.texto.trim()).join("\n"));
    pagina.cleanup();
  }

  const texto = paginasTexto.join("\n\n");

  const primera = await pdf.getPage(1);
  const base = primera.getViewport({ scale: 1 });
  const escala = Math.min(3, LADO_MAXIMO / Math.max(base.width, base.height));
  const vista = primera.getViewport({ scale: escala });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(vista.width);
  canvas.height = Math.round(vista.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo dibujar el PDF.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await primera.render({ canvasContext: ctx, viewport: vista, canvas }).promise;

  return {
    texto,
    paginas: pdf.numPages,
    escaneado: texto.replace(/\s/g, "").length < 80,
    primeraPagina: canvas,
  };
}
