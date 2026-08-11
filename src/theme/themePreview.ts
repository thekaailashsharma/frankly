import type { Theme } from "./Theme";

/**
 * A static CSS approximation of each theme's actual generated surface —
 * used anywhere a small chip needs to hint at "this is a living gradient
 * theme, not a flat colour" without paying for a real WebGL context per
 * chip (Setup's theme grid renders up to 8 of these at once). Built
 * straight from the same colour parameters `GeneratedSurface` animates,
 * so it's not a made-up approximation — it's the same palette, just still.
 */
export function themePreviewBackground(theme: Theme): string {
  const surface = theme.surface;
  switch (surface.kind) {
    case "paper":
    case "colour":
      return surface.colour;
    case "contour":
      return `radial-gradient(circle at 32% 28%, ${surface.glow}, ${surface.base} 65%)`;
    case "marble":
      return `linear-gradient(135deg, ${surface.c1} 0%, ${surface.c2} 52%, ${surface.c3} 100%)`;
    case "bokeh":
      return [
        `radial-gradient(circle at 28% 30%, ${surface.near}, transparent 55%)`,
        `radial-gradient(circle at 72% 68%, ${surface.far}, transparent 55%)`,
        surface.base,
      ].join(", ");
  }
}
