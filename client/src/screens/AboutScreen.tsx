import { ArtClean, ArtLook, ArtOutfit, ArtPhoto, ArtWardrobe } from "../components/AboutArt";
import { PhotoRules } from "../components/PhotoTips";

/** Who makes the app. Change here; it is shown at the bottom of About. */
export const MAKER = "Kirya Production";
export const VERSION = "0.9";

const STEPS = [
  {
    title: "Photograph an item",
    text: "Lay one piece flat on a plain surface and shoot it from above, or pick a photo from your gallery.",
    Art: ArtPhoto,
  },
  {
    title: "AI cleans it up",
    text: "AI finds the item, removes the background and anything else in the shot, straightens it and places it on white. It also fills in the name, category, colour, style and season. You can edit everything.",
    Art: ArtClean,
  },
  {
    title: "Build your wardrobe",
    text: "Every piece lands in one clean grid. Filter by outerwear, tops, bottoms, shoes or accessories.",
    Art: ArtWardrobe,
  },
  {
    title: "Get outfits",
    text: "Pick the pieces and choose how to build: every good combination, the single best match, or exactly what you picked. Outfits are laid out as worn, top to bottom, at true relative size. Save the ones you like.",
    Art: ArtOutfit,
  },
  {
    title: "Keep your looks",
    text: "Add photos of yourself in outfits. AI names each look, describes it and finds your wardrobe pieces in it. Turn any look into a saved outfit.",
    Art: ArtLook,
  },
];

const AI_LABEL: Record<string, string> = {
  claude: "Claude (inside the Claude app)",
  http: "AI server",
  mock: "On-device (no AI connected)",
};
const STORAGE_LABEL: Record<string, string> = {
  artifact: "Your Claude account, private to you",
  local: "This device only",
  memory: "This session only (storage is blocked in this browser)",
};

interface Props {
  aiProvider: string;
  storage?: string;
}

/** About: what the app does, step by step, with line illustrations. */
export function AboutScreen({ aiProvider, storage }: Props) {
  return (
    <main className="screen about">
      <header className="head"><h1 className="title">About</h1></header>

      <section className="about-logo" aria-label="AI Wardrobe">
        <span>AI</span>
        <span>WARDROBE</span>
      </section>
      <p className="about-lead">
        Photograph your clothes. Get a clean digital wardrobe. Let AI tell you what to wear.
      </p>

      <p className="eyebrow about-h">How it works</p>
      <ol className="about-steps">
        {STEPS.map(({ title, text, Art }, i) => (
          <li key={title} className="about-step">
            <Art />
            <div className="about-step-text">
              <span className="n">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h2>{title}</h2>
                <p>{text}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <p className="eyebrow about-h">For clean photos</p>
      <PhotoRules />

      <p className="eyebrow about-h">Right now</p>
      <dl className="attrs" style={{ margin: 0 }}>
        <div className="attr" style={{ gridColumn: "1 / -1" }}><dt>AI</dt><dd>{AI_LABEL[aiProvider] ?? aiProvider}</dd></div>
        <div className="attr" style={{ gridColumn: "1 / -1" }}><dt>Your wardrobe is stored</dt><dd>{STORAGE_LABEL[storage ?? "local"]}</dd></div>
      </dl>

      <p className="eyebrow about-h">Install on iPhone</p>
      <ol className="rules">
        {[
          ["Open the app link in Safari", "Not inside another app."],
          ["Tap Share", "The square with an arrow, at the bottom of the screen."],
          ["Add to Home Screen", "AI Wardrobe opens full screen, with its own icon."],
        ].map(([t, s], i) => (
          <li key={t}>
            <span className="n">{String(i + 1).padStart(2, "0")}</span>
            <span>{t}<small>{s}</small></span>
          </li>
        ))}
      </ol>

      <footer className="about-foot">
        <span>AI Wardrobe {VERSION}</span>
        <span>Made by {MAKER}</span>
      </footer>
    </main>
  );
}
