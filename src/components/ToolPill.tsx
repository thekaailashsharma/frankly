import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { GlassPanel } from "../glass/GlassPanel";
import type { NibKind } from "../ink/types";
import type { Theme } from "../theme/Theme";
import { micro, label as labelFont } from "../tokens/Typography";
import { relativeLuminance } from "../theme/color";
import "./ToolPill.css";

/* ------------------------------------------------------------------ */
/* Edge model — ported from the Swift tool palette's edge-snap logic. */
/* ------------------------------------------------------------------ */

export type PaletteEdge = "bottom" | "top" | "leading" | "trailing";

export interface PaletteEdgeHelpers {
  alignment(edge: PaletteEdge): { justify: string; align: string };
  arrowEdge(edge: PaletteEdge): PaletteEdge;
  nearest(translation: { x: number; y: number }, current: PaletteEdge): PaletteEdge;
}

/** Where the pill sits within its parent: bottom→bottom-center, top→top-center,
 * leading→left-center, trailing→right-center. */
export function edgeAlignment(edge: PaletteEdge): { justify: string; align: string } {
  switch (edge) {
    case "bottom":
      return { justify: "center", align: "flex-end" };
    case "top":
      return { justify: "center", align: "flex-start" };
    case "leading":
      return { justify: "flex-start", align: "center" };
    case "trailing":
      return { justify: "flex-end", align: "center" };
  }
}

/** Which side a popover anchored to the pill should point toward — the
 * edge OPPOSITE the pill's own edge, so the popover opens into free space. */
export function edgeArrowSide(edge: PaletteEdge): PaletteEdge {
  switch (edge) {
    case "bottom":
      return "top";
    case "top":
      return "bottom";
    case "leading":
      return "trailing";
    case "trailing":
      return "leading";
  }
}

/** Snap a drag translation to the nearest screen edge, with a 40px deadzone
 * that keeps a small jitter from relocating the pill. */
export function nearestEdge(translation: { x: number; y: number }, current: PaletteEdge): PaletteEdge {
  const { x: dx, y: dy } = translation;
  if (Math.abs(dx) <= 40 && Math.abs(dy) <= 40) return current;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "trailing" : "leading";
  return dy > 0 ? "bottom" : "top";
}

/* ------------------------------------------------------------------ */

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** A hairline ring that contrasts against the swatch colour itself,
 * independent of theme tint — a pale ink option (light themes' near-white
 * accent inks) on the glass panel's own light-ish tint was reported as
 * "barely visible"; this guarantees every option pops from the panel
 * regardless of how light or dark that particular ink happens to be. */
function ringFor(colorHex: string): string {
  return relativeLuminance(colorHex) > 0.6 ? "rgba(0,0,0,0.28)" : "rgba(255,255,255,0.4)";
}

const NIB_ORDER: NibKind[] = ["fine", "marker", "wide", "eraser"];
const NIB_PUCK_DOT: Record<NibKind, number> = { fine: 6, marker: 10, wide: 16, eraser: 14 };
const NIB_BUTTON_DOT: Record<NibKind, number> = { fine: 6, marker: 10, wide: 14, eraser: 0 };
const NIB_LABEL: Record<NibKind, string> = { fine: "Fine", marker: "Marker", wide: "Highlight", eraser: "Eraser" };
const NIB_BLURB: Record<NibKind, string> = {
  fine: "Thins as you write faster, like a real pen.",
  marker: "Broader, and it builds where strokes cross.",
  wide: "Highlights underneath what you've already written.",
  eraser: "Drag over ink to remove it.",
};

// Exactly ten, every one animated (see DecorationLayer.css's
// ANIMATION_BY_EMOJI) — a bigger grid starts to feel like a sticker pack
// rather than a handful of things worth actually reaching for.
const EMOJI_SET = ["❤️", "🔥", "⭐", "✨", "🎉", "👏", "😂", "🙌", "💯", "🌊"];
const STICKY_COLORS = ["#fff2a8", "#ffd1dc", "#c9f2c7", "#bfe0ff"];

const SPRING_TRANSITION = "0.3s cubic-bezier(0.34, 1.4, 0.64, 1)";
const EASE_TRANSITION = "0.2s ease-out";

const DRAG_THRESHOLD = 22;
const LONG_PRESS_MS = 550;

type PopoverKind = { type: "nib"; nib: NibKind } | { type: "stickers" };

interface ToolPillProps {
  theme: Theme;
  inks: string[];
  nib: NibKind;
  onNibChange: (n: NibKind) => void;
  inkIndex: number;
  onInkChange: (i: number) => void;
  edge: PaletteEdge;
  onEdgeChange: (e: PaletteEdge) => void;
  minimized: boolean;
  onMinimizedChange: (m: boolean) => void;
  penDown: boolean;
  autoMinimize: boolean;
  onUndo: () => void;
  onStartOver: () => void;
  onAddEmoji: (emoji: string) => void;
  onAddSticky: (color: string) => void;
  onAddSignature?: () => void;
  hasSignature: boolean;
  compact: boolean;
}

export function ToolPill({
  theme,
  inks,
  nib,
  onNibChange,
  inkIndex,
  onInkChange,
  edge,
  onEdgeChange,
  minimized,
  onMinimizedChange,
  penDown,
  autoMinimize,
  onUndo,
  onStartOver,
  onAddEmoji,
  onAddSticky,
  onAddSignature,
  hasSignature,
  compact,
}: ToolPillProps) {
  // The palette always floats over its OWN writing card — a known,
  // controlled backdrop, unlike the nav bar which can sit over an
  // unpredictable photo. That's what makes it safe to actually follow the
  // theme here: a dark board gets dark glass and light icons, a light
  // board gets light glass and dark icons — instead of the nav's
  // one-size-fits-all fallback.
  const dark = theme.isDark;
  const tint = dark ? "#f5f3ee" : "#14141a";
  const collapsed = minimized || (autoMinimize && penDown);
  const isHorizontal = edge === "bottom" || edge === "top";

  /* Two different transitions for two different triggers: a spring for
   * the deliberate minimize toggle, a plain ease-out for the automatic
   * pen-down collapse. */
  const [transition, setTransition] = useState(SPRING_TRANSITION);
  const prevMinimized = useRef(minimized);
  const prevPenDown = useRef(penDown);
  useEffect(() => {
    if (prevMinimized.current !== minimized) {
      setTransition(SPRING_TRANSITION);
    } else if (prevPenDown.current !== penDown) {
      setTransition(EASE_TRANSITION);
    }
    prevMinimized.current = minimized;
    prevPenDown.current = penDown;
  }, [minimized, penDown]);

  const [popover, setPopover] = useState<PopoverKind | null>(null);

  /* --------------------------- drag to edge --------------------------- */
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ startX: number; startY: number; dragging: boolean; suppressClick: boolean } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    // Deliberately NOT calling setPointerCapture here. This root wraps every
    // real button in the pill (nibs, ink swatches, undo/stickers/minimize) —
    // capturing the pointer immediately on down redirects the eventual
    // pointerup (and the click synthesized from it) to THIS div instead of
    // whichever button was actually pressed, on some browsers. That silently
    // ate ordinary clicks on the swatches — capture is now deferred until a
    // real drag past the threshold is detected, so a plain click never
    // triggers it at all.
    dragState.current = { startX: e.clientX, startY: e.clientY, dragging: false, suppressClick: false };
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const s = dragState.current;
    if (!s) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      s.dragging = true;
      s.suppressClick = true;
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    }
    if (s.dragging) setDragOffset({ x: dx, y: dy });
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const s = dragState.current;
    if (!s) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (s.dragging) {
      const next = nearestEdge({ x: dx, y: dy }, edge);
      onEdgeChange(next);
      setDragOffset({ x: 0, y: 0 });
    }
    dragState.current = null;
  }

  function suppressIfDragged(e: ReactMouseEvent) {
    const s = dragState.current;
    if (s?.suppressClick) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  /* --------------------------- long-press undo ------------------------- */
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  function handleUndoPointerDown() {
    longPressFired.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      onStartOver();
    }, LONG_PRESS_MS);
  }
  function handleUndoPointerUpOrLeave() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }
  function handleUndoClick() {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    onUndo();
  }

  /* ---------------------- dismiss popover on outside/escape ------------ */
  useEffect(() => {
    if (!popover) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPopover(null);
    }
    function onPointerDownOutside(e: PointerEvent) {
      const root = rootRef.current;
      if (root && !root.contains(e.target as Node)) setPopover(null);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDownOutside, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDownOutside, true);
    };
  }, [popover]);

  /* -------------------------------- style ------------------------------- */
  const positionStyle = edgePositionStyle(edge, dragOffset);

  return (
    <div
      ref={rootRef}
      className="tool-pill-root"
      style={positionStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClickCapture={suppressIfDragged}
    >
      <div className="tool-pill__stage">
        <div
          className="tool-pill__puck"
          data-hidden={!collapsed}
          style={{ transition: `opacity ${transition}, transform ${transition}` }}
        >
          <PuckView dark={dark} nib={nib} ink={inks[inkIndex] ?? tint} onOpen={() => onMinimizedChange(false)} />
        </div>
        <div
          className="tool-pill__full"
          data-hidden={collapsed}
          style={{ transition: `opacity ${transition}, transform ${transition}` }}
        >
          <FullView
            dark={dark}
            tint={tint}
            inks={inks}
            nib={nib}
            onNibChange={onNibChange}
            inkIndex={inkIndex}
            onInkChange={onInkChange}
            isHorizontal={isHorizontal}
            onMinimize={() => onMinimizedChange(true)}
            onUndoClick={handleUndoClick}
            onUndoPointerDown={handleUndoPointerDown}
            onUndoPointerUp={handleUndoPointerUpOrLeave}
            popover={popover}
            setPopover={setPopover}
          />
        </div>
      </div>

      {popover?.type === "nib" && (
        <NibPopover dark={dark} tint={tint} nib={popover.nib} edge={edge} compact={compact} onDismiss={() => setPopover(null)} />
      )}

      {popover?.type === "stickers" && (
        <StickerPopover
          dark={dark}
          edge={edge}
          compact={compact}
          hasSignature={hasSignature}
          onPickEmoji={(e) => {
            onAddEmoji(e);
            setPopover(null);
          }}
          onAddSticky={(c) => {
            onAddSticky(c);
            setPopover(null);
          }}
          onAddSignature={
            onAddSignature &&
            (() => {
              onAddSignature();
              setPopover(null);
            })
          }
        />
      )}
    </div>
  );
}

function edgePositionStyle(edge: PaletteEdge, dragOffset: { x: number; y: number }): CSSProperties {
  const pad = 18;
  const base: CSSProperties = { position: "absolute" };
  const drag = `translate(${dragOffset.x}px, ${dragOffset.y}px)`;
  switch (edge) {
    case "bottom":
      return {
        ...base,
        left: "50%",
        bottom: `calc(${pad}px + env(safe-area-inset-bottom, 0px))`,
        transform: `translateX(-50%) ${drag}`,
      };
    case "top":
      return {
        ...base,
        left: "50%",
        // See EventShell.tsx — same nav-collision fix, same variable.
        top: `calc(var(--event-nav-height, 0px) + ${pad}px + env(safe-area-inset-top, 0px))`,
        transform: `translateX(-50%) ${drag}`,
      };
    case "leading":
      return {
        ...base,
        top: "50%",
        left: `calc(${pad}px + env(safe-area-inset-left, 0px))`,
        transform: `translateY(-50%) ${drag}`,
      };
    case "trailing":
      return {
        ...base,
        top: "50%",
        right: `calc(${pad}px + env(safe-area-inset-right, 0px))`,
        transform: `translateY(-50%) ${drag}`,
      };
  }
}

/* ------------------------------------------------------------------ */
/* Puck (minimized) view                                              */
/* ------------------------------------------------------------------ */

function PuckView({
  dark,
  nib,
  ink,
  onOpen,
}: {
  dark: boolean;
  nib: NibKind;
  ink: string;
  onOpen: () => void;
}) {
  const dot = NIB_PUCK_DOT[nib];
  return (
    <GlassPanel radius={999} dark={dark} tint={0.6} className="tool-pill__puck-glass">
      <button
        type="button"
        className="tool-pill__puck-button"
        aria-label={`Show tools (${NIB_LABEL[nib]} nib)`}
        onClick={onOpen}
      >
        {nib === "eraser" ? (
          <EraserIcon tint={dark ? "#f5f3ee" : "#14141a"} />
        ) : (
          <span className="tool-pill__puck-dot" style={{ width: dot, height: dot, background: ink }} />
        )}
      </button>
    </GlassPanel>
  );
}

/* ------------------------------------------------------------------ */
/* Full (resting) view                                                */
/* ------------------------------------------------------------------ */

interface FullViewProps {
  dark: boolean;
  tint: string;
  inks: string[];
  nib: NibKind;
  onNibChange: (n: NibKind) => void;
  inkIndex: number;
  onInkChange: (i: number) => void;
  isHorizontal: boolean;
  onMinimize: () => void;
  onUndoClick: () => void;
  onUndoPointerDown: () => void;
  onUndoPointerUp: () => void;
  popover: PopoverKind | null;
  setPopover: (p: PopoverKind | null) => void;
}

function FullView({
  dark,
  tint,
  inks,
  nib,
  onNibChange,
  inkIndex,
  onInkChange,
  isHorizontal,
  onMinimize,
  onUndoClick,
  onUndoPointerDown,
  onUndoPointerUp,
  popover,
  setPopover,
}: FullViewProps) {
  return (
    <GlassPanel radius={999} dark={dark} tint={0.6} className={`tool-pill__full-glass ${isHorizontal ? "is-row" : "is-column"}`}>
      {NIB_ORDER.map((n) => {
        const selected = n === nib;
        return (
          <button
            key={n}
            type="button"
            className="tool-pill__nib-button"
            aria-label={NIB_LABEL[n]}
            aria-pressed={selected}
            onClick={() => {
              if (selected && n !== "eraser") {
                setPopover(popover?.type === "nib" && popover.nib === n ? null : { type: "nib", nib: n });
              } else {
                onNibChange(n);
              }
            }}
          >
            {selected && <span className="tool-pill__nib-fill" style={{ background: withAlpha(tint, 0.12) }} />}
            {n === "eraser" ? (
              <EraserIcon tint={withAlpha(tint, selected ? 1 : 0.58)} />
            ) : (
              <span
                className="tool-pill__nib-dot"
                style={{
                  width: NIB_BUTTON_DOT[n],
                  height: NIB_BUTTON_DOT[n],
                  background: withAlpha(tint, selected ? 1 : 0.58),
                }}
              />
            )}
          </button>
        );
      })}

      <Divider tint={tint} isHorizontal={isHorizontal} />

      {inks.map((color, i) => {
        const selected = i === inkIndex;
        return (
          <button
            key={`${color}-${i}`}
            type="button"
            className="tool-pill__ink-button"
            aria-label={`Ink ${i + 1}`}
            aria-pressed={selected}
            onClick={() => onInkChange(i)}
          >
            {selected && (
              <span
                className="tool-pill__ink-selected-ring"
                style={{ border: `1.5px solid ${withAlpha(tint, 0.9)}` }}
              />
            )}
            <span
              className="tool-pill__ink-swatch"
              style={{ background: color, border: `1px solid ${ringFor(color)}`, boxShadow: `0 0 0 1px ${withAlpha(tint, 0.14)}` }}
            />
          </button>
        );
      })}

      <Divider tint={tint} isHorizontal={isHorizontal} />

      <button
        type="button"
        className="tool-pill__action-button"
        aria-label="Undo (long-press to start over)"
        onPointerDown={onUndoPointerDown}
        onPointerUp={onUndoPointerUp}
        onPointerLeave={onUndoPointerUp}
        onClick={onUndoClick}
      >
        <UndoIcon tint={withAlpha(tint, 0.78)} />
      </button>
      <button
        type="button"
        className="tool-pill__action-button"
        aria-label="Add a sticker"
        aria-pressed={popover?.type === "stickers"}
        onClick={() => setPopover(popover?.type === "stickers" ? null : { type: "stickers" })}
      >
        <StickerIcon tint={withAlpha(tint, 0.78)} />
      </button>
      <button
        type="button"
        className="tool-pill__action-button"
        aria-label="Minimize tools"
        onClick={onMinimize}
      >
        <MinimizeIcon tint={withAlpha(tint, 0.78)} />
      </button>
    </GlassPanel>
  );
}

function Divider({ tint, isHorizontal }: { tint: string; isHorizontal: boolean }) {
  return (
    <div
      className="tool-pill__divider"
      style={{
        width: isHorizontal ? 1 : 20,
        height: isHorizontal ? 20 : 1,
        background: withAlpha(tint, 0.12),
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Nib settings popover                                                */
/* ------------------------------------------------------------------ */

function NibPopover({
  dark,
  tint,
  nib,
  edge,
  compact,
  onDismiss,
}: {
  dark: boolean;
  tint: string;
  nib: NibKind;
  edge: PaletteEdge;
  compact: boolean;
  onDismiss: () => void;
}) {
  const arrow = edgeArrowSide(edge);

  if (compact) {
    return (
      <>
        <div className="tool-pill__sheet-scrim" onClick={onDismiss} />
        <div className="tool-pill__sheet">
          <GlassPanel radius={20} dark={dark} tint={0.6} className="tool-pill__sheet-glass">
            <PopoverContent tint={tint} nib={nib} />
          </GlassPanel>
        </div>
      </>
    );
  }

  return (
    <div className={`tool-pill__popover tool-pill__popover--${arrow}`}>
      <GlassPanel radius={16} dark={dark} tint={0.6} className="tool-pill__popover-glass">
        <PopoverContent tint={tint} nib={nib} />
      </GlassPanel>
    </div>
  );
}

function PopoverContent({ tint, nib }: { tint: string; nib: NibKind }) {
  return (
    <div className="tool-pill__popover-content">
      <div
        className="tool-pill__popover-label"
        style={{ ...micro(10), letterSpacing: 1.4, color: withAlpha(tint, 0.6), textTransform: "uppercase" }}
      >
        {NIB_LABEL[nib]}
      </div>
      <div className="tool-pill__popover-blurb" style={{ ...labelFont(13), color: withAlpha(tint, 0.75) }}>
        {NIB_BLURB[nib]}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sticker popover — anchored to the pill exactly like NibPopover, so it  */
/* opens next to wherever the pill actually is instead of screen-center. */
/* ------------------------------------------------------------------ */

function StickerPopover({
  dark,
  edge,
  compact,
  hasSignature,
  onPickEmoji,
  onAddSticky,
  onAddSignature,
}: {
  dark: boolean;
  edge: PaletteEdge;
  compact: boolean;
  hasSignature: boolean;
  onPickEmoji: (emoji: string) => void;
  onAddSticky: (color: string) => void;
  onAddSignature?: () => void;
}) {
  const arrow = edgeArrowSide(edge);
  const textColor = dark ? "#f5f3ee" : "#14141a";

  const content = (
    <div className="tool-pill__sticker-content">
      <p className="tool-pill__sticker-label" style={{ ...micro(10), letterSpacing: 1.2, color: withAlpha(textColor, 0.55) }}>
        EMOJI
      </p>
      <div className="tool-pill__sticker-grid">
        {EMOJI_SET.map((emoji) => (
          <button key={emoji} className="tool-pill__sticker-emoji" onClick={() => onPickEmoji(emoji)} aria-label={`Add ${emoji}`}>
            {emoji}
          </button>
        ))}
      </div>

      <div className="tool-pill__divider" style={{ width: "100%", height: 1, background: withAlpha(textColor, 0.12) }} />

      <p className="tool-pill__sticker-label" style={{ ...micro(10), letterSpacing: 1.2, color: withAlpha(textColor, 0.55) }}>
        STICKY NOTE
      </p>
      <div className="tool-pill__sticker-swatches">
        {STICKY_COLORS.map((color) => (
          <button
            key={color}
            className="tool-pill__sticker-swatch"
            style={{ background: color }}
            onClick={() => onAddSticky(color)}
            aria-label="Add sticky note"
          />
        ))}
      </div>

      {hasSignature && onAddSignature && (
        <>
          <div className="tool-pill__divider" style={{ width: "100%", height: 1, background: withAlpha(textColor, 0.12) }} />
          <button
            className="tool-pill__sticker-signature"
            style={{ color: textColor, background: withAlpha(textColor, 0.06) }}
            onClick={onAddSignature}
          >
            ✎ Stamp my signature
          </button>
        </>
      )}
    </div>
  );

  if (compact) {
    return (
      <div className="tool-pill__sheet">
        <GlassPanel radius={20} dark={dark} tint={0.6} className="tool-pill__sheet-glass tool-pill__sticker-glass">
          {content}
        </GlassPanel>
      </div>
    );
  }

  return (
    <div className={`tool-pill__popover tool-pill__popover--${arrow}`}>
      <GlassPanel radius={20} dark={dark} tint={0.6} className="tool-pill__popover-glass tool-pill__sticker-glass">
        {content}
      </GlassPanel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

function UndoIcon({ tint }: { tint: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 7L4 12L9 17"
        stroke={tint}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 12H14.5C17.5376 12 20 14.4624 20 17.5C20 20.5376 17.5376 23 14.5 23"
        stroke={tint}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(0 -6)"
      />
    </svg>
  );
}

function StickerIcon({ tint }: { tint: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke={tint} strokeWidth={2} />
      <circle cx="9" cy="10" r="1.2" fill={tint} />
      <circle cx="15" cy="10" r="1.2" fill={tint} />
      <path d="M8 14.5C9 16.2 15 16.2 16 14.5" stroke={tint} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

function EraserIcon({ tint }: { tint: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M18.5 13.5L10 22H5.5L2.5 19L13 8.5L18.5 13.5Z"
        fill={tint}
        opacity={0.18}
        stroke={tint}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path d="M13 8.5L18.5 3 22 6.5 16.5 12" stroke={tint} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <path d="M5.5 22H18.5" stroke={tint} strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

function MinimizeIcon({ tint }: { tint: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9.5" stroke={tint} strokeWidth={2} />
      <path d="M7.5 12H16.5" stroke={tint} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}
