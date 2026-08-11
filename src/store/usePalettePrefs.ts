import { useCallback, useState } from "react";
import type { PaletteEdge } from "../components/ToolPill";

const EDGE_KEY = "palette.edge";
const AUTOMIN_KEY = "palette.automin";

/** Device-level, not per-event — ported from EventStore's
 * `paletteEdge`/`autoMinimizePalette`, which the native app persists to
 * UserDefaults rather than per-event storage, because where your hand
 * rests doesn't change per event, it changes per person. */
export function usePalettePrefs() {
  const [edge, setEdgeState] = useState<PaletteEdge>(
    () => (localStorage.getItem(EDGE_KEY) as PaletteEdge) || "bottom"
  );
  const [autoMinimize, setAutoMinimizeState] = useState<boolean>(() => {
    const stored = localStorage.getItem(AUTOMIN_KEY);
    return stored === null ? true : stored === "1";
  });

  const setEdge = useCallback((value: PaletteEdge) => {
    localStorage.setItem(EDGE_KEY, value);
    setEdgeState(value);
  }, []);

  const setAutoMinimize = useCallback((value: boolean) => {
    localStorage.setItem(AUTOMIN_KEY, value ? "1" : "0");
    setAutoMinimizeState(value);
  }, []);

  return { edge, setEdge, autoMinimize, setAutoMinimize };
}
