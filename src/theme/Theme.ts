/** Ported 1:1 from Theme.swift. Straight sRGB hex decode, no gamma. */
export function hex(n: number): string {
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export type Surface =
  | { kind: "contour"; base: string; line: string; glow: string; bands: number }
  | { kind: "marble"; c1: string; c2: string; c3: string }
  | { kind: "bokeh"; base: string; near: string; far: string; density: number }
  | { kind: "colour"; colour: string }
  | { kind: "paper"; colour: string };

export type Mood = "quiet" | "expressive";

export function moodOf(surface: Surface): Mood {
  return surface.kind === "paper" || surface.kind === "colour" ? "quiet" : "expressive";
}

export interface Theme {
  id: string;
  name: string;
  surface: Surface;
  isDark: boolean;
  cardTint: string;
  inks: string[];
  seed: number;
  poster: string;
  cover: string | null;
}

export const THEMES: Theme[] = [
  {
    id: "leaf",
    name: "Leaf",
    surface: { kind: "paper", colour: hex(0xf2eee4) },
    isDark: false,
    cardTint: hex(0xfcfaf5),
    inks: [hex(0x1c1c21), hex(0x5e2224), hex(0x1e3a56)],
    seed: 1.0,
    poster: hex(0xd8543f),
    cover: "hill",
  },
  {
    id: "night",
    name: "Night",
    surface: { kind: "paper", colour: hex(0x0f0f13) },
    isDark: true,
    cardTint: hex(0x17171d),
    inks: [hex(0xf2eee4), hex(0xd8be92), hex(0xa8b8c4)],
    seed: 2.0,
    poster: hex(0x1b1b22),
    cover: "ink",
  },
  {
    id: "contour",
    name: "Contour",
    surface: { kind: "contour", base: hex(0x08080c), line: hex(0xede8dc), glow: hex(0x2a2a38), bands: 24 },
    isDark: true,
    cardTint: hex(0x0e0e14),
    inks: [hex(0xf2eee4), hex(0xbfbab0), hex(0x8c877d)],
    seed: 3.1,
    poster: hex(0xe8e3d6),
    cover: "grind",
  },
  {
    id: "marble",
    name: "Marble",
    surface: { kind: "marble", c1: hex(0x2618c4), c2: hex(0x7a1fd4), c3: hex(0xf0247e) },
    isDark: true,
    cardTint: hex(0x140c22),
    inks: [hex(0xf7f2ea), hex(0xe9bbda), hex(0xbdb2f0)],
    seed: 11.4,
    poster: hex(0x4a22c8),
    cover: "ember",
  },
  {
    id: "ember",
    name: "Ember",
    surface: { kind: "marble", c1: hex(0x6e1a02), c2: hex(0xe0620c), c3: hex(0xffc42e) },
    isDark: true,
    cardTint: hex(0x1c0e06),
    inks: [hex(0xfcf2e0), hex(0xf0c48a), hex(0xd9a08a)],
    seed: 5.7,
    poster: hex(0xe0620c),
    cover: "station",
  },
  {
    id: "neon",
    name: "Neon",
    surface: { kind: "bokeh", base: hex(0x01030e), near: hex(0x2e6bff), far: hex(0x14e0d0), density: 7 },
    isDark: true,
    cardTint: hex(0x060a18),
    inks: [hex(0xedf3ff), hex(0x9bd8f0), hex(0xaeb8e0)],
    seed: 8.2,
    poster: hex(0x0e2a6b),
    cover: "ember",
  },
  {
    id: "holo",
    name: "Holo",
    surface: { kind: "marble", c1: hex(0x6e4be8), c2: hex(0xe85bc8), c3: hex(0x4be8e0) },
    isDark: false,
    cardTint: hex(0xfaf7f0),
    inks: [hex(0x181624), hex(0x4a1c48), hex(0x143c46)],
    seed: 17.9,
    poster: hex(0xe85bc8),
    cover: "ink",
  },
  {
    id: "paper",
    name: "Paper",
    surface: { kind: "colour", colour: hex(0xe9e3d6) },
    isDark: false,
    cardTint: hex(0xfcfaf4),
    inks: [hex(0x1a1a1f), hex(0x5e2224), hex(0x1f3a5f)],
    seed: 1.0,
    poster: hex(0xc96a4a),
    cover: "paper",
  },
];

export const DEFAULT_THEME = THEMES[0];

export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? DEFAULT_THEME;
}
