import type { ItemAttributes } from "../types";
import { current, type ProcessingSession } from "../services/ImageProcessingService";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
import { ImagePreview, ScaleControl } from "../components/ImagePreview";
import { ItemFields } from "../components/ItemFields";
import { LoadingLine } from "../components/LoadingState";

interface Props {
  session: ProcessingSession;
  busy: boolean;
  note?: string | null;
  onChange: (a: ItemAttributes) => void;
  onSave: () => void;
  onRetry: () => void;
  onSelect: (index: number) => void;
  onDiscard: () => void;
}

export function ItemResultScreen({ session, busy, note, onChange, onSave, onRetry, onSelect, onDiscard }: Props) {
  const v = current(session);
  const n = session.variants.length;
  const scale = session.attributes.scale ?? 1;
  const setScale = (s: number) => onChange({ ...session.attributes, scale: s });

  return (
    <main className="screen no-nav">
      <div className="back-row">
        <IconButton icon="close" label="Discard" onClick={onDiscard} />
        <span className="badge">Your item</span>
        <span style={{ width: 40 }} />
      </div>

      <ImagePreview src={v.previewUrl} alt={session.attributes.name} original={session.sourceUrl} scale={scale} onScale={setScale} />

      <div className="tools">
        {busy ? (
          <div style={{ flex: 1 }}><LoadingLine /></div>
        ) : (
          <div className="versions" aria-live="polite">
            {n > 1 && <IconButton icon="back" label="Previous version" onClick={() => onSelect(session.index - 1)} disabled={session.index === 0} />}
            <span className="lbl">{n > 1 && <b>{session.index + 1}/{n}</b>}{v.label}</span>
            {n > 1 && (
              <IconButton icon="forward" label="Next version" onClick={() => onSelect(session.index + 1)} disabled={session.index === n - 1} />
            )}
          </div>
        )}
        <ScaleControl value={scale} onChange={setScale} />
      </div>
      <p className="size-hint">Size sets how big this item looks next to others in outfits.</p>

      {!busy && note && <p className="note">{note}</p>}
      {!busy && !v.separated && (
        <p className="note">The background couldn't be separated. Tap Try again for another method, or retake the photo on a plain surface that contrasts with the item.</p>
      )}
      <ItemFields value={session.attributes} onChange={onChange} />
      <div className="actions">
        <Button variant="solid" block icon="check" onClick={onSave} disabled={busy}>Save</Button>
        <div className="row">
          <Button variant="text" icon="retry" onClick={onRetry} disabled={busy}>Try again</Button>
          <Button variant="text" icon="trash" onClick={onDiscard} disabled={busy}>Delete</Button>
        </div>
      </div>
    </main>
  );
}
