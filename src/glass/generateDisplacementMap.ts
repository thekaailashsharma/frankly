/**
 * Builds the displacement map that gives glass its edge lensing.
 *
 * This is the Aave technique (aave.com/design/building-glass-for-the-web):
 * feDisplacementMap distorts the element's OWN painted content
 * (SourceGraphic), never a live backdrop. That is why it runs correctly in
 * Safari and Firefox with zero flags — it never touches the code path
 * that's still broken in WebKit (backdrop-filter with a custom SVG
 * reference). The cost is real: it can only bend what's inside the glass
 * shape, not refract whatever happens to be underneath it. For a floating
 * tool palette that's the right trade — the palette's own icon/label
 * content gets genuine lens distortion at the edges, and a plain
 * `backdrop-filter: blur()` (a CSS function, not a custom filter
 * reference — universally supported) handles the see-through blur.
 *
 * Encoding: displacement is stored as colour. Flat grey (128,128) at the
 * centre means "don't move this pixel"; deviation in R pushes along x,
 * deviation in G pushes along y — the standard normal/displacement-map
 * convention `feDisplacementMap` expects.
 */
export function generateDisplacementMap(width: number, height: number, radius: number, edgeWidth = 24): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Neutral grey everywhere — no displacement by default.
  ctx.fillStyle = "rgb(128,128,128)";
  ctx.fillRect(0, 0, width, height);

  const img = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const distToEdge = distanceToRoundedRectEdge(x, y, width, height, radius);
      if (distToEdge < edgeWidth && distToEdge >= 0) {
        // Smootherstep falloff — the same profile used for real lens edges,
        // steep near the boundary, flat toward the interior.
        const t = 1 - distToEdge / edgeWidth;
        const falloff = t * t * t * (t * (t * 6 - 15) + 10);
        const { nx, ny } = outwardNormal(x, y, width, height, radius);
        img.data[i] = 128 + nx * falloff * 90;
        img.data[i + 1] = 128 + ny * falloff * 90;
        img.data[i + 2] = 128;
        img.data[i + 3] = 255;
      } else {
        img.data[i] = 128;
        img.data[i + 1] = 128;
        img.data[i + 2] = 128;
        img.data[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

function distanceToRoundedRectEdge(x: number, y: number, w: number, h: number, r: number): number {
  const dx = Math.min(x, w - x);
  const dy = Math.min(y, h - y);
  if (dx > r && dy > r) return Math.min(dx, dy);
  const cx = Math.max(r - x, r - (w - x), 0);
  const cy = Math.max(r - y, r - (h - y), 0);
  if (cx > 0 && cy > 0) {
    const cornerDist = r - Math.hypot(cx, cy);
    return cornerDist;
  }
  return Math.min(dx, dy);
}

function outwardNormal(x: number, y: number, w: number, h: number, r: number): { nx: number; ny: number } {
  const cx = Math.max(r - x, r - (w - x), 0);
  const cy = Math.max(r - y, r - (h - y), 0);
  if (cx > 0 && cy > 0) {
    const len = Math.hypot(cx, cy) || 1;
    return { nx: cx / len, ny: cy / len };
  }
  const dx = Math.min(x, w - x);
  const dy = Math.min(y, h - y);
  if (dx < dy) return { nx: x < w - x ? -1 : 1, ny: 0 };
  return { nx: 0, ny: y < h - y ? -1 : 1 };
}
