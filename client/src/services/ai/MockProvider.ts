import type { Category, DetectionResult, OutfitSuggestion } from "../../types";
import { ruleBasedOutfits } from "./outfitRules";
import type { AIProvider, OutfitInputItem, OutfitRequest } from "./AIProvider";
import { segment } from "../../utils/cutout";
import { isNeutral, nearestColorName, toHex } from "../../utils/color";
import { defaultType } from "./normalize";

/**
 * Works with no network and no API key. Detection reads the photo's pixels (shape + colour);
 * outfits come from a deterministic rule-based stylist. Good enough to run and demo the app.
 */
export class MockProvider implements AIProvider {
  readonly id = "mock" as const;
  readonly label = "On-device";

  async detectClothing({ canvas }: { canvas: HTMLCanvasElement }): Promise<DetectionResult> {
    const probe = segment(canvas, { bbox: [0, 0, 1, 1], rotationDeg: 0, background: "plain" });
    const { avg, aspect } = probe.stats;
    const category: Category = aspect > 1.3 ? "shoes" : aspect < 0.62 ? "bottom" : "top";
    const color = nearestColorName(...avg);
    const type = defaultType(category);
    return {
      attributes: {
        name: `${color} ${type}`,
        category,
        type,
        color,
        colorHex: toHex(...avg),
        material: "",
        style: isNeutral(color) ? "Minimal" : "Casual",
        season: "All seasons",
        gender: "Unisex",
      },
      detection: { bbox: [0, 0, 1, 1], rotationDeg: Number.NaN, background: probe.stats.fellBack ? "busy" : "plain" },
    };
  }

  async generateOutfits(wardrobe: OutfitInputItem[], req: OutfitRequest): Promise<OutfitSuggestion[]> {
    return ruleBasedOutfits(wardrobe, req);
  }
}
