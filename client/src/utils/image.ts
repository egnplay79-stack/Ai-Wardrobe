/** Decode a picked/captured file into a canvas, honouring EXIF orientation, capped at `max` px. */
export async function fileToCanvas(file: Blob, max = 1400): Promise<HTMLCanvasElement> {
  let source: CanvasImageSource & { width: number; height: number };
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  const k = Math.min(1, max / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * k);
  canvas.height = Math.round(source.height * k);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/jpeg", quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), type, quality),
  );
}

/** Smaller copy for sending to a vision model. */
export function downscale(canvas: HTMLCanvasElement, max = 1024): HTMLCanvasElement {
  const k = Math.min(1, max / Math.max(canvas.width, canvas.height));
  if (k === 1) return canvas;
  const c = document.createElement("canvas");
  c.width = Math.round(canvas.width * k);
  c.height = Math.round(canvas.height * k);
  c.getContext("2d")!.drawImage(canvas, 0, 0, c.width, c.height);
  return c;
}

export const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));
