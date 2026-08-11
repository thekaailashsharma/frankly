import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { applyTheme, contentAlpha, neutrals, type ColorScheme } from "./tokens";

interface ThemeContextValue {
  scheme: ColorScheme;
  /** Event-specific accent, drawn from the cover. Two colours per screen —
   * the accent and the ink alphas — is the whole colour budget. */
  accent: string;
  setAccent: (hex: string) => void;
  reducedMotion: boolean;
  reducedTransparency: boolean;
  /** Safari has no `prefers-reduced-transparency` signal to read, so this
   * is the manual escape hatch host setup exposes instead. */
  setReducedTransparencyOverride: (value: boolean) => void;
}

const OVERRIDE_KEY = "frankly-reduced-transparency";

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setScheme] = useState<ColorScheme>(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  );
  const [accent, setAccent] = useState("#C4622D"); // warm terracotta default
  const [reducedMotion, setReducedMotion] = useState(false);
  const [systemReducedTransparency, setSystemReducedTransparency] = useState(false);
  const [manualOverride, setManualOverride] = useState(() => localStorage.getItem(OVERRIDE_KEY) === "1");
  const reducedTransparency = systemReducedTransparency || manualOverride;

  const setReducedTransparencyOverride = (value: boolean) => {
    localStorage.setItem(OVERRIDE_KEY, value ? "1" : "0");
    setManualOverride(value);
  };

  useEffect(() => {
    const schemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    // prefers-reduced-transparency is unsupported in Safari — this is a
    // best-effort read for Chromium; Safari users get the in-app toggle
    // in host setup instead, since there is no OS signal to read there.
    const transparencyQuery = window.matchMedia("(prefers-reduced-transparency: reduce)");

    const onScheme = () => setScheme(schemeQuery.matches ? "dark" : "light");
    const onMotion = () => setReducedMotion(motionQuery.matches);
    const onTransparency = () => setSystemReducedTransparency(transparencyQuery.matches);

    onMotion();
    onTransparency();
    schemeQuery.addEventListener("change", onScheme);
    motionQuery.addEventListener("change", onMotion);
    transparencyQuery.addEventListener("change", onTransparency);
    return () => {
      schemeQuery.removeEventListener("change", onScheme);
      motionQuery.removeEventListener("change", onMotion);
      transparencyQuery.removeEventListener("change", onTransparency);
    };
  }, []);

  useEffect(() => {
    applyTheme(document.documentElement, scheme);
    document.documentElement.style.setProperty("--accent", accent);
    document.documentElement.dataset.scheme = scheme;
  }, [scheme, accent]);

  const value = useMemo(
    () => ({ scheme, accent, setAccent, reducedMotion, reducedTransparency, setReducedTransparencyOverride }),
    [scheme, accent, reducedMotion, reducedTransparency]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Re-exported so canvas code can read exact hex without a DOM round-trip. */
export { neutrals, contentAlpha };
