import { useEffect, useRef, useState, type CSSProperties } from "react";
import { paintStroke } from "../ink/render";
import { inkBounds } from "../ink/bounds";
import { NIBS, resolveInk, type Note } from "../ink/types";
import { DecorationLayer } from "./DecorationLayer";

interface NoteInkViewProps {
  note: Note;
  palette: string[];
  /** When true (the only mode the native app ever uses this component in),
   * the note is scaled/translated to fill exactly its own ink bounding
   * box rather than its full original canvas — used by the ghost layer
   * and the artifact, where whitespace margins from the writing surface
   * would waste space in a much smaller frame. Ignored when the note has
   * decorations (see below) — a sticker's position is a fraction of the
   * ORIGINAL canvas, not of whatever the ink happens to occupy, so
   * cropping to ink bounds would silently misplace every sticker on a
   * note that has any.
   */
  fitToInkBounds?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function NoteInkView({ note, palette, fitToInkBounds = true, className, style }: NoteInkViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasDecorations = (note.decorations?.length ?? 0) > 0;
  const [frame, setFrame] = useState({ width: 0, height: 0, x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    // A note carrying decorations always fits its full original canvas —
    // a sticker's x/y is a fraction of THAT frame, so ink and decorations
    // have to share the exact same scale/offset or they drift apart.
    const bounds = hasDecorations
      ? { x: 0, y: 0, width: note.canvasWidth, height: note.canvasHeight }
      : fitToInkBounds
        ? inkBounds(note)
        : null;

    ctx.save();
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;
    if (bounds && bounds.width > 0 && bounds.height > 0) {
      scale = Math.min(rect.width / bounds.width, rect.height / bounds.height);
      offsetX = (rect.width - bounds.width * scale) / 2;
      offsetY = (rect.height - bounds.height * scale) / 2;
      ctx.translate(offsetX - bounds.x * scale, offsetY - bounds.y * scale);
      ctx.scale(scale, scale);
    }

    const highlighter = note.strokes.filter((s) => NIBS[s.nib].drawsUnderneath);
    const ink = note.strokes.filter((s) => !NIBS[s.nib].drawsUnderneath);
    for (const s of [...highlighter, ...ink]) paintStroke(ctx, s.points, s.nib, resolveInk(palette, s.inkIndex));
    ctx.restore();

    if (hasDecorations) {
      setFrame({ width: note.canvasWidth * scale, height: note.canvasHeight * scale, x: offsetX, y: offsetY });
    }
  }, [note, palette, fitToInkBounds, hasDecorations]);

  return (
    <div ref={containerRef} className={className} style={{ position: "relative", ...style }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
      {hasDecorations && frame.width > 0 && (
        <div style={{ position: "absolute", left: frame.x, top: frame.y, width: frame.width, height: frame.height }}>
          <DecorationLayer decorations={note.decorations!} />
        </div>
      )}
    </div>
  );
}
