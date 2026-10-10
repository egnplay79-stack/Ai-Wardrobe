import type { ImageEditProvider, ImageInput } from "./types.js";

const blob = (img: ImageInput) => new Blob([img.bytes], { type: img.mediaType });
async function bytesOf(res: Response): Promise<ImageInput> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`.slice(0, 300));
  return { bytes: new Uint8Array(await res.arrayBuffer()), mediaType: res.headers.get("content-type")?.split(";")[0] || "image/png" };
}

/** Returns the photo untouched; the app then isolates the garment on-device. */
export class PassthroughEdit implements ImageEditProvider {
  readonly name = "none";
  async clean(image: ImageInput) {
    return image;
  }
}

/** remove.bg — background removal, transparent PNG. Docs: https://www.remove.bg/api */
export class RemoveBgEdit implements ImageEditProvider {
  readonly name = "removebg";
  constructor(private key: string) {}
  async clean(image: ImageInput) {
    const form = new FormData();
    form.append("image_file", blob(image), "item.jpg");
    form.append("size", "auto");
    form.append("type", "product");
    form.append("crop", "true");
    form.append("crop_margin", "3%");
    form.append("format", "png");
    return bytesOf(await fetch("https://api.remove.bg/v1.0/removebg", { method: "POST", headers: { "X-Api-Key": this.key }, body: form }));
  }
}

/**
 * Photoroom Image Editing API — cut-out on a transparent background, trimmed with a small margin.
 * Docs: https://docs.photoroom.com — check field names against the current API version.
 */
export class PhotoroomEdit implements ImageEditProvider {
  readonly name = "photoroom";
  constructor(private key: string) {}
  async clean(image: ImageInput) {
    const form = new FormData();
    form.append("imageFile", blob(image), "item.jpg");
    form.append("padding", "0.03");
    form.append("export.format", "png");
    return bytesOf(await fetch("https://image-api.photoroom.com/v2/edit", { method: "POST", headers: { "x-api-key": this.key }, body: form }));
  }
}

/**
 * Generative flat-lay via Replicate (default FLUX Kontext). This is the only option that
 * actually smooths wrinkles. The prompt forbids redesigning the garment; review outputs.
 * Output is on white; the app cuts it out from the white ground afterwards.
 * Docs: https://replicate.com/black-forest-labs/flux-kontext-pro
 */
export class ReplicateFlatLayEdit implements ImageEditProvider {
  readonly name = "replicate";
  constructor(private token: string, private model: string) {}
  static PROMPT =
    "Turn this into a clean e-commerce flat-lay of the same garment: remove the background and any other objects, " +
    "place the garment centred on a pure white background, viewed straight from above, laid flat and symmetrical, " +
    "smooth out creases and wrinkles. Keep the exact same garment: identical colour, fabric texture, pattern, " +
    "stitching, buttons, logos and proportions. Do not add or remove any design details.";

  async clean(image: ImageInput) {
    const dataUri = `data:${image.mediaType};base64,${Buffer.from(image.bytes).toString("base64")}`;
    const res = await fetch(`https://api.replicate.com/v1/models/${this.model}/predictions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json", Prefer: "wait=60" },
      body: JSON.stringify({ input: { prompt: ReplicateFlatLayEdit.PROMPT, input_image: dataUri, output_format: "jpg", aspect_ratio: "4:5" } }),
    });
    if (!res.ok) throw new Error(`Replicate ${res.status}`);
    let pred = (await res.json()) as { status: string; output?: string | string[]; urls?: { get: string }; error?: string };
    for (let i = 0; i < 60 && !["succeeded", "failed", "canceled"].includes(pred.status); i++) {
      await new Promise((r) => setTimeout(r, 2000));
      pred = await (await fetch(pred.urls!.get, { headers: { Authorization: `Bearer ${this.token}` } })).json();
    }
    if (pred.status !== "succeeded" || !pred.output) throw new Error(pred.error || "Generation failed");
    const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    return bytesOf(await fetch(url));
  }
}
