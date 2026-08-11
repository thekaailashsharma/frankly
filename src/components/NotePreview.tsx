import { useEffect, useRef } from "react";
import { paintStroke } from "../ink/render";
import { NIBS, resolveInk, type Note } from "../ink/types";
import { DecorationLayer } from "./DecorationLayer";

/** A note rendered once, statically — the wall never needs a live,
 * interactive canvas per card, just an accurate picture of the ink (and,
 * now, whatever stickers/sticky notes/stamps were dropped on it — this
 * canvas already renders at exactly canvasWidth×canvasHeight with no
 * ink-bounds cropping, so a decoration's fractional x/y lines up with it
 * directly, no extra scale math needed). */
export function NotePreview({ note, palette }: { note: Note; palette: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = note.canvasWidth * dpr;
    canvas.height = note.canvasHeight * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const highlighter = note.strokes.filter((s) => NIBS[s.nib].drawsUnderneath);
    const ink = note.strokes.filter((s) => !NIBS[s.nib].drawsUnderneath);
    for (const s of [...highlighter, ...ink]) paintStroke(ctx, s.points, s.nib, resolveInk(palette, s.inkIndex));
  }, [note, palette]);

  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: `${note.canvasWidth} / ${note.canvasHeight}` }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      {(note.decorations?.length ?? 0) > 0 && <DecorationLayer decorations={note.decorations!} />}
    </div>
  );
}
