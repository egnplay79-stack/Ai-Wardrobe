import { useCallback, useRef, useState } from "react";
import type { Outfit, WardrobeItem } from "../types";
import { OutfitGenerationService, type GenerateStrategy } from "../services/OutfitGenerationService";

export function useOutfitGeneration() {
  /** null, "wardrobe", "manual" or the anchor item id. */
  const [generating, setGenerating] = useState<null | string>(null);
  const [error, setError] = useState<string | null>(null);
  const ctl = useRef<AbortController | null>(null);

  const run = useCallback(async (key: string, job: (signal: AbortSignal) => Promise<Outfit[]>) => {
    ctl.current?.abort();
    ctl.current = new AbortController();
    setGenerating(key);
    setError(null);
    try {
      const res = await job(ctl.current.signal);
      if (!res.length) setError("No complete outfit found yet. Add a top, a bottom or shoes.");
      return res;
    } catch (e) {
      const code = (e as { code?: string; name?: string })?.code ?? (e as Error)?.name;
      if (code !== "cancelled" && code !== "AbortError") setError("Outfits couldn't be generated. Try again.");
      return [];
    } finally {
      setGenerating(null);
    }
  }, []);

  const generate = useCallback(
    (items: WardrobeItem[], current: Outfit[], strategy: GenerateStrategy = "all") =>
      run("wardrobe", (s) => OutfitGenerationService.generate(items, current, s, strategy)),
    [run],
  );
  const generateFor = useCallback(
    (anchor: WardrobeItem, items: WardrobeItem[], current: Outfit[]) =>
      run(anchor.id, (s) => OutfitGenerationService.generateForItem(anchor, items, current, s)),
    [run],
  );
  const compose = useCallback(
    (selected: WardrobeItem[], replaceId?: string) => run("manual", (s) => OutfitGenerationService.composeExact(selected, s, replaceId)),
    [run],
  );
  const edit = useCallback(
    async (id: string, selected: WardrobeItem[], name?: string) => {
      ctl.current?.abort();
      ctl.current = new AbortController();
      setGenerating("manual");
      setError(null);
      try {
        await OutfitGenerationService.editOutfit(id, selected, name, ctl.current.signal);
        return true;
      } catch (e) {
        const code = (e as { code?: string; name?: string })?.code ?? (e as Error)?.name;
        if (code !== "cancelled" && code !== "AbortError") setError("Couldn't save the outfit. Try again.");
        return false;
      } finally {
        setGenerating(null);
      }
    },
    [],
  );
  const cancel = useCallback(() => ctl.current?.abort(), []);

  return { generating, error, generate, generateFor, compose, edit, cancel, clearError: () => setError(null) };
}
