import { hexToHsl, hslToHex, relativeLuminance } from "./color";
import { hex } from "./Theme";

/** Ported 1:1 from GlassCard's `surface` computed property — the colour
 * ink-contrast decisions are made against, not the raw cardTint. */
export function surfaceColour(cardTint: string, isDark: boolean): string {
  const tint = hexToHsl(cardTint);
  const material = isDark ? 0.1 : 0.97;
  return hslToHex({ h: tint.h, s: tint.s * 0.9, l: tint.l * 0.88 + material * 0.12 });
}

/** Ported 1:1 from StationView's `primary(surface:)`. */
export function primaryOn(surface: string): string {
  return relativeLuminance(surface) > 0.45 ? hex(0x1a1a1f) : hex(0xf4f1ea);
}
