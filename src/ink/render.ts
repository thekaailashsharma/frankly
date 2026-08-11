import { strokeToOutline, outlineToPath2D } from "./outline";
import { NIBS, type NibKind, type StrokePoint } from "./types";

/** Shared by the live canvas and every static preview, so a note looks
 * identical whether it's being written or shown on the wall.
 *
 * `preview` is only ever true for the wet (in-progress) layer: an eraser
 * drawn with destination-out onto an otherwise-empty wet canvas erases
 * nothing visible until it's baked onto the real ink layer on release, so
 * without this the gesture would look like it did nothing until you lift
 * the pen. A plain translucent fill there instead gives the same "here's
 * where I've erased" feedback a real destination-out would, without
 * needing the wet and baked layers to somehow share one canvas.
 */
export function paintStroke(
  ctx: CanvasRenderingContext2D,
  points: StrokePoint[],
  nibKind: NibKind,
  color: string,
  preview = false
) {
  const nib = NIBS[nibKind];
  const outline = strokeToOutline(points, nib);
  if (outline.length < 2) return;
  const path = outlineToPath2D(outline);

  ctx.save();
  if (nib.erases && preview) {
    ctx.fillStyle = "rgba(127,127,127,0.35)";
    ctx.fill(path);
  } else if (nib.erases) {
    // Punches a hole in whatever's already been baked onto THIS canvas —
    // colour is irrelevant here, only the shape's alpha matters. This is
    // why an eraser stroke has to bake onto the same layer real ink does:
    // destination-out only ever affects pixels already on its own canvas.
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#000000";
    ctx.fill(path);
  } else {
    ctx.fillStyle = withAlpha(color, nib.alpha);
    ctx.fill(path);
    if (nib.rimAlpha > 0) {
      ctx.strokeStyle = withAlpha(color, nib.rimAlpha);
      ctx.lineWidth = 1;
      ctx.stroke(path);
    }
  }
  ctx.restore();
}

export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
