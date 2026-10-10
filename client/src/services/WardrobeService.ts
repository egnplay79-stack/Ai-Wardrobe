import type { ItemAttributes, WardrobeItem } from "../types";
import type { StorageAdapter, WardrobeState } from "./storage/StorageAdapter";
import { ArtifactStorageAdapter } from "./storage/ArtifactStorageAdapter";
import { LocalStorageAdapter } from "./storage/LocalStorageAdapter";

/** Wardrobe CRUD on top of whichever storage adapter fits the environment. */
class WardrobeServiceImpl {
  private adapter: StorageAdapter | null = null;
  private ready: Promise<StorageAdapter> | null = null;

  init(): Promise<StorageAdapter> {
    if (!this.ready) {
      this.ready = (async () => {
        const adapter: StorageAdapter = (await ArtifactStorageAdapter.create()) ?? new LocalStorageAdapter();
        await adapter.init();
        this.adapter = adapter;
        return adapter;
      })();
    }
    return this.ready;
  }

  private async a() {
    return this.adapter ?? this.init();
  }

  async subscribe(fn: (s: WardrobeState) => void) {
    return (await this.a()).subscribe(fn);
  }

  get storageKind() {
    return this.adapter?.kind;
  }

  async addItem(attributes: ItemAttributes, image: Blob) {
    return (await this.a()).addItem(attributes, image);
  }

  async updateItem(id: string, patch: Partial<ItemAttributes>) {
    return (await this.a()).updateItem(id, patch);
  }

  /** Deleting an item also removes outfits that can no longer be worn without it. */
  async removeItem(item: WardrobeItem, outfitIdsUsingIt: string[]) {
    const a = await this.a();
    if (outfitIdsUsingIt.length) await a.deleteOutfits(outfitIdsUsingIt);
    await a.deleteItem(item);
  }
}

export const WardrobeService = new WardrobeServiceImpl();
