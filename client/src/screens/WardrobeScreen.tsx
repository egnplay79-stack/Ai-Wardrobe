import type { WardrobeItem } from "../types";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { ItemCard } from "../components/ItemCard";
import { LoadingState } from "../components/LoadingState";
import { CategoryFilter, applyFilter, type Filter } from "../components/CategoryFilter";

interface Props {
  items: WardrobeItem[];
  ready: boolean;
  onAdd: () => void;
  onOpen: (id: string) => void;
  filter: Filter;
  onFilter: (f: Filter) => void;
}

export function WardrobeScreen({ items, ready, onAdd, onOpen, filter, onFilter }: Props) {
  const shown = applyFilter(items, filter);
  return (
    <main className="screen">
      <header className="head">
        <div>
          <h1 className="title">Wardrobe</h1>
          {items.length > 0 && <p className="subtitle">{items.length} {items.length === 1 ? "item" : "items"}</p>}
        </div>
        {items.length > 0 && <Button icon="plus" small onClick={onAdd}>Add item</Button>}
      </header>

      {!ready ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState
          lead="Your wardrobe is empty."
          rest="Add your first item and let AI build your outfits."
          action={<Button icon="plus" onClick={onAdd}>Add item</Button>}
        />
      ) : (
        <>
          <CategoryFilter items={items} value={filter} onChange={onFilter} />
          <div className="grid" key={filter}>
            {shown.map((it, i) => (
              <ItemCard key={it.id} item={it} index={i} onOpen={() => onOpen(it.id)} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
