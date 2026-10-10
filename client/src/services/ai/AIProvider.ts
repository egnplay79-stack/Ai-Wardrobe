import type { Category, DetectionResult, ItemAttributes, LookAnalysis, OutfitSuggestion } from "../../types";

/** The slice of a wardrobe item an outfit model needs. Images are never sent for outfits. */
export interface OutfitInputItem {
  id: string;
  name: string;
  category: Category;
  type: string;
  color: string;
  style: string;
  season: string;
  material?: string;
}

export interface OutfitRequest {
  /** Build outfits around this item ("Create outfit from this item"). */
  anchorItemId?: string;
  occasion?: string;
  max?: number;
  /** Use exactly these items as ONE outfit: name it, explain it, don't add or drop anything. */
  exact?: boolean;
  /**
   * "all": every distinct good combination of the given items (up to `max`).
   * "best": the single most harmonious outfit; pieces that don't fit may be left out.
   */
  strategy?: "all" | "best";
  signal?: AbortSignal;
}

export interface SizeRequestItem {
  id: string;
  /** Cut-out on white, small JPEG. */
  image: Blob;
  name: string;
  type: string;
  category: Category;
}

export interface ServerProcessedItem {
  processedImage: Blob;
  attributes: ItemAttributes;
}

/**
 * Every AI vendor sits behind this interface. Swap providers in `services/ai/index.ts`;
 * nothing in screens, hooks or other services knows which one is active.
 */
export interface AIProvider {
  readonly id: "mock" | "claude" | "http";
  readonly label: string;

  /** Find the garment in the photo and describe it. */
  detectClothing(input: { image: Blob; canvas: HTMLCanvasElement; signal?: AbortSignal }): Promise<DetectionResult>;

  /** Combine wardrobe items into outfits. Must only return ids that exist in `wardrobe`. */
  generateOutfits(wardrobe: OutfitInputItem[], req: OutfitRequest): Promise<OutfitSuggestion[]>;

  /**
   * Optional: the whole pipeline runs server-side (POST /api/items/process) — e.g. a
   * generative model that also smooths wrinkles. When present it replaces on-device processing.
   */
  processItem?(image: Blob, signal?: AbortSignal): Promise<ServerProcessedItem>;

  /**
   * Optional: estimate real-world sizes (cm) of several items from their photos, judged
   * together so they're consistent with each other. Providers without vision omit it.
   */
  estimateSizes?(items: SizeRequestItem[], signal?: AbortSignal): Promise<Record<string, { w: number; h: number }>>;

  /** Optional: read an outfit photo — name, description, visible pieces, matching wardrobe items. */
  describeLook?(image: Blob, wardrobe: OutfitInputItem[], signal?: AbortSignal): Promise<LookAnalysis>;
}

export class AIUnavailableError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}
