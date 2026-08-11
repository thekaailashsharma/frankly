import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { nanoid } from "nanoid";
import { InkCanvas } from "../ink/InkCanvas";
import { ThemeBackdrop } from "../theme/ThemeBackdrop";
import { GlassPanel } from "../glass/GlassPanel";
import { useEventStore } from "../store/EventStore";
import { useElementSize } from "../theme/useElementSize";
import * as Typography from "../tokens/Typography";
import { saveSignature, markSignatureAsked } from "../storage/db";
import { inksFor } from "../theme/InkPalette";
import { PAPER, PAPER_INK } from "../tokens/tokens";
import type { Stroke, Note } from "../ink/types";
import "./SignatureOnboarding.css";

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Ported 1:1 from SignatureOnboarding.swift — shown once per device,
 * ever, before the first write. Skippable, and skipping is remembered so
 * it never asks twice. */
export function SignatureOnboarding() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const store = useEventStore();
  const { ref, size } = useElementSize<HTMLDivElement>();
  const compact = size.width > 0 && size.width < 700;
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [saving, setSaving] = useState(false);

  const theme = store.theme;
  const tint = theme.inks[0];
  // The ink pad is pinned to a fixed light paper tone (see .signature-onboarding__pad),
  // not the theme's own (often dark) surface — so the pen colour must be
  // contrast-checked against THAT paper, not picked raw from theme.inks. Dark
  // themes' inks[0] is a near-white accent meant for a dark backdrop; drawn
  // raw on the pale pad it was invisible, which is exactly the "white on
  // white" signature bug reported.
  const padInks = useMemo(() => inksFor(theme, PAPER), [theme]);

  function proceed() {
    navigate(`/event/${eventId}/station`);
  }

  function skip() {
    markSignatureAsked();
    proceed();
  }

  async function confirm() {
    if (strokes.length === 0) {
      skip();
      return;
    }
    setSaving(true);
    const note: Note = {
      id: nanoid(),
      strokes,
      canvasWidth: padWidth,
      canvasHeight: padHeight,
      createdAt: Date.now(),
    };
    await saveSignature(note);
    proceed();
  }

  const padWidth = size.width > 0 ? Math.min(size.width - (compact ? 48 : 140), 720) : 0;
  const padHeight = compact ? 140 : 180;

  return (
    <div className="screen screen--fixed signature-onboarding" ref={ref}>
      {/* usePhoto (removed) — same call as Setup/Station: the photo read
       * as flat colour next to the actual animated GeneratedSurface. */}
      <ThemeBackdrop theme={theme} calm={0.4} className="signature-onboarding__backdrop" />

      <div className="signature-onboarding__body" style={{ padding: `0 ${compact ? 24 : 70}px`, gap: compact ? 26 : 40 }}>
        <div className="signature-onboarding__heading" style={{ gap: 10 }}>
          <h1 style={{ ...Typography.editorial(compact ? 38 : 56), color: tint, margin: 0 }}>Sign once.</h1>
          <p style={{ ...Typography.label(compact ? 14 : 16), color: withAlpha(tint, 0.55), margin: 0 }}>
            We'll use it whenever you need it. It stays on this device.
          </p>
        </div>

        {/* A glass frame around the paper insert — the paper itself stays
         * flat/opaque (that's what the ink-contrast fix above assumes),
         * but the frame around it is real Liquid Glass, so this reads as
         * an object floating on the backdrop rather than a flat rectangle
         * pasted over it. */}
        <GlassPanel radius={24} tint={0.1} style={{ width: padWidth || "100%" }} className="signature-onboarding__frame">
          <div className="signature-onboarding__pad" style={{ height: padHeight }}>
            <InkCanvas
              strokes={strokes}
              palette={padInks}
              activeNib="fine"
              activeInkIndex={0}
              onStrokeComplete={(s) => setStrokes((prev) => [...prev, s])}
            />
            <div
              className="signature-onboarding__rule"
              style={{ background: withAlpha(PAPER_INK, 0.22), bottom: padHeight * 0.24 }}
            />
          </div>
        </GlassPanel>

        <GlassPanel radius={999} tint={theme.isDark ? 0.16 : 0.4} style={{ width: padWidth || "100%" }} className="signature-onboarding__actions">
          <button className="signature-onboarding__skip" style={{ color: withAlpha(tint, 0.7) }} onClick={skip}>
            Skip
          </button>
          <div style={{ flex: 1 }} />
          {strokes.length > 0 && (
            <button
              className="signature-onboarding__clear"
              style={{ color: withAlpha(tint, 0.7) }}
              onClick={() => setStrokes([])}
            >
              Clear
            </button>
          )}
          <button
            className="signature-onboarding__confirm"
            disabled={saving || strokes.length === 0}
            style={{
              background: tint,
              color: theme.isDark ? "#000" : "#fff",
              opacity: strokes.length === 0 ? 0.3 : 1,
            }}
            onClick={confirm}
          >
            That's me
          </button>
        </GlassPanel>
      </div>
    </div>
  );
}
