import { useEffect, useMemo, useState } from "react";
import { nanoid } from "nanoid";
import { useEventStore } from "../store/EventStore";
import { useElementSize } from "../theme/useElementSize";
import { ThemeBackdrop } from "../theme/ThemeBackdrop";
import { NoteInkView } from "../components/NoteInkView";
import { InkCanvas } from "../ink/InkCanvas";
import { GlassCard } from "../components/GlassCard";
import { inksFor } from "../theme/InkPalette";
import { hex } from "../theme/Theme";
import * as Typography from "../tokens/Typography";
import { pages as layoutPages, type Page } from "../theme/ArtifactLayout";
import { getSignature } from "../storage/db";
import type { Note, Stroke } from "../ink/types";
import "./Artifact.css";

/**
 * The collective closing piece — every note anyone wrote, laid out on one
 * backdrop, with the host able to sign off with a final note that seals
 * ("closes") the event. Ported 1:1 from the native CollectiveArtifactView
 * + ArtifactBrowser + HostNoteView. Closing is an instant state flip in
 * the native app — no seal/confetti animation exists, so none is added here.
 */
export function Artifact() {
  const { theme, notes, hostNote, isClosed, name, count, close, reopen } = useEventStore();
  const { ref, size } = useElementSize<HTMLDivElement>();
  const [pageIndex, setPageIndex] = useState(0);
  const [writeBackOpen, setWriteBackOpen] = useState(false);

  const foreground = theme.isDark ? hex(0xf4f1ea) : hex(0x1a1a1f);
  const inks = useMemo(
    () => inksFor(theme, theme.isDark ? hex(0x201c2c) : hex(0xefebe2)),
    [theme]
  );

  // The area notes may occupy — reserves space for the header above and
  // (when there's a host note on this render) the footer below.
  const content = useMemo(() => {
    const top = size.height * 0.115;
    const bottom = hostNote == null ? size.height * 0.06 : size.height * 0.21;
    return { x: 0, y: top, width: size.width, height: Math.max(0, size.height - top - bottom) };
  }, [size.width, size.height, hostNote]);

  const artifactPages = useMemo<Page[]>(
    () => layoutPages(notes, { width: content.width, height: content.height }),
    [notes, content.width, content.height]
  );

  // Keep the current page in range as the note count / geometry changes.
  useEffect(() => {
    setPageIndex((i) => Math.min(i, Math.max(0, artifactPages.length - 1)));
  }, [artifactPages.length]);

  const currentPage: Page | undefined = artifactPages[pageIndex];
  const isLastPage = pageIndex === artifactPages.length - 1;

  async function handleSignAndClose(note: Note | null) {
    await close(note);
    setWriteBackOpen(false);
  }

  return (
    <div ref={ref} className="screen artifact">
      <ThemeBackdrop theme={theme} calm={0.92} />

      <div
        className="artifact__header"
        style={{ paddingLeft: size.width * 0.06, paddingTop: size.height * 0.055 }}
      >
        <p style={{ ...Typography.editorial(16), color: foreground, opacity: 0.85, margin: 0 }}>{name}</p>
        <p style={{ ...Typography.label(12), color: foreground, opacity: 0.45, margin: "4px 0 0" }}>
          {count} {count === 1 ? "note" : "notes"}
        </p>
      </div>

      {notes.length === 0 ? (
        <div className="artifact__empty">
          <p style={{ ...Typography.editorial(18), color: foreground, opacity: 0.5, margin: 0 }}>
            Nothing written yet.
          </p>
        </div>
      ) : (
        currentPage?.placements.map((placement) => (
          <div
            key={placement.note.id}
            className="artifact__note"
            style={{
              left: content.x + placement.frame.x,
              top: content.y + placement.frame.y,
              width: placement.frame.width,
              height: placement.frame.height,
              transform: `rotate(${placement.rotation}deg)`,
            }}
          >
            <NoteInkView note={placement.note} palette={inks} fitToInkBounds style={{ width: "100%", height: "100%" }} />
          </div>
        ))
      )}

      {hostNote && isLastPage && <HostFooter hostNote={hostNote} inks={inks} foreground={foreground} size={size} />}

      {artifactPages.length > 1 && (
        <p
          className="artifact__page-indicator"
          style={{
            ...Typography.micro(10),
            color: foreground,
            opacity: 0.35,
            paddingRight: size.width * 0.06,
          }}
        >
          {pageIndex + 1} / {artifactPages.length}
        </p>
      )}

      <div className="artifact__close-row">
        {isClosed ? (
          <button
            className="artifact__closed-label"
            style={{ ...Typography.label(13, true), color: foreground }}
            onClick={() => reopen()}
            title="Tap to reopen"
          >
            🔒 Closed
          </button>
        ) : (
          <button
            className="artifact__close-pill"
            style={{ ...Typography.label(13, true), opacity: notes.length === 0 ? 0.35 : 1 }}
            disabled={notes.length === 0}
            onClick={() => setWriteBackOpen(true)}
          >
            Close &amp; write back
          </button>
        )}
      </div>

      {writeBackOpen && (
        <WriteBackModal theme={theme} onCancel={() => setWriteBackOpen(false)} onSignAndClose={handleSignAndClose} />
      )}
    </div>
  );
}

function HostFooter({
  hostNote,
  inks,
  foreground,
  size,
}: {
  hostNote: Note;
  inks: string[];
  foreground: string;
  size: { width: number; height: number };
}) {
  const margin = size.width * 0.06;
  const noteHeight = Math.min(size.height * 0.13, 110);
  const noteWidth = Math.min(size.width * 0.5, 520);
  const centerY = size.height - size.height * 0.05 - noteHeight / 2;

  return (
    <div
      className="artifact__host-footer"
      style={{
        width: Math.max(0, size.width - margin * 2),
        top: centerY,
        left: "50%",
        transform: "translate(-50%, -50%)",
      }}
    >
      <div style={{ width: noteWidth * 0.55, height: 0.5, background: foreground, opacity: 0.18 }} />
      <NoteInkView note={hostNote} palette={inks} fitToInkBounds style={{ width: noteWidth, height: noteHeight }} />
    </div>
  );
}

function WriteBackModal({
  theme,
  onCancel,
  onSignAndClose,
}: {
  theme: ReturnType<typeof useEventStore>["theme"];
  onCancel: () => void;
  onSignAndClose: (note: Note | null) => void;
}) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [signature, setSignature] = useState<Note | null>(null);
  const { ref: cardRef, size: cardSize } = useElementSize<HTMLDivElement>();

  useEffect(() => {
    let cancelled = false;
    getSignature().then((record) => {
      if (!cancelled) setSignature(record?.note ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function useSavedSignature() {
    if (signature) setStrokes(signature.strokes);
  }

  function undo() {
    setStrokes((prev) => prev.slice(0, -1));
  }

  function signAndClose() {
    const note: Note | null =
      strokes.length > 0
        ? {
            id: nanoid(),
            strokes,
            canvasWidth: cardSize.width || 400,
            canvasHeight: 300,
            createdAt: Date.now(),
          }
        : null;
    onSignAndClose(note);
  }

  return (
    <div className="artifact__modal-scrim" onClick={onCancel}>
      <div className="artifact__modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ ...Typography.editorial(22), margin: "0 0 16px" }}>Write back to the room</h2>

        <GlassCard theme={theme} framed style={{ height: 300, maxHeight: 300 }}>
          <div ref={cardRef} style={{ width: "100%", height: "100%" }}>
            <InkCanvas
              strokes={strokes}
              // The card's actual surface tint, not theme.inks raw — a dark
              // theme's inks[0] is a light accent meant for a dark backdrop;
              // guarding it against the card's own tint is what keeps the
              // pen visible no matter which theme is active.
              palette={inksFor(theme, theme.cardTint)}
              activeNib="fine"
              activeInkIndex={0}
              onStrokeComplete={(s) => setStrokes((prev) => [...prev, s])}
            />
          </div>
        </GlassCard>

        {signature && strokes.length === 0 && (
          <button className="artifact__modal-signature" onClick={useSavedSignature}>
            Use my saved signature
          </button>
        )}

        <div className="artifact__modal-buttons">
          <button className="artifact__modal-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="artifact__modal-undo" onClick={undo} disabled={strokes.length === 0}>
            Undo
          </button>
          <button className="artifact__modal-sign" onClick={signAndClose}>
            Sign &amp; close
          </button>
        </div>
      </div>
    </div>
  );
}
