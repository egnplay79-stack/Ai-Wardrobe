import type { OutfitInputItem, OutfitRequest } from "./AIProvider";

/** Prompts are shared by every LLM-backed provider (and mirrored on the server). */
export const DETECT_PROMPT = `The photo shows one wardrobe item (clothing, shoes or an accessory). If several are visible, pick the main, largest one.
Reply with ONLY a JSON object:
{"name":"short English name, 2-4 words, e.g. \\"White Oversized Shirt\\"",
 "category":"top|bottom|dress|outerwear|shoes|accessory",
 "type":"specific garment type, one or two words: Shirt, T-shirt, Hoodie, Jeans, Trousers, Skirt, Sneakers, Boots, Coat, Blazer, Bag…",
 "color":"main colour in plain English, 1-2 words",
 "color_hex":"#rrggbb of the main colour",
 "material":"likely fabric if visible (Cotton, Denim, Wool, Leather, Knit…), else empty string",
 "style":"one word: Minimal, Casual, Classic, Sport, Street, Smart, Romantic…",
 "season":"All seasons|Spring / Summer|Autumn / Winter",
 "gender":"Women|Men|Unisex",
 "bbox":[x0,y0,x1,y1],
 "rotation_deg":0,
 "background":"plain|busy",
 "outline":[[x,y],...],
 "size_cm":{"width":0,"height":0}}
bbox: the item's box as fractions of image width/height (0..1), with ~3% margin, never cutting the item.
rotation_deg: clockwise tilt of the item from its natural upright position (shirts, trousers, dresses vertical; shoes sole-horizontal), -45..45; 0 if it lies straight.
background: "plain" for a uniform surface around the item, "busy" for patterned or cluttered.
size_cm: the item's real-world size exactly as it lies in the photo, in centimetres (width = left to right including spread sleeves/legs, height = top to bottom), for a typical adult size M. Judge from its cut and details (zip and button sizes, pockets, logos, laces, a cropped vs long fit, wide vs slim legs).
outline: 16-32 points tracing the item's silhouette clockwise (fractions 0..1 of the photo), following sleeves, legs and straps; err slightly outside the item rather than inside.
Categories: top = t-shirts, shirts, sweaters, hoodies; bottom = trousers, jeans, skirts, shorts; outerwear = jackets, coats, blazers; accessory = bags, belts, hats, caps, scarves, glasses, watches, jewellery.
For accessories, "type" must name the exact thing (Sunglasses, Cap, Beanie, Scarf, Belt, Bag, Backpack, Watch, Necklace…).`;

export function outfitPrompt(wardrobe: OutfitInputItem[], req: OutfitRequest): string {
  if (req.exact) {
    return `You are a precise, minimalist stylist. The user picked these items to wear together (JSON):
${JSON.stringify(wardrobe)}

Treat them as ONE outfit using ALL items (copy every id). Give it a name and explain honestly why it works; if something clashes, say how to wear it so it works.
Reply with ONLY JSON:
{"outfits":[{"name":"one or two words","items":["every id"],"reason":"one sentence","reasons":["2-3 very short points"]}]}`;
  }
  if (req.strategy === "best") {
    return `You are a precise, minimalist stylist. The user picked these items (JSON):
${JSON.stringify(wardrobe)}

Occasion: ${req.occasion || "everyday"}.
Choose the ONE best outfit from them: the most harmonious, coordinated combination. Leave out any piece that doesn't fit the look; never add items that are not listed (copy ids exactly).
Rules: a top + bottom, or a dress. Add shoes whenever any exist. Add outerwear and accessories only when they make the look better. Weigh colour harmony, style, season, proportions (fitted with relaxed, long with short) and context.
Reply with ONLY JSON, exactly one outfit:
{"outfits":[{"name":"one or two words","items":["id",...],"reason":"one sentence why this is the strongest combination","reasons":["2-3 very short points"]}]}`;
  }
  const anchor = req.anchorItemId
    ? `Every outfit MUST include the item with id "${req.anchorItemId}" and be built to flatter it.`
    : req.strategy === "all"
      ? "Cover every distinct good combination these items allow: each different top/bottom/dress pairing, with and without a layer when both work. Skip only combinations that clash."
      : "Use the wardrobe broadly; vary the outfits.";
  return `You are a precise, minimalist stylist. The user's wardrobe (JSON):
${JSON.stringify(wardrobe)}

Occasion: ${req.occasion || "everyday"}.
Create up to ${req.max ?? 6} distinct outfits using ONLY these items (copy ids exactly). ${anchor}
Rules: each outfit has a top + bottom, or a dress. Add shoes whenever any exist. Add outerwear and accessories only when they improve the look. Consider colour harmony, style, season, proportions (fitted with relaxed, long with short) and context. No duplicate combinations. If only one good outfit exists, return one.
Reply with ONLY JSON:
{"outfits":[{"name":"one or two words, e.g. Minimal, Everyday, Smart Casual","items":["id",...],"reason":"one sentence why it works","reasons":["2-3 very short points, e.g. Neutral colours, Balanced proportions"]}]}`;
}

export function sizesPrompt(items: { id: string; name: string; type: string; category: string }[]): string {
  return `The ${items.length} photos show clothing items cut out on white, in this order:
${items.map((it, i) => `${i + 1}. id "${it.id}" — ${it.name} (${it.type}, ${it.category})`).join("\n")}

For EACH photo estimate the item's real-world size exactly as it lies in that photo, in centimetres:
width = left to right (including spread sleeves, both legs, both shoes of a pair), height = top to bottom.
Assume a typical adult size M. Judge from the cut and details: zip and button sizes (~1.5 cm), pockets, logos, laces, hood, cropped vs long length, wide vs slim legs, shoe pair overlap.
Keep the items consistent with each other — they will be shown side by side at true scale.
Reply with ONLY JSON: {"sizes":[{"id":"...","width_cm":0,"height_cm":0}]}`;
}

export function lookPrompt(wardrobe: OutfitInputItem[]): string {
  return `The photo shows a person's outfit (a mirror selfie, a street photo or an inspiration picture).
1. Give the look a short name (1-3 words, e.g. "Monochrome Street", "Soft Layers").
2. Describe it in one or two plain sentences: the overall style, colours and silhouette.
3. List every visible clothing item, shoe and accessory as short phrases ("Black puffer jacket", "Wide black trousers", "Tan suede sneakers").
4. Match visible pieces to the user's wardrobe below ONLY when you are confident it is the same item (same type, colour and details). Copy ids exactly; return none rather than guessing.
5. Up to 4 short style tags (e.g. "Minimal", "Streetwear", "Winter").

Wardrobe (JSON): ${JSON.stringify(wardrobe)}

Reply with ONLY JSON:
{"title":"...","description":"...","pieces":["..."],"item_ids":["..."],"tags":["..."]}`;
}
