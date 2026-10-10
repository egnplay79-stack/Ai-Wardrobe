import { useState } from "react";
import type { WardrobeItem } from "../types";
import { AIProcessingView } from "../components/AIProcessingView";
import { Button } from "../components/Button";
import { CategoryFilter, applyFilter, type Filter } from "../components/CategoryFilter";
import { Icon } from "../components/Icon";
import { IconButton } from "../components/IconButton";
import { useCyclingStep } from "../hooks/useCyclingStep";
import { canGenerate, type GenerateStrategy } from "../services/OutfitGenerationService";
import { ANALYZE_STEPS } from "./OutfitsScreen";

interface Props {
  items: WardrobeItem[];
  selected: Set<string>;
  onSelected: (s: Set<string>) => void;
  generating: boolean;
  onBack: () => void;
  onGenerate: (items: WardrobeItem[], strategy: GenerateStrategy) => void;
  onCompose: (items: WardrobeItem[], name?: string) => void;
  /** Editing an existing outfit: one "Save changes" button, the name can be changed. */
  editing?: { name: string };
}

type Mode = GenerateStrategy | "exact";

const MODES: { id: Mode; label: string; hint: string; action: string }[] = [
  { id: "all", label: "All outfits", hint: "AI builds every good combination from your picks.", action: "Generate all" },
  { id: "best", label: "Best match", hint: "AI picks the single most harmonious outfit and may leave out pieces that don't fit.", action: "Find best match" },
  { id: "exact", label: "Exactly these", hint: "Your picks become one outfit, exactly as chosen.", action: "Create outfit" },
];

const MODE_KEY = "aw.outfitMode";
const readMode = (): Mode => {
  try { const v = localStorage.getItem(MODE_KEY); return v === "best" || v === "exact" ? v : "all"; } catch { return "all"; }
};

/**
 * Pick the items to build from, then choose how: every good combination, the single best match,
 * or exactly the picked set as one outfit.
 */
export function OutfitBuilderScreen({ items, selected, onSelected, generating, onBack, onGenerate, onCompose, editing }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [name, setName] = useState(editing?.name ?? "");
  const [mode, setModeState] = useState<Mode>(readMode);
  const setMode = (m: Mode) => {
    setModeState(m);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* storage blocked */ }
  };
  const current = MODES.find((m) => m.id === mode)!;
  const step = useCyclingStep(ANALYZE_STEPS.map((s) => s.key), generating);
  const shown = applyFilter(items, filter);
  const chosen = items.filter((i) => selected.has(i.id));

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelected(next);
  };
  const setMany = (ids: string[], on: boolean) => {
    const next = new Set(selected);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    onSelected(next);
  };
  const allShownOn = shown.length > 0 && shown.every((i) => selected.has(i.id));

  const okGenerate = canGenerate(chosen);
  const okCompose = chosen.length >= 2;
  const ok = mode === "exact" ? okCompose : okGenerate;
  const hint = chosen.length === 0
    ? "Select the items to build from"
    : editing
      ? `${chosen.length} items in this outfit`
      : mode === "exact" && !okCompose
        ? "Pick at least two pieces"
        : mode !== "exact" && !okGenerate
          ? "Add a top and a bottom, or a dress"
          : current.hint;
  const run = () => (mode === "exact" ? onCompose(chosen) : onGenerate(chosen, mode));

  if (generating) {
    return (
      <main className="screen no-nav">
        <div className="back-row"><IconButton icon="close" label="Cancel" onClick={onBack} /></div>
        <AIProcessingView title={mode === "best" ? "Finding the best match" : "Building outfits"} steps={ANALYZE_STEPS} active={step} />
      </main>
    );
  }

  return (
    <main className="screen no-nav">
      <div className="back-row">
        <IconButton icon="back" label="Back" onClick={onBack} />
        <span className="badge">{editing ? "Edit outfit" : "Create outfit"}</span>
        <span style={{ width: 40 }} />
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.015em", margin: "0 0 22px", maxWidth: "20ch" }}>
        {editing ? "Change the pieces in this outfit." : "Choose the pieces to build from."}
      </h1>
      {editing && (
        <div className="name-edit">
          <label htmlFor="outfit-name" className="eyebrow" style={{ display: "block", marginBottom: 4 }}>Name</label>
          <input id="outfit-name" className="name-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      )}

      <CategoryFilter items={items} value={filter} onChange={setFilter} />

      <div className="sel-row">
        <span>{selected.size ? `${chosen.length} selected` : "None selected"}</span>
        <span className="links">
          <button onClick={() => setMany(shown.map((i) => i.id), true)} disabled={allShownOn} style={{ opacity: allShownOn ? 0.35 : 1 }}>
            Select all
          </button>
          <button onClick={() => setMany(shown.map((i) => i.id), false)} disabled={!shown.some((i) => selected.has(i.id))} style={{ opacity: shown.some((i) => selected.has(i.id)) ? 1 : 0.35 }}>
            Clear
          </button>
        </span>
      </div>

      <div className="pick-grid">
        {shown.map((it) => {
          const on = selected.has(it.id);
          return (
            <button key={it.id} className="pick" aria-pressed={on} onClick={() => toggle(it.id)}>
              <div className="ph"><img src={it.imageUrl} alt="" loading="lazy" draggable={false} /></div>
              <span className="mark"><Icon name="check" /></span>
              <span className="nm">{it.name}</span>
            </button>
          );
        })}
      </div>

      <div className="dock">
        <div className="dock-inner">
          <div className="hint" aria-live="polite">{hint}</div>
          {editing ? (
            <Button variant="solid" block icon="check" onClick={() => onCompose(chosen, name.trim() || undefined)} disabled={!okCompose}>Save changes</Button>
          ) : (
            <>
              <div className="segmented" role="radiogroup" aria-label="How to build">
                {MODES.map((m) => (
                  <button key={m.id} role="radio" aria-checked={mode === m.id} onClick={() => setMode(m.id)}>{m.label}</button>
                ))}
              </div>
              <Button variant="solid" block onClick={run} disabled={!ok}>{current.action}</Button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
