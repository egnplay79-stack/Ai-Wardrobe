import { useState } from "react";
import { CATEGORY_LABEL, type WardrobeItem } from "../types";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
import { ImagePreview } from "../components/ImagePreview";

interface Props {
  item: WardrobeItem;
  creating: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCreateOutfit: () => void;
}

export function ItemDetailScreen({ item, creating, onBack, onEdit, onDelete, onCreateOutfit }: Props) {
  const [confirm, setConfirm] = useState(false);
  const rows: [string, string | undefined][] = [
    ["Category", CATEGORY_LABEL[item.category]],
    ["Type", item.type],
    ["Color", item.color],
    ["Material", item.material],
    ["Style", item.style],
    ["Season", String(item.season)],
    ["Real size", item.realCm ? `≈ ${item.realCm.w} × ${item.realCm.h} cm` : undefined],
  ];
  return (
    <main className="screen no-nav">
      <div className="back-row"><IconButton icon="back" label="Back" onClick={onBack} /></div>
      <ImagePreview src={item.imageUrl} alt={item.name} />
      <h1 className="item-name">{item.name}</h1>
      <dl className="attrs" style={{ margin: 0 }}>
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div className="attr" key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="actions">
        <Button variant="solid" block icon="arrow" onClick={onCreateOutfit} disabled={creating}>
          {creating ? "Building outfits…" : "Create outfit"}
        </Button>
        {confirm ? (
          <div className="confirm">
            <span>Delete this item?</span>
            <span style={{ display: "flex", gap: 16 }}>
              <Button variant="text" onClick={() => setConfirm(false)}>Keep</Button>
              <Button variant="text" onClick={onDelete}>Delete</Button>
            </span>
          </div>
        ) : (
          <div className="row">
            <Button variant="text" icon="edit" onClick={onEdit}>Edit item</Button>
            <Button variant="text" icon="trash" onClick={() => setConfirm(true)}>Delete</Button>
          </div>
        )}
      </div>
    </main>
  );
}
