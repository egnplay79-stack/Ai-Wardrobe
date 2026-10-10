import type { ProcessingStage } from "../types";
import { AIProcessingView } from "../components/AIProcessingView";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";

const STEPS = [
  { key: "detect", label: "Detecting clothing" },
  { key: "isolate", label: "Removing background" },
  { key: "straighten", label: "Straightening" },
  { key: "finish", label: "Placing on white" },
];

interface Props {
  stage: ProcessingStage;
  thumb?: string;
  error: string | null;
  /** Busy background detected: ask before processing. */
  warning: boolean;
  onContinue: () => void;
  onRetake: () => void;
  onCancel: () => void;
}

export function ProcessingScreen({ stage, thumb, error, warning, onContinue, onRetake, onCancel }: Props) {
  if (warning) {
    return (
      <main className="screen no-nav">
        <div className="back-row"><IconButton icon="close" label="Cancel" onClick={onCancel} /></div>
        <div className="warn">
          {thumb && <div className="preview"><img src={thumb} alt="" /></div>}
          <h1>The background looks busy.</h1>
          <p>Patterns, rugs or other objects around the item make the cut-out rough. For a clean result, retake it on a plain, one-colour surface that contrasts with the item.</p>
          <div className="acts">
            <Button variant="solid" block icon="camera" onClick={onRetake}>Retake photo</Button>
            <Button variant="text" onClick={onContinue}>Continue anyway</Button>
          </div>
        </div>
      </main>
    );
  }
  return (
    <main className="screen no-nav">
      <div className="back-row"><IconButton icon="close" label="Cancel" onClick={onCancel} /></div>
      {error ? (
        <div className="empty">
          <p>{error}</p>
          <div><Button onClick={onCancel}>Choose another photo</Button></div>
        </div>
      ) : (
        <AIProcessingView title="Processing" steps={STEPS} active={stage} thumb={thumb} />
      )}
    </main>
  );
}
