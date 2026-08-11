import { useMemo } from "react";
import { useEventStore } from "../store/EventStore";
import { coverById, deadZoneAlignment, type Cover, type DeadZone } from "../theme/Cover";
import { relativeLuminance } from "../theme/color";
import { hex } from "../theme/Theme";
import { poster as posterFont, label as labelFont, micro as microFont } from "../tokens/Typography";
import { useElementSize } from "../theme/useElementSize";
import "./Poster.css";

interface Size {
  width: number;
  height: number;
}

/** Ported 1:1 from Poster.swift — decides whether the backdrop needs a
 * directional wash so the title stays legible on busy/tall crops. */
function needsWash(size: Size): boolean {
  return size.width < 760 || size.height / Math.max(size.width, 1) > 1.45;
}

/** Ported 1:1 from Poster.swift — the huge display-word size. */
function displaySize(name: string, cover: Cover | null, size: Size): number {
  const n = Math.max(1, name.length);
  const measure = cover?.deadZone === "top" ? 0.68 : 0.8;
  const toFillWidth = (size.width * measure) / (n * 0.52);
  const heightCap = size.height * (size.width < 700 ? 0.13 : 0.26);
  return Math.min(toFillWidth, heightCap);
}

/** Ported 1:1 from Poster.swift — ink colour for title/labels. */
function foregroundColour(cover: Cover | null, themePoster: string): string {
  if (cover) return cover.ink;
  return relativeLuminance(themePoster) > 0.32 ? hex(0x141419) : hex(0xf4f1e8);
}

function washGradientDirection(zone: DeadZone | undefined): string {
  switch (zone) {
    case "top":
      return "to bottom";
    case "bottomLeading":
      return "to top";
    case "leading":
      return "to right";
    default:
      return "to bottom right";
  }
}

function washGradient(washColour: string, zone: DeadZone | undefined): string {
  const direction = washGradientDirection(zone);
  return `linear-gradient(${direction}, ${washColour}D4 0%, ${washColour}8C 22%, ${washColour}1F 48%, transparent 70%)`;
}

export function Poster() {
  const { theme, mode, name, prompt, count, isClosed } = useEventStore();
  const { ref, size } = useElementSize<HTMLDivElement>();

  const cover = coverById(theme.cover);
  const compact = size.width < 700;
  const margin = size.width * (compact ? 0.075 : 0.058);
  const inset = size.height * (compact ? 0.07 : 0.058);

  const foreground = useMemo(() => foregroundColour(cover, theme.poster), [cover, theme.poster]);
  const centred = cover?.deadZone === "top";
  const size_ = displaySize(name, cover, size);
  const showWash = !!cover && needsWash(size);
  const washColour = relativeLuminance(foreground) > 0.4 ? "#000000" : "#FBF7EE";
  const liftColour = cover && relativeLuminance(cover.ink) > 0.4 ? "#000000" : "#ffffff";

  const layoutAlign = cover ? deadZoneAlignment(cover.deadZone) : { justify: "center", align: "center" };

  return (
    <div ref={ref} className="poster">
      {/* Background */}
      <div className="poster__bg">
        {cover ? (
          <>
            <img src={`/covers/${cover.asset}`} alt="" className="poster__bg-img" />
            {cover.lift > 0.001 && (
              <div
                className="poster__lift"
                style={{ backgroundColor: liftColour, opacity: cover.lift, mixBlendMode: "overlay" }}
              />
            )}
            {showWash && (
              <div className="poster__wash" style={{ background: washGradient(washColour, cover.deadZone) }} />
            )}
          </>
        ) : (
          <div className="poster__bg-flat" style={{ background: theme.poster }} />
        )}
      </div>

      {/* Title block. Top-anchored dead zones (topLeading/top) share their
       * corner with the mode/collecting label above — found by testing:
       * both start at the same (inset, margin) point and the title's own
       * huge font simply painted over the label. Extra top clearance only
       * applies when the title is actually top-anchored; bottom-anchored
       * covers never had this collision. */}
      <div
        className="poster__title-layer"
        style={{
          padding: `${inset}px ${margin}px`,
          paddingTop: layoutAlign.align === "flex-start" ? inset + 34 : inset,
          justifyContent: layoutAlign.justify,
          alignItems: layoutAlign.align,
        }}
      >
        <div
          className="poster__title-block"
          style={{ gap: compact ? 8 : 12, textAlign: centred ? "center" : "left" }}
        >
          <div
            className="poster__name"
            style={{
              ...posterFont(size_, true),
              color: foreground,
              lineHeight: 0.86,
            }}
          >
            {name}
          </div>
          {prompt && (
            <div
              className="poster__prompt"
              style={{
                ...labelFont(compact ? 13 : 15),
                color: foreground,
                opacity: 0.66,
                maxWidth: size.width * (centred ? 0.56 : 0.44),
              }}
            >
              {prompt}
            </div>
          )}
        </div>
      </div>

      {/* Edge labels */}
      <div className="poster__edges" style={{ inset: `${inset}px ${margin}px` }}>
        <div
          className="poster__edge poster__edge--tl"
          style={{ ...microFont(10), color: foreground, letterSpacing: 1.7 }}
        >
          <span>{mode === "candid" ? "CANDID" : "KEEPSAKE"}</span>
          <span>{isClosed ? "CLOSED" : "COLLECTING"}</span>
        </div>
        <div
          className="poster__edge poster__edge--tr"
          style={{ ...microFont(10), color: foreground, letterSpacing: 1.7 }}
        >
          <span>{String(count).padStart(2, "0")} / NOTES</span>
        </div>
        <div
          className="poster__edge poster__edge--bl"
          style={{ ...microFont(10), color: foreground, letterSpacing: 1.7 }}
        >
          <span>FRANKLY</span>
        </div>
        <div
          className="poster__edge poster__edge--br"
          style={{ ...microFont(10), color: foreground, letterSpacing: 1.7 }}
        >
          <span>{cover ? cover.id.toUpperCase() : ""}</span>
        </div>
      </div>
    </div>
  );
}
