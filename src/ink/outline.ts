import { getStroke } from "perfect-freehand";
import type { NibConfig, StrokePoint } from "./types";

/**
 * Turns a live point stream into a filled outline polygon — the same
 * "filled shape, not a stroked line" approach the native ink engine used,
 * because a stroked line can't taper or build alpha at self-crossings the
 * way real ink does.
 */
export function strokeToOutline(points: StrokePoint[], nib: NibConfig): [number, number][] {
  const input = points.map((p) => [p.x, p.y, p.pressure] as [number, number, number]);
  return getStroke(input, {
    size: nib.size,
    thinning: nib.thinning,
    // Matches the native engine's tuned values exactly, for visual parity.
    smoothing: 0.42,
    streamline: 0.42,
    easing: (t) => t,
    simulatePressure: points.every((p) => p.pressure === 0.5),
    last: true,
  }) as [number, number][];
}

/** Builds a smooth Path2D from perfect-freehand's outline points, using
 * quadratic curves through midpoints rather than straight segments — the
 * standard technique for avoiding a faceted, polygon-y look. */
export function outlineToPath2D(outline: [number, number][]): Path2D {
  const path = new Path2D();
  if (outline.length < 2) {
    if (outline.length === 1) {
      path.arc(outline[0][0], outline[0][1], 0.5, 0, Math.PI * 2);
    }
    return path;
  }
  const [firstX, firstY] = outline[0];
  path.moveTo(firstX, firstY);
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    path.quadraticCurveTo(x0, y0, mx, my);
  }
  path.closePath();
  return path;
}
