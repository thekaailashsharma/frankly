import { useCallback, useEffect, useRef } from "react";
import { nanoid } from "nanoid";
import { useInkCapture } from "./useInkCapture";
import { paintStroke } from "./render";
import { NIBS, resolveInk, type NibKind, type Stroke, type StrokePoint } from "./types";
// Owned by the component, not by whoever happens to import it — a
// consumer forgetting this import once already caused a real bug: an
// unstyled, content-sized container fed its own measured size back into
// its canvases' inline pixel dimensions, growing without bound on every
// ResizeObserver tick until Chromium's internal size clamp was hit.
import "./InkCanvas.css";

interface InkCanvasProps {
  strokes: Stroke[];
  /** Whatever palette this context is rendering against — the writing
   * surface's own theme, or a different theme entirely if this note is
   * being redrawn into the ghost layer or the artifact. */
  palette: string[];
  activeNib: NibKind;
  activeInkIndex: number;
  disabled?: boolean;
  onStrokeBegan?: () => void;
  onStrokeComplete: (stroke: Stroke) => void;
}

/**
 * Three stacked canvases, bottom to top: highlighter (wide/underneath
 * strokes), ink (fine/marker), wet (the one stroke currently being drawn).
 *
 * This ordering is what makes marking over a word never cover it, without
 * ever having to re-sort or redraw everything that came before — each
 * committed stroke is baked once, onto the layer its nib belongs to, and
 * never touched again. The wet layer is the only thing that redraws on
 * every frame, and it only ever contains one stroke's worth of geometry —
 * this is the fix for the classic mistake of recomputing an entire
 * drawing's outline on every pointer event, which is what makes freehand
 * canvases visibly lag as a page fills up.
 */
export function InkCanvas({
  strokes,
  palette,
  activeNib,
  activeInkIndex,
  disabled,
  onStrokeBegan,
  onStrokeComplete,
}: InkCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const highlighterRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const wetRef = useRef<HTMLCanvasElement>(null);
  const bakedCount = useRef(0);
  const liveNib = useRef(activeNib);
  const liveInkIndex = useRef(activeInkIndex);
  const livePalette = useRef(palette);
  liveNib.current = activeNib;
  liveInkIndex.current = activeInkIndex;
  livePalette.current = palette;

  // Sized from layout dimensions (offsetWidth/Height), never
  // getBoundingClientRect() — a 3D transform on an ancestor (the
  // Station card's tilt/scale during its leaving animation) reports its
  // post-transform, potentially wildly distorted visual bounding box
  // through getBoundingClientRect() on every descendant. offsetWidth is
  // the pre-transform CSS layout size, immune to that.
  const sizeCanvas = useCallback((canvas: HTMLCanvasElement, size: { width: number; height: number }) => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(size.width * dpr));
    canvas.height = Math.max(1, Math.round(size.height * dpr));
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  const bakeStroke = useCallback(
    (stroke: Stroke) => {
      const canvas = NIBS[stroke.nib].drawsUnderneath ? highlighterRef.current : inkRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;
      paintStroke(ctx, stroke.points, stroke.nib, resolveInk(palette, stroke.inkIndex));
    },
    [palette]
  );

  const repaintAll = useCallback(() => {
    for (const ref of [highlighterRef, inkRef]) {
      const canvas = ref.current;
      if (!canvas) continue;
      canvas.getContext("2d")!.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    }
    for (const stroke of strokes) bakeStroke(stroke);
    bakedCount.current = strokes.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bakeStroke]);

  // Full rebuild on mount / resize — the only O(n) pass, and only when the
  // canvas geometry itself changes (e.g. iPad rotation).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const rebuild = () => {
      const size = { width: container.offsetWidth, height: container.offsetHeight };
      for (const ref of [highlighterRef, inkRef, wetRef]) {
        if (ref.current) sizeCanvas(ref.current, size);
      }
      bakedCount.current = 0;
      repaintAll();
    };

    rebuild();
    const observer = new ResizeObserver(rebuild);
    observer.observe(container);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizeCanvas]);

  // Incremental append — O(1) per new stroke in the steady state.
  useEffect(() => {
    if (strokes.length <= bakedCount.current) return;
    for (let i = bakedCount.current; i < strokes.length; i++) bakeStroke(strokes[i]);
    bakedCount.current = strokes.length;
  }, [strokes, bakeStroke]);

  // The palette itself can change under an already-drawn note (ghost
  // layer / artifact showing it against a different theme) — repaint
  // everything already committed, not just new strokes.
  const isFirstPaletteRender = useRef(true);
  useEffect(() => {
    if (isFirstPaletteRender.current) {
      isFirstPaletteRender.current = false;
      return;
    }
    repaintAll();
  }, [palette, repaintAll]);

  const redrawWet = useCallback((points: StrokePoint[]) => {
    const canvas = wetRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    paintStroke(ctx, points, liveNib.current, resolveInk(livePalette.current, liveInkIndex.current), true);
  }, []);

  const rafHandle = useRef<number | null>(null);
  const onPointsChanged = useCallback(
    (points: StrokePoint[]) => {
      if (rafHandle.current != null) return;
      rafHandle.current = requestAnimationFrame(() => {
        rafHandle.current = null;
        redrawWet(points);
      });
    },
    [redrawWet]
  );

  const onStrokeEnd = useCallback(
    (points: StrokePoint[]) => {
      const canvas = wetRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      }
      if (points.length < 2) return; // a tap, not a mark
      onStrokeComplete({
        id: nanoid(),
        points,
        inkIndex: liveInkIndex.current,
        nib: liveNib.current,
      });
    },
    [onStrokeComplete]
  );

  const capture = useInkCapture({
    enabled: !disabled,
    onStrokeBegan,
    onPointsChanged,
    onStrokeEnd,
    getCanvasRect: () => wetRef.current!.getBoundingClientRect(),
  });

  return (
    <div ref={containerRef} className="ink-canvas-stack">
      <canvas ref={highlighterRef} className="ink-layer" />
      <canvas ref={inkRef} className="ink-layer" />
      <canvas
        ref={wetRef}
        className="ink-layer ink-layer--wet"
        style={{ touchAction: "none" }}
        {...capture}
      />
    </div>
  );
}
