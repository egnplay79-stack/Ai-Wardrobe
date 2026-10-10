import type { Detection, ItemAttributes, ProcessingOptions, ProcessingStage } from "../types";
import { AIService } from "./AIService";
import { ClothingDetectionService } from "./ClothingDetectionService";
import { segment, toCutout } from "../utils/cutout";
import { canvasToBlob, fileToCanvas, nextFrame } from "../utils/image";

/** One background-removal result the user can pick. */
export interface Variant {
  image: Blob;
  previewUrl: string;
  /** False when the background could not be separated (busy or same-colour surface). */
  separated: boolean;
  /** Short name of the method used, shown under the photo. */
  label: string;
  coverage: number;
  ragged: number;
}

export interface ProcessingSession {
  source: HTMLCanvasElement;
  sourceUrl: string;
  detection: Detection | null;
  attributes: ItemAttributes;
  variants: Variant[];
  /** Selected variant. */
  index: number;
  /** Retries so far; decides the next strategy. */
  attempt: number;
}

export const current = (s: ProcessingSession) => s.variants[s.index];

/**
 * Each "Try again" removes the background a different way. Order: from the default towards
 * stricter, looser, finer and simpler methods, so consecutive results really differ.
 */
const STRATEGIES: { label: string; opts: ProcessingOptions }[] = [
  { label: "Standard", opts: {} },
  { label: "Cleaner edges", opts: { tolerance: 0.8, bias: 1.25, shave: 1 } },
  { label: "Keep more fabric", opts: { tolerance: 1.35, bias: 0.75, shadow: false } },
  { label: "Fine detail", opts: { workMax: 1400, tolerance: 0.9, feather: 1 } },
  { label: "Follow the outline", opts: { refine: false, tolerance: 1.1 } },
  { label: "Strong removal", opts: { tolerance: 1.7, bias: 1.4, shave: 2 } },
];

/**
 * Photo → the garment alone, background removed (transparent PNG). The app shows it on white.
 * If the active provider can process server-side, its result is the first variant;
 * every retry runs the on-device remover with a different strategy.
 */
export const ImageProcessingService = {
  async process(file: Blob, onStage: (s: ProcessingStage) => void, signal?: AbortSignal): Promise<ProcessingSession> {
    const source = await fileToCanvas(file);
    const sourceUrl = source.toDataURL("image/jpeg", 0.8);
    const provider = await AIService.provider();

    if (provider.processItem) {
      onStage("detect");
      try {
        const r = await provider.processItem(await canvasToBlob(source), signal);
        onStage("isolate");
        const image = await ensureCutout(r.processedImage);
        onStage("finish");
        const v: Variant = { image, previewUrl: URL.createObjectURL(image), separated: true, label: "Server", coverage: -1, ragged: -1 };
        return { source, sourceUrl, detection: null, attributes: r.attributes, variants: [v], index: 0, attempt: 0 };
      } catch (e) {
        if ((e as Error)?.name === "AbortError") throw e;
        // fall through to the on-device pipeline
      }
    }

    onStage("detect");
    const { attributes, detection } = await ClothingDetectionService.detect(source, signal);
    const v = await this.render(source, detection, STRATEGIES[0], onStage);
    return { source, sourceUrl, detection, attributes, variants: [v], index: 0, attempt: 0 };
  },

  async render(source: HTMLCanvasElement, detection: Detection, strategy: (typeof STRATEGIES)[number], onStage?: (s: ProcessingStage) => void): Promise<Variant> {
    onStage?.("isolate");
    await nextFrame();
    const seg = segment(source, detection, strategy.opts);
    onStage?.("straighten");
    await nextFrame();
    onStage?.("finish");
    const image = await canvasToBlob(toCutout(seg.canvas), "image/png");
    return {
      image, previewUrl: URL.createObjectURL(image), separated: !seg.stats.fellBack,
      label: strategy.label, coverage: seg.stats.coverage, ragged: seg.stats.ragged,
    };
  },

  /**
   * "Try again": remove the background anew with the next strategy. A result is only offered if
   * it differs from the earlier versions and passes a quality check (not the whole photo, not a
   * shredded outline); otherwise the next strategy is tried. `added` is false if none qualified.
   * The item is re-detected by AI on the first retry and after each full cycle.
   */
  async retry(session: ProcessingSession, onStage: (s: ProcessingStage) => void, signal?: AbortSignal): Promise<{ session: ProcessingSession; added: boolean }> {
    let attempt = session.attempt;
    let detection = session.detection;
    const seen = session.variants.map((v) => v.coverage).filter((c) => c >= 0);
    const known = session.variants.map((v) => v.ragged).filter((r) => r > 0);
    const bestRagged = known.length ? Math.min(...known) : Infinity;

    for (let tries = 0; tries < STRATEGIES.length; tries++) {
      attempt++;
      const cycle = Math.floor(attempt / STRATEGIES.length);
      if (!detection || attempt === 1 || attempt % STRATEGIES.length === 0) {
        onStage("detect");
        try {
          detection = (await ClothingDetectionService.detect(session.source, signal)).detection;
        } catch (e) {
          if ((e as Error)?.name === "AbortError") throw e;
          detection = detection ?? { bbox: [0, 0, 1, 1], rotationDeg: Number.NaN, background: "plain" };
        }
      }
      const base = STRATEGIES[attempt % STRATEGIES.length];
      // On later cycles nudge the settings so the same method still gives a new result.
      const strategy = cycle === 0 ? base : {
        label: `${base.label} · alt ${cycle}`,
        opts: { ...base.opts, tolerance: (base.opts.tolerance ?? 1) * (1 + 0.12 * (cycle % 2 ? 1 : -1)) },
      };
      const v = await this.render(session.source, detection, strategy, onStage);
      const duplicate = seen.some((c) => Math.abs(c - v.coverage) < 0.003);
      const usable = v.separated && v.coverage > 0.02 && v.coverage < 0.85 && v.ragged <= bestRagged * 1.6;
      if (!duplicate && usable) {
        const variants = [...session.variants, v];
        return { session: { ...session, detection, variants, index: variants.length - 1, attempt }, added: true };
      }
      URL.revokeObjectURL(v.previewUrl);
    }
    return { session: { ...session, attempt, detection }, added: false };
  },
};

/**
 * Server images may arrive already transparent (remove.bg / Photoroom) or on white
 * (generative flat-lay). Anything with an opaque border gets cut out from its white ground here.
 */
async function ensureCutout(image: Blob): Promise<Blob> {
  const c = await fileToCanvas(image, 1400);
  const g = c.getContext("2d", { willReadFrequently: true })!;
  const corners = [[1, 1], [c.width - 2, 1], [1, c.height - 2], [c.width - 2, c.height - 2]];
  const transparent = corners.every(([x, y]) => g.getImageData(x, y, 1, 1).data[3] < 20);
  if (transparent) return image;
  const seg = segment(c, { bbox: [0, 0, 1, 1], rotationDeg: 0, background: "plain" });
  return canvasToBlob(toCutout(seg.canvas), "image/png");
}
