import { useEffect, useMemo, useState } from "react";
import type { Look, Outfit, WardrobeItem } from "../types";
import { WardrobeService } from "../services/WardrobeService";

export function useWardrobe() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [looks, setLooks] = useState<Look[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let alive = true;
    WardrobeService.subscribe((s) => {
      if (!alive) return;
      setItems(s.items);
      setOutfits(s.outfits);
      setLooks(s.looks ?? []);
      setReady(true);
    }).then((u) => {
      if (alive) unsub = u;
      else u();
    });
    return () => {
      alive = false;
      unsub?.();
    };
  }, []);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  /** Outfits whose items all still exist, with the items resolved. */
  const resolved = useMemo(
    () =>
      outfits
        .map((o) => ({ outfit: o, items: o.itemIds.map((id) => byId.get(id)).filter((x): x is WardrobeItem => !!x) }))
        .filter((r) => r.items.length === r.outfit.itemIds.length && r.items.length >= 2),
    [outfits, byId],
  );

  return { items, outfits, looks, resolved, byId, ready, storageKind: WardrobeService.storageKind };
}
