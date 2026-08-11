import type { Theme } from "./Theme";
import { hex } from "./Theme";
import { contrastRatio, relativeLuminance } from "./color";

export const MINIMUM_CONTRAST = 3.0;

const MASTER: string[] = [
  hex(0x141418),
  hex(0xf7f3ea),
  hex(0x5e2233),
  hex(0xe8c87a),
  hex(0x1f3a5f),
  hex(0xbfd8e8),
  hex(0x24453a),
  hex(0xefb3c0),
];

/** Ported 1:1 from InkPalette.swift — theme's hand-picked inks are used as
 * designed, and only topped up from a fallback palette when they fail
 * contrast against the actual composited surface underneath them. */
export function inksFor(theme: Theme, surface: string): string[] {
  const passing = theme.inks.filter((ink) => contrastRatio(ink, surface) >= MINIMUM_CONTRAST);
  if (passing.length >= 3) return passing.slice(0, 4);

  const extras = MASTER.filter((m) => !passing.some((p) => p.toLowerCase() === m.toLowerCase()))
    .filter((m) => contrastRatio(m, surface) >= MINIMUM_CONTRAST)
    .sort((a, b) => contrastRatio(b, surface) - contrastRatio(a, surface));

  const combined = [...passing, ...extras];
  if (combined.length === 0) {
    return [relativeLuminance(surface) > 0.45 ? hex(0x141418) : hex(0xf7f3ea)];
  }
  return combined.slice(0, 4);
}
