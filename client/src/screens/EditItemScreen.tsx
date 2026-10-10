import { useState } from "react";
import type { ItemAttributes, WardrobeItem } from "../types";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
import { ItemFields } from "../components/ItemFields";
import { ImagePreview, ScaleControl } from "../components/ImagePreview";

export function EditItemScreen({ item, onBack, onSave }: { item: WardrobeItem; onBack: () => void; onSave: (a: ItemAttributes) => Promise<void> }) {
  const [value, setValue] = useState<ItemAttributes>(item);
  const [busy, setBusy] = useState(false);
  return (
    <main className="screen no-nav">
      <div className="back-row">
        <IconButton icon="back" label="Back" onClick={onBack} />
        <span className="badge">Edit item</span>
        <span style={{ width: 40 }} />
      </div>
      <ImagePreview src={item.imageUrl} alt={item.name} scale={value.scale ?? 1} onScale={(s) => setValue({ ...value, scale: s })} />
      <div className="tools">
        <span className="versions"><span className="lbl">Size in outfits</span></span>
        <ScaleControl value={value.scale ?? 1} onChange={(s) => setValue({ ...value, scale: s })} />
      </div>
      <ItemFields value={value} onChange={setValue} />
      <div className="actions">
        <Button variant="solid" block icon="check" disabled={busy} onClick={async () => { setBusy(true); await onSave(value); setBusy(false); }}>
          Save changes
        </Button>
      </div>
    </main>
  );
}
