import { useState } from "react";
import { Icon } from "../components/Icon";
import { IconButton } from "../components/IconButton";
import { BackgroundExample, PhotoRules } from "../components/PhotoTips";

const SKIP_KEY = "aw.skipPhotoTips";
const readSkip = () => { try { return localStorage.getItem(SKIP_KEY) === "1"; } catch { return false; } };
const writeSkip = (v: boolean) => { try { v ? localStorage.setItem(SKIP_KEY, "1") : localStorage.removeItem(SKIP_KEY); } catch { /* storage blocked */ } };

type Source = "camera" | "gallery";

/**
 * Add item: before the camera or gallery opens, a short sheet explains what makes a
 * background removable. "Don't show again" is remembered on this device.
 */
export function AddItemScreen({ onBack, onFile }: { onBack: () => void; onFile: (f: File) => void }) {
  const [skip, setSkip] = useState(readSkip);
  const [sheet, setSheet] = useState<Source | null>(null);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    setSheet(null);
    if (f) onFile(f);
  };
  const input = (source: Source, label: string) => (
    <input
      type="file"
      accept="image/*"
      {...(source === "camera" ? { capture: "environment" as const } : {})}
      onChange={pick}
      aria-label={label}
    />
  );
  // While tips are on, the first tap opens the sheet; the sheet's button holds the real file input.
  const choice = (source: Source, title: string, sub: string, icon: "camera" | "gallery", label: string) =>
    skip ? (
      <label className="choice">
        <span>{title}<small>{sub}</small></span>
        <Icon name={icon} />
        {input(source, label)}
      </label>
    ) : (
      <button className="choice" onClick={() => setSheet(source)} aria-label={label}>
        <span>{title}<small>{sub}</small></span>
        <Icon name={icon} />
      </button>
    );

  return (
    <main className="screen no-nav">
      <div className="back-row"><IconButton icon="back" label="Back" onClick={onBack} /></div>
      <h1 className="title" style={{ marginBottom: 28 }}>Add item</h1>
      <div className="choices">
        {choice("camera", "Take a photo", "Opens the camera", "camera", "Take a photo")}
        <div className="or">or</div>
        {choice("gallery", "Choose from gallery", "JPG, PNG or HEIC", "gallery", "Choose from gallery")}
      </div>

      <div className="tip-block">
        <p className="eyebrow">For a clean cut-out</p>
        <PhotoRules />
      </div>

      {sheet && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="tips-title" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h2 id="tips-title" className="title">Before you shoot</h2>
              <IconButton icon="close" label="Close" onClick={() => setSheet(null)} />
            </div>
            <p className="sheet-lead">The background must be as plain as possible. Patterns, rugs and clutter can't be removed cleanly.</p>
            <BackgroundExample />
            <PhotoRules />
            <label className="check">
              <input type="checkbox" checked={skip} onChange={(e) => { setSkip(e.target.checked); writeSkip(e.target.checked); }} />
              <span>Don't show again</span>
            </label>
            <label className="btn solid block file-btn">
              <Icon name={sheet === "camera" ? "camera" : "gallery"} size="sm" />
              {sheet === "camera" ? "Got it, open camera" : "Got it, choose photo"}
              {input(sheet, sheet === "camera" ? "Open camera" : "Choose photo")}
            </label>
          </div>
        </div>
      )}
    </main>
  );
}
