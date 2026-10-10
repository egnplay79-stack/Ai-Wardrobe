import { useState } from "react";
import { isSaved, type Outfit, type WardrobeItem } from "../types";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
import { OutfitBoard } from "../components/OutfitBoard";
import { outfitKind } from "../components/OutfitCard";

interface Props {
  outfit: Outfit;
  items: WardrobeItem[];
  onBack: () => void;
  onOpenItem: (id: string) => void;
  onToggleSave: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** Same layout as an item: large picture, name, details, then the actions. */
export function OutfitDetailScreen({ outfit, items, onBack, onOpenItem, onToggleSave, onEdit, onDelete }: Props) {
  const [confirm, setConfirm] = useState(false);
  const saved = isSaved(outfit);
  const reasons = outfit.reasons.length ? outfit.reasons : outfit.description ? [outfit.description] : [];
  const styles = [...new Set(items.map((i) => i.style).filter(Boolean))];
  const rows: [string, string][] = [
    ["Pieces", String(items.length)],
    ["Type", outfitKind(outfit)],
    ["Style", styles.slice(0, 2).join(" / ") || "—"],
    ["Created", new Date(outfit.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })],
  ];

  return (
    <main className="screen no-nav">
      <div className="back-row"><IconButton icon="back" label="Back" onClick={onBack} /></div>
      <div className="hero-board"><OutfitBoard items={items} /></div>
      <h1 className="item-name">{outfit.name}</h1>
      {outfit.description && <p className="desc">{outfit.description}</p>}

      <dl className="attrs" style={{ margin: "0 0 28px" }}>
        {rows.map(([k, v]) => (
          <div className="attr" key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <p className="eyebrow">Pieces</p>
      <ul className="piece-list">
        {items.map((it) => (
          <li key={it.id}>
            <button onClick={() => onOpenItem(it.id)}>
              <img src={it.imageUrl} alt="" />
              <span className="t">{it.name}<small>{it.type}</small></span>
            </button>
          </li>
        ))}
      </ul>

      {reasons.length > 0 && (
        <>
          <p className="eyebrow">Why it works</p>
          <ul className="why">
            {reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </>
      )}

      <div className="actions">
        {saved ? (
          <Button block icon="bookmark" onClick={onToggleSave}>Saved · remove from saved</Button>
        ) : (
          <Button variant="solid" block icon="bookmark" onClick={onToggleSave}>Save outfit</Button>
        )}
        {confirm ? (
          <div className="confirm">
            <span>Delete this outfit?</span>
            <span style={{ display: "flex", gap: 16 }}>
              <Button variant="text" onClick={() => setConfirm(false)}>Keep</Button>
              <Button variant="text" onClick={onDelete}>Delete</Button>
            </span>
          </div>
        ) : (
          <div className="row">
            <Button variant="text" icon="edit" onClick={onEdit}>Edit outfit</Button>
            <Button variant="text" icon="trash" onClick={() => setConfirm(true)}>Delete</Button>
          </div>
        )}
      </div>
    </main>
  );
}
