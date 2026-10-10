import { useState } from "react";
import type { Look } from "../types";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { IconButton } from "../components/IconButton";

interface Props {
  looks: Look[];
  onFile: (f: File) => void;
  onOpen: (id: string) => void;
}

export const lookDate = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** Your own photos in outfits — a grid like the wardrobe. */
export function LooksScreen({ looks, onFile, onOpen }: Props) {
  const [sheet, setSheet] = useState(false);
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    setSheet(false);
    if (f) onFile(f);
  };
  const add = () => setSheet(true);

  return (
    <main className="screen">
      <header className="head">
        <div>
          <h1 className="title">Looks</h1>
          {looks.length > 0 && <p className="subtitle">{looks.length} {looks.length === 1 ? "photo" : "photos"}</p>}
        </div>
        {looks.length > 0 && <Button icon="plus" small onClick={add}>Add look</Button>}
      </header>

      {looks.length === 0 ? (
        <EmptyState
          lead="Your looks."
          rest="Save photos of outfits you wore or love. AI names them and finds your pieces in each one."
          action={<Button icon="plus" onClick={add}>Add look</Button>}
        />
      ) : (
        <div className="grid">
          {looks.map((l, i) => (
            <button key={l.id} className="item-card look-card" onClick={() => onOpen(l.id)} style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
              <div className="ph"><img src={l.imageUrl} alt={l.title} loading="lazy" /></div>
              <div>
                <div className="nm">{l.title}</div>
                <div className="ct">{lookDate(l.createdAt)}{l.itemIds.length ? ` · ${l.itemIds.length} from wardrobe` : ""}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {sheet && (
        <div className="sheet-backdrop" onClick={() => setSheet(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="look-add" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h2 id="look-add" className="title">Add look</h2>
              <IconButton icon="close" label="Close" onClick={() => setSheet(false)} />
            </div>
            <p className="sheet-lead">A mirror selfie, a street photo or a picture you love. Full-length photos work best.</p>
            <div className="choices" style={{ marginTop: 0 }}>
              <label className="choice">
                <span>Take a photo<small>Opens the camera</small></span>
                <Icon name="camera" />
                <input type="file" accept="image/*" capture="environment" onChange={pick} aria-label="Take a look photo" />
              </label>
              <label className="choice">
                <span>Choose from gallery<small>JPG, PNG or HEIC</small></span>
                <Icon name="gallery" />
                <input type="file" accept="image/*" onChange={pick} aria-label="Choose a look photo" />
              </label>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
