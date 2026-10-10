export type Tab = "wardrobe" | "outfits" | "looks" | "about";

const TABS: [Tab, string, string][] = [
  ["wardrobe", "01", "WARDROBE"],
  ["outfits", "02", "OUTFITS"],
  ["looks", "03", "LOOKS"],
  ["about", "04", "ABOUT"],
];

export function BottomNavigation({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="nav" aria-label="Main">
      <div className="nav-inner">
        {TABS.map(([id, num, label]) => (
          <button key={id} className="nav-tab" aria-current={tab === id ? "page" : undefined} onClick={() => onChange(id)}>
            <span className="num">{num}</span>
            <span className="dash">—</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
