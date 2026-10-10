/**
 * Line illustrations for the About page — 1px ink strokes on white, same language as the app.
 * Each fits a 160 × 100 box.
 */

const TEE = "M13 3L17 1H23L27 3L36 10L32 15L28 12V36H12V12L8 15L4 10Z";
const TROUSERS = "M3 1H21L23 39H15L12 12L9 39H1Z";
const JACKET = "M13 3L17 1H23L27 3L35 9L38 34L33 35L29 14V38H11V14L7 35L2 34L5 9Z";
const SHOE = "M2 5Q2 2 5 2L13 3Q17 6 24 7Q29 8 29 11V13H2Z";

const ink = { fill: "none", stroke: "#111", strokeWidth: 1, strokeLinejoin: "round" as const, strokeLinecap: "round" as const, vectorEffect: "non-scaling-stroke" as const };
const solid = (fill: string) => ({ ...ink, fill });

function Shape({ d, x, y, s = 1, fill = "#fff", rotate = 0, cx = 20, cy = 19 }: { d: string; x: number; y: number; s?: number; fill?: string; rotate?: number; cx?: number; cy?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) rotate(${rotate} ${cx} ${cy})`}>
      <path d={d} {...solid(fill)} />
    </g>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 160 100" className="about-art" aria-hidden="true">
      <rect x="0.5" y="0.5" width="159" height="99" fill="#fff" stroke="#e8e8e8" />
      {children}
    </svg>
  );
}

/** 01 — a tee laid flat on a plain surface, framed by the camera viewfinder. */
export function ArtPhoto() {
  return (
    <Frame>
      <rect x="44" y="14" width="72" height="72" fill="#f3f3f3" />
      <Shape d={TEE} x={58} y={26} s={1.15} fill="#fff" rotate={-8} />
      {[
        "M40 22V10H52", "M108 10H120V22", "M120 78V90H108", "M52 90H40V78",
      ].map((d) => <path key={d} d={d} {...ink} strokeWidth={1.4} />)}
    </Frame>
  );
}

/** 02 — the same tee: tilted on a busy floor → upright on clean white. */
export function ArtClean() {
  return (
    <Frame>
      <defs>
        <pattern id="aw-floor" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 6L6 0" stroke="#c9c9c9" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="14" y="20" width="56" height="60" fill="url(#aw-floor)" stroke="#e1e1e1" />
      <Shape d={TEE} x={22} y={31} s={1} fill="#fff" rotate={-12} />
      <path d="M76 50H88M84 46L88 50L84 54" {...ink} />
      <rect x="94" y="20" width="56" height="60" fill="#fff" stroke="#111" />
      <Shape d={TEE} x={102} y={31} s={1} fill="#fff" />
      <text x="42" y="93" textAnchor="middle" className="art-cap">Your photo</text>
      <text x="122" y="93" textAnchor="middle" className="art-cap">Clean item</text>
    </Frame>
  );
}

/** 03 — a wardrobe grid: four clean items, the first selected by the category filter. */
export function ArtWardrobe() {
  const cells: [string, number, number, number][] = [
    [TEE, 0.72, 6, 6], [JACKET, 0.72, 6, 6], [TROUSERS, 0.72, 12, 4], [SHOE, 0.9, 5, 14],
  ];
  return (
    <Frame>
      <path d="M22 15H44" {...ink} strokeWidth={1.6} />
      <path d="M52 15H64M72 15H86M94 15H106" stroke="#c9c9c9" strokeWidth="1" />
      {cells.map(([d, s, ox, oy], i) => {
        const x = 22 + i * 30;
        return (
          <g key={i}>
            <rect x={x} y={26} width="26" height="34" fill="#fff" stroke="#e1e1e1" />
            <Shape d={d} x={x + ox * 0.3} y={26 + oy} s={s * 0.62} />
            <path d={`M${x} 66H${x + 18}`} stroke="#111" strokeWidth="1" />
            <path d={`M${x} 71H${x + 12}`} stroke="#c9c9c9" strokeWidth="1" />
          </g>
        );
      })}
      <path d="M22 84H138" stroke="#e8e8e8" />
    </Frame>
  );
}

/** 04 — picked pieces (checked) become an outfit laid out as it is worn. */
export function ArtOutfit() {
  return (
    <Frame>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={14} y={14 + i * 25} width="22" height="21" fill="#fff" stroke="#111" />
          <circle cx={33} cy={17 + i * 25} r="3.2" fill="#111" />
          <path d={`M31.5 ${17.1 + i * 25}L32.6 ${18.2 + i * 25}L34.6 ${16 + i * 25}`} stroke="#fff" strokeWidth="0.9" fill="none" />
        </g>
      ))}
      <Shape d={JACKET} x={15} y={17} s={0.38} />
      <Shape d={TROUSERS} x={20} y={41} s={0.38} />
      <Shape d={SHOE} x={16} y={70} s={0.5} />
      <path d="M48 50H64M60 46L64 50L60 54" {...ink} />
      <rect x="76" y="8" width="70" height="84" fill="#fff" stroke="#111" />
      <Shape d={JACKET} x={98} y={13} s={0.66} />
      <Shape d={TROUSERS} x={103} y={41} s={0.82} />
      <Shape d={SHOE} x={96} y={76} s={1} />
    </Frame>
  );
}

/** 05 — a photo of you in a look, with the wardrobe pieces AI found in it. */
export function ArtLook() {
  return (
    <Frame>
      <rect x="18" y="10" width="56" height="80" fill="#f3f3f3" stroke="#111" />
      <circle cx="46" cy="21" r="5" {...solid("#fff")} />
      <Shape d={JACKET} x={34} y={26} s={0.6} />
      <Shape d={TROUSERS} x={39} y={48} s={0.82} />
      <Shape d={SHOE} x={33} y={80} s={0.5} />
      <Shape d={SHOE} x={45} y={80} s={0.5} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <path d={`M78 ${30 + i * 22}H92`} stroke="#c9c9c9" strokeDasharray="2 2" />
          <rect x={96} y={20 + i * 22} width="20" height="20" fill="#fff" stroke="#e1e1e1" />
          <path d={`M122 ${27 + i * 22}H146`} stroke="#111" />
          <path d={`M122 ${33 + i * 22}H138`} stroke="#c9c9c9" />
        </g>
      ))}
      <Shape d={JACKET} x={98} y={22} s={0.4} />
      <Shape d={TROUSERS} x={102} y={43} s={0.4} />
      <Shape d={SHOE} x={98} y={69} s={0.55} />
    </Frame>
  );
}
