import type { Detection, ItemAttributes, OutfitSuggestion } from "../types";
import type { OutfitInputItem, OutfitRequest } from "../services/ai/AIProvider";

/** Base URL of the AI Wardrobe backend (see /server). Empty = same origin. */
export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(API_URL + path, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(text || res.statusText, res.status);
  }
  return res.json() as Promise<T>;
}

export type ProcessResponse = ItemAttributes & { processedImage: string | null; detection?: Detection };

/** POST /api/items/process — multipart image in; processed image (or null) + attributes + detection out. */
export async function processItemApi(image: Blob, opts: { detectOnly?: boolean; signal?: AbortSignal } = {}) {
  const body = new FormData();
  body.append("image", image, "item.jpg");
  const r = await request<ProcessResponse>("/api/items/process" + (opts.detectOnly ? "?detectOnly=1" : ""), {
    method: "POST",
    body,
    signal: opts.signal,
  });
  const blob = r.processedImage ? await (await fetch(r.processedImage)).blob() : null; // data: URL from the server
  return { processedImage: blob, raw: r };
}

/** POST /api/outfits/generate — wardrobe in, outfits out. */
export function generateOutfitsApi(wardrobe: OutfitInputItem[], req: OutfitRequest) {
  return request<{ outfits: OutfitSuggestion[] }>("/api/outfits/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wardrobe, anchorItemId: req.anchorItemId, occasion: req.occasion, max: req.max, exact: req.exact, strategy: req.strategy }),
    signal: req.signal,
  });
}

export async function healthApi(): Promise<boolean> {
  try {
    const r = await fetch(API_URL + "/api/health", { signal: AbortSignal.timeout(2500) });
    return r.ok;
  } catch {
    return false;
  }
}

/** POST /api/items/sizes — several cut-outs in, real-world sizes (cm) out. */
export async function estimateSizesApi(items: { id: string; image: Blob; name: string; type: string; category: string }[], signal?: AbortSignal) {
  const body = new FormData();
  items.forEach((it) => body.append("images", it.image, `${it.id}.jpg`));
  body.append("meta", JSON.stringify(items.map(({ id, name, type, category }) => ({ id, name, type, category }))));
  return request<{ sizes: { id: string; width_cm: number; height_cm: number }[] }>("/api/items/sizes", { method: "POST", body, signal });
}

/** POST /api/looks/describe — outfit photo + wardrobe in, name / description / pieces / matched ids out. */
export async function describeLookApi(image: Blob, wardrobe: OutfitInputItem[], signal?: AbortSignal) {
  const body = new FormData();
  body.append("image", image, "look.jpg");
  body.append("wardrobe", JSON.stringify(wardrobe));
  return request<Record<string, unknown>>("/api/looks/describe", { method: "POST", body, signal });
}
