import type { ReactNode, CSSProperties } from "react";
import type { Theme, Mood } from "../theme/Theme";
import { surfaceColour } from "../theme/surfaceColor";

const RADIUS = 26;

interface GlassCardProps {
  theme: Theme;
  /** Station passes false in writing/leaving — the card becomes the whole
   * screen, so cropping/border/shadow would just be wrong. */
  framed?: boolean;
  /** Skips the native mood-based quiet/expressive switch and always uses
   * the glass treatment — for screens we designed ourselves rather than
   * ported from a spec (Setup), where a consistently glassy look matters
   * more than matching a "quiet" paper theme's flatter native card. */
  forceGlass?: boolean;
  children: ReactNode | ((surface: string) => ReactNode);
  className?: string;
  style?: CSSProperties;
}

function variantFor(framed: boolean, mood: Mood, forceGlass: boolean): "bleed" | "quiet" | "expressive" {
  if (!framed) return "bleed";
  if (forceGlass) return "expressive";
  return mood === "quiet" ? "quiet" : "expressive";
}

/** Ported 1:1 from GlassCard.swift's three render paths. Native uses
 * `.ultraThinMaterial` here, not Liquid Glass — this component's fidelity
 * target is the blur+tint card look, not refraction. */
export function GlassCard({ theme, framed = true, forceGlass = false, children, className, style }: GlassCardProps) {
  const mood: Mood = theme.surface.kind === "paper" || theme.surface.kind === "colour" ? "quiet" : "expressive";
  const variant = variantFor(framed, mood, forceGlass);
  const surface = surfaceColour(theme.cardTint, theme.isDark);
  const content = typeof children === "function" ? children(surface) : children;
  // A caller-supplied radius (Station animates this between 26 and 0)
  // must win over the fixed default — it must not be silently discarded
  // by the variant styles spread after `...style` below.
  const radius = style?.borderRadius ?? RADIUS;
  // Absolute+inset content only makes sense when the caller supplies an
  // explicit height (Station always does, animating it directly) — an
  // absolutely-positioned child never contributes to its parent's
  // auto-height, so without one this collapses to 0px. Found by testing:
  // Setup passes no height at all and its whole card silently vanished.
  const hasExplicitHeight = style?.height != null;

  if (variant === "bleed") {
    return (
      <div className={className} style={{ ...style, background: theme.cardTint, position: "relative" }}>
        {content}
      </div>
    );
  }

  if (variant === "quiet") {
    return (
      <div
        className={className}
        style={{
          ...style,
          position: "relative",
          borderRadius: radius,
          background: theme.cardTint,
          border: `1px solid ${theme.isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
          boxShadow: `0 10px 22px ${theme.isDark ? "rgba(0,0,0,0.32)" : "rgba(0,0,0,0.055)"}`,
          overflow: "hidden",
        }}
      >
        {content}
      </div>
    );
  }

  // expressive
  return (
    <div
      className={className}
      style={{
        ...style,
        position: "relative",
        borderRadius: radius,
        overflow: "hidden",
        boxShadow: [
          "0 2px 2px rgba(0,0,0,0.16)",
          "0 5px 5px rgba(0,0,0,0.13)",
          "0 11px 12px rgba(0,0,0,0.10)",
          "0 24px 30px rgba(0,0,0,0.09)",
        ].join(", "),
      }}
    >
      <div style={{ position: "absolute", inset: 0, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }} />
      <div style={{ position: "absolute", inset: 0, background: theme.cardTint, opacity: 0.9 }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(to bottom, ${theme.isDark ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.55)"} 0%, transparent 55%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: radius,
          border: "1px solid transparent",
          background: `linear-gradient(to bottom, ${theme.isDark ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.95)"}, ${
            theme.isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.10)"
          }) border-box`,
          WebkitMask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          pointerEvents: "none",
        }}
      />
      <div style={hasExplicitHeight ? { position: "absolute", inset: 0, zIndex: 1 } : { position: "relative", zIndex: 1 }}>
        {content}
      </div>
    </div>
  );
}
