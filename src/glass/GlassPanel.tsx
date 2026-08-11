import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode, CSSProperties } from "react";
import { generateDisplacementMap } from "./generateDisplacementMap";
import { useTheme } from "../tokens/ThemeProvider";
import "./GlassPanel.css";

interface GlassPanelProps {
  children: ReactNode;
  radius?: number;
  className?: string;
  style?: CSSProperties;
  /** How strong the tint over the blur is — 0 reads as nearly clear glass. */
  tint?: number;
  /** Washes the blur with dark instead of white — for a caller that KNOWS
   * what it's floating over (the tool palette always sits on its own
   * writing card, never an unpredictable photo), a dark theme genuinely
   * wants a dark pane of glass, not a bright one with dark icons pasted
   * over it. Defaults to the white wash every other caller already
   * expects. */
  dark?: boolean;
}

/**
 * The tool palette and every floating sheet is built from this.
 *
 * Two effects, deliberately kept separate because they have different
 * browser-support stories:
 *  - `backdrop-filter: blur()/saturate()` — plain CSS functions, universal
 *    support, gives the see-through frost.
 *  - `filter: url(#displacement)` — a real SVG feDisplacementMap, applied
 *    to this element's OWN rendered content (icons, labels, the blurred
 *    backdrop once composited), giving genuine edge lensing. `filter` with
 *    an SVG reference has broad cross-browser support — it is
 *    `backdrop-filter` with a custom reference that's still Chromium-only,
 *    and we never use that combination.
 *
 * Respects `prefers-reduced-transparency` where the platform reports it
 * (Chromium); Safari has no such signal, so host setup exposes the same
 * toggle manually — see HostSetup.
 */
export function GlassPanel({ children, radius = 20, className, style, tint = 0.14, dark = false }: GlassPanelProps) {
  const id = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement>(null);
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const { reducedTransparency } = useTheme();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rebuild = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      setMapUrl(generateDisplacementMap(Math.round(rect.width), Math.round(rect.height), radius));
    };
    rebuild();
    const observer = new ResizeObserver(rebuild);
    observer.observe(el);
    return () => observer.disconnect();
  }, [radius]);

  const filterId = `glass-disp-${id}`;
  const washRgb = dark ? "20,20,26" : "255,255,255";

  return (
    <div
      ref={ref}
      className={`glass-panel ${dark ? "glass-panel--dark" : ""} ${className ?? ""}`}
      style={{
        ...style,
        borderRadius: radius,
        backgroundColor: `rgba(${washRgb},${reducedTransparency ? Math.max(tint, 0.7) : tint})`,
        // Was blur(20px) saturate(1.5) — a touch of contrast is what turns
        // "blurry" into "glassy": it keeps the refracted backdrop looking
        // like it has real material behind it instead of washing flat.
        backdropFilter: reducedTransparency ? "none" : "blur(24px) saturate(1.8) contrast(1.08)",
        WebkitBackdropFilter: reducedTransparency ? "none" : "blur(24px) saturate(1.8) contrast(1.08)",
        filter: mapUrl && !reducedTransparency ? `url(#${filterId})` : undefined,
      }}
    >
      {mapUrl && (
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
          <filter id={filterId} colorInterpolationFilters="sRGB">
            <feImage href={mapUrl} x="0" y="0" width="100%" height="100%" result="map" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={6} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
      )}
      <div className="glass-panel__content">{children}</div>
    </div>
  );
}
