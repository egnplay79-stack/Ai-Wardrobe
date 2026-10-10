import { isSaved, type Outfit, type WardrobeItem } from "../types";
import type { OutfitInputItem } from "./ai/AIProvider";
import type { NewOutfit } from "./storage/StorageAdapter";
import { AIService } from "./AIService";
import { WardrobeService } from "./WardrobeService";

export type GenerateStrategy = "all" | "best";

const toInput = (i: WardrobeItem): OutfitInputItem => ({
  id: i.id, name: i.name, category: i.category, type: i.type, color: i.color, style: i.style, season: String(i.season), material: i.material || undefined,
});

/** Minimum wardrobe for a complete outfit: (top + bottom) or a dress. */
export function canGenerate(items: WardrobeItem[]): boolean {
  const has = (c: string) => items.some((i) => i.category === c);
  return (has("top") && has("bottom")) || has("dress");
}

export const OutfitGenerationService = {
  /**
   * AI builds outfits from the items the user selected; replaces the previous unsaved suggestions.
   * "all" — every good combination; "best" — the single most harmonious outfit.
   */
  async generate(items: WardrobeItem[], current: Outfit[], signal?: AbortSignal, strategy: GenerateStrategy = "all"): Promise<Outfit[]> {
    const max = strategy === "best" ? 1 : 12;
    const suggestions = await AIService.run((p) => p.generateOutfits(items.map(toInput), { max, strategy, signal }));
    const fresh: NewOutfit[] = suggestions.map((s) => ({
      name: s.name, itemIds: s.items, description: s.reason, reasons: s.reasons ?? [], source: "wardrobe", saved: false,
    }));
    // New suggestions replace old unsaved ones; saved outfits are never touched.
    return replace(current.filter((o) => o.source === "wardrobe" && !isSaved(o)).map((o) => o.id), fresh);
  },

  /** The user's selection becomes exactly one outfit; AI names and explains it. Kept alongside others. */
  /** Change the pieces of an existing outfit in place (same id), re-explained by AI. */
  async editOutfit(id: string, items: WardrobeItem[], name: string | undefined, signal?: AbortSignal): Promise<Outfit[]> {
    const suggestions = await AIService.run((p) => p.generateOutfits(items.map(toInput), { exact: true, max: 1, signal }));
    const s = suggestions[0];
    const adapter = await WardrobeService.init();
    const patch = {
      itemIds: items.map((i) => i.id),
      name: name || s?.name || "My outfit",
      description: s?.reason ?? "",
      reasons: s?.reasons ?? [],
      saved: true,
    };
    await adapter.updateOutfit(id, patch);
    return [];
  },

  async composeExact(items: WardrobeItem[], signal?: AbortSignal, replaceId?: string): Promise<Outfit[]> {
    const suggestions = await AIService.run((p) => p.generateOutfits(items.map(toInput), { exact: true, max: 1, signal }));
    const s = suggestions[0] ?? { name: "My outfit", items: items.map((i) => i.id), reason: "", reasons: [] };
    // Your own set is saved straight away. When editing an outfit, the new one replaces it.
    return replace(replaceId ? [replaceId] : [], [{ name: s.name, itemIds: items.map((i) => i.id), description: s.reason, reasons: s.reasons ?? [], source: "manual", saved: true }]);
  },

  /** "Create outfit" from one item: outfits built around it. Replaces earlier ones for that item. */
  async generateForItem(anchor: WardrobeItem, items: WardrobeItem[], current: Outfit[], signal?: AbortSignal): Promise<Outfit[]> {
    const suggestions = await AIService.run((p) =>
      p.generateOutfits(items.map(toInput), { anchorItemId: anchor.id, max: 3, signal }),
    );
    const fresh: NewOutfit[] = suggestions.map((s) => ({
      name: s.name, itemIds: s.items, description: s.reason, reasons: s.reasons ?? [], source: "item", anchorItemId: anchor.id, saved: false,
    }));
    return replace(current.filter((o) => o.source === "item" && o.anchorItemId === anchor.id && !isSaved(o)).map((o) => o.id), fresh);
  },
};

async function replace(oldIds: string[], fresh: NewOutfit[]): Promise<Outfit[]> {
  const adapter = await WardrobeService.init();
  if (!fresh.length) return [];
  if (oldIds.length) await adapter.deleteOutfits(oldIds);
  return adapter.addOutfits(fresh);
}

/** Save or unsave an outfit. */
export async function setOutfitSaved(id: string, saved: boolean) {
  const adapter = await WardrobeService.init();
  await adapter.updateOutfit(id, { saved });
}

export async function renameOutfit(id: string, name: string) {
  const adapter = await WardrobeService.init();
  await adapter.updateOutfit(id, { name });
}
