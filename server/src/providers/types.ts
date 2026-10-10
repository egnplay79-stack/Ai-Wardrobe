import type { DetectionResult, OutfitSuggestion } from "../../../client/src/types/index.js";
import type { OutfitInputItem, OutfitRequest } from "../../../client/src/services/ai/AIProvider.js";

export interface ImageInput {
  bytes: Uint8Array;
  mediaType: string;
}

/** Turns a raw photo into a clean product shot on white. */
export interface ImageEditProvider {
  readonly name: string;
  clean(image: ImageInput): Promise<ImageInput>;
}

/** Describes garments and builds outfits. */
export interface LLMProvider {
  readonly name: string;
  detect(image: ImageInput): Promise<DetectionResult>;
  outfits(wardrobe: OutfitInputItem[], req: Omit<OutfitRequest, "signal">): Promise<OutfitSuggestion[]>;
  /** Real-world sizes (cm) of several items judged together; providers without vision return {}. */
  /** Read an outfit photo; providers without vision return null. */
  look(image: ImageInput, wardrobe: OutfitInputItem[]): Promise<Record<string, unknown> | null>;
  sizes(items: { id: string; name: string; type: string; category: string; image: ImageInput }[]): Promise<Record<string, { w: number; h: number }>>;
}

export type { OutfitInputItem };
