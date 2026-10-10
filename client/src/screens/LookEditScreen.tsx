import { useEffect, useRef, useState } from "react";
import type { Look, LookAnalysis, WardrobeItem } from "../types";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { IconButton } from "../components/IconButton";
import { LoadingState } from "../components/LoadingState";
import { LookService, defaultLookTitle, type LookDraft } from "../services/LookService";
import type { NewLook } from "../services/storage/StorageAdapter";

interface Props {
  items: WardrobeItem[];
  /** New look from a fresh photo… */
  draft?: LookDraft;
  /** …or an existing one being edited. */
  look?: Look;
  onCancel: () => void;
  onSave: (data: NewLook) => Promise<void>;
}

/** Name, note, tags and which wardrobe pieces are in the photo. AI fills it in for a new look. */
export function LookEditScreen({ items, draft, look, onCancel, onSave }: Props) {
  const [title, setTitle] = useState(look?.title ?? defaultLookTitle());
  const [note, setNote] = useState(look?.note ?? "");
  const [tags, setTags] = useState((look?.tags ?? []).join(", "));
  const [picked, setPicked] = useState<Set<string>>(new Set(look?.itemIds ?? []));
  const [ai, setAi] = useState<Pick<LookAnalysis, "description" | "pieces">>({ description: look?.description ?? "", pieces: look?.pieces ?? [] });
  const [reading, setReading] = useState(!!draft);
  const [busy, setBusy] = useState(false);
  const touched = useRef(false);

  useEffect(() => {
    if (!draft) return;
    const ctl = new AbortController();
    LookService.analyze(draft, items, ctl.signal)
      .then((r) => {
        if (!r) return;
        if (!touched.current) setTitle(r.title);
        setTags((t) => t || r.tags.join(", "));
        setPicked((p) => new Set([...p, ...r.itemIds]));
        setAi({ description: r.description, pieces: r.pieces });
      })
      .catch(() => undefined)
      .finally(() => setReading(false));
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const toggle = (id: string) => {
    const n = new Set(picked);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setPicked(n);
  };
  const save = async () => {
    setBusy(true);
    try {
      await onSave({
        title: title.trim() || defaultLookTitle(),
        note: note.trim(),
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 6),
        itemIds: [...picked],
        description: ai.description,
        pieces: ai.pieces,
      });
    } finally {
      setBusy(false);
    }
  };
  const photo = draft?.previewUrl ?? look?.imageUrl;

  return (
    <main className="screen no-nav">
      <div className="back-row">
        <IconButton icon={draft ? "close" : "back"} label={draft ? "Discard" : "Back"} onClick={onCancel} />
        <span className="badge">{draft ? "New look" : "Edit look"}</span>
        <span style={{ width: 40 }} />
      </div>
      {photo && <div className="look-hero"><img src={photo} alt="" /></div>}

      {reading ? (
        <div style={{ margin: "-10px 0 18px" }}><LoadingState label="AI is reading this look…" /></div>
      ) : (
        ai.description && <p className="desc" style={{ marginTop: -8 }}>{ai.description}</p>
      )}

      <label htmlFor="look-title" className="eyebrow" style={{ display: "block", marginBottom: 4 }}>Name</label>
      <input id="look-title" className="name-input" value={title} onChange={(e) => { touched.current = true; setTitle(e.target.value); }} />
      <div className="attrs" style={{ marginBottom: 28 }}>
        <div className="attr" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="look-note">Note</label>
          <input id="look-note" value={note} placeholder="Where, when, how it felt…" onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="attr" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="look-tags">Tags</label>
          <input id="look-tags" value={tags} placeholder="Minimal, Winter" onChange={(e) => setTags(e.target.value)} />
        </div>
      </div>

      {items.length > 0 && (
        <>
          <div className="sel-row" style={{ margin: "0 0 12px" }}>
            <span className="eyebrow" style={{ margin: 0 }}>Pieces from your wardrobe</span>
            <span>{picked.size} in this look</span>
          </div>
          <div className="pick-grid" style={{ paddingBottom: 24 }}>
            {items.map((it) => {
              const on = picked.has(it.id);
              return (
                <button key={it.id} className="pick" aria-pressed={on} onClick={() => toggle(it.id)}>
                  <div className="ph"><img src={it.imageUrl} alt="" loading="lazy" /></div>
                  <span className="mark"><Icon name="check" /></span>
                  <span className="nm">{it.name}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="actions" style={{ marginTop: 8 }}>
        <Button variant="solid" block icon="check" onClick={save} disabled={busy}>{draft ? "Save look" : "Save changes"}</Button>
      </div>
    </main>
  );
}
