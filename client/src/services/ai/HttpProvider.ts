import type { DetectionResult, OutfitSuggestion } from "../../types";
import { AIUnavailableError, type AIProvider, type OutfitInputItem, type OutfitRequest, type ServerProcessedItem, type SizeRequestItem } from "./AIProvider";
import { describeLookApi, estimateSizesApi, generateOutfitsApi, processItemApi, type ProcessResponse } from "../../api/client";
import { normalizeDetection, normalizeLook, normalizeOutfits, normalizeSizes } from "./normalize";

const toDetection = (r: ProcessResponse): DetectionResult => {
  const d = r.detection;
  return normalizeDetection({
    ...r,
    color_hex: r.colorHex,
    bbox: d?.bbox,
    rotation_deg: d?.rotationDeg,
    background: d?.background,
  });
};

/**
 * Talks to the AI Wardrobe backend (see /server). The server owns vendor keys and can run
 * heavy models (segmentation, generative flat-lay) that a phone cannot.
 */
export class HttpProvider implements AIProvider {
  readonly id = "http" as const;
  readonly label = "Server";

  /** Full server pipeline. Throws when the server has no image model, so the app goes on-device. */
  async processItem(image: Blob, signal?: AbortSignal): Promise<ServerProcessedItem> {
    const { processedImage, raw } = await processItemApi(image, { signal });
    if (!processedImage) {
      this.cached = { image, result: toDetection(raw) };
      throw new AIUnavailableError("Server returned no processed image", "no_image_model");
    }
    return { processedImage, attributes: toDetection(raw).attributes };
  }

  /** Remembers the last detection so the on-device fallback doesn't call the server twice. */
  private cached: { image: Blob; result: DetectionResult } | null = null;

  async detectClothing({ image, signal }: { image: Blob; signal?: AbortSignal }): Promise<DetectionResult> {
    if (this.cached) {
      const r = this.cached.result;
      this.cached = null;
      return r;
    }
    const { raw } = await processItemApi(image, { detectOnly: true, signal });
    return toDetection(raw);
  }

  async describeLook(image: Blob, wardrobe: OutfitInputItem[], signal?: AbortSignal) {
    return normalizeLook(await describeLookApi(image, wardrobe, signal), new Set(wardrobe.map((w) => w.id)));
  }

  async estimateSizes(items: SizeRequestItem[], signal?: AbortSignal) {
    const r = await estimateSizesApi(items, signal);
    return normalizeSizes(r, items.map((i) => i.id));
  }

  async generateOutfits(wardrobe: OutfitInputItem[], req: OutfitRequest): Promise<OutfitSuggestion[]> {
    const r = await generateOutfitsApi(wardrobe, req);
    return normalizeOutfits(r, new Set(wardrobe.map((i) => i.id)), req.anchorItemId, req.exact, req.strategy === "best" ? 1 : undefined);
  }
}
