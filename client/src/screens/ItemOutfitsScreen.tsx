import type { Outfit, WardrobeItem } from "../types";
import { AIProcessingView } from "../components/AIProcessingView";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
import { OutfitCard } from "../components/OutfitCard";
import { useCyclingStep } from "../hooks/useCyclingStep";
import { ANALYZE_STEPS } from "./OutfitsScreen";

interface Props {
  item: WardrobeItem;
  resolved: { outfit: Outfit; items: WardrobeItem[] }[];
  generating: boolean;
  error: string | null;
  onBack: () => void;
  onOpen: (id: string) => void;
  onToggleSave: (o: Outfit) => void;
  onRetry: () => void;
  onAdd: () => void;
}

/** Result of "Create outfit" on one item. */
export function ItemOutfitsScreen({ item, resolved, generating, error, onBack, onOpen, onToggleSave, onRetry, onAdd }: Props) {
  const step = useCyclingStep(ANALYZE_STEPS.map((s) => s.key), generating);
  const list = resolved.filter((r) => r.outfit.source === "item" && r.outfit.anchorItemId === item.id);
  return (
    <main className="screen no-nav">
      <div className="back-row"><IconButton icon="back" label="Back" onClick={onBack} /></div>
      <header className="head stack">
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <img src={item.imageUrl} alt="" style={{ width: 44, height: 55, objectFit: "contain", padding: 4, border: "1px solid var(--hair)" }} />
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>Outfits with</p>
            <h1 style={{ fontSize: 17, fontWeight: 500, margin: 0 }}>{item.name}</h1>
          </div>
        </div>
      </header>
      {generating ? (
        <AIProcessingView title="Finding matches" steps={ANALYZE_STEPS} active={step} />
      ) : list.length ? (
        <>
          <div className="grid" style={{ marginBottom: 28 }}>
            {list.map((r, i) => (
              <OutfitCard key={r.outfit.id} outfit={r.outfit} items={r.items} index={i} onOpen={() => onOpen(r.outfit.id)} onToggleSave={() => onToggleSave(r.outfit)} />
            ))}
          </div>
          <Button variant="text" icon="retry" onClick={onRetry}>Try other combinations</Button>
        </>
      ) : (
        <div className="empty">
          <p>{error ?? "Nothing in your wardrobe completes this item yet."} <span>Add pieces that go with it.</span></p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button icon="plus" onClick={onAdd}>Add item</Button>
            <Button variant="text" icon="retry" onClick={onRetry}>Try again</Button>
          </div>
        </div>
      )}
    </main>
  );
}
