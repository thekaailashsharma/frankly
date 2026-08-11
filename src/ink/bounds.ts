import { NIBS, type Note, type Stroke } from "./types";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Bounding box of a stroke's points, expanded by its own nib width on
 * every side — ported from `Stroke.bounds` (inset by -size). */
export function strokeBounds(stroke: Stroke): Rect | null {
  if (stroke.points.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of stroke.points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const inset = NIBS[stroke.nib].size;
  return { x: minX - inset, y: minY - inset, width: maxX - minX + inset * 2, height: maxY - minY + inset * 2 };
}

/** Union of every stroke's bounds — ported from `Note.inkBounds`. */
export function inkBounds(note: Note): Rect | null {
  let result: Rect | null = null;
  for (const stroke of note.strokes) {
    const b = strokeBounds(stroke);
    if (!b) continue;
    if (!result) {
      result = b;
    } else {
      const minX = Math.min(result.x, b.x);
      const minY = Math.min(result.y, b.y);
      const maxX = Math.max(result.x + result.width, b.x + b.width);
      const maxY = Math.max(result.y + result.height, b.y + b.height);
      result = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
  }
  return result;
}

/** Sum of point-to-point Euclidean distances across all strokes — ported
 * from `Note.inkLength`. */
export function inkLength(note: Note): number {
  let total = 0;
  for (const stroke of note.strokes) {
    for (let i = 1; i < stroke.points.length; i++) {
      const a = stroke.points[i - 1];
      const b = stroke.points[i];
      total += Math.hypot(b.x - a.x, b.y - a.y);
    }
  }
  return total;
}
