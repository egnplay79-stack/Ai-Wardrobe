import type { Category, DetectionResult, ItemAttributes, LookAnalysis, OutfitSuggestion } from "../../types";
import { isValidHex } from "../../utils/color";

const CATEGORIES: Category[] = ["top", "bottom", "dress", "outerwear", "shoes", "accessory"];
const str = (v: unknown, fallback = "") => (typeof v === "string" && v.trim() ? v.trim().slice(0, 60) : fallback);
const title = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** Make any provider's raw JSON safe to use. */
export function normalizeDetection(raw: unknown): DetectionResult {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const category = CATEGORIES.includes(r.category as Category) ? (r.category as Category) : "top";
  const color = title(str(r.color, "Neutral"));
  const type = title(str(r.type, defaultType(category)));
  const attributes: ItemAttributes = {
    name: str(r.name, `${color} ${type}`),
    category,
    type,
    color,
    colorHex: isValidHex(r.color_hex) ? r.color_hex : "#999999",
    material: str(r.material),
    style: title(str(r.style, "Casual")),
    season: str(r.season, "All seasons"),
    gender: str(r.gender, "Unisex"),
    realCm: parseSize(r.size_cm),
  };
  const bb = Array.isArray(r.bbox) && r.bbox.length === 4 ? r.bbox.map(Number) : [0, 0, 1, 1];
  // Missing tilt → NaN, which tells the on-device pipeline to estimate it from the garment's shape.
  const rot = r.rotation_deg == null || r.rotation_deg === "" ? Number.NaN : Number(r.rotation_deg);
  return {
    attributes,
    detection: {
      bbox: bb.every((n) => isFinite(n)) ? (bb as [number, number, number, number]) : [0, 0, 1, 1],
      rotationDeg: isFinite(rot) ? Math.max(-45, Math.min(45, rot)) : Number.NaN,
      background: r.background === "busy" ? "busy" : "plain",
      outline: parseOutline(r.outline),
    },
  };
}

export function normalizeOutfits(raw: unknown, validIds: Set<string>, anchor?: string, exact?: boolean, limit?: number): OutfitSuggestion[] {
  const list = Array.isArray(raw) ? raw : (raw as { outfits?: unknown })?.outfits;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: OutfitSuggestion[] = [];
  for (const o of list) {
    const rawItems = (o?.items ?? o?.item_ids ?? []) as unknown[];
    // Exact mode: the user's selection is the outfit, whatever the model echoed back.
    const items = exact ? [...validIds] : [...new Set(rawItems.map(String))].filter((id) => validIds.has(id));
    if (items.length < 2 || (anchor && !items.includes(anchor))) continue;
    const key = [...items].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: str(o?.name, "Outfit"),
      items,
      reason: str(o?.reason, "").slice(0, 200) || "Balanced, easy combination.",
      reasons: Array.isArray(o?.reasons) ? o.reasons.map((x: unknown) => str(x)).filter(Boolean).slice(0, 3) : undefined,
    });
    if (exact || (limit && out.length >= limit)) break;
  }
  return out;
}

export function defaultType(c: Category): string {
  return { top: "Top", bottom: "Trousers", dress: "Dress", outerwear: "Jacket", shoes: "Shoes", accessory: "Accessory" }[c];
}

function parseOutline(v: unknown): [number, number][] | undefined {
  if (!Array.isArray(v) || v.length < 6 || v.length > 80) return undefined;
  const pts = v
    .map((p) => (Array.isArray(p) && p.length >= 2 ? [Number(p[0]), Number(p[1])] : null))
    .filter((p): p is [number, number] => !!p && p.every((n) => isFinite(n) && n >= -0.05 && n <= 1.05));
  return pts.length >= 6 ? pts : undefined;
}

/** {width, height} in cm from a model, or undefined when missing or implausible. */
export function parseSize(v: unknown): { w: number; h: number } | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const w = Number(o.width ?? o.width_cm ?? o.w), h = Number(o.height ?? o.height_cm ?? o.h);
  if (!isFinite(w) || !isFinite(h) || w < 2 || h < 2 || w > 250 || h > 250) return undefined;
  return { w: Math.round(w), h: Math.round(h) };
}

export function normalizeSizes(raw: unknown, ids: string[]): Record<string, { w: number; h: number }> {
  const list = Array.isArray(raw) ? raw : (raw as { sizes?: unknown })?.sizes;
  const out: Record<string, { w: number; h: number }> = {};
  if (!Array.isArray(list)) return out;
  list.forEach((e, i) => {
    const id = typeof e?.id === "string" && ids.includes(e.id) ? e.id : ids[i];
    const sz = parseSize(e);
    if (id && sz) out[id] = sz;
  });
  return out;
}

export function normalizeLook(raw: unknown, validIds: Set<string>): LookAnalysis {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = (v: unknown, max: number) => (Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean).slice(0, max) : []);
  return {
    title: str(r.title, "My look"),
    description: typeof r.description === "string" ? r.description.trim().slice(0, 300) : "",
    pieces: list(r.pieces, 12),
    itemIds: [...new Set(list(r.item_ids ?? r.itemIds, 12))].filter((id) => validIds.has(id)),
    tags: list(r.tags, 4),
  };
}
