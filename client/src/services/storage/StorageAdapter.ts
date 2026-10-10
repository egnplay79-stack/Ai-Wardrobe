import type { Look, Outfit, WardrobeItem } from "../../types";

export interface WardrobeState {
  items: WardrobeItem[];
  outfits: Outfit[];
  looks: Look[];
}

export type NewItem = Omit<WardrobeItem, "id" | "userId" | "imageUrl" | "imageRef" | "createdAt">;
export type NewOutfit = Omit<Outfit, "id" | "userId" | "createdAt">;
export type NewLook = Omit<Look, "id" | "userId" | "imageUrl" | "imageRef" | "createdAt">;

/**
 * Persistence boundary. Swap for a REST/Supabase/Firebase adapter without touching the UI.
 * Implementations push the full state to subscribers after every change.
 */
export interface StorageAdapter {
  readonly kind: "artifact" | "local" | "memory";
  init(): Promise<void>;
  subscribe(fn: (s: WardrobeState) => void): () => void;
  addItem(item: NewItem, image: Blob): Promise<WardrobeItem>;
  updateItem(id: string, patch: Partial<NewItem>): Promise<void>;
  deleteItem(item: WardrobeItem): Promise<void>;
  addOutfits(outfits: NewOutfit[]): Promise<Outfit[]>;
  updateOutfit(id: string, patch: Partial<NewOutfit>): Promise<void>;
  deleteOutfits(ids: string[]): Promise<void>;
  addLook(look: NewLook, image: Blob): Promise<Look>;
  updateLook(id: string, patch: Partial<NewLook>): Promise<void>;
  deleteLook(look: Look): Promise<void>;
}
