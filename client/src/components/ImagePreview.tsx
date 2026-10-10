import { useRef, useState } from "react";

export const SCALE_MIN = 0.5;
export const SCALE_MAX = 1.5;
const clamp = (v: number) => Math.round(Math.min(SCALE_MAX, Math.max(SCALE_MIN, v)) * 100) / 100;

interface Props {
  src: string;
  alt: string;
  /** Source photo: press and hold to compare. */
  original?: string;
  /** Item size adjustment; when set, pinch / ctrl+wheel resize the item. */
  scale?: number;
  onScale?: (s: number) => void;
}

/**
 * Large item photo on white. With `original`, press and hold to compare with the source.
 * With `onScale`, the item can be made larger or smaller (pinch on touch, ctrl + wheel on desktop).
 */
export function ImagePreview({ src, alt, original, scale, onScale }: Props) {
  const [comparing, setComparing] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const holdTimer = useRef<number>();

  const distance = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const down = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && onScale) {
      window.clearTimeout(holdTimer.current);
      setComparing(false);
      pinch.current = { dist: distance(), scale: scale ?? 1 };
    } else if (original) {
      // A short delay so a pinch doesn't flash the original.
      holdTimer.current = window.setTimeout(() => setComparing(true), 120);
    }
  };
  const move = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2 && onScale) {
      onScale(clamp(pinch.current.scale * (distance() / Math.max(1, pinch.current.dist))));
    }
  };
  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    window.clearTimeout(holdTimer.current);
    setComparing(false);
  };
  const wheel = (e: React.WheelEvent) => {
    if (!onScale || !e.ctrlKey) return;
    e.preventDefault();
    onScale(clamp((scale ?? 1) * (1 - e.deltaY * 0.004)));
  };

  const sized = onScale !== undefined;
  return (
    <div
      className={"hero" + (comparing ? " comparing" : "") + (sized ? " sized" : "")}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerLeave={up}
      onPointerCancel={up}
      onWheel={wheel}
      onContextMenu={(e) => original && e.preventDefault()}
      style={{ touchAction: sized ? "none" : undefined }}
    >
      <img
        key={src}
        className="main"
        src={src}
        alt={alt}
        draggable={false}
        style={sized ? { transform: `scale(${scale ?? 1})` } : undefined}
      />
      {original && <img className="orig" src={original} alt="" draggable={false} />}
      {original && <span className="hint">{comparing ? "Original" : sized ? "Hold to compare · pinch to resize" : "Hold to compare"}</span>}
    </div>
  );
}

/** − 100% + control for the item size. */
export function ScaleControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const pct = Math.round(value * 100);
  return (
    <div className="scale-ctl" role="group" aria-label="Item size">
      <button aria-label="Smaller" onClick={() => onChange(clamp(value - 0.05))} disabled={value <= SCALE_MIN}>−</button>
      <button className="pct" onClick={() => onChange(1)} title="Reset to 100%">{pct}%</button>
      <button aria-label="Larger" onClick={() => onChange(clamp(value + 0.05))} disabled={value >= SCALE_MAX}>+</button>
    </div>
  );
}
