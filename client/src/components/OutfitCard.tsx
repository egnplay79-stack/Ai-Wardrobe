import { isSaved, type Outfit, type WardrobeItem } from "../types";
import { Icon } from "./Icon";
import { OutfitBoard } from "./OutfitBoard";

export function outfitKind(o: Outfit): string {
  if (o.source === "manual") return "Your set";
  return isSaved(o) ? "Saved" : "AI suggestion";
}

/** Same card as a wardrobe item: the picture, the name, a short line under it. */
export function OutfitCard({ outfit, items, index, onOpen, onToggleSave }: {
  outfit: Outfit;
  items: WardrobeItem[];
  index: number;
  onOpen: () => void;
  onToggleSave?: () => void;
}) {
  const saved = isSaved(outfit);
  return (
    <div className="item-card outfit-card" style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
      <button className="card-open" onClick={onOpen} aria-label={`Open ${outfit.name}`}>
        <OutfitBoard items={items} />
      </button>
      {onToggleSave && (
        <button
          className="save-toggle"
          aria-pressed={saved}
          aria-label={saved ? "Remove from saved" : "Save outfit"}
          title={saved ? "Saved" : "Save"}
          onClick={onToggleSave}
        >
          <Icon name="bookmark" size="sm" filled={saved} />
        </button>
      )}
      <button className="card-open" onClick={onOpen} tabIndex={-1}>
        <div className="nm">{outfit.name}</div>
        <div className="ct">{items.length} pieces · {outfitKind(outfit)}</div>
      </button>
    </div>
  );
}
