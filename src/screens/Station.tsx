import { useCallback, useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { InkCanvas } from "../ink/InkCanvas";
import { ToolPill } from "../components/ToolPill";
import { RestingPen } from "../components/RestingPen";
import { PaperStyle } from "../components/PaperStyle";
import { GlassCard } from "../components/GlassCard";
import { DecorationLayer } from "../components/DecorationLayer";
import { AuthorSheet } from "../components/AuthorSheet";
import { ThemeBackdrop } from "../theme/ThemeBackdrop";
import { primaryOn } from "../theme/surfaceColor";
import { inksFor } from "../theme/InkPalette";
import { useEventStore } from "../store/EventStore";
import { usePalettePrefs } from "../store/usePalettePrefs";
import { useElementSize } from "../theme/useElementSize";
import { EVENT_MODES } from "../store/EventMode";
import * as Typography from "../tokens/Typography";
import { renderStamp } from "../ink/renderStamp";
import { renderNoteSnapshot } from "../ink/renderNoteSnapshot";
import { uploadNoteSnapshot } from "../lib/uploadSnapshot";
import { getSignature } from "../storage/db";
import { PAPER } from "../tokens/tokens";
import type { Note, NibKind, Stroke, Decoration } from "../ink/types";
import "./Station.css";

const AUTHOR_NAME_KEY = "frankly-author-name";
const AUTHOR_EMAIL_KEY = "frankly-author-email";

type Phase = "attract" | "writing" | "leaving";

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Ported 1:1 from StationView.swift — the three-phase writing kiosk.
 * attract (idle, inset card) -> writing (edge-to-edge, first mark) ->
 * leaving (submit, card lifts/slides/fades) -> back to attract.
 */
export function Station() {
  const store = useEventStore();
  const { edge: paletteEdge, setEdge: setPaletteEdge, autoMinimize } = usePalettePrefs();
  const { ref: sizeRef, size } = useElementSize<HTMLDivElement>();
  const compact = size.width > 0 && size.width < 700;
  const reducedMotion = useReducedMotion();

  const [phase, setPhase] = useState<Phase>("attract");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [nib, setNib] = useState<NibKind>("fine");
  const [inkIndex, setInkIndex] = useState(0);
  const [decorations, setDecorations] = useState<Decoration[]>([]);
  const [hasSignature, setHasSignature] = useState(false);
  const [authorSheetOpen, setAuthorSheetOpen] = useState(false);
  const [paletteMinimized, setPaletteMinimized] = useState(false);
  const [penNear, setPenNear] = useState(false);
  const [bloom, setBloom] = useState(0);
  const [bloomTransition, setBloomTransition] = useState("opacity 180ms ease-out");
  const [cardOffset, setCardOffset] = useState(0);
  const [cardTilt, setCardTilt] = useState(0);
  const [cardScale, setCardScale] = useState(1);
  const [cardOpacity, setCardOpacity] = useState(1);
  const [cardTransition, setCardTransition] = useState("none");

  const penIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  // Station reads its OWN theme, not the event's — a host can now give the
  // writing kiosk a different background than Poster/Wall/Artifact use.
  const theme = store.stationTheme;
  const tint = theme.isDark ? "#ffffff" : "#000000";
  const inks = inksFor(theme, theme.cardTint);
  const modeConfig = EVENT_MODES[store.mode === "memento" ? "memento" : "candid"];

  useEffect(() => {
    return () => {
      if (penIdleTimer.current) clearTimeout(penIdleTimer.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getSignature()
      .then((sig) => {
        if (!cancelled) setHasSignature(!!sig);
      })
      .catch(() => setHasSignature(false));
    return () => {
      cancelled = true;
    };
  }, []);

  function addEmoji(emoji: string) {
    setDecorations((prev) => [
      ...prev,
      { id: nanoid(), kind: "emoji", emoji, x: 0.5 + (Math.random() - 0.5) * 0.2, y: 0.3, rotation: 0, scale: 1 },
    ]);
  }

  function addSticky(color: string) {
    setDecorations((prev) => [
      ...prev,
      { id: nanoid(), kind: "sticky", color, text: "", x: 0.5, y: 0.4, rotation: -4, scale: 1 },
    ]);
  }

  async function addSignatureStamp() {
    const sig = await getSignature().catch(() => undefined);
    if (!sig) return;
    const imageDataUrl = renderStamp(sig.note.strokes);
    if (!imageDataUrl) return;
    setDecorations((prev) => [
      ...prev,
      { id: nanoid(), kind: "stamp", imageDataUrl, x: 0.72, y: 0.82, rotation: -3, scale: 1 },
    ]);
  }

  const beginWriting = useCallback(() => {
    if (phase !== "attract") return;
    setCardTransition("transform 420ms cubic-bezier(0.34, 1.28, 0.64, 1), border-radius 420ms cubic-bezier(0.34, 1.28, 0.64, 1)");
    setPhase("writing");
  }, [phase]);

  const onStrokeBegan = useCallback(() => {
    setPenNear(true);
    if (penIdleTimer.current) clearTimeout(penIdleTimer.current);
    penIdleTimer.current = setTimeout(() => setPenNear(false), 1100);
    beginWriting();
  }, [beginWriting]);

  const onStrokeComplete = useCallback((stroke: Stroke) => {
    setStrokes((prev) => [...prev, stroke]);
  }, []);

  const onUndo = useCallback(() => setStrokes((prev) => prev.slice(0, -1)), []);

  function reset(animated: boolean) {
    if (penIdleTimer.current) clearTimeout(penIdleTimer.current);
    setPaletteMinimized(false);
    setAuthorSheetOpen(false);
    setStrokes([]);
    setDecorations([]);
    setPenNear(false);
    setNib("fine");
    setInkIndex(0);
    setCardOffset(0);
    setCardTilt(0);
    setCardScale(1);
    setCardOpacity(1);
    setCardTransition(animated ? "transform 380ms cubic-bezier(0.34, 1.1, 0.64, 1)" : "none");
    setPhase("attract");
  }

  function bloomPulse(delayMs: number) {
    setTimeout(() => {
      setBloomTransition("opacity 180ms ease-out");
      setBloom(1);
      setTimeout(() => {
        setBloomTransition("opacity 900ms cubic-bezier(0.4, 0, 0.2, 1)");
        setBloom(0);
      }, 180);
    }, delayMs);
  }

  async function submit(authorName?: string, authorEmail?: string) {
    if (strokes.length === 0 && decorations.length === 0) return;
    const rect = canvasWrapRef.current?.getBoundingClientRect();

    if (authorName) localStorage.setItem(AUTHOR_NAME_KEY, authorName);
    if (authorEmail) localStorage.setItem(AUTHOR_EMAIL_KEY, authorEmail);

    // Snapshot + upload happen before the note is saved, not after — this
    // app has no "update a note later" path, so pngUrl either goes in
    // with the insert or never at all. Best-effort: a failed or slow
    // upload still falls through to a real submit, just without pngUrl.
    //
    // `inks` (used on-screen) is contrast-checked against theme.cardTint —
    // the dark writing card. The snapshot's actual canvas is always PAPER
    // (near-white), regardless of theme, so on a dark theme `inks` is a
    // set of LIGHT colours picked specifically to survive on a dark card —
    // drawn on the snapshot's white background, they vanished. Same
    // mismatched-background bug as the Wall/Signature/Artifact ones
    // earlier, just missed here because this canvas is invisible (never
    // rendered on screen, only uploaded) so it never showed up in a
    // regular walkthrough.
    let pngUrl: string | undefined;
    const snapshot = renderNoteSnapshot(
      { id: "snapshot", strokes, canvasWidth: 1, canvasHeight: 1, createdAt: 0 },
      inksFor(theme, PAPER),
      PAPER
    );
    const noteId = nanoid();
    if (snapshot) {
      pngUrl = (await uploadNoteSnapshot(store.event?.id ?? "unknown", noteId, snapshot)) ?? undefined;
    }

    const note: Note = {
      id: noteId,
      strokes,
      canvasWidth: rect?.width ?? size.width,
      canvasHeight: rect?.height ?? size.height,
      createdAt: Date.now(),
      decorations: decorations.length > 0 ? decorations : undefined,
      authorName: authorName || undefined,
      authorEmail: authorEmail || undefined,
      pngUrl,
    };
    await store.submit(note);

    if (reducedMotion) {
      bloomPulse(0);
      reset(false);
      return;
    }

    setPhase("leaving");
    setCardTransition("transform 160ms ease-in");
    setCardTilt(-6);
    setCardScale(1.01);
    setTimeout(() => {
      setCardTransition("transform 540ms cubic-bezier(0.34, 1.05, 0.64, 1), opacity 540ms ease-in-out");
      setCardOffset(520);
      setCardScale(0.62);
      setCardTilt(4);
      setCardOpacity(0);
    }, 120);
    bloomPulse(340);
    setTimeout(() => reset(false), 800);
  }

  // Matches .station__sheet-wrap--writing/--leaving's own CSS padding —
  // that padding is what keeps the live theme backdrop visible as a frame
  // around the paper while writing; the card's own size has to shrink to
  // fit inside it rather than the old exact-100% full-bleed size.
  const writingMargin = compact ? 10 : 22;
  const cardWidth =
    phase === "attract"
      ? size.width > 0
        ? Math.min(size.width - (compact ? 34 : 130), 960)
        : 0
      : Math.max(0, size.width - writingMargin * 2);
  const cardHeight =
    phase === "attract" ? (compact ? cardWidth * 1.15 : cardWidth / 1.5) : Math.max(0, size.height - writingMargin * 2);

  return (
    <div className="screen screen--fixed station" ref={sizeRef}>
      {/* usePhoto (removed) made this a blurred, heavily-scrimmed photo —
       * read as a flat dark colour, not the vivid animated marble/contour/
       * bokeh swirl Artifact shows for the same themes. */}
      <ThemeBackdrop
        theme={theme}
        calm={store.calm}
        bloom={bloom}
        ghostNotes={store.notes}
        reducedMotion={reducedMotion}
        className="station__backdrop"
        style={{ transition: bloomTransition }}
      />

      <div className={`station__sheet-wrap station__sheet-wrap--${phase}`}>
        <GlassCard
          // Always framed now — "bleed" (flat, no border/shadow) was only
          // ever meant for a literal full-bleed surface, which writing no
          // longer is now that it keeps a margin around it. Framed gives
          // it the quiet/expressive card treatment (border + shadow, and
          // for expressive themes the glass sheen) so it reads as a
          // floating object over the live backdrop instead of a flat slab.
          theme={theme}
          framed
          className="station__sheet"
          style={{
            width: cardWidth || undefined,
            height: cardHeight || undefined,
            transform: `perspective(700px) rotate3d(1, -0.35, 0, ${cardTilt}deg) scale(${cardScale}) translateY(${cardOffset}px)`,
            opacity: cardOpacity,
            transition: cardTransition,
            borderRadius: phase === "attract" ? 26 : 22,
          }}
        >
          {(cardSurface) => {
            const primary = primaryOn(cardSurface);
            return (
              <div className="station__card-inner" ref={canvasWrapRef}>
                <PaperStyle kind="plain" tint={primary} lineSpacing={compact ? 26 : 34} />

                {phase === "attract" ? (
                  <div className="station__attract" style={{ padding: compact ? 26 : 42, gap: compact ? 16 : 22 }}>
                    <p
                      className="station__attract-prompt"
                      style={{ ...Typography.editorial(compact ? 34 : 52), color: primary, lineHeight: 0.88 }}
                    >
                      {store.prompt}
                    </p>
                    <RestingPen tint={primary} width={compact ? 120 : 168} />
                  </div>
                ) : (
                  <>
                    <p
                      className="station__prompt-label"
                      style={{ ...Typography.label(compact ? 13 : 15), color: withAlpha(primary, 0.32), padding: compact ? 20 : 30 }}
                    >
                      {store.prompt}
                    </p>
                    <p
                      className="station__privacy-line"
                      style={{ ...Typography.label(compact ? 10 : 11), color: withAlpha(primary, 0.32), padding: compact ? 16 : 24 }}
                    >
                      {modeConfig.privacyLine}
                    </p>
                  </>
                )}

                <InkCanvas
                  strokes={strokes}
                  palette={inks}
                  activeNib={nib}
                  activeInkIndex={inkIndex}
                  disabled={phase === "leaving"}
                  onStrokeBegan={onStrokeBegan}
                  onStrokeComplete={onStrokeComplete}
                />

                <DecorationLayer decorations={decorations} editable={phase === "writing"} onChange={setDecorations} />
              </div>
            );
          }}
        </GlassCard>
      </div>

      {phase === "attract" ? (
        <SocialProofStack count={store.count} tint={tint} />
      ) : phase === "writing" ? (
        <CommitBar
          onSubmit={() => setAuthorSheetOpen(true)}
          disabled={strokes.length === 0 && decorations.length === 0}
          tint={tint}
          isDark={theme.isDark}
          compact={compact}
        />
      ) : null}

      {authorSheetOpen && (
        <AuthorSheet
          dark={theme.isDark}
          defaultName={localStorage.getItem(AUTHOR_NAME_KEY) ?? ""}
          defaultEmail={localStorage.getItem(AUTHOR_EMAIL_KEY) ?? ""}
          onSubmit={(name, email) => {
            setAuthorSheetOpen(false);
            void submit(name || undefined, email || undefined);
          }}
          onSkip={() => {
            setAuthorSheetOpen(false);
            void submit();
          }}
        />
      )}

      {phase === "writing" && (
        <ToolPill
          theme={theme}
          inks={inks}
          nib={nib}
          onNibChange={setNib}
          inkIndex={inkIndex}
          onInkChange={setInkIndex}
          edge={paletteEdge}
          onEdgeChange={setPaletteEdge}
          minimized={paletteMinimized}
          onMinimizedChange={setPaletteMinimized}
          penDown={penNear}
          autoMinimize={autoMinimize}
          onUndo={onUndo}
          onStartOver={() => reset(true)}
          onAddEmoji={addEmoji}
          onAddSticky={addSticky}
          onAddSignature={hasSignature ? addSignatureStamp : undefined}
          hasSignature={hasSignature}
          compact={compact}
        />
      )}
    </div>
  );
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function SocialProofStack({ count, tint }: { count: number; tint: string }) {
  const bars = Math.min(count, 5);
  return (
    <div className="station__social-proof">
      <div className="station__social-proof-bars" style={{ height: 26 }}>
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 96 - i * 3,
              height: 5,
              borderRadius: 4,
              background: withAlpha(tint, 0.1 + i * 0.035),
              transform: `translateY(${-i * 4}px)`,
            }}
          />
        ))}
      </div>
      <p className="station__social-proof-label" style={{ ...Typography.label(12), color: withAlpha(tint, 0.42) }}>
        {count === 0 ? "be the first" : count === 1 ? "1 person has written" : `${count} people have written`}
      </p>
    </div>
  );
}

function CommitBar({
  onSubmit,
  disabled,
  tint,
  isDark,
  compact,
}: {
  onSubmit: () => void;
  disabled: boolean;
  tint: string;
  isDark: boolean;
  compact: boolean;
}) {
  return (
    <div className="station__commit-bar" style={{ paddingBottom: compact ? 16 : 24 }}>
      <button
        className="station__commit-button"
        onClick={onSubmit}
        disabled={disabled}
        style={{ background: tint, color: isDark ? "#000" : "#fff", opacity: disabled ? 0.3 : 1 }}
      >
        <span style={Typography.label(15, true)}>Done</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
