import type { LLMProvider, OutfitInputItem } from "./types.js";
import { ruleBasedOutfits } from "../../../client/src/services/ai/outfitRules.js";
import { normalizeDetection } from "../../../client/src/services/ai/normalize.js";

/** No-key fallback: rule-based outfits, neutral attributes (the user edits them in the app). */
export class RulesProvider implements LLMProvider {
  readonly name = "rules";
  async detect() {
    return normalizeDetection({ name: "New item", category: "top", type: "Top", color: "Neutral", style: "Casual" });
  }
  async look() {
    return null;
  }
  async sizes() {
    return {};
  }
  async outfits(wardrobe: OutfitInputItem[], req: { anchorItemId?: string; occasion?: string; max?: number; exact?: boolean; strategy?: "all" | "best" }) {
    return ruleBasedOutfits(wardrobe, req);
  }
}
