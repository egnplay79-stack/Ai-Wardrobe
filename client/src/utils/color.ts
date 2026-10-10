const PALETTE: [string, number, number, number][] = [
  ["White", 245, 245, 242], ["Cream", 238, 228, 205], ["Beige", 215, 195, 160], ["Grey", 140, 140, 140],
  ["Light grey", 195, 195, 195], ["Charcoal", 60, 62, 66], ["Black", 22, 22, 24], ["Navy", 30, 40, 80],
  ["Blue", 50, 90, 170], ["Light blue", 150, 185, 220], ["Denim", 75, 100, 140], ["Green", 60, 120, 70],
  ["Olive", 110, 110, 60], ["Khaki", 170, 155, 110], ["Brown", 110, 75, 45], ["Camel", 185, 140, 90],
  ["Red", 180, 40, 40], ["Burgundy", 110, 30, 45], ["Pink", 230, 160, 180], ["Orange", 225, 120, 50],
  ["Yellow", 230, 200, 70], ["Purple", 110, 70, 140],
];

export function nearestColorName(r: number, g: number, b: number): string {
  let best = PALETTE[0][0], bestD = Infinity;
  for (const [name, pr, pg, pb] of PALETTE) {
    const d = 2 * (r - pr) ** 2 + 4 * (g - pg) ** 2 + 3 * (b - pb) ** 2;
    if (d < bestD) { bestD = d; best = name; }
  }
  return best;
}

export const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

const NEUTRALS = new Set(["White", "Cream", "Beige", "Grey", "Light grey", "Charcoal", "Black", "Navy", "Denim", "Khaki", "Camel"]);
export const isNeutral = (color: string) =>
  [...NEUTRALS].some((n) => color.toLowerCase().includes(n.toLowerCase()));

export function isValidHex(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
}
