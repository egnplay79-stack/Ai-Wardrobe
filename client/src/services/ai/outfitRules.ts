import type { Category, OutfitSuggestion } from "../../types";
import type { OutfitInputItem, OutfitRequest } from "./AIProvider";
import { isNeutral } from "../../utils/color";

/**
 * Deterministic stylist used when no LLM is available (client mock and server fallback).
 * Pure TypeScript, no DOM, so the server imports it too.
 */
type Combo = { items: OutfitInputItem[]; score: number };

export function ruleBasedOutfits(wardrobe: OutfitInputItem[], req: OutfitRequest): OutfitSuggestion[] {
  if (req.exact) {
    if (wardrobe.length < 2) return [];
    const base = outfitName(wardrobe);
    const reasons = explain(wardrobe);
    return [{ name: base, items: wardrobe.map((i) => i.id), reason: SENTENCE[base] ?? SENTENCE.Everyday, reasons }];
  }
  const by = (c: Category) => wardrobe.filter((i) => i.category === c);
  const tops = by("top"), bottoms = by("bottom"), dresses = by("dress");
  const shoes = by("shoes"), outer = by("outerwear"), acc = by("accessory");
  const anchor = wardrobe.find((i) => i.id === req.anchorItemId);

  const bases: OutfitInputItem[][] = [];
  for (const t of tops) for (const b of bottoms) bases.push([t, b]);
  for (const d of dresses) bases.push([d]);

  const pickBest = (pool: OutfitInputItem[], base: OutfitInputItem[]) =>
    pool.length ? [...pool].sort((a, b) => pairScore(b, base) - pairScore(a, base))[0] : undefined;

  let combos: Combo[] = [];
  for (const base of bases) {
    const set = [...base];
    const forcedShoe = anchor?.category === "shoes" ? anchor : undefined;
    const shoe = forcedShoe ?? pickBest(shoes, set);
    if (shoe) set.push(shoe);
    const plain = { items: [...set], score: comboScore(set) };
    combos.push(plain);
    const jacket = anchor?.category === "outerwear" ? anchor : pickBest(outer, set);
    if (jacket) combos.push({ items: [jacket, ...set], score: comboScore([jacket, ...set]) + 0.3 });
  }
  if (anchor?.category === "accessory") combos.forEach((c) => c.items.push(anchor));
  else if (acc.length) combos.slice(0).sort((a, b) => b.score - a.score).slice(0, 2).forEach((c) => {
    const a = pickBest(acc, c.items);
    if (a) c.items.push(a);
  });
  if (anchor) combos = combos.filter((c) => c.items.some((i) => i.id === anchor.id));

  combos.sort((a, b) => b.score - a.score);
  const used = new Map<string, number>();
  const limit = req.strategy === "best" ? 1 : req.max ?? 6;
  return combos.slice(0, limit).map((c) => {
    const base = outfitName(c.items);
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    const reasons = explain(c.items);
    return {
      name: n > 1 ? `${base} ${["", "", "II", "III", "IV", "V"][n] ?? n}` : base,
      items: c.items.map((i) => i.id),
      reason: SENTENCE[base] ?? SENTENCE.Everyday,
      reasons,
    };
  });
}

const SENTENCE: Record<string, string> = {
  Minimal: "A quiet, neutral palette that works almost anywhere.",
  Layered: "A light layer over a clean base adds structure without noise.",
  "Smart Layers": "Tailored layering that reads polished but not formal.",
  Accent: "One colour carries the look while everything else stays neutral.",
  "Smart Casual": "Tailored pieces kept relaxed enough for daytime.",
  Sport: "Comfortable, coordinated and easy to move in.",
  Everyday: "An easy, balanced combination for daily wear.",
};

function pairScore(item: OutfitInputItem, base: OutfitInputItem[]): number {
  let s = 0;
  for (const b of base) {
    if (item.style === b.style) s += 1;
    if (isNeutral(item.color)) s += 0.6;
    if (item.season === b.season || item.season === "All seasons" || b.season === "All seasons") s += 0.4;
  }
  return s;
}

function comboScore(items: OutfitInputItem[]): number {
  const accents = items.filter((i) => !isNeutral(i.color));
  const accentColors = new Set(accents.map((i) => i.color.toLowerCase()));
  let s = 3;
  if (accentColors.size > 1) s -= 1.5 * (accentColors.size - 1);
  if (accents.length === 1) s += 0.5;
  const styles = new Set(items.map((i) => i.style));
  s -= 0.4 * (styles.size - 1);
  if (items.some((i) => i.category === "shoes")) s += 0.5;
  return s;
}

function outfitName(items: OutfitInputItem[]): string {
  const styles = items.map((i) => i.style.toLowerCase());
  if (items.some((i) => i.category === "outerwear")) return styles.some((s) => /smart|classic/.test(s)) ? "Smart Layers" : "Layered";
  if (styles.some((s) => /sport/.test(s))) return "Sport";
  if (styles.some((s) => /smart|classic/.test(s))) return "Smart Casual";
  if (items.every((i) => isNeutral(i.color))) return "Minimal";
  if (items.filter((i) => !isNeutral(i.color)).length === 1) return "Accent";
  return "Everyday";
}

function explain(items: OutfitInputItem[]): string[] {
  const r: string[] = [];
  const accents = items.filter((i) => !isNeutral(i.color));
  if (!accents.length) r.push("Neutral colours");
  else if (accents.length === 1) r.push(`${accents[0].color} as the only accent`);
  else r.push("Coordinated colours");
  const styles = new Set(items.map((i) => i.style));
  if (styles.size === 1) r.push(`One style: ${[...styles][0]}`);
  if (items.some((i) => i.category === "outerwear")) r.push("Layered for cooler days");
  else r.push("Balanced proportions");
  return r.slice(0, 3);
}
