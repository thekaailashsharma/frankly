import { useState } from "react";
import { GlassPanel } from "../glass/GlassPanel";
import { editorial, label as labelFont } from "../tokens/Typography";
import "./AuthorSheet.css";

interface AuthorSheetProps {
  dark: boolean;
  defaultName: string;
  defaultEmail: string;
  onSubmit: (name: string, email: string) => void;
  onSkip: () => void;
}

/**
 * One tasteful stop between "Done" and the note actually landing on the
 * Wall — optional, never a hard gate (skipping submits exactly the same
 * as filling it in), because a feedback tool that blocks submission on a
 * form field stops being anonymous-friendly the moment it does. Remembers
 * what you type for next time (Station.tsx persists it to localStorage)
 * so someone writing three notes in a row for other people only ever
 * types their own name once.
 */
export function AuthorSheet({ dark, defaultName, defaultEmail, onSubmit, onSkip }: AuthorSheetProps) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const textColor = dark ? "#f5f3ee" : "#14141a";

  return (
    <div className="author-sheet-scrim" onClick={onSkip}>
      <div className="author-sheet" onClick={(e) => e.stopPropagation()}>
        <GlassPanel radius={24} dark={dark} tint={0.62} className="author-sheet__glass">
          <div className="author-sheet__content">
            <p className="author-sheet__title" style={{ ...editorial(24), color: textColor }}>
              Whose note is this?
            </p>
            <p className="author-sheet__hint" style={{ ...labelFont(13), color: textColor, opacity: 0.6 }}>
              Totally optional — skip if you'd rather stay anonymous.
            </p>

            <input
              className="author-sheet__input"
              style={{ ...labelFont(16), color: textColor }}
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <input
              className="author-sheet__input"
              style={{ ...labelFont(16), color: textColor }}
              placeholder="Email (optional)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <div className="author-sheet__actions">
              <button
                className="author-sheet__skip"
                style={{ color: textColor, opacity: 0.6 }}
                onClick={onSkip}
              >
                Skip
              </button>
              <button
                className="author-sheet__submit"
                style={{ background: textColor, color: dark ? "#14141a" : "#f5f3ee" }}
                onClick={() => onSubmit(name.trim(), email.trim())}
              >
                Add & finish
              </button>
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
