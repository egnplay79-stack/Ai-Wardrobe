import { isSaved, type Outfit, type WardrobeItem } from "../types";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { OutfitCard } from "../components/OutfitCard";

export const ANALYZE_STEPS = [
  { key: "colors", label: "Matching colors" },
  { key: "proportions", label: "Checking proportions" },
  { key: "build", label: "Building outfits" },
];

type Resolved = { outfit: Outfit; items: WardrobeItem[] };

interface Props {
  itemCount: number;
  resolved: Resolved[];
  onCreate: () => void;
  onOpen: (id: string) => void;
  onToggleSave: (o: Outfit) => void;
  onAdd: () => void;
}

/**
 * Outfits tab, laid out like the wardrobe: a grid of cards.
 * Saved — kept until you delete them. Suggestions — the latest AI ideas, saved with one tap.
 */
export function OutfitsScreen({ itemCount, resolved, onCreate, onOpen, onToggleSave, onAdd }: Props) {
  const saved = resolved.filter((r) => isSaved(r.outfit));
  const suggestions = resolved.filter((r) => !isSaved(r.outfit) && r.outfit.source === "wardrobe");

  if (itemCount < 2 && resolved.length === 0) {
    return (
      <main className="screen">
        <header className="head"><h1 className="title">Outfits</h1></header>
        <EmptyState
          lead="Add a few more items"
          rest="to build outfits. At least two pieces, ideally a top, a bottom and shoes."
          action={<Button icon="plus" onClick={onAdd}>Add item</Button>}
        />
      </main>
    );
  }

  const grid = (list: Resolved[]) => (
    <div className="grid" style={{ marginBottom: 40 }}>
      {list.map((r, i) => (
        <OutfitCard key={r.outfit.id} outfit={r.outfit} items={r.items} index={i} onOpen={() => onOpen(r.outfit.id)} onToggleSave={() => onToggleSave(r.outfit)} />
      ))}
    </div>
  );

  return (
    <main className="screen">
      <header className="head">
        <div>
          <h1 className="title">Outfits</h1>
          {saved.length > 0 && <p className="subtitle">{saved.length} saved</p>}
        </div>
        {resolved.length > 0 && <Button icon="plus" small onClick={onCreate}>Create outfit</Button>}
      </header>

      {resolved.length === 0 && (
        <EmptyState
          lead="No outfits yet."
          rest="Pick your pieces and let AI build them. Save the ones you like."
          action={<Button variant="solid" onClick={onCreate}>Create outfit</Button>}
        />
      )}

      {saved.length > 0 && (
        <>
          <div className="section"><span className="eyebrow" style={{ margin: 0 }}>Saved</span></div>
          {grid(saved)}
        </>
      )}
      {suggestions.length > 0 && (
        <>
          <div className="section">
            <span className="eyebrow" style={{ margin: 0 }}>AI suggestions</span>
            <span className="badge">Tap the bookmark to keep one</span>
          </div>
          {grid(suggestions)}
        </>
      )}
    </main>
  );
}
