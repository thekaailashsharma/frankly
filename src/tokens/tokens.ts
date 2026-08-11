/**
 * Single source of truth for the design system. Every screen, and the canvas
 * renderer, reads from here — nothing hardcodes a colour or a spacing value.
 *
 * The hierarchy is alpha-based, not a palette of greys: one ink colour at
 * four opacities. This is Apple's own mechanism (label/secondaryLabel/...)
 * and it's the reason unlike screens still cohere — an alpha composites
 * correctly over any surface underneath it, a fixed grey does not.
 */

export type ColorScheme = "light" | "dark";

interface Neutrals {
  bgBase: string;
  bgRaised: string;
  bgOverlay: string;
  ink: string; // the one hue; hierarchy comes from alpha, not hue changes
  hairline: string; // ink at 0.29 baked in as rgba
  fillSubtle: string; // ink at 0.1 baked in as rgba
}

const LIGHT: Neutrals = {
  bgBase: "#FAF8F3", // warm off-white — never pure #fff
  bgRaised: "#FFFFFF",
  bgOverlay: "#FFFFFF",
  ink: "#1A1A1A", // warm off-black — never pure #000
  hairline: "rgba(26,26,26,0.12)",
  fillSubtle: "rgba(26,26,26,0.06)",
};

const DARK: Neutrals = {
  bgBase: "#141414",
  bgRaised: "#1C1C1E",
  bgOverlay: "#242426",
  ink: "#F5F3EE",
  hairline: "rgba(245,243,238,0.14)",
  fillSubtle: "rgba(245,243,238,0.08)",
};

export function neutrals(scheme: ColorScheme): Neutrals {
  return scheme === "dark" ? DARK : LIGHT;
}

/** Paper never flips to dark mode — real paper doesn't, and ink colours
 * are chosen once against this exact tone regardless of system theme.
 * Recolouring the page instead of the ink is how you get invisible ink. */
export const PAPER = "#FDFBF6";
export const PAPER_INK = "#1A1A1A";

/** Ink at four alphas — the entire content-hierarchy system. */
export function contentAlpha(scheme: ColorScheme) {
  const { ink } = neutrals(scheme);
  return {
    primary: withAlpha(ink, 1),
    secondary: withAlpha(ink, 0.6),
    tertiary: withAlpha(ink, 0.3),
    quaternary: withAlpha(ink, 0.18),
  };
}

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 8pt grid, 4pt sub-grid. Five steps covers everything a 5-screen app needs. */
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/** Four radii. Concentric where nested: inner = outer - padding. */
export const RADIUS = {
  sm: 4, // inline chips
  md: 12, // controls, inputs
  lg: 20, // cards, sheets
  capsule: 999,
} as const;

/** Five type roles bound to Dynamic-Type-equivalent clamp() sizes. */
export const TYPE = {
  display: "clamp(1.75rem, 1.4rem + 1.5vw, 2.125rem)", // 28-34pt
  title: "clamp(1.25rem, 1.1rem + 0.6vw, 1.375rem)", // 20-22pt
  headline: "1.0625rem", // 17pt semibold
  body: "1.0625rem", // 17pt
  caption: "0.8125rem", // 13pt
} as const;

/** Two elevations, expressed as background tone lifts — never shadows. */
export const ELEVATION = {
  base: 0,
  raised: 1,
  overlay: 2,
} as const;

/** Three motion presets. Never exceed bounce 0.4 — Apple's own ceiling. */
export const MOTION = {
  fast: "180ms cubic-bezier(0.32, 0.72, 0, 1)",
  standard: "260ms cubic-bezier(0.32, 0.72, 0, 1)",
  spring: "420ms cubic-bezier(0.34, 1.28, 0.64, 1)", // ~bounce 0.15, never more
} as const;

export const TOUCH_TARGET = 44;

/** Applies neutrals + derived content alphas as CSS custom properties on
 * the root element, so plain CSS (`var(--bg-base)`) and canvas code (which
 * imports the same functions above) never drift from one another. */
export function applyTheme(root: HTMLElement, scheme: ColorScheme) {
  const n = neutrals(scheme);
  const c = contentAlpha(scheme);
  const vars: Record<string, string> = {
    "--bg-base": n.bgBase,
    "--bg-raised": n.bgRaised,
    "--bg-overlay": n.bgOverlay,
    "--paper": PAPER,
    "--paper-ink": PAPER_INK,
    "--hairline": n.hairline,
    "--fill-subtle": n.fillSubtle,
    "--content-primary": c.primary,
    "--content-secondary": c.secondary,
    "--content-tertiary": c.tertiary,
    "--content-quaternary": c.quaternary,
    "--space-xs": `${SPACE.xs}px`,
    "--space-sm": `${SPACE.sm}px`,
    "--space-md": `${SPACE.md}px`,
    "--space-lg": `${SPACE.lg}px`,
    "--space-xl": `${SPACE.xl}px`,
    "--radius-sm": `${RADIUS.sm}px`,
    "--radius-md": `${RADIUS.md}px`,
    "--radius-lg": `${RADIUS.lg}px`,
    "--radius-capsule": `${RADIUS.capsule}px`,
    "--type-display": TYPE.display,
    "--type-title": TYPE.title,
    "--type-headline": TYPE.headline,
    "--type-body": TYPE.body,
    "--type-caption": TYPE.caption,
    "--motion-fast": MOTION.fast,
    "--motion-standard": MOTION.standard,
    "--motion-spring": MOTION.spring,
  };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
}
