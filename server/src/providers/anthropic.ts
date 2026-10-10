import Anthropic from "@anthropic-ai/sdk";
import type { ImageInput, LLMProvider, OutfitInputItem } from "./types.js";
import { DETECT_PROMPT, lookPrompt, outfitPrompt, sizesPrompt } from "../../../client/src/services/ai/prompts.js";
import { normalizeDetection, normalizeOutfits, normalizeSizes } from "../../../client/src/services/ai/normalize.js";

const MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  constructor(apiKey: string, private model: string) {
    this.client = new Anthropic({ apiKey });
  }

  private async json(content: Anthropic.MessageParam["content"], maxTokens = 1200): Promise<unknown> {
    const res = await this.client.messages.create({ model: this.model, max_tokens: maxTokens, messages: [{ role: "user", content }] });
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const start = text.search(/[[{]/), end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
    if (start < 0 || end < start) throw new Error("Model did not return JSON");
    return JSON.parse(text.slice(start, end + 1));
  }

  async detect(image: ImageInput) {
    const media_type = (MEDIA.has(image.mediaType) ? image.mediaType : "image/jpeg") as "image/jpeg";
    const raw = await this.json([
      { type: "image", source: { type: "base64", media_type, data: Buffer.from(image.bytes).toString("base64") } },
      { type: "text", text: DETECT_PROMPT },
    ], 600);
    return normalizeDetection(raw);
  }

  async look(image: ImageInput, wardrobe: OutfitInputItem[]) {
    const media_type = (MEDIA.has(image.mediaType) ? image.mediaType : "image/jpeg") as "image/jpeg";
    return (await this.json([
      { type: "image", source: { type: "base64", media_type, data: Buffer.from(image.bytes).toString("base64") } },
      { type: "text", text: lookPrompt(wardrobe) },
    ], 900)) as Record<string, unknown>;
  }

  async sizes(items: { id: string; name: string; type: string; category: string; image: ImageInput }[]) {
    const content: Anthropic.MessageParam["content"] = items.map((it) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: (MEDIA.has(it.image.mediaType) ? it.image.mediaType : "image/jpeg") as "image/jpeg", data: Buffer.from(it.image.bytes).toString("base64") },
    }));
    content.push({ type: "text", text: sizesPrompt(items) });
    return normalizeSizes(await this.json(content, 800), items.map((i) => i.id));
  }

  async outfits(wardrobe: OutfitInputItem[], req: { anchorItemId?: string; occasion?: string; max?: number; exact?: boolean; strategy?: "all" | "best" }) {
    const raw = await this.json(outfitPrompt(wardrobe, req));
    return normalizeOutfits(raw, new Set(wardrobe.map((i) => i.id)), req.anchorItemId, req.exact, req.strategy === "best" ? 1 : undefined);
  }
}
