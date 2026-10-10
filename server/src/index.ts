import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { createImageEdit, createLLM } from "./config.js";
import type { OutfitInputItem } from "./providers/types.js";

const llm = createLLM();
const imageEdit = createImageEdit();
const app = new Hono();

app.use("/api/*", cors({ origin: (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(",") }));

app.get("/api/health", (c) => c.json({ ok: true, llm: llm.name, image: imageEdit.name }));

/**
 * POST /api/items/process
 * multipart/form-data: image
 * → { processedImage (data URL | null), name, category, type, color, colorHex, material, style, season, gender, detection }
 * processedImage is null when no image provider is configured (or ?detectOnly=1):
 * the client then isolates the garment on-device using `detection`.
 */
app.post("/api/items/process", bodyLimit({ maxSize: 15 * 1024 * 1024 }), async (c) => {
  const form = await c.req.formData();
  const file = form.get("image");
  if (!(file instanceof File)) return c.json({ error: "image is required" }, 400);
  const input = { bytes: new Uint8Array(await file.arrayBuffer()), mediaType: file.type || "image/jpeg" };

  const detectOnly = c.req.query("detectOnly") === "1" || imageEdit.name === "none";

  // Describe from the original photo (more context), clean in parallel.
  const [detected, cleaned] = await Promise.all([
    llm.detect(input),
    detectOnly
      ? null
      : imageEdit.clean(input).catch((e) => {
          console.error("[image]", imageEdit.name, e.message);
          return null;
        }),
  ]);
  return c.json({
    processedImage: cleaned ? `data:${cleaned.mediaType};base64,${Buffer.from(cleaned.bytes).toString("base64")}` : null,
    ...detected.attributes,
    detection: detected.detection,
  });
});

/**
 * POST /api/looks/describe
 * multipart/form-data: image, wardrobe = JSON OutfitInputItem[]
 * → { title, description, pieces[], item_ids[], tags[] }
 */
app.post("/api/looks/describe", bodyLimit({ maxSize: 15 * 1024 * 1024 }), async (c) => {
  const form = await c.req.formData();
  const file = form.get("image");
  if (!(file instanceof File)) return c.json({ error: "image is required" }, 400);
  const wardrobe = JSON.parse(String(form.get("wardrobe") ?? "[]")) as OutfitInputItem[];
  const r = await llm.look({ bytes: new Uint8Array(await file.arrayBuffer()), mediaType: file.type || "image/jpeg" }, wardrobe.slice(0, 300));
  if (!r) return c.json({ error: "no vision model configured" }, 503);
  return c.json(r);
});

/**
 * POST /api/items/sizes
 * multipart/form-data: images (one per item, same order as meta), meta = JSON [{id, name, type, category}]
 * → { sizes: [{ id, width_cm, height_cm }] } — real-world size of each item as it lies in its photo.
 */
app.post("/api/items/sizes", bodyLimit({ maxSize: 25 * 1024 * 1024 }), async (c) => {
  const form = await c.req.formData();
  const meta = JSON.parse(String(form.get("meta") ?? "[]")) as { id: string; name: string; type: string; category: string }[];
  const files = form.getAll("images").filter((f): f is File => f instanceof File);
  if (!meta.length || meta.length !== files.length || meta.length > 20) return c.json({ error: "images and meta must match (max 20)" }, 400);
  const items = await Promise.all(meta.map(async (m, i) => ({ ...m, image: { bytes: new Uint8Array(await files[i].arrayBuffer()), mediaType: files[i].type || "image/jpeg" } })));
  const sizes = await llm.sizes(items);
  return c.json({ sizes: Object.entries(sizes).map(([id, s]) => ({ id, width_cm: s.w, height_cm: s.h })) });
});

/**
 * POST /api/outfits/generate
 * { wardrobe: OutfitInputItem[], anchorItemId?, occasion?, max?, exact? } → { outfits: [{ name, items, reason, reasons }] }
 * wardrobe = only the items the user selected. exact = true: those items ARE the outfit (name + explain it).
 * strategy = "all": every good combination; "best": the single most harmonious outfit.
 */
app.post("/api/outfits/generate", async (c) => {
  const body = await c.req.json<{ wardrobe?: OutfitInputItem[]; anchorItemId?: string; occasion?: string; max?: number; exact?: boolean; strategy?: "all" | "best" }>();
  if (!Array.isArray(body.wardrobe)) return c.json({ error: "wardrobe is required" }, 400);
  const wardrobe = body.wardrobe.slice(0, 300);
  const outfits = await llm.outfits(wardrobe, { anchorItemId: body.anchorItemId, occasion: body.occasion, max: Math.min(body.max ?? 6, 10), exact: body.exact === true, strategy: body.strategy === "best" ? "best" : body.strategy === "all" ? "all" : undefined });
  return c.json({ outfits });
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Something went wrong" }, 500);
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => console.log(`AI Wardrobe API on :${port} (llm: ${llm.name}, image: ${imageEdit.name})`));
