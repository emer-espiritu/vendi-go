/**
 * Compresión de imágenes de producto, delegada a `browser-image-compression`.
 *
 * El criterio acá es de robustez: la librería madura resuelve decodificación,
 * EXIF, redimensionado a 1024 px y codificación — y su camino principal corre
 * dentro de un Web Worker, de modo que el trabajo pesado no compite con el
 * hilo de React ni puede colgar el formulario.
 *
 * El resultado se entrega como data URL para conservar el contrato del
 * formulario (el upload a Storage sigue soportando data URL o URL directa).
 */

import imageCompression from "browser-image-compression";

/** Lado máximo de la imagen procesada, en px. */
const MAX_SIDE = 1024;
/** Calidad de codificación (JPEG/WebP según el navegador). */
const QUALITY = 0.82;
/** Techo de tamaño de salida, en MB. */
const MAX_SIZE_MB = 0.5;
/** Techo de tiempo para todo el proceso. */
const TOTAL_TIMEOUT_MS = 20000;

export interface CompressStep {
  stage: "procesando" | "comprimida";
  elapsedMs: number;
  progress?: number;
  output?: string;
}

/** Visibilidad de avance para el llamador (etiqueta del botón, diagnóstico). */
export type OnStep = (step: CompressStep) => void;

/** Contorno de demora: si el proceso no responde, rechaza con error claro. */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, guard]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("No se pudo leer la imagen comprimida."));
    };
    reader.onerror = () =>
      reject(new Error("La imagen comprimida no se pudo leer."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Lee un archivo de imagen y devuelve un data URL redimensionado y
 * comprimido, listo para guardar en el estado del formulario y subir.
 *
 * Nunca agranda la imagen; solo reduce. Corre en Web Worker y, si el
 * navegador no lo soporta, cae al camino en hilo de la librería. Con el
 * techo de 20 s se garantiza un mensaje de error en vez de colgar la UI.
 */
export async function compressProductImage(
  file: File,
  onStep?: OnStep,
): Promise<string> {
  const started = performance.now();

  const compressed = await withTimeout(
    imageCompression(file, {
      maxSizeMB: MAX_SIZE_MB,
      maxWidthOrHeight: MAX_SIDE,
      initialQuality: QUALITY,
      useWebWorker: true,
      onProgress: (progress) => {
        onStep?.({
          stage: "procesando",
          elapsedMs: Math.round(performance.now() - started),
          progress,
        });
      },
    }),
    TOTAL_TIMEOUT_MS,
    "La imagen tardó demasiado en procesarse. Probá con otra foto o de menor tamaño.",
  );

  const dataUrl = await blobToDataUrl(compressed);
  onStep?.({
    stage: "comprimida",
    elapsedMs: Math.round(performance.now() - started),
    output: `${compressed.type} ${compressed.size} bytes → data URL ${dataUrl.length} chars`,
  });

  return dataUrl;
}
