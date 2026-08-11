export interface StrokePoint {
  x: number;
  y: number;
  /** Milliseconds since the stroke began. Real elapsed time, not an index —
   * downstream recognition and the outline algorithm both want it real. */
  t: number;
  pressure: number;
}

export type NibKind = "fine" | "marker" | "wide" | "eraser";

export interface NibConfig {
  size: number;
  alpha: number;
  rimAlpha: number;
  thinning: number;
  /** Highlighter: renders underneath ink already on the page, so marking
   * over a word never covers it. */
  drawsUnderneath: boolean;
  /** Punches through ink already baked on its layer instead of painting
   * on top of it — see `paintStroke`'s destination-out branch. */
  erases?: boolean;
}

export const NIBS: Record<NibKind, NibConfig> = {
  fine: { size: 5, alpha: 0.92, rimAlpha: 0.3, thinning: 0.62, drawsUnderneath: false },
  marker: { size: 13, alpha: 0.8, rimAlpha: 0.1, thinning: 0.34, drawsUnderneath: false },
  wide: { size: 34, alpha: 0.34, rimAlpha: 0, thinning: 0.06, drawsUnderneath: true },
  eraser: { size: 28, alpha: 1, rimAlpha: 0, thinning: 0, drawsUnderneath: false, erases: true },
};

export interface Stroke {
  id: string;
  points: StrokePoint[];
  /** An index into whatever ink palette is rendering this note, not a
   * baked colour — the same stroke recolors correctly when the same note
   * is later shown against a different theme's palette (ghost layer,
   * artifact), exactly as the native `Stroke.inkIndex` does. */
  inkIndex: number;
  nib: NibKind;
}

/** Resolves a palette index the same way every render call site should —
 * clamped, so a palette shorter than the index used at write time never
 * throws or renders nothing. */
export function resolveInk(palette: string[], index: number): string {
  if (palette.length === 0) return "#000000";
  return palette[Math.min(Math.max(0, index), palette.length - 1)];
}

export type DecorationKind = "emoji" | "sticky" | "stamp";

/** A personal touch dropped on top of a note — an animated emoji, a
 * sticky note, or a stamped copy of the writer's saved signature. Kept
 * deliberately separate from `Stroke`: these are placed objects (drag to
 * move, delete), not ink, and never go through the recognition pipeline. */
export interface Decoration {
  id: string;
  kind: DecorationKind;
  /** Fraction of the note's canvas — 0..1 — so a decoration stays in the
   * same relative spot however large the note is drawn later (Wall tile,
   * Artifact card, the original writing surface). */
  x: number;
  y: number;
  rotation: number;
  scale: number;
  /** kind: "emoji" */
  emoji?: string;
  /** kind: "sticky" */
  text?: string;
  color?: string;
  /** kind: "stamp" — a flattened raster of the saved signature, captured
   * once at insert time rather than carrying its own stroke/palette pair
   * through every render path that already knows how to draw a Note. */
  imageDataUrl?: string;
}

export interface Note {
  id: string;
  strokes: Stroke[];
  canvasWidth: number;
  canvasHeight: number;
  createdAt: number;
  authorName?: string;
  authorEmail?: string;
  /** Public URL of a flattened PNG snapshot in Supabase Storage — see
   * ink/renderNoteSnapshot.ts. Best-effort: absent doesn't mean anything
   * went wrong, the strokes/decorations are the durable record either way. */
  pngUrl?: string;
  transcript?: string;
  decorations?: Decoration[];
}
