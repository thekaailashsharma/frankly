import { useState } from "react";
import { editorial, label as labelFont } from "../tokens/Typography";
import "./PinGate.css";

interface PinGateProps {
  onUnlock: (pin: string) => Promise<boolean>;
}

/** What `/event/:id/setup` shows when this tab hasn't unlocked Setup yet —
 * the fixed, always-typeable endpoint the PIN model trades a little
 * security for: no link to copy, no query string to remember, just this
 * screen and the 6 digits from when the event was created. */
export function PinGate({ onUnlock }: PinGateProps) {
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);
  const [wrong, setWrong] = useState(false);

  async function submit() {
    if (pin.length < 4 || checking) return;
    setChecking(true);
    setWrong(false);
    const ok = await onUnlock(pin);
    setChecking(false);
    if (!ok) {
      setWrong(true);
      setPin("");
    }
  }

  return (
    <div className="pin-gate">
      <div className="pin-gate__card">
        <p className="pin-gate__title" style={editorial(28)}>
          Setup PIN
        </p>
        <p className="pin-gate__hint" style={labelFont(14)}>
          Shown once, right here, when this event was created.
        </p>
        <input
          className={`pin-gate__input ${wrong ? "is-wrong" : ""}`}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
            setWrong(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          inputMode="numeric"
          autoFocus
          placeholder="••••••"
          maxLength={6}
        />
        {wrong && <p className="pin-gate__error">That's not it — try again.</p>}
        <button className="pin-gate__submit" onClick={submit} disabled={pin.length < 4 || checking}>
          {checking ? "Checking…" : "Unlock"}
        </button>
      </div>
    </div>
  );
}
