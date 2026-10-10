import { useEffect, useState } from "react";
import { AIService, type AIStatus } from "../services/AIService";

export function useAIStatus(): AIStatus {
  const [s, setS] = useState<AIStatus>(AIService.getStatus());
  useEffect(() => {
    AIService.init();
    const unsub = AIService.subscribe(setS);
    return () => { unsub(); };
  }, []);
  return s;
}
