import type { Detection } from "../types";

export interface SegmentOptions {
  tolerance?: number;
  cropOnly?: boolean;
  /** Treat darker floor next to the item as shadow and remove it (default true). */
  shadow?: boolean;
  /** Colour-model refinement after the fill (default true). Off = pure edge-following fill. */
  refine?: boolean;
  /** Working resolution, px on the long side (default 900). Higher keeps finer detail. */
  workMax?: number;
  /** <1 keeps more fabric-like pixels, >1 removes more floor-like pixels (default 1). */
  bias?: number;
  /** Shave this many px off the edge before the soft matte (default 0). */
  shave?: number;
  /** Feather passes on the edge (default 2). */
  feather?: number;
  /** Extra user rotation in degrees, added after the detected correction. */
  extraRotation?: number;
}

export interface SegmentStats {
  /** Mean colour of the isolated garment. */
  avg: [number, number, number];
  /** Width / height of the straightened garment. */
  aspect: number;
  /** Share of the crop the garment covers (0..1). */
  coverage: number;
  /** True when the background could not be separated and the full crop was kept. */
  fellBack: boolean;
  /** Edge length relative to size (perimeter / √area): higher = more ragged outline. */
  ragged: number;
}

export interface SegmentResult {
  /** Transparent, straightened, trimmed garment. */
  canvas: HTMLCanvasElement;
  stats: SegmentStats;
}

type RGB = [number, number, number];

const WORK_MAX = 900;

/** Perceptual-ish RGB distance (green weighted), ≈ channel units. */
const cdist = (r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) =>
  Math.sqrt(2 * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + 3 * (b1 - b2) ** 2) / 3;

/**
 * On-device garment isolation.
 *
 * 1. Crop to the AI box; pixels outside the AI outline (if given) are background.
 * 2. Region-grow the background from the border with a drifting local reference (follows
 *    floor gradients and soft shadows, stops at the garment edge).
 * 3. Learn colour models of background and garment (k-means) and use them to re-classify
 *    enclosed gaps (between sleeve and body, between trouser legs) and halo pixels.
 * 4. Smooth the mask (no jagged steps), keep the garment, drop stray objects.
 * 5. Soft matte: a 3–4 px band where alpha follows colour similarity, then feathered —
 *    edges fade instead of cutting hard.
 * 6. Remove background colour spill from semi-transparent edge pixels.
 * 7. Gentle tone lift, straighten, trim.
 */
export function segment(src: HTMLCanvasElement, det: Detection, opt: SegmentOptions = {}): SegmentResult {
  const tolMul = opt.tolerance ?? 1;
  let b = det.bbox.map(Number) as number[];
  if (b.length !== 4 || b.some((v) => !isFinite(v)) || b[2] - b[0] < 0.05 || b[3] - b[1] < 0.05) b = [0, 0, 1, 1];
  const pad = 0.04;
  const x0 = Math.max(0, b[0] - pad) * src.width, y0 = Math.max(0, b[1] - pad) * src.height;
  const x1 = Math.min(1, b[2] + pad) * src.width, y1 = Math.min(1, b[3] + pad) * src.height;
  const cw = x1 - x0, ch = y1 - y0, k = Math.min(1, (opt.workMax ?? WORK_MAX) / Math.max(cw, ch));
  const W = Math.max(8, Math.round(cw * k)), H = Math.max(8, Math.round(ch * k)), N = W * H;

  const work = document.createElement("canvas");
  work.width = W; work.height = H;
  const g = work.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(src, x0, y0, cw, ch, 0, 0, W, H);
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;

  // Optional AI outline → "allowed" region, generously dilated so sleeves are never clipped.
  const allowed = det.outline && det.outline.length >= 3
    ? rasterOutline(det.outline, src.width, src.height, x0, y0, k, W, H)
    : null;

  const fg = new Uint8Array(N).fill(1);
  let fellBack = opt.cropOnly ?? false;
  let alpha: Float32Array | null = null;

  if (!opt.cropOnly) {
    const q = new Int32Array(N);
    const res = growBackground(d, W, H, fg, allowed, tolMul, q);

    if (!res.ok) {
      if (allowed) { for (let p = 0; p < N; p++) fg[p] = allowed[p] ? 1 : 0; }
      else { fg.fill(1); fellBack = true; }
    }
    if (!fellBack && opt.refine !== false) {
      // Colour models: background from the outer frame only (clean floor, no shadows under the item),
      // garment from the confident interior.
      const frame = new Uint8Array(N);
      const fx = Math.round(W * 0.08), fy = Math.round(H * 0.08);
      let frameCount = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const p = y * W + x;
        if (!fg[p] && (x < fx || x >= W - fx || y < fy || y >= H - fy)) { frame[p] = 1; frameCount++; }
      }
      const bgSrc = frameCount > N * 0.02 ? frame : invert(fg);
      const bgC = kmeans(d, bgSrc, 5);
      // Fabric model from deep inside the garment, so a shadow fringe the fill kept doesn't pollute it.
      let deep = erode(fg, W, H, Math.max(3, Math.round(Math.max(W, H) * 0.05)));
      if (deep.reduce((a, v) => a + v, 0) < 400) deep = erode(fg, W, H, 3);
      const fgC = kmeans(d, deep, 6);
      // Re-decide every pixel near the garment by colour (GrabCut-style): recovers fabric the fill
      // ate through low-contrast folds, and drops shadows and gaps that look like floor.
      const R = Math.max(4, Math.round(Math.max(W, H) * 0.06));
      const region = dilate(erode(dilate(fg, W, H, R), W, H, R), W, H, 2);
      // Cast shadows only sit next to the silhouette's edge (outer edge or inside gaps).
      const deepRegion = erode(fg, W, H, Math.max(3, Math.round(Math.max(W, H) * 0.03)));

      const dB = new Float32Array(N), dF = new Float32Array(N);
      for (let p = 0; p < N; p++) {
        const i = p * 4;
        const plain = bgC.length ? nearest(bgC, d[i], d[i + 1], d[i + 2]) : 255;
        // Near the edge, "floor in shadow" (floor colour scaled darker) also counts as background.
        dB[p] = opt.shadow !== false && !deepRegion[p] && bgC.length ? Math.min(plain, shadowDist(bgC, d[i], d[i + 1], d[i + 2]) + 4) : plain;
        dF[p] = fgC.length ? nearest(fgC, d[i], d[i + 1], d[i + 2]) : 255;
      }
      const core = erode(fg, W, H, 4);
      for (let p = 0; p < N; p++) {
        if (!region[p]) { fg[p] = 0; continue; }
        if (allowed && !allowed[p]) { fg[p] = 0; continue; }
        const garmentLike = dF[p] * 0.85 * (opt.bias ?? 1) < dB[p];
        if (core[p]) fg[p] = dB[p] < dF[p] * 0.6 * (opt.bias ?? 1) ? 0 : 1;
        else fg[p] = garmentLike ? 1 : 0;
      }
      const open = connectedToBorder(invert(fg), W, H, q); // floor reachable from outside, before smoothing
      smoothMask(fg, W, H, 3);
      fillHoles(fg, dB, dF, W, H, q, open);
      keepMain(fg, W, H, q);
      smoothMask(fg, W, H, 1);
      if (allowed) for (let p = 0; p < N; p++) if (!allowed[p]) fg[p] = 0;
      if (opt.shave) { const sh = erode(fg, W, H, opt.shave); fg.set(sh); }

      // Soft matte in a band around the edge.
      alpha = new Float32Array(N);
      const wide = edgeBand(fg, W, H, 2);
      for (let p = 0; p < N; p++) {
        if (!wide[p]) { alpha[p] = fg[p]; continue; }
        const t = dB[p] / (dB[p] + dF[p] + 1e-3); // 0 = looks like floor, 1 = looks like garment
        const colourA = smoothstep(0.25, 0.75, t);
        alpha[p] = 0.55 * colourA + 0.45 * fg[p];
      }
      for (let i = 0; i < (opt.feather ?? 2); i++) alpha = blur(alpha, W, H, 1);
      // Keep the interior fully opaque and the outside fully clear.
      const inner = erode(fg, W, H, 2);
      for (let p = 0; p < N; p++) {
        if (inner[p]) alpha[p] = 1;
        else if (alpha[p] < 0.04) alpha[p] = 0;
      }
      decontaminate(d, alpha, bgC);

      if (fg.reduce((s, v) => s + v, 0) < N * 0.02) { fg.fill(1); alpha = null; fellBack = true; }
    } else if (!fellBack) {
      // Edge-following fill only: keep the garment, smooth, soft edge.
      keepMain(fg, W, H, q);
      smoothMask(fg, W, H, 2);
      if (opt.shave) { const sh = erode(fg, W, H, opt.shave); fg.set(sh); }
      let a = new Float32Array(N);
      for (let p = 0; p < N; p++) a[p] = fg[p];
      for (let i = 0; i < (opt.feather ?? 2); i++) a = blur(a, W, H, 1);
      const inner = erode(fg, W, H, 2);
      for (let p = 0; p < N; p++) if (inner[p]) a[p] = 1;
      alpha = a;
    }
  }

  // Presentation: a gentle contrast lift around the garment's own midtone and a small shadow lift.
  // Identical per channel, so colour and fabric stay true.
  let ar = 0, ag = 0, ab = 0, cnt = 0;
  const hist = new Uint32Array(256);
  for (let p = 0; p < N; p++) if (fg[p]) {
    const i = p * 4;
    ar += d[i]; ag += d[i + 1]; ab += d[i + 2]; cnt++;
    hist[(d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) | 0]++;
  }
  const avg: RGB = cnt ? [ar / cnt, ag / cnt, ab / cnt] : [128, 128, 128];
  let mid = 128, acc = 0;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= cnt / 2) { mid = i; break; } }
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    let v = i + 0.07 * (i - mid);
    if (i < 70) v += (70 - i) * 0.12;
    lut[i] = Math.round(v);
  }
  for (let p = 0; p < N; p++) {
    const i = p * 4;
    d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]];
    d[i + 3] = alpha ? Math.round(Math.max(0, Math.min(1, alpha[p])) * 255) : 255;
  }
  g.putImageData(img, 0, 0);

  // Straighten. Non-finite rotationDeg means "estimate from the garment's shape".
  const tilt = isFinite(det.rotationDeg) ? det.rotationDeg : fellBack ? 0 : estimateTilt(fg, W, H);
  const detRot = Math.abs(tilt) >= (isFinite(det.rotationDeg) ? 2 : 3) ? -tilt : 0;
  const rot = ((detRot + (opt.extraRotation ?? 0)) * Math.PI) / 180;
  const cs = Math.abs(Math.cos(rot)), sn = Math.abs(Math.sin(rot));
  const RW = Math.ceil(W * cs + H * sn), RH = Math.ceil(W * sn + H * cs);
  const r = document.createElement("canvas");
  r.width = RW; r.height = RH;
  const rg = r.getContext("2d", { willReadFrequently: true })!;
  rg.imageSmoothingQuality = "high";
  rg.translate(RW / 2, RH / 2);
  rg.rotate(rot);
  rg.drawImage(work, -W / 2, -H / 2);

  // Trim to the garment.
  const rd = rg.getImageData(0, 0, RW, RH).data;
  let tx0 = RW, ty0 = RH, tx1 = 0, ty1 = 0;
  for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++)
    if (rd[(y * RW + x) * 4 + 3] > 20) { if (x < tx0) tx0 = x; if (x > tx1) tx1 = x; if (y < ty0) ty0 = y; if (y > ty1) ty1 = y; }
  if (tx1 <= tx0) { tx0 = 0; ty0 = 0; tx1 = RW - 1; ty1 = RH - 1; }
  const tw = tx1 - tx0 + 1, th = ty1 - ty0 + 1;
  const out = document.createElement("canvas");
  out.width = tw; out.height = th;
  out.getContext("2d")!.drawImage(r, tx0, ty0, tw, th, 0, 0, tw, th);

  let perim = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const p = y * W + x;
    if (fg[p] && (!fg[p - 1] || !fg[p + 1] || !fg[p - W] || !fg[p + W])) perim++;
  }
  const ragged = cnt ? perim / Math.sqrt(cnt) : 0;
  return { canvas: out, stats: { avg, aspect: tw / th, coverage: cnt / N, fellBack, ragged } };
}

/* ------------------------------------------------------------------ */
/* Background region growing                                           */
/* ------------------------------------------------------------------ */

function growBackground(
  d: Uint8ClampedArray, W: number, H: number, fg: Uint8Array, allowed: Uint8Array | null, tolMul: number, q: Int32Array,
): { ok: boolean; tol: number } {
  const N = W * H;
  const ring: number[] = [];
  for (let x = 0; x < W; x++) ring.push(x, (H - 1) * W + x);
  for (let y = 1; y < H - 1; y++) ring.push(y * W, y * W + W - 1);
  const px = (p: number) => p * 4;
  const dd = (a: number, r: number, gg: number, bb: number) => cdist(d[a], d[a + 1], d[a + 2], r, gg, bb);

  // Surface noise between neighbouring border pixels.
  const noiseSamples: number[] = [];
  for (let x = 1; x < W; x += 2) noiseSamples.push(dd(px(x), d[px(x - 1)], d[px(x - 1) + 1], d[px(x - 1) + 2]));
  for (let y = 1; y < H; y += 2) noiseSamples.push(dd(px(y * W), d[px((y - 1) * W)], d[px((y - 1) * W) + 1], d[px((y - 1) * W) + 2]));
  noiseSamples.sort((a, b) => a - b);
  const noise = noiseSamples[Math.floor(noiseSamples.length * 0.6)] || 4;
  const tol = Math.min(42, Math.max(13, 9 + 2.6 * noise)) * tolMul;

  const med = (c: number) => { const v = ring.map((p) => d[p * 4 + c]).sort((a, b) => a - b); return v[v.length >> 1]; };
  const mr = med(0), mg = med(1), mb = med(2);
  let spread = 0;
  for (const p of ring) spread += dd(px(p), mr, mg, mb);
  spread /= ring.length;
  const seedTol = Math.max(tol * 2.2, spread * 2.2);
  const globalTol = Math.max(seedTol, spread * 2.6) * Math.max(1, tolMul);

  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
  let qh = 0, qt = 0;
  const seed = (p: number) => { const i = px(p); fg[p] = 0; R[p] = d[i]; G[p] = d[i + 1]; B[p] = d[i + 2]; q[qt++] = p; };
  for (const p of ring) if (fg[p] && dd(px(p), mr, mg, mb) < seedTol) seed(p);
  if (allowed) for (let p = 0; p < N; p++) if (!allowed[p] && fg[p]) seed(p);

  while (qh < qt) {
    const p = q[qh++], x = p % W;
    const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W];
    for (const s of nb) {
      if (s < 0 || s >= N || !fg[s]) continue;
      const si = px(s);
      if (dd(si, R[p], G[p], B[p]) < tol && dd(si, mr, mg, mb) < globalTol) {
        fg[s] = 0;
        R[s] = R[p] * 0.9 + d[si] * 0.1; G[s] = G[p] * 0.9 + d[si + 1] * 0.1; B[s] = B[p] * 0.9 + d[si + 2] * 0.1;
        q[qt++] = s;
      }
    }
  }
  const fgCount = N - qt;
  return { ok: fgCount > N * 0.03 && fgCount < N * 0.97, tol };
}

/* ------------------------------------------------------------------ */
/* Colour models                                                       */
/* ------------------------------------------------------------------ */

function kmeans(d: Uint8ClampedArray, mask: Uint8Array, k: number): RGB[] {
  const idx: number[] = [];
  const N = mask.length;
  let total = 0;
  for (let p = 0; p < N; p++) if (mask[p]) total++;
  if (!total) return [];
  const step = Math.max(1, Math.floor(total / 5000));
  let c = 0;
  for (let p = 0; p < N; p++) if (mask[p] && c++ % step === 0) idx.push(p * 4);
  // Seed by luminance quantiles.
  const sorted = [...idx].sort((a, b) => d[a] + d[a + 1] + d[a + 2] - (d[b] + d[b + 1] + d[b + 2]));
  let centers: RGB[] = [];
  for (let j = 0; j < k; j++) {
    const i = sorted[Math.min(sorted.length - 1, Math.floor(((j + 0.5) / k) * sorted.length))];
    centers.push([d[i], d[i + 1], d[i + 2]]);
  }
  for (let it = 0; it < 6; it++) {
    const sum = centers.map(() => [0, 0, 0, 0]);
    for (const i of idx) {
      let best = 0, bd = Infinity;
      for (let j = 0; j < centers.length; j++) {
        const dv = cdist(d[i], d[i + 1], d[i + 2], ...centers[j]);
        if (dv < bd) { bd = dv; best = j; }
      }
      const s = sum[best];
      s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; s[3]++;
    }
    centers = sum.filter((s) => s[3] > 0).map((s) => [s[0] / s[3], s[1] / s[3], s[2] / s[3]] as RGB);
  }
  return centers;
}

function nearest(cs: RGB[], r: number, g: number, b: number): number {
  let m = Infinity;
  for (const c of cs) { const v = cdist(r, g, b, c[0], c[1], c[2]); if (v < m) m = v; }
  return m;
}

/** Distance to the nearest background colour darkened by a soft shadow (55–100% brightness). */
function shadowDist(cs: RGB[], r: number, g: number, b: number): number {
  let m = Infinity;
  for (const c of cs) {
    const cc = c[0] * c[0] + c[1] * c[1] + c[2] * c[2];
    if (cc < 1) continue;
    const s = Math.max(0.55, Math.min(1, (r * c[0] + g * c[1] + b * c[2]) / cc));
    const v = cdist(r, g, b, c[0] * s, c[1] * s, c[2] * s);
    if (v < m) m = v;
  }
  return m;
}

/* ------------------------------------------------------------------ */
/* Mask operations                                                     */
/* ------------------------------------------------------------------ */

/** Holes inside the garment: small ones, or ones that look like fabric, are filled. */
function fillHoles(fg: Uint8Array, dB: Float32Array, dF: Float32Array, W: number, H: number, q: Int32Array, open: Uint8Array) {
  const N = W * H;
  let garment = 0;
  for (let p = 0; p < N; p++) garment += fg[p];
  const seen = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    if (fg[p] || seen[p]) continue;
    let h = 0, t = 0, touches = false, sB = 0, sF = 0;
    q[t++] = p; seen[p] = 1;
    while (h < t) {
      const a = q[h++], ax = a % W, ay = (a / W) | 0;
      // Touching the border, or part of floor that was open to the outside before smoothing
      // (the narrow top of the gap between trouser legs), means it's not a hole.
      if (ax === 0 || ay === 0 || ax === W - 1 || ay === H - 1 || open[a]) touches = true;
      sB += dB[a]; sF += dF[a];
      const nb = [ax > 0 ? a - 1 : -1, ax < W - 1 ? a + 1 : -1, a - W, a + W];
      for (const s of nb) if (s >= 0 && s < N && !fg[s] && !seen[s]) { seen[s] = 1; q[t++] = s; }
    }
    // Real gaps (between a sleeve and the body) are big and look like floor; anything else is fabric.
    const gap = t > Math.max(30, garment * 0.004) && sB < sF * 0.55;
    if (!touches && !gap) for (let i = 0; i < t; i++) fg[q[i]] = 1;
  }
}

/** Pixels of `m` connected (4-neighbour) to the image border. */
function connectedToBorder(m: Uint8Array, W: number, H: number, q: Int32Array): Uint8Array {
  const N = W * H;
  const out = new Uint8Array(N);
  let h = 0, t = 0;
  const push = (p: number) => { if (m[p] && !out[p]) { out[p] = 1; q[t++] = p; } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (h < t) {
    const a = q[h++], ax = a % W;
    if (ax > 0) push(a - 1);
    if (ax < W - 1) push(a + 1);
    if (a >= W) push(a - W);
    if (a + W < N) push(a + W);
  }
  return out;
}

/** Keep the garment: the largest component plus any component at least 8% of its size. */
function keepMain(fg: Uint8Array, W: number, H: number, q: Int32Array) {
  const N = W * H;
  const lab = new Int32Array(N);
  const sizes = [0];
  let L = 0;
  for (let p = 0; p < N; p++) {
    if (!fg[p] || lab[p]) continue;
    L++; let h = 0, t = 0;
    q[t++] = p; lab[p] = L;
    while (h < t) {
      const a = q[h++], ax = a % W;
      const nb = [ax > 0 ? a - 1 : -1, ax < W - 1 ? a + 1 : -1, a - W, a + W];
      for (const s of nb) if (s >= 0 && s < N && fg[s] && !lab[s]) { lab[s] = L; q[t++] = s; }
    }
    sizes.push(t);
  }
  const big = Math.max(0, ...sizes);
  const minKeep = Math.max(80, big * 0.08);
  for (let p = 0; p < N; p++) if (fg[p] && sizes[lab[p]] < minKeep) fg[p] = 0;
}

/** Majority filter: removes stair-steps and single-pixel spurs. */
function smoothMask(fg: Uint8Array, W: number, H: number, passes: number) {
  for (let it = 0; it < passes; it++) {
    const src = fg.slice();
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += src[(y + dy) * W + x + dx];
      fg[y * W + x] = s >= 5 ? 1 : 0;
    }
  }
}

function invert(m: Uint8Array): Uint8Array {
  const o = new Uint8Array(m.length);
  for (let p = 0; p < m.length; p++) o[p] = m[p] ? 0 : 1;
  return o;
}

function dilate(m: Uint8Array, W: number, H: number, r: number): Uint8Array {
  return invert(erode(invert(m), W, H, r));
}

/** Chamfer (3-4) distance, in pixels, from every pixel to the nearest set pixel of `m`. O(N). */
function distanceTo(m: Uint8Array, W: number, H: number): Float32Array {
  const INF = 1e9;
  const dt = new Float32Array(W * H);
  for (let p = 0; p < dt.length; p++) dt[p] = m[p] ? 0 : INF;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x;
    let v = dt[p];
    if (x > 0) v = Math.min(v, dt[p - 1] + 3);
    if (y > 0) {
      v = Math.min(v, dt[p - W] + 3);
      if (x > 0) v = Math.min(v, dt[p - W - 1] + 4);
      if (x < W - 1) v = Math.min(v, dt[p - W + 1] + 4);
    }
    dt[p] = v;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const p = y * W + x;
    let v = dt[p];
    if (x < W - 1) v = Math.min(v, dt[p + 1] + 3);
    if (y < H - 1) {
      v = Math.min(v, dt[p + W] + 3);
      if (x < W - 1) v = Math.min(v, dt[p + W + 1] + 4);
      if (x > 0) v = Math.min(v, dt[p + W - 1] + 4);
    }
    dt[p] = v;
  }
  for (let p = 0; p < dt.length; p++) dt[p] /= 3;
  return dt;
}

function erode(m: Uint8Array, W: number, H: number, r: number): Uint8Array {
  if (r > 2) {
    const dt = distanceTo(invert(m), W, H);
    const o = new Uint8Array(m.length);
    for (let p = 0; p < m.length; p++) o[p] = dt[p] > r ? 1 : 0;
    return o;
  }
  let cur = m.slice();
  for (let it = 0; it < r; it++) {
    const nx = new Uint8Array(cur.length);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const p = y * W + x;
      nx[p] = cur[p] && cur[p - 1] && cur[p + 1] && cur[p - W] && cur[p + W] ? 1 : 0;
    }
    cur = nx;
  }
  return cur;
}

/** Pixels within r px of the mask boundary, on either side. */
function edgeBand(m: Uint8Array, W: number, H: number, r: number): Uint8Array {
  const inv = new Uint8Array(m.length);
  for (let p = 0; p < m.length; p++) inv[p] = m[p] ? 0 : 1;
  const a = erode(m, W, H, r), b = erode(inv, W, H, r);
  const band = new Uint8Array(m.length);
  for (let p = 0; p < m.length; p++) band[p] = !a[p] && !b[p] ? 1 : 0;
  return band;
}

function blur(a: Float32Array, W: number, H: number, r: number): Float32Array {
  const t = new Float32Array(a.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0, c = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const yy = y + dy, xx = x + dx;
      if (yy >= 0 && yy < H && xx >= 0 && xx < W) { s += a[yy * W + xx]; c++; }
    }
    t[y * W + x] = s / c;
  }
  return t;
}

/** Remove floor-colour spill from soft edge pixels: C = a·F + (1−a)·B → solve for F. */
function decontaminate(d: Uint8ClampedArray, alpha: Float32Array, bg: RGB[]) {
  if (!bg.length) return;
  for (let p = 0; p < alpha.length; p++) {
    const a = alpha[p];
    if (a <= 0.02 || a >= 0.98) continue;
    const i = p * 4;
    let best = bg[0], bd = Infinity;
    for (const c of bg) { const v = cdist(d[i], d[i + 1], d[i + 2], c[0], c[1], c[2]); if (v < bd) { bd = v; best = c; } }
    const aa = Math.max(a, 0.35);
    for (let ch = 0; ch < 3; ch++) d[i + ch] = Math.max(0, Math.min(255, (d[i + ch] - (1 - aa) * best[ch]) / aa));
  }
}

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** AI outline (fractions of the full photo) → mask in work space, dilated by ~5% of the crop. */
function rasterOutline(poly: [number, number][], SW: number, SH: number, x0: number, y0: number, k: number, W: number, H: number): Uint8Array {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = "#fff"; g.strokeStyle = "#fff";
  g.lineJoin = "round";
  g.lineWidth = Math.max(W, H) * 0.1;
  g.beginPath();
  poly.forEach(([fx, fy], i) => {
    const x = (fx * SW - x0) * k, y = (fy * SH - y0) * k;
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  });
  g.closePath();
  g.fill();
  g.stroke();
  const data = g.getImageData(0, 0, W, H).data;
  const m = new Uint8Array(W * H);
  for (let p = 0; p < m.length; p++) m[p] = data[p * 4 + 3] > 0 ? 1 : 0;
  return m;
}

/* ------------------------------------------------------------------ */
/* Background check, output                                            */
/* ------------------------------------------------------------------ */

export interface BackgroundCheck {
  busy: boolean;
  /** 0 = perfectly plain, higher = more pattern/clutter around the item. */
  score: number;
}

/** Looks at the outer frame of the photo: patterned or cluttered surfaces cut out badly. */
export function assessBackground(src: HTMLCanvasElement): BackgroundCheck {
  const k = Math.min(1, 400 / Math.max(src.width, src.height));
  const W = Math.max(8, Math.round(src.width * k)), H = Math.max(8, Math.round(src.height * k));
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(src, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data;
  const fx = Math.round(W * 0.08), fy = Math.round(H * 0.08);
  const frame: number[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < fx || x >= W - fx || y < fy || y >= H - fy) frame.push((y * W + x) * 4);
  let edges = 0, n = 0;
  for (const i of frame) {
    if (i + 4 >= d.length) continue;
    const v = cdist(d[i], d[i + 1], d[i + 2], d[i + 4], d[i + 5], d[i + 6]);
    if (v > 18) edges++;
    n++;
  }
  const med = (ch: number) => { const v = frame.map((i) => d[i + ch]).sort((a, b) => a - b); return v[v.length >> 1]; };
  const mr = med(0), mg = med(1), mb = med(2);
  let far = 0;
  for (const i of frame) if (cdist(d[i], d[i + 1], d[i + 2], mr, mg, mb) > 40) far++;
  const score = (edges / Math.max(1, n)) * 100 + (far / frame.length) * 60;
  return { busy: score > 14, score };
}

/** Final stored cut-out: transparent background, small even margin, longest side ≤ 1000 px. */
export function toCutout(item: HTMLCanvasElement, maxSide = 1000, margin = 0.03): HTMLCanvasElement {
  const k = Math.min(maxSide / Math.max(item.width, item.height), 2);
  const w = Math.round(item.width * k), h = Math.round(item.height * k);
  const m = Math.round(Math.max(w, h) * margin);
  const c = document.createElement("canvas");
  c.width = w + 2 * m;
  c.height = h + 2 * m;
  const g = c.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  g.drawImage(item, m, m, w, h);
  return c;
}

/**
 * Clockwise tilt (degrees) of an elongated garment from its nearest upright/flat axis,
 * from second-order moments of the mask. Returns 0 for near-round shapes (unreliable).
 */
export function estimateTilt(fg: Uint8Array, W: number, H: number): number {
  let n = 0, sx = 0, sy = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (fg[y * W + x]) { n++; sx += x; sy += y; }
  if (n < 50) return 0;
  const mx = sx / n, my = sy / n;
  let xx = 0, yy = 0, xy = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (fg[y * W + x]) {
    const dx = x - mx, dy = y - my;
    xx += dx * dx; yy += dy * dy; xy += dx * dy;
  }
  const tr = xx + yy, det = xx * yy - xy * xy;
  const l1 = tr / 2 + Math.sqrt(Math.max(0, (tr * tr) / 4 - det)), l2 = tr / 2 - Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  if (l2 <= 0 || Math.sqrt(l1 / l2) < 1.25) return 0;
  const theta = (0.5 * Math.atan2(2 * xy, xx - yy) * 180) / Math.PI; // major axis, clockwise from +x
  const fromVertical = ((theta - 90 + 270) % 180) - 90;
  const fromHorizontal = ((theta + 270) % 180) - 90;
  const t = Math.abs(fromVertical) < Math.abs(fromHorizontal) ? fromVertical : fromHorizontal;
  return Math.abs(t) <= 35 ? t : 0;
}
