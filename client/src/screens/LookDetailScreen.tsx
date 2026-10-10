import { useState } from "react";
import type { Look, WardrobeItem } from "../types";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
import { lookDate } from "./LooksScreen";

interface Props {
  look: Look;
  items: WardrobeItem[];
  creating: boolean;
  onBack: () => void;
  onOpenItem: (id: string) => void;
  onMakeOutfit: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** Same layout as an item: the photo, the name, details, then actions. */
export function LookDetailScreen({ look, items, creating, onBack, onOpenItem, onMakeOutfit, onEdit, onDelete }: Props) {
  const [confirm, setConfirm] = useState(false);
  const mine = look.itemIds.map((id) => items.find((i) => i.id === id)).filter((x): x is WardrobeItem => !!x);
  const rows: [string, string][] = [
    ["Date", lookDate(look.createdAt)],
    ["From wardrobe", String(mine.length)],
    ["Tags", look.tags.join(", ") || "—"],
    ["Pieces seen", String(look.pieces.length || "—")],
  ];
  return (
    <main className="screen no-nav">
      <div className="back-row"><IconButton icon="back" label="Back" onClick={onBack} /></div>
      <div className="look-hero"><img src={look.imageUrl} alt={look.title} /></div>
      <h1 className="item-name">{look.title}</h1>
      {look.description && <p className="desc">{look.description}</p>}
      {look.note && <p className="note" style={{ margin: "-12px 0 24px" }}>{look.note}</p>}

      <dl className="attrs" style={{ margin: "0 0 28px" }}>
        {rows.map(([k, v]) => (
          <div className="attr" key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>

      {mine.length > 0 && (
        <>
          <p className="eyebrow">From your wardrobe</p>
          <ul className="piece-list">
            {mine.map((it) => (
              <li key={it.id}>
                <button onClick={() => onOpenItem(it.id)}>
                  <img src={it.imageUrl} alt="" />
                  <span className="t">{it.name}<small>{it.type}</small></span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {look.pieces.length > 0 && (
        <>
          <p className="eyebrow">In the photo</p>
          <ul className="why" style={{ marginBottom: 8 }}>
            {look.pieces.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </>
      )}

      <div className="actions">
        {mine.length >= 2 && (
          <Button variant="solid" block icon="arrow" onClick={onMakeOutfit} disabled={creating}>
            {creating ? "Making outfit…" : "Make outfit from these pieces"}
          </Button>
        )}
        {confirm ? (
          <div className="confirm">
            <span>Delete this look?</span>
            <span style={{ display: "flex", gap: 16 }}>
              <Button variant="text" onClick={() => setConfirm(false)}>Keep</Button>
              <Button variant="text" onClick={onDelete}>Delete</Button>
            </span>
          </div>
        ) : (
          <div className="row">
            <Button variant="text" icon="edit" onClick={onEdit}>Edit look</Button>
            <Button variant="text" icon="trash" onClick={() => setConfirm(true)}>Delete</Button>
          </div>
        )}
      </div>
    </main>
  );
}
