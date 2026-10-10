import { useEffect, useRef, useState } from "react";
import { realSizeCm } from "../utils/sizes";
import type { WardrobeItem } from "../types";

/** Where an accessory is worn, from its type/name (English and Russian keywords). */
type Zone = "head" | "neck" | "waist" | "hand";
const ZONES: [Zone, RegExp][] = [
  ["head", /glass|sunglass|spectacle|hat|cap\b|beanie|beret|bucket|headband|earring|hair|очк|шап|кеп|панам|берет|серьг/i],
  ["neck", /scarf|necklace|tie\b|chain|choker|pendant|шарф|ожерел|галстук|цеп|кулон/i],
  ["waist", /belt|ремень|пояс/i],
  ["hand", /bag|tote|clutch|backpack|purse|wallet|watch|bracelet|ring\b|glove|сумк|рюкзак|часы|браслет|кольц|перчат|кошел/i],
];
export function accessoryZone(it: WardrobeItem): Zone {
  const text = `${it.type} ${it.name}`;
  for (const [z, re] of ZONES) if (re.test(text)) return z;
  return "hand";
}

interface Row {
  key: string;
  weight: number;
  main: WardrobeItem[];
  side: WardrobeItem[];
}

/**
 * The outfit laid out the way it is worn, top to bottom:
 *   glasses / hat
 *   jacket · top        (scarf)
 *   belt
 *   trousers            (bag)
 *   shoes
 * Every item is a background-free cut-out in its own cell; cells sit close but never overlap.
 */
export function buildRows(items: WardrobeItem[]): Row[] {
  const of = (c: WardrobeItem["category"]) => items.filter((i) => i.category === c);
  const acc = of("accessory");
  const zone = (z: Zone) => acc.filter((a) => accessoryZone(a) === z);

  const outer = of("outerwear"), tops = of("top"), bottoms = of("bottom"), dresses = of("dress"), shoes = of("shoes");
  const rows: Row[] = [];
  if (zone("head").length) rows.push({ key: "head", weight: 0.26, main: zone("head"), side: [] });

  if (dresses.length) {
    // A dress spans the whole body; a jacket goes beside it.
    rows.push({ key: "body", weight: 2.1, main: [...outer.slice(0, 1), dresses[0]], side: [...zone("neck"), ...zone("hand"), ...tops, ...bottoms, ...outer.slice(1), ...dresses.slice(1)] });
    rows[rows.length - 1].side.push(...zone("waist")); // a belt sits beside the dress
  } else {
    const upper = [...outer.slice(0, 1), ...tops.slice(0, 1)];
    if (upper.length) rows.push({ key: "upper", weight: 1, main: upper, side: [...zone("neck"), ...outer.slice(1), ...tops.slice(1)] });
    if (zone("waist").length) rows.push({ key: "waist", weight: 0.14, main: zone("waist"), side: [] });
    if (bottoms.length) rows.push({ key: "lower", weight: 1.15, main: bottoms.slice(0, 1), side: [...zone("hand"), ...bottoms.slice(1)] });
    else if (zone("hand").length && rows.length) rows[rows.length - 1].side.push(...zone("hand"));
    if (!upper.length && !bottoms.length && zone("neck").length) rows.push({ key: "neck", weight: 0.4, main: zone("neck"), side: [] });
  }
  if (shoes.length) rows.push({ key: "feet", weight: 0.32, main: shoes.slice(0, 1), side: shoes.slice(1) });
  // Anything not placed yet (e.g. a bag in an outfit with no trousers) goes beside the last row.
  const placed = new Set(rows.flatMap((r) => [...r.main, ...r.side]).map((i) => i.id));
  const rest = items.filter((i) => !placed.has(i.id));
  if (!rows.length) rows.push({ key: "all", weight: 1, main: rest, side: [] });
  else if (rest.length) rows[rows.length - 1].side.push(...rest);
  return rows;
}

/* ---------- proportional layout ---------- */

const GAP_X = 4; // cm between items in a row
const GAP_Y = 3; // cm between rows

/** Where the visible item sits inside its image (fractions), and its aspect (w/h). */
interface ContentBox { x0: number; y0: number; x1: number; y1: number; aspect: number }

/** Measured once per image URL and shared by every board. */
const boxCache = new Map<string, ContentBox>();
const DEFAULT_ASPECT: Record<WardrobeItem["category"], number> = {
  top: 0.95, outerwear: 0.9, bottom: 0.45, dress: 0.55, shoes: 1.4, accessory: 1.6,
};

/**
 * The visible item's box inside the picture, ignoring transparent or white margins and stray
 * specks (a row/column counts only if enough of it is item). Sizes must come from this box,
 * not the file's dimensions, or an item with wide empty margins looks too small.
 */
function measure(img: HTMLImageElement): ContentBox {
  const k = Math.min(1, 256 / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.max(1, Math.round(img.naturalWidth * k)), H = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, W, H);
  let d: Uint8ClampedArray;
  try { d = g.getImageData(0, 0, W, H).data; } catch { return { x0: 0, y0: 0, x1: 1, y1: 1, aspect: img.naturalWidth / img.naturalHeight }; }
  // Cut-outs are transparent around the item; older images may be on white instead.
  const transparent = [0, (W - 1) * 4, (H - 1) * W * 4, (H * W - 1) * 4].some((i) => d[i + 3] < 200);
  const isItem = (i: number) => d[i + 3] > 60 && (transparent || !(d[i] > 246 && d[i + 1] > 246 && d[i + 2] > 246));
  const cols = new Uint32Array(W), rows = new Uint32Array(H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isItem((y * W + x) * 4)) { cols[x]++; rows[y]++; }
  const span = (a: Uint32Array, len: number, other: number) => {
    const min = Math.max(1, other * 0.01);
    let a0 = 0, a1 = len - 1;
    while (a0 < len && a[a0] < min) a0++;
    while (a1 > a0 && a[a1] < min) a1--;
    return a0 >= len ? [0, len] : [a0, a1 + 1];
  };
  const [x0, x1] = span(cols, W, H), [y0, y1] = span(rows, H, W);
  return { x0: x0 / W, y0: y0 / H, x1: x1 / W, y1: y1 / H, aspect: ((x1 - x0) / W * img.naturalWidth) / ((y1 - y0) / H * img.naturalHeight) };
}

function useContentBoxes(items: WardrobeItem[]) {
  const [, bump] = useState(0);
  useEffect(() => {
    let alive = true;
    for (const it of items) {
      if (boxCache.has(it.imageUrl)) continue;
      const im = new Image();
      im.onload = () => {
        if (im.naturalWidth && im.naturalHeight) boxCache.set(it.imageUrl, measure(im));
        if (alive) bump((n) => n + 1);
      };
      im.src = it.imageUrl;
    }
    return () => { alive = false; };
  }, [items]);
  return (it: WardrobeItem): ContentBox | null => boxCache.get(it.imageUrl) ?? null;
}

interface Placed { item: WardrobeItem; x: number; y: number; w: number; h: number }

/**
 * Place every item at its real-world size (cm), rows top to bottom as worn. Returns the
 * content boxes in cm plus the outfit's overall size; the caller scales uniformly to fit.
 */
export function layoutOutfit(items: WardrobeItem[], aspectOf: (it: WardrobeItem) => number) {
  const rows = buildRows(items);
  const placed: Placed[] = [];
  let y = 0;
  let minX = Infinity, maxX = -Infinity;
  for (const r of rows) {
    const size = (it: WardrobeItem) => ({ it, ...realSizeCm(it, aspectOf(it)) });
    const main = r.main.map(size), side = r.side.map(size);
    const rowH = Math.max(...main.map((m) => m.h), ...side.map((m) => m.h), 1);
    const mainW = main.reduce((a, m) => a + m.w, 0) + GAP_X * Math.max(0, main.length - 1);
    let x = -mainW / 2;
    const put = (m: { it: WardrobeItem; w: number; h: number }) => {
      // Upper body sits on the waistline (bottom-aligned); everything else is centred in its row.
      const top = r.key === "upper" ? y + rowH - m.h : y + (rowH - m.h) / 2;
      placed.push({ item: m.it, x, y: top, w: m.w, h: m.h });
      minX = Math.min(minX, x); maxX = Math.max(maxX, x + m.w);
      x += m.w + GAP_X;
    };
    main.forEach(put);
    if (!main.length) x = -side.reduce((a, m) => a + m.w + GAP_X, -GAP_X) / 2;
    side.forEach(put);
    y += rowH + GAP_Y;
  }
  const height = Math.max(1, y - GAP_Y), width = Math.max(1, maxX - minX);
  return { placed: placed.map((p) => ({ ...p, x: p.x - minX })), width, height };
}

/** Outfit on white: every item true to its real size relative to the others, as worn. */
export function OutfitBoard({ items }: { items: WardrobeItem[] }) {
  const boxOf = useContentBoxes(items);
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const ready = items.every((it) => boxOf(it));
  const { placed, width, height } = layoutOutfit(items, (it) => boxOf(it)?.aspect ?? DEFAULT_ASPECT[it.category]);
  const s = Math.min(size.w / width, size.h / height);
  const ox = (size.w - width * s) / 2, oy = (size.h - height * s) / 2;

  return (
    <div className="board" aria-label={items.map((i) => i.name).join(", ")}>
      <div className="board-inner" ref={ref} style={{ opacity: ready && size.w ? 1 : 0 }}>
        {size.w > 0 && placed.map((p) => {
          const b = boxOf(p.item) ?? { x0: 0, y0: 0, x1: 1, y1: 1, aspect: 1 };
          // Size the whole image so its visible content lands exactly on the target box.
          const cw = p.w * s, ch = p.h * s;
          const iw = cw / (b.x1 - b.x0), ih = ch / (b.y1 - b.y0);
          return (
            <img
              key={p.item.id}
              src={p.item.imageUrl}
              alt={p.item.name}
              draggable={false}
              style={{ left: ox + p.x * s - b.x0 * iw, top: oy + p.y * s - b.y0 * ih, width: iw, height: ih }}
            />
          );
        })}
      </div>
    </div>
  );
}
