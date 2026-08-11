import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Theme } from "./Theme";
import { moodOf } from "./Theme";
import { coverById } from "./Cover";
import { ColourField } from "./ColourField";
import { GhostInkLayer } from "./GhostInkLayer";
import { GeneratedSurface } from "./webgl/GeneratedSurface";
import { useElementSize } from "./useElementSize";
import type { Note } from "../ink/types";

interface ThemeBackdropProps {
  theme: Theme;
  calm: number;
  bloom?: number;
  ghostNotes?: Note[];
  usePhoto?: boolean;
  reducedMotion?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Ported 1:1 from ThemeBackdrop.swift — dispatches to a flat paper fill,
 * the HSL colour field, or one of the three generated GPU surfaces,
 * optionally replaced entirely by a drifting photographic cover; then
 * layers a vignette (expressive themes only) and a submit "bloom" flash
 * on top of whichever of those is active.
 */
export function ThemeBackdrop({
  theme,
  calm,
  bloom = 0,
  ghostNotes = [],
  usePhoto = false,
  reducedMotion = false,
  className,
  style,
}: ThemeBackdropProps) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const effectiveCalm = Math.max(0, calm - bloom * 0.85);
  const cover = usePhoto ? coverById(theme.cover) : null;
  const mood = moodOf(theme.surface);

  return (
    <div ref={ref} className={className} style={{ position: "absolute", inset: 0, overflow: "hidden", ...style }}>
      {cover ? (
        <PhotoBackdrop cover={cover} theme={theme} calm={effectiveCalm} reducedMotion={reducedMotion} ghostNotes={ghostNotes} />
      ) : (
        <>
          {theme.surface.kind === "paper" && (
            <>
              <div style={{ position: "absolute", inset: 0, background: theme.surface.colour }} />
              <GhostInkLayer notes={ghostNotes} ink={theme.inks[0]} />
            </>
          )}
          {theme.surface.kind === "colour" && <ColourField colour={theme.surface.colour} calm={effectiveCalm} />}
          {(theme.surface.kind === "contour" || theme.surface.kind === "marble" || theme.surface.kind === "bokeh") && (
            <GeneratedSurface surface={theme.surface} seed={theme.seed} calm={effectiveCalm} reducedMotion={reducedMotion} />
          )}
        </>
      )}

      {mood === "expressive" && size.width > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at center, transparent ${Math.min(size.width, size.height) * 0.28}px, ${
              theme.isDark ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.14)"
            } ${Math.max(size.width, size.height) * 0.78}px)`,
          }}
        />
      )}

      {bloom > 0.001 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: theme.isDark ? "#fff" : "#000",
            opacity: bloom * (theme.isDark ? 0.1 : 0.05),
            mixBlendMode: "overlay",
          }}
        />
      )}
    </div>
  );
}

function PhotoBackdrop({
  cover,
  theme,
  calm,
  reducedMotion,
  ghostNotes,
}: {
  cover: NonNullable<ReturnType<typeof coverById>>;
  theme: Theme;
  calm: number;
  reducedMotion: boolean;
  ghostNotes: Note[];
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [, forceTick] = useState(0);
  const startRef = useRef(performance.now());
  const { ref, size } = useElementSize<HTMLDivElement>();

  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    let last = 0;
    const INTERVAL = 1000 / 20; // 20fps, matching the native photo-drift refresh
    function tick(now: number) {
      if (now - last >= INTERVAL) {
        last = now;
        const t = ((now - startRef.current) / 1000) * 0.02;
        if (imgRef.current) {
          imgRef.current.style.transform = `scale(1.18) translate(${Math.sin(t) * 14}px, ${Math.cos(t * 0.8) * 10}px)`;
        }
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  useEffect(() => {
    forceTick((n) => n + 1); // ensure size is measured after mount
  }, []);

  const ink = theme.isDark ? "#ffffff" : "#000000";
  const scrimOpacity = theme.isDark ? 0.52 : 0.2;
  const falloffColour = theme.isDark ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.28)";

  return (
    <div ref={ref} style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <img
        ref={imgRef}
        src={`/covers/${cover.asset}`}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: `blur(34px) saturate(${0.85 - calm * 0.45})`,
          transform: "scale(1.18)",
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: "#000", opacity: scrimOpacity }} />
      {size.width > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at center, transparent ${Math.min(size.width, size.height) * 0.22}px, ${falloffColour} ${
              Math.max(size.width, size.height) * 0.8
            }px)`,
          }}
        />
      )}
      <GhostInkLayer notes={ghostNotes} ink={ink} maxOpacity={0.05} />
    </div>
  );
}
