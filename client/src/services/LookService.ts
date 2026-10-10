import type { Look, LookAnalysis, WardrobeItem } from "../types";
import type { NewLook } from "./storage/StorageAdapter";
import { AIService } from "./AIService";
import { WardrobeService } from "./WardrobeService";
import { canvasToBlob, downscale, fileToCanvas } from "../utils/image";

export interface LookDraft {
  image: Blob;
  previewUrl: string;
}

const toInput = (i: WardrobeItem) => ({
  id: i.id, name: i.name, category: i.category, type: i.type, color: i.color, style: i.style, season: String(i.season),
});

export const defaultLookTitle = () =>
  "Look · " + new Date().toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** Photos of outfits the user wore or likes. Kept as taken (no background removal). */
export const LookService = {
  async prepare(file: Blob): Promise<LookDraft> {
    const canvas = await fileToCanvas(file, 1600);
    const image = await canvasToBlob(canvas, "image/jpeg", 0.86);
    return { image, previewUrl: URL.createObjectURL(image) };
  },

  /** AI reads the photo and matches pieces to the wardrobe. Null when no vision AI is available. */
  async analyze(draft: LookDraft, wardrobe: WardrobeItem[], signal?: AbortSignal): Promise<LookAnalysis | null> {
    const provider = await AIService.provider();
    if (!provider.describeLook) return null;
    try {
      const small = await canvasToBlob(downscale(await fileToCanvas(draft.image, 1400), 1024), "image/jpeg", 0.85);
      return await provider.describeLook(small, wardrobe.map(toInput), signal);
    } catch (e) {
      if ((e as Error)?.name === "AbortError" || (e as { code?: string })?.code === "cancelled") throw e;
      return null;
    }
  },

  async save(data: NewLook, image: Blob): Promise<Look> {
    return (await WardrobeService.init()).addLook(data, image);
  },

  async update(id: string, patch: Partial<NewLook>) {
    await (await WardrobeService.init()).updateLook(id, patch);
  },

  async remove(look: Look) {
    await (await WardrobeService.init()).deleteLook(look);
  },
};
