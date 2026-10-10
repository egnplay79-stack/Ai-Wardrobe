import { CATEGORY_ORDER, CATEGORY_PLURAL, type Category, type WardrobeItem } from "../types";

export type Filter = "all" | Category;

/** Text tabs with counts. Only categories that exist in the wardrobe are shown. */
export function CategoryFilter({ items, value, onChange }: { items: WardrobeItem[]; value: Filter; onChange: (f: Filter) => void }) {
  const counts = new Map<Category, number>();
  for (const i of items) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);
  const cats = CATEGORY_ORDER.filter((c) => counts.get(c));
  if (cats.length < 2 && value === "all") return null;
  return (
    <div className="filter" role="toolbar" aria-label="Filter by category">
      <button aria-pressed={value === "all"} onClick={() => onChange("all")}>
        All<sup>{items.length}</sup>
      </button>
      {cats.map((c) => (
        <button key={c} aria-pressed={value === c} onClick={() => onChange(c)}>
          {CATEGORY_PLURAL[c]}<sup>{counts.get(c)}</sup>
        </button>
      ))}
    </div>
  );
}

export const applyFilter = (items: WardrobeItem[], f: Filter) => (f === "all" ? items : items.filter((i) => i.category === f));
