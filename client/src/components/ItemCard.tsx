import type { WardrobeItem } from "../types";

export function ItemCard({ item, index, onOpen }: { item: WardrobeItem; index: number; onOpen: () => void }) {
  return (
    <button className="item-card" onClick={onOpen} style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
      <div className="ph">
        <img src={item.imageUrl} alt={item.name} loading="lazy" />
      </div>
      <div>
        <div className="nm">{item.name}</div>
        <div className="ct">{item.type}</div>
      </div>
    </button>
  );
}
