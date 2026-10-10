/** The four rules that decide whether a background can be removed cleanly. */
export const PHOTO_RULES: [string, string][] = [
  ["Plain, one-colour background", "A sheet, floor or table with no pattern, text or texture."],
  ["Contrast with the item", "Light item on a dark surface, dark item on a light one."],
  ["One item, fully in frame", "Nothing else in the shot. Leave a little space around it."],
  ["From above, in daylight", "Even light, no flash, no hard shadows."],
];

/** Good vs bad background, drawn in thin lines. */
export function BackgroundExample() {
  const tee = "M30 22l10-6h10l10 6 9 10-6 6-5-4v30H32V34l-5 4-6-6z";
  return (
    <div className="bg-example" aria-hidden="true">
      <figure>
        <svg viewBox="0 0 90 90">
          <rect x="1" y="1" width="88" height="88" fill="#f3f3f3" stroke="#111" strokeWidth="1" />
          <path d={tee} fill="#111" />
        </svg>
        <figcaption>Yes</figcaption>
      </figure>
      <figure>
        <svg viewBox="0 0 90 90">
          <defs>
            <pattern id="rug" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M0 10L10 0M-2 2L2 -2M8 12L12 8" stroke="#bbb" strokeWidth="2" />
            </pattern>
          </defs>
          <rect x="1" y="1" width="88" height="88" fill="url(#rug)" stroke="#111" strokeWidth="1" />
          <path d={tee} fill="#999" />
          <circle cx="76" cy="74" r="7" fill="#777" />
        </svg>
        <figcaption>No</figcaption>
      </figure>
    </div>
  );
}

export function PhotoRules() {
  return (
    <ol className="rules">
      {PHOTO_RULES.map(([t, s], i) => (
        <li key={t}>
          <span className="n">{String(i + 1).padStart(2, "0")}</span>
          <span>
            {t}
            <small>{s}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}
