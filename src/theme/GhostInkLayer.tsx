import type { Note } from "../ink/types";
import { NoteInkView } from "../components/NoteInkView";

interface GhostInkLayerProps {
  notes: Note[];
  ink: string;
  maxOpacity?: number;
  className?: string;
}

const GOLDEN = 0.6180339887;
const WINDOW = 9;

/**
 * Ported 1:1 from GhostInkLayer.swift — the last 9 notes scattered across
 * the quiet themes' backdrop as a faint wallpaper texture, placed by a
 * deterministic golden-ratio sequence rather than randomly, so the layout
 * is stable across re-renders of the same note history.
 */
export function GhostInkLayer({ notes, ink, maxOpacity = 0.055, className }: GhostInkLayerProps) {
  const window = notes.slice(-WINDOW);
  const count = window.length;
  if (count === 0) return null;

  return (
    <div className={className} style={{ position: "absolute", inset: 0, filter: "blur(0.6px)", pointerEvents: "none" }}>
      {window.map((note, index) => {
        const u = (index * GOLDEN) % 1;
        const v = (index * GOLDEN * 2.3) % 1;
        const widthPct = (0.55 + u * 0.45) * 100;
        const heightPct = widthPct * 0.3;
        const xPct = (0.12 + u * 0.8) * 100;
        const yPct = (0.1 + v * 0.82) * 100;
        const rotation = (u - 0.5) * 7;
        const age = count > 1 ? (count - 1 - index) / (count - 1) : 0;
        const opacity = maxOpacity * (1 - age * 0.66);

        return (
          <NoteInkView
            key={note.id}
            note={note}
            palette={[ink]}
            fitToInkBounds
            style={{
              position: "absolute",
              left: `${xPct}%`,
              top: `${yPct}%`,
              width: `${widthPct}%`,
              height: `${heightPct}%`,
              opacity,
              transform: `rotate(${rotation}deg)`,
              transition: "opacity 1.6s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        );
      })}
    </div>
  );
}
