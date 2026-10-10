import type { DetectionResult } from "../types";
import { AIService } from "./AIService";
import { canvasToBlob, downscale } from "../utils/image";

/** Finds the garment in a photo and describes it, via whichever AI provider is active. */
export const ClothingDetectionService = {
  async detect(canvas: HTMLCanvasElement, signal?: AbortSignal): Promise<DetectionResult> {
    const image = await canvasToBlob(downscale(canvas, 1024), "image/jpeg", 0.88);
    return AIService.run((p) => p.detectClothing({ image, canvas, signal }));
  },
};
