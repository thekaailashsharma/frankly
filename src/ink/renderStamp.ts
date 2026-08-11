import { strokeBounds } from "./bounds";
import { paintStroke } from "./render";
import { PAPER_INK } from "../tokens/tokens";
import type { Stroke } from "./types";

/**
 * Flattens a saved signature into a small transparent PNG so it can be
 * dropped onto a note as a "stamp" decoration — a plain, portable raster
 * rather than carrying its own stroke/palette pair through every place a
 * Note already knows how to render (Wall tiles, Artifact cards, the wire
 * format saved to IndexedDB). Always drawn in a single fixed dark ink:
 * signatures are a single pen, and this way it stays legible however
 * light or dark the surface it lands on turns out to be.
 */
export function renderStamp(strokes: Stroke[]): string | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const stroke of strokes) {
    const b = strokeBounds(stroke);
    if (!b) continue;
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  if (!Number.isFinite(minX)) return null;

  const pad = 10;
  const width = maxX - minX + pad * 2;
  const height = maxY - minY + pad * 2;
  const scale = 2;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.translate(pad - minX, pad - minY);

  for (const stroke of strokes) {
    paintStroke(ctx, stroke.points, stroke.nib, PAPER_INK);
  }

  return canvas.toDataURL("image/png");
}
