import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NotePreview } from "../components/NotePreview";
import { useEventStore } from "../store/EventStore";
import { inksFor } from "../theme/InkPalette";
import { PAPER } from "../tokens/tokens";
import type { Note } from "../ink/types";
import "./Wall.css";

/**
 * A ritual, not a library — refuses the uniform grid on purpose. Masonry
 * columns preserve each note's own shape instead of cropping handwriting
 * to a square, and there's no infinite scroll: the count is the point.
 *
 * Bonus screen, not one of the four core surfaces — folds in nicely next
 * to the Artifact for a host who wants to browse individual notes rather
 * than the collective piece.
 */
export function Wall() {
  const navigate = useNavigate();
  const store = useEventStore();
  const [openNote, setOpenNote] = useState<Note | null>(null);
  const notes = store.notes.slice().reverse();
  // .wall__card's actual background is the fixed --paper tone, not
  // theme.cardTint — inks were being contrast-checked against the wrong
  // surface, so a dark theme's light "safe" inks (safe against its own
  // dark card) landed on this pale card and vanished. Same class of bug
  // as the signature pad and the Artifact write-back modal, just missed
  // here the first time.
  const palette = inksFor(store.theme, PAPER);

  return (
    <div className="screen screen--scroll wall">
      <div className="wall__header">
        <button className="wall__back" onClick={() => navigate(`/event/${store.event?.id}`)}>
          ← {store.name || "Back"}
        </button>
        <p className="wall__count">
          {notes.length} note{notes.length === 1 ? "" : "s"} so far
        </p>
      </div>

      {notes.length === 0 ? (
        <div className="wall__empty">
          <p>Nothing written yet.</p>
          <p className="wall__empty-sub">The first note here will look better than this sentence.</p>
        </div>
      ) : (
        <div className="wall__columns">
          {notes.map((note) => (
            <button key={note.id} className="wall__card" onClick={() => setOpenNote(note)}>
              {note.authorName && <p className="wall__card-author">{note.authorName}</p>}
              <NotePreview note={note} palette={palette} />
            </button>
          ))}
        </div>
      )}

      {openNote && (
        <div className="wall__lightbox" onClick={() => setOpenNote(null)}>
          <div className="wall__lightbox-card" onClick={(e) => e.stopPropagation()}>
            {openNote.authorName && <p className="wall__card-author">{openNote.authorName}</p>}
            <NotePreview note={openNote} palette={palette} />
          </div>
        </div>
      )}
    </div>
  );
}
