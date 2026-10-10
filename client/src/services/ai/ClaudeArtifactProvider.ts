import type { DetectionResult, OutfitSuggestion } from "../../types";
import { AIUnavailableError, type AIProvider, type OutfitInputItem, type OutfitRequest, type SizeRequestItem } from "./AIProvider";
import { getSample } from "./claudeRuntime";
import { DETECT_PROMPT, lookPrompt, outfitPrompt, sizesPrompt } from "./prompts";
import { normalizeDetection, normalizeLook, normalizeOutfits, normalizeSizes } from "./normalize";

/** Uses Claude through the artifact runtime when the app is opened inside Claude. No keys needed. */
export class ClaudeArtifactProvider implements AIProvider {
  readonly id = "claude" as const;
  readonly label = "Claude";

  static async isAvailable(): Promise<boolean> {
    return (await getSample()) !== null;
  }

  private async sample() {
    const s = await getSample();
    if (!s) throw new AIUnavailableError("Claude is not available here", "unavailable");
    return s;
  }

  async detectClothing({ image, signal }: { image: Blob; signal?: AbortSignal }): Promise<DetectionResult> {
    const s = await this.sample();
    const lim = await s.limits().catch(() => null);
    if (!lim?.images) throw new AIUnavailableError("Images are not supported in this view", "images_unavailable");
    try {
      const raw = await s.json(DETECT_PROMPT, { images: image, signal, cache: false });
      return normalizeDetection(raw);
    } catch (e) {
      throw wrap(e);
    }
  }

  async describeLook(image: Blob, wardrobe: OutfitInputItem[], signal?: AbortSignal) {
    const s = await this.sample();
    const lim = await s.limits().catch(() => null);
    if (!lim?.images) throw new AIUnavailableError("Images are not supported in this view", "images_unavailable");
    try {
      const raw = await s.json(lookPrompt(wardrobe), { images: image, signal, cache: false });
      return normalizeLook(raw, new Set(wardrobe.map((w) => w.id)));
    } catch (e) {
      throw wrap(e);
    }
  }

  estimateSizes(items: SizeRequestItem[], signal?: AbortSignal) {
    return estimateSizesWithClaude(items, signal);
  }

  async generateOutfits(wardrobe: OutfitInputItem[], req: OutfitRequest): Promise<OutfitSuggestion[]> {
    const s = await this.sample();
    try {
      const raw = await s.json(outfitPrompt(wardrobe, req), { signal: req.signal, cache: false });
      return normalizeOutfits(raw, new Set(wardrobe.map((i) => i.id)), req.anchorItemId, req.exact, req.strategy === "best" ? 1 : undefined);
    } catch (e) {
      throw wrap(e);
    }
  }
}

export async function estimateSizesWithClaude(items: SizeRequestItem[], signal?: AbortSignal) {
  const s = await getSample();
  if (!s) throw new AIUnavailableError("Claude is not available here", "unavailable");
  const lim = await s.limits().catch(() => null);
  if (!lim?.images) throw new AIUnavailableError("Images are not supported in this view", "images_unavailable");
  const per = Math.max(1, Math.min(8, lim.images.maxCount));
  const out: Record<string, { w: number; h: number }> = {};
  for (let i = 0; i < items.length; i += per) {
    const chunk = items.slice(i, i + per);
    try {
      const raw = await s.json(sizesPrompt(chunk), { images: chunk.map((c) => c.image), signal, cache: false });
      Object.assign(out, normalizeSizes(raw, chunk.map((c) => c.id)));
    } catch (e) {
      throw wrap(e);
    }
  }
  return out;
}

function wrap(e: unknown): Error {
  const code = (e as { code?: string })?.code ?? "upstream_error";
  return new AIUnavailableError((e as { message?: string })?.message ?? "AI request failed", code);
}
