import { CATEGORY_LABEL, type Category, type ItemAttributes } from "../types";
import { defaultType } from "../services/ai/normalize";

const SEASONS = ["All seasons", "Spring / Summer", "Autumn / Winter", "Summer", "Winter"];

/** Editable attribute grid. Values are prefilled by AI; every field can be changed. */
export function ItemFields({ value, onChange }: { value: ItemAttributes; onChange: (v: ItemAttributes) => void }) {
  const set = <K extends keyof ItemAttributes>(k: K, v: ItemAttributes[K]) => onChange({ ...value, [k]: v });
  const text = (k: "type" | "color" | "material" | "style", label: string) => (
    <div className="attr">
      <label htmlFor={"f-" + k}>{label}</label>
      <input id={"f-" + k} value={value[k] ?? ""} placeholder="—" onChange={(e) => set(k, e.target.value)} />
    </div>
  );
  return (
    <>
      <label htmlFor="f-name" className="eyebrow" style={{ display: "block", marginBottom: 4 }}>Name</label>
      <input id="f-name" className="name-input" value={value.name} onChange={(e) => set("name", e.target.value)} />
      <div className="attrs">
        <div className="attr">
          <label htmlFor="f-category">Category</label>
          <select id="f-category" value={value.category} onChange={(e) => onChange(withCategory(value, e.target.value as Category))}>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        {text("type", "Type")}
        {text("color", "Color")}
        {text("material", "Material")}
        {text("style", "Style")}
        <div className="attr">
          <label htmlFor="f-season">Season</label>
          <select id="f-season" value={value.season} onChange={(e) => set("season", e.target.value)}>
            {[...new Set([value.season, ...SEASONS])].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}

/** Changing the category also updates the type and name when they were still the generic defaults. */
function withCategory(v: ItemAttributes, category: Category): ItemAttributes {
  const oldType = defaultType(v.category);
  const genericType = !v.type || v.type === oldType;
  const type = genericType ? defaultType(category) : v.type;
  const name = v.name === `${v.color} ${v.type}` ? `${v.color} ${type}` : v.name;
  return { ...v, category, type, name };
}
