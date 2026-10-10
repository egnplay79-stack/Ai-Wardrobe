import { useCallback, useRef, useState } from "react";
import type { ItemAttributes, ProcessingStage } from "../types";
import { ImageProcessingService, current, type ProcessingSession } from "../services/ImageProcessingService";
import { WardrobeService } from "../services/WardrobeService";
import { assessBackground } from "../utils/cutout";
import { fileToCanvas } from "../utils/image";

/** Photo → processed item → saved. Holds the in-progress session between screens. */
export function useItemProcessing() {
  const [session, setSession] = useState<ProcessingSession | null>(null);
  const [stage, setStage] = useState<ProcessingStage>("detect");
  const [thumb, setThumb] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set when the photo's background looks busy; the user decides to continue or retake. */
  const [warning, setWarning] = useState<File | null>(null);
  /** Shown when Try again couldn't produce a new, better version. */
  const [retryNote, setRetryNote] = useState<string | null>(null);
  const ctl = useRef<AbortController | null>(null);

  const start = useCallback(async (file: File, force = false): Promise<ProcessingSession | "warn" | null> => {
    ctl.current?.abort();
    ctl.current = new AbortController();
    setError(null);
    setWarning(null);
    setRetryNote(null);
    setSession(null);
    setStage("detect");
    setBusy(true);
    setThumb(URL.createObjectURL(file));
    try {
      if (!force) {
        const check = assessBackground(await fileToCanvas(file, 800));
        if (check.busy) {
          setWarning(file);
          return "warn";
        }
      }
      const s = await ImageProcessingService.process(file, setStage, ctl.current.signal);
      setSession(s);
      return s;
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setError("This photo couldn't be processed. Try another one.");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const retry = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    try {
      const { session: next, added } = await ImageProcessingService.retry(session, setStage);
      // Keep edits made to the fields while the new version was being made.
      setSession((s) => (s ? { ...next, attributes: s.attributes, index: added ? next.index : s.index } : next));
      setRetryNote(added ? null : "No cleaner version found for this photo. A plainer background will help most.");
    } finally {
      setBusy(false);
    }
  }, [session]);

  /** Switch between background-removal versions produced by Try again. */
  const select = useCallback((index: number) => {
    setSession((s) => (s && index >= 0 && index < s.variants.length ? { ...s, index } : s));
  }, []);

  const update = useCallback((attributes: ItemAttributes) => {
    setSession((s) => (s ? { ...s, attributes } : s));
  }, []);

  const save = useCallback(async () => {
    if (!session) return null;
    setBusy(true);
    try {
      const item = await WardrobeService.addItem(session.attributes, current(session).image);
      setSession(null);
      return item;
    } catch {
      setError("Couldn't save. Check your connection and try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }, [session]);

  const discard = useCallback(() => {
    ctl.current?.abort();
    session?.variants.forEach((v) => URL.revokeObjectURL(v.previewUrl));
    setSession(null);
    setError(null);
    setWarning(null);
  }, [session]);

  return { session, stage, thumb, busy, error, warning, retryNote, start, retry, select, update, save, discard };
}
