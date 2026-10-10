import type { WardrobeItem } from "../types";
import { AIService } from "./AIService";
import { WardrobeService } from "./WardrobeService";
import { canvasToBlob } from "../utils/image";

/** Items already sent for measuring in this session (success or not), so we never loop. */
const attempted = new Set<string>();

/** Cut-out flattened onto white, ≤512 px — what the vision model looks at. */
async function onWhite(url: string): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = url;
  });
  const k = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * k));
  c.height = Math.max(1, Math.round(img.naturalHeight * k));
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  return canvasToBlob(c, "image/jpeg", 0.85);
}

/**
 * Real-world sizes for outfit layout. Items saved before AI sizing (or added offline) are
 * measured once, all together, so the model keeps them consistent with each other; the
 * result is stored on each item. Without a vision-capable provider the size table is used.
 */
export const SizingService = {
  needs(items: WardrobeItem[]) {
    return items.filter((i) => !i.realCm && !attempted.has(i.id));
  },

  async ensure(items: WardrobeItem[], signal?: AbortSignal): Promise<number> {
    const need = this.needs(items);
    if (!need.length) return 0;
    need.forEach((i) => attempted.add(i.id));
    const provider = await AIService.provider();
    if (!provider.estimateSizes) return 0;
    try {
      const reqs = await Promise.all(
        need.map(async (i) => ({ id: i.id, name: i.name, type: i.type, category: i.category, image: await onWhite(i.imageUrl) })),
      );
      const sizes = await provider.estimateSizes(reqs, signal);
      let n = 0;
      for (const [id, realCm] of Object.entries(sizes)) {
        await WardrobeService.updateItem(id, { realCm });
        n++;
      }
      return n;
    } catch {
      return 0;
    }
  },
};
