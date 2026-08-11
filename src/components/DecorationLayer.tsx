import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Decoration } from "../ink/types";
import "./DecorationLayer.css";

interface DecorationLayerProps {
  decorations: Decoration[];
  /** Station passes true while composing — drag, delete, edit sticky text.
   * Wall/Artifact/anywhere a note is just being shown pass false (or omit
   * it) and get a plain, non-interactive render. */
  editable?: boolean;
  onChange?: (next: Decoration[]) => void;
}

/**
 * Renders a note's placed decorations (emoji, sticky notes, signature
 * stamps) — positioned as fractions of whatever box this is mounted
 * inside, so the same decoration list looks right whether it's drawn at
 * full Station size or shrunk into a Wall tile.
 */
export function DecorationLayer({ decorations, editable = false, onChange }: DecorationLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const dragState = useRef<{ id: string; pointerId: number } | null>(null);

  function update(id: string, patch: Partial<Decoration>) {
    onChange?.(decorations.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function remove(id: string) {
    onChange?.(decorations.filter((d) => d.id !== id));
    setSelectedId(null);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>, id: string) {
    if (!editable) return;
    e.stopPropagation();
    setSelectedId(id);
    dragState.current = { id, pointerId: e.pointerId };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragState.current;
    const container = containerRef.current;
    if (!drag || drag.pointerId !== e.pointerId || !container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    update(drag.id, { x, y });
  }

  function endDrag() {
    dragState.current = null;
  }

  return (
    <div ref={containerRef} className="decoration-layer" onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
      {decorations.map((d) => {
        const style = {
          left: `${d.x * 100}%`,
          top: `${d.y * 100}%`,
          transform: `translate(-50%, -50%) rotate(${d.rotation}deg) scale(${d.scale})`,
        };
        const selected = editable && selectedId === d.id;

        if (d.kind === "emoji") {
          return (
            <div
              key={d.id}
              className={`decoration decoration--emoji ${selected ? "is-selected" : ""}`}
              style={style}
              onPointerDown={(e) => onPointerDown(e, d.id)}
            >
              <span className={`decoration__emoji-glyph decoration__emoji-glyph--${animationFor(d.emoji)}`}>{d.emoji}</span>
              {selected && <DeleteBadge onClick={() => remove(d.id)} />}
            </div>
          );
        }

        if (d.kind === "sticky") {
          const editing = editingId === d.id;
          return (
            <div
              key={d.id}
              className={`decoration decoration--sticky ${selected ? "is-selected" : ""}`}
              style={{ ...style, background: d.color }}
              onPointerDown={(e) => onPointerDown(e, d.id)}
              onDoubleClick={() => editable && setEditingId(d.id)}
            >
              {editing ? (
                <textarea
                  className="decoration__sticky-input"
                  autoFocus
                  value={d.text ?? ""}
                  maxLength={80}
                  onChange={(e) => update(d.id, { text: e.target.value })}
                  onBlur={() => setEditingId(null)}
                  onPointerDown={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="decoration__sticky-text">{d.text || (editable ? "Tap to edit" : "")}</span>
              )}
              {selected && !editing && <DeleteBadge onClick={() => remove(d.id)} />}
            </div>
          );
        }

        // stamp
        return (
          <div
            key={d.id}
            className={`decoration decoration--stamp ${selected ? "is-selected" : ""}`}
            style={style}
            onPointerDown={(e) => onPointerDown(e, d.id)}
          >
            <img src={d.imageDataUrl} alt="Signature" draggable={false} />
            {selected && <DeleteBadge onClick={() => remove(d.id)} />}
          </div>
        );
      })}
    </div>
  );
}

function DeleteBadge({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="decoration__delete"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label="Remove"
    >
      ×
    </button>
  );
}

/** Every emoji in the set animates, but not all the same way — a heart
 * beats, a star spins, a wave rocks. Matching the motion to the glyph is
 * what makes the tray feel considered rather than one keyframe stamped
 * on ten unrelated icons. */
const ANIMATION_BY_EMOJI: Record<string, string> = {
  "❤️": "heartbeat",
  "🔥": "flicker",
  "⭐": "spin",
  "✨": "twinkle",
  "🎉": "pop",
  "👏": "clap",
  "😂": "wobble",
  "🙌": "bounce",
  "💯": "pulse",
  "🌊": "sway",
};

function animationFor(emoji?: string): string {
  return ANIMATION_BY_EMOJI[emoji ?? ""] ?? "bounce";
}
