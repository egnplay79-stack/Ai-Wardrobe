import type { Category, WardrobeItem } from "../types";

/**
 * Typical real size of an item laid flat, in centimetres.
 * Clothes (tops, outerwear, bottoms, dresses): LENGTH, top to bottom, whatever the sleeves do.
 * Shoes and accessories: the longest side (shoe length, glasses width, bag width…).
 * Matched on type and name, English or Russian; first match wins, so specific words come first.
 */
const TABLE: Record<Category, [RegExp, number][]> = {
  accessory: [
    [/sunglass|glasses|spectacle|очк/i, 14],
    [/earring|серьг/i, 5],
    [/\bring\b|кольц/i, 3],
    [/bracelet|браслет/i, 8],
    [/watch|часы/i, 22],
    [/necklace|chain|pendant|ожерел|цепоч|кулон/i, 25],
    [/beanie|шапк/i, 24],
    [/\bcap\b|кепк|бейсболк/i, 25],
    [/\bhat\b|bucket|beret|шляп|панам|берет/i, 33],
    [/glove|перчат/i, 24],
    [/wallet|кошел/i, 18],
    [/clutch|клатч/i, 25],
    [/backpack|рюкзак/i, 45],
    [/tote|шоппер/i, 40],
    [/bag|purse|сумк/i, 30],
    [/belt|ремень|пояс/i, 45],
    [/scarf|шарф/i, 60],
    [/\btie\b|галстук/i, 45],
  ],
  // One shoe's length; a side-by-side pair is handled below.
  shoes: [
    [/knee|high boot|сапог/i, 45],
    [/boot|ботин|челси|chelsea/i, 32],
    [/heel|pump|туфл|лодоч/i, 25],
    [/sandal|slide|flip|сандал|шлеп/i, 27],
    [/loafer|лофер|мокасин/i, 28],
    [/sneaker|trainer|кросс|кед/i, 30],
  ],
  dress: [
    [/maxi|макси/i, 135],
    [/mini|мини/i, 80],
    [/midi|миди/i, 110],
  ],
  bottom: [
    [/shorts|шорт/i, 50],
    [/mini|мини/i, 40],
    [/maxi|макси/i, 95],
    [/midi|skirt|юбк/i, 65],
    [/legging|лосин|леггин/i, 95],
  ],
  outerwear: [
    [/trench|coat|parka|пальто|тренч|парк/i, 100],
    [/puffer|down jacket|пухов/i, 72],
    [/blazer|пиджак|жакет/i, 75],
    [/vest|gilet|жилет/i, 60],
    [/cardigan|кардиган/i, 68],
  ],
  top: [
    [/crop|кроп/i, 45],
    [/tank|cami|майк/i, 60],
    [/hoodie|sweatshirt|худи|свитшот|толстовк/i, 70],
    [/sweater|jumper|pullover|knit|свитер|джемпер/i, 66],
    [/blouse|блуз/i, 65],
    [/t-?shirt|\btee\b|polo|футболк|поло/i, 70],
    [/shirt|рубашк|сорочк/i, 75],
  ],
};

const BY_CATEGORY: Record<Category, number> = {
  top: 70, outerwear: 72, bottom: 105, dress: 100, shoes: 30, accessory: 25,
};

/** Shoes are shown a little larger than life so they read clearly next to clothes. */
const SHOE_BOOST = 1.2;

/** Garments are sized by length; shoes and accessories by their longest side. */
const BY_LENGTH: Category[] = ["top", "outerwear", "bottom", "dress"];

/** Look in the item's own category first, then in neighbouring ones (a puffer filed as a "Top"). */
const NEIGHBOURS: Record<Category, Category[]> = {
  top: ["top", "outerwear"], outerwear: ["outerwear", "top"], bottom: ["bottom"], dress: ["dress"],
  shoes: ["shoes"], accessory: ["accessory"],
};

function lookupCm(item: Pick<WardrobeItem, "category" | "type" | "name">): number {
  const text = `${item.type} ${item.name}`;
  for (const c of NEIGHBOURS[item.category]) for (const [re, v] of TABLE[c]) if (re.test(text)) return v;
  return BY_CATEGORY[item.category];
}

/**
 * Real width and height (cm) of an item whose visible content has the given aspect (w/h).
 * The user's per-item size adjustment is applied; shoes get a small boost.
 */
export function realSizeCm(item: Pick<WardrobeItem, "category" | "type" | "name" | "scale" | "realCm">, aspect: number) {
  const boost = (item.category === "shoes" ? SHOE_BOOST : 1) * (item.scale ?? 1);
  // AI measured this exact item from its photo: trust it, keeping the picture's own proportions.
  const r = item.realCm;
  if (r && r.w > 1 && r.h > 1) {
    const typical = lookupCm(item);
    // Guard against a wild estimate: stay within 0.4×–2.5× of the typical size for this type.
    const ok = (v: number) => v > typical * 0.4 && v < typical * 2.5;
    const main = BY_LENGTH.includes(item.category) || aspect < 1 ? r.h : r.w;
    if (ok(main)) {
      // Use both measured sides: pick the size whose area matches the AI's width × height,
      // keeping the photo's own proportions (the picture is never stretched).
      const h = Math.sqrt((r.w * r.h) / aspect);
      return { w: h * aspect * boost, h: h * boost };
    }
  }
  let cm = lookupCm(item);
  if (item.category === "shoes") {
    // A pair shot from the side is wider than one shoe; overlapping or side by side, ~1.5 shoe lengths.
    if (aspect > 1.6) cm *= 1.5;
    cm *= SHOE_BOOST;
  }
  cm *= item.scale ?? 1;
  if (BY_LENGTH.includes(item.category)) return { w: cm * aspect, h: cm };
  return aspect >= 1 ? { w: cm, h: cm / aspect } : { w: cm * aspect, h: cm };
}
