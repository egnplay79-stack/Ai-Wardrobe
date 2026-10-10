import { useEffect, useState } from "react";

/** Walks through steps while `active`, holding on the last one until the work ends. */
export function useCyclingStep(keys: string[], active: boolean, ms = 1400): string {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active) { setI(0); return; }
    const t = setInterval(() => setI((x) => Math.min(x + 1, keys.length - 1)), ms);
    return () => clearInterval(t);
  }, [active, keys.length, ms]);
  return keys[i];
}
