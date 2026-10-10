import { useCallback, useEffect, useRef, useState } from "react";
import type { Tab } from "../components/BottomNavigation";

export type Route =
  | { name: "add" }
  | { name: "processing" }
  | { name: "result" }
  | { name: "item"; id: string }
  | { name: "edit"; id: string }
  | { name: "outfit"; id: string }
  | { name: "itemOutfits"; id: string }
  | { name: "builder"; editId?: string }
  | { name: "lookNew" }
  | { name: "look"; id: string }
  | { name: "lookEdit"; id: string };

/**
 * Tab root + a stack of pushed screens. Mirrors pushes into history so the
 * system back gesture (Android, iOS swipe in browsers) pops a screen.
 */
export function useNavigator() {
  const [tab, setTabState] = useState<Tab>("wardrobe");
  const [stack, setStack] = useState<Route[]>([]);
  const depth = useRef(0);
  /** History entries we actually pushed; never call history.back() beyond these. */
  const pushed = useRef(0);

  useEffect(() => {
    const onPop = () => {
      if (!pushed.current) return;
      pushed.current--;
      setStack((s) => s.slice(0, -1));
      depth.current = Math.max(0, depth.current - 1);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const push = useCallback((r: Route) => {
    setStack((s) => [...s, r]);
    depth.current++;
    try { history.pushState({ d: depth.current }, ""); pushed.current++; } catch { /* sandboxed */ }
    window.scrollTo(0, 0);
  }, []);

  /** Replace the top screen (e.g. processing → result) without growing history. */
  const replace = useCallback((r: Route) => {
    setStack((s) => (s.length ? [...s.slice(0, -1), r] : [r]));
    window.scrollTo(0, 0);
  }, []);

  const back = useCallback(() => {
    if (!depth.current) return;
    if (pushed.current >= depth.current) {
      history.back();
    } else {
      setStack((s) => s.slice(0, -1));
      depth.current--;
    }
  }, []);

  /** Clear pushed screens and show a tab. */
  const reset = useCallback((t?: Tab) => {
    const n = pushed.current;
    depth.current = 0;
    pushed.current = 0;
    setStack([]);
    if (t) setTabState(t);
    if (n) { try { history.go(-n); } catch { /* sandboxed */ } }
    window.scrollTo(0, 0);
  }, []);

  const setTab = useCallback((t: Tab) => reset(t), [reset]);

  return { tab, setTab, route: stack[stack.length - 1] as Route | undefined, push, replace, back, reset };
}
