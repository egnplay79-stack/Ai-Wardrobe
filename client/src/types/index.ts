export type Category = "top" | "bottom" | "dress" | "outerwear" | "shoes" | "accessory";

/** Order used by filters and pickers. */
export const CATEGORY_ORDER: Category[] = ["outerwear", "top", "bottom", "dress", "shoes", "accessory"];

export const CATEGORY_PLURAL: Record<Category, string> = {
  outerwear: "Outerwear",
  top: "Tops",
  bottom: "Bottoms",
  dress: "Dresses",
  shoes: "Shoes",
  accessory: "Accessories",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  top: "Top",
  bottom: "Bottom",
  dress: "Dress",
  outerwear: "Outerwear",
  shoes: "Shoes",
  accessory: "Accessory",
};

export type Season = "All seasons" | "Spring / Summer" | "Autumn / Winter" | "Summer" | "Winter";
export type Gender = "Women" | "Men" | "Unisex";

/** Attributes the AI infers from a photo. Every field is editable by the user. */
export interface ItemAttributes {
  name: string;
  category: Category;
  /** Specific garment type: Shirt, Jeans, Sneakers… */
  type: string;
  color: string;
  colorHex: string;
  material?: string;
  style: string;
  season: Season | string;
  gender?: Gender | string;
  /** User size adjustment (1 = as detected). Scales the item in outfits. */
  scale?: number;
  /** Real-world size of the item as it lies in its cut-out, in cm, estimated by AI from the photo. */
  realCm?: { w: number; h: number };
}

export interface WardrobeItem extends ItemAttributes {
  id: string;
  userId: string;
  imageUrl: string;
  /** Storage-specific pointer to the image (asset id, blob key). */
  imageRef?: string;
  createdAt: number;
}

export interface Outfit {
  id: string;
  userId: string;
  name: string;
  itemIds: string[];
  description: string;
  /** Short "why it works" bullet points. */
  reasons: string[];
  /** wardrobe — AI picked from the selected items; item — built around one item; manual — exactly the items the user chose. */
  source: "wardrobe" | "item" | "manual";
  anchorItemId?: string;
  /**
   * Saved outfits stay until the user deletes them. Unsaved ones are AI suggestions that the
   * next generation replaces. Missing (outfits from older versions) counts as saved.
   */
  saved?: boolean;
  createdAt: number;
}

/** Where the clothing sits in the photo, as fractions of width/height (0..1). */
export interface Detection {
  bbox: [number, number, number, number];
  /** Clockwise tilt of the garment from its natural upright position, degrees. NaN = estimate on-device. */
  rotationDeg: number;
  background: "plain" | "busy";
  /** Rough outline of the item as polygon points (fractions of the photo). Optional prior for cut-out. */
  outline?: [number, number][];
}

export interface DetectionResult {
  attributes: ItemAttributes;
  detection: Detection;
}

/** Result of POST /api/items/process (and of the on-device pipeline). */
export interface ProcessedItem {
  processedImage: Blob;
  previewUrl: string;
  attributes: ItemAttributes;
}

export interface OutfitSuggestion {
  name: string;
  items: string[];
  reason: string;
  reasons?: string[];
}

export type { SegmentOptions as ProcessingOptions } from "../utils/cutout";

export type ProcessingStage = "detect" | "isolate" | "straighten" | "finish";

export const isSaved = (o: Outfit) => o.saved !== false;

/** A photo of an outfit the user wore or likes, with AI-read details. */
export interface Look {
  id: string;
  userId: string;
  imageUrl: string;
  imageRef?: string;
  title: string;
  note: string;
  /** What AI sees: one or two sentences. */
  description: string;
  /** Pieces AI spotted in the photo, in words ("Black puffer jacket"). */
  pieces: string[];
  /** Wardrobe items that appear in the photo (AI-matched, user-editable). */
  itemIds: string[];
  tags: string[];
  createdAt: number;
}

export interface LookAnalysis {
  title: string;
  description: string;
  pieces: string[];
  itemIds: string[];
  tags: string[];
}
