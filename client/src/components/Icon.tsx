const PATHS = {
  camera: "M3.5 8.5h3.2l1.8-2.5h7l1.8 2.5h3.2v10.5h-17z M12 16.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z",
  gallery: "M4 5h16v14H4z M4 15.5l4.5-4.5 4 4 2.5-2.5L20 17.5 M15.5 9.5h.01",
  plus: "M12 5v14 M5 12h14",
  back: "M15 5l-7 7 7 7",
  forward: "M9 5l7 7-7 7",
  bookmark: "M7 4h10v16l-5-4-5 4z",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  trash: "M5 7h14 M9.5 7V5h5v2 M7 7l.8 12h8.4L17 7",
  check: "M5 12.5l4.5 4.5L19 7.5",
  retry: "M19 12a7 7 0 1 1-2.05-4.95 M19 4.5V8h-3.5",
  edit: "M5 19h3.5L18.5 9 15 5.5 5 15.5z",
  close: "M6 6l12 12 M18 6L6 18",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 13.5l1.1.9-1.6 2.8-1.4-.5a7 7 0 0 1-1.7 1l-.3 1.5h-3.2l-.3-1.5a7 7 0 0 1-1.7-1l-1.4.5-1.6-2.8 1.1-.9a7 7 0 0 1 0-2l-1.1-.9 1.6-2.8 1.4.5a7 7 0 0 1 1.7-1l.3-1.5h3.2l.3 1.5a7 7 0 0 1 1.7 1l1.4-.5 1.6 2.8-1.1.9a7 7 0 0 1 0 2z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size, filled }: { name: IconName; size?: "sm"; filled?: boolean }) {
  return (
    <svg className={size === "sm" ? "icon sm" : "icon"} viewBox="0 0 24 24" aria-hidden="true" style={filled ? { fill: "currentColor" } : undefined}>
      {PATHS[name].split(" M").map((d, i) => (
        <path key={i} d={i ? "M" + d : d} />
      ))}
    </svg>
  );
}
