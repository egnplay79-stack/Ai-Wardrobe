import { Icon } from "./Icon";
import { LoadingLine } from "./LoadingState";

export interface Step {
  key: string;
  label: string;
}

/** Thin, quiet progress: a title, the steps with the current one in ink, a moving hairline. */
export function AIProcessingView({ title, steps, active, thumb }: { title: string; steps: Step[]; active: string; thumb?: string }) {
  const idx = Math.max(0, steps.findIndex((s) => s.key === active));
  return (
    <div className="processing" aria-live="polite">
      {thumb && (
        <div className="thumb">
          <img src={thumb} alt="" />
        </div>
      )}
      <div>
        <h1 className="title" style={{ marginBottom: 18 }}>{title}</h1>
        <ul className="steps">
          {steps.map((s, i) => (
            <li key={s.key} className={i < idx ? "done" : i === idx ? "on" : ""}>
              {i < idx ? <Icon name="check" /> : <span style={{ width: 14 }} />}
              {s.label}
            </li>
          ))}
        </ul>
      </div>
      <LoadingLine />
    </div>
  );
}
