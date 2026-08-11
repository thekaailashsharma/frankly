import { paintStroke } from "./render";
import { inkBounds } from "./bounds";
import { resolveInk, NIBS, type Note } from "./types";

// Caps the exported PNG's largest dimension — not a quality knob, a
// storage-budget one. At this size a typical note lands well under
// 150KB, and Supabase Storage's free tier is generous but not infinite:
// with the bucket's own 500KB/file limit, ~150 notes stays a rounding
// error against a 1GB quota instead of something to watch.
const MAX_DIMENSION = 900;

/**
 * Flattens a note's INK into a single PNG for storage/export — the
 * durable record is still the strokes/decorations JSON saved alongside
 * it; this is a convenience snapshot, not the source of truth, which is
 * why it doesn't bother compositing decorations (emoji, stickies, the
 * signature stamp) into the raster. Those already render correctly
 * everywhere the app shows a Note — this is for a static image link.
 */
export function renderNoteSnapshot(note: Note, palette: string[], background: string): string | null {
  const bounds = inkBounds(note);
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;

  const pad = Math.max(bounds.width, bounds.height) * 0.08;
  const w = bounds.width + pad * 2;
  const h = bounds.height + pad * 2;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(w, h));

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.translate(pad - bounds.x, pad - bounds.y);

  // Highlighter always renders underneath regardless of when it was
  // drawn (that's the whole point of a highlighter) — everything else,
  // ink and erasers alike, stays in original chronological order on the
  // SAME layer, so an eraser only ever punches through ink that already
  // existed at that point in time, not ink added afterward.
  const highlighter = note.strokes.filter((s) => NIBS[s.nib].drawsUnderneath);
  const rest = note.strokes.filter((s) => !NIBS[s.nib].drawsUnderneath);

  for (const s of highlighter) paintStroke(ctx, s.points, s.nib, resolveInk(palette, s.inkIndex));
  for (const s of rest) paintStroke(ctx, s.points, s.nib, resolveInk(palette, s.inkIndex));

  return canvas.toDataURL("image/png");
}
