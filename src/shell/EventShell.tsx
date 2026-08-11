import { useEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getSignature, hasAskedSignature } from "../storage/db";
import { useEventStore } from "../store/EventStore";
import { GlassPanel } from "../glass/GlassPanel";
import { relativeLuminance } from "../theme/color";
import { label as labelFont } from "../tokens/Typography";
import "./EventShell.css";

type Surface = "poster" | "station" | "artifact" | "setup" | "wall";

// These were raw Unicode glyphs (◱ ✎ ▦ ▤ ⚙) before — several of them
// (▦, ▤ especially) aren't in iPadOS's system font and fall back to a
// generic Unicode font that renders as a soft, pixelated bitmap at this
// size, exactly the "blurry icon" photographed on a real device. Actual
// vector SVGs render crisp on every platform, the same way every other
// icon in the app (ToolPill's undo/eraser/sticker icons) already does.
const TABS: { id: Surface; label: string; Icon: (props: { color: string }) => ReactElement }[] = [
  { id: "poster", label: "Poster", Icon: PosterIcon },
  { id: "station", label: "Station", Icon: StationIcon },
  { id: "artifact", label: "Artifact", Icon: ArtifactIcon },
  { id: "wall", label: "Wall", Icon: WallIcon },
  { id: "setup", label: "Setup", Icon: SetupIcon },
];

/** The four core surfaces, plus the bonus Wall — a floating Liquid Glass
 * pill, not a flat docked website navbar: bottom-center on phone widths,
 * top-center on desktop widths, both built on the same GlassPanel (real
 * SVG feDisplacementMap refraction, not a flat blur rectangle) every other
 * floating control in the app already uses. Hidden entirely on Station
 * and the signature interstitial, which are full-bleed kiosk experiences
 * with their own exit control. */
export function EventShell({ children }: { children: ReactNode }) {
  const { eventId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { theme, isHost } = useEventStore();
  // Setup used to be one tap away for anyone with the event link — the
  // only gate was that nobody happened to click it. Now it only appears
  // while the current URL itself carries a verified `?key=...` (see
  // EventStore.isHost) — tap any other tab and that query string is gone,
  // so this disappears again on the very next page. Exactly the property
  // a shared iPad passed hand to hand needs: nothing about "being host"
  // survives past the one page the secret link pointed at.
  const tabs = isHost ? TABS : TABS.filter((t) => t.id !== "setup");

  const segment = location.pathname.split("/").pop();
  const current: Surface = (["poster", "station", "artifact", "setup", "wall"].includes(segment ?? "")
    ? (segment as Surface)
    : "poster") as Surface;

  // Station used to hide the nav entirely and rely on its own ✕ button —
  // the only way back to Poster/Artifact/etc. was browser-back. Now it
  // keeps the nav, just always pinned to the top (regardless of device):
  // Station's own bottom edge is already busy with the Commit bar and the
  // tool palette, so the nav would collide with them there. Signature is
  // still a true one-shot interstitial with no reason to jump elsewhere.
  const chromeless = segment === "signature";
  const forceTop = current === "station";
  // GlassPanel is structurally a WHITE wash over a blurred backdrop — how
  // dark it reads in practice depends on whatever's actually behind it at
  // that spot (a "dark" theme's cover photo can still have a pale sky up
  // top), not on theme.isDark. Picking the icon colour from theme.isDark
  // made 4 of 5 tabs render white-on-near-white and vanish on Night's
  // Poster screen. Pinning the panel to a reliably bright wash and the
  // icons to a fixed dark tone is what actually guarantees legibility.
  const tint = "#14141a";
  const accent = theme.poster;
  // The active pill's own fill IS the theme accent, which can itself be
  // pale (e.g. Contour's cream poster) — so its label needs its own
  // luminance-checked text colour, independent of the tint above.
  const onAccent = relativeLuminance(accent) > 0.55 ? "#14141a" : "#f7f5f0";

  function goTo(tab: Surface) {
    if (tab === "station") {
      // Was: `await getSignature()` before navigating, with no catch — if
      // that IndexedDB read ever rejected (a real possibility: private
      // browsing, a not-yet-opened DB, a locked-down mobile webview) the
      // whole handler threw and navigate() never ran. Tapping "Station"
      // did nothing, silently, which is exactly what got reported. Now
      // it degrades to "ask for a signature" on any failure instead of
      // going nowhere.
      Promise.resolve(hasAskedSignature() || getSignature())
        .catch(() => false)
        .then((signed) => {
          navigate(signed ? `/event/${eventId}/station` : `/event/${eventId}/signature`);
        });
      return;
    }
    navigate(tab === "poster" ? `/event/${eventId}` : `/event/${eventId}/${tab}`);
  }

  const top = isDesktop || forceTop;
  const navRef = useRef<HTMLElement>(null);
  const [navHeight, setNavHeight] = useState(0);

  // Station's own root is `position: fixed; inset: 0` (the drawing surface
  // needs to be pinned to the true viewport, not whatever box flexbox's
  // layout algorithm would have given it) — which means it paints straight
  // over this flex-reserved nav strip entirely, ignoring the space the nav
  // "took" from the flex column. Its own top-anchored overlay (the
  // ink/type toggle) ended up under the nav's higher z-index, silently
  // eating clicks meant for it. Publishing the nav's real measured height
  // as a CSS variable lets Station's CSS push that overlay below it
  // exactly, instead of guessing a magic-number offset that would drift
  // out of sync the moment either one's padding changes.
  useEffect(() => {
    const el = navRef.current;
    if (!el || chromeless) {
      setNavHeight(0);
      return;
    }
    const observer = new ResizeObserver(([entry]) => setNavHeight(entry.contentRect.height));
    observer.observe(el);
    return () => observer.disconnect();
  }, [chromeless, top]);

  return (
    <div className="event-shell" style={{ "--event-nav-height": `${navHeight}px` } as CSSProperties}>
      <div className={`event-shell__content ${chromeless ? "" : top ? "event-shell__content--top-nav" : "event-shell__content--bottom-nav"}`}>
        {children}
      </div>

      {!chromeless && (
        <nav ref={navRef} className={`event-shell__nav ${top ? "event-shell__nav--top" : "event-shell__nav--bottom"}`}>
          <GlassPanel radius={999} tint={0.62} className="event-shell__glass">
            {tabs.map((tab) => {
              const active = current === tab.id;
              const iconColor = active ? onAccent : withAlpha(tint, 0.62);
              return (
                <button
                  key={tab.id}
                  className="event-shell__tab"
                  style={{ color: active ? onAccent : withAlpha(tint, 0.62) }}
                  onClick={() => goTo(tab.id)}
                  aria-current={active}
                >
                  {active && <span className="event-shell__tab-fill" style={{ background: accent }} />}
                  <span className="event-shell__tab-icon" aria-hidden>
                    <tab.Icon color={iconColor} />
                  </span>
                  <span className="event-shell__tab-label" style={labelFont(13, active)}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </GlassPanel>
        </nav>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Icons — plain vector shapes, sized off the nav's own CSS font-size    */
/* rule rather than an intrinsic size, so they scale exactly like the    */
/* Unicode glyphs they replaced without a second breakpoint to maintain. */
/* ------------------------------------------------------------------ */

function PosterIcon({ color }: { color: string }) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="3" width="16" height="18" rx="2" stroke={color} strokeWidth="1.8" />
      <path d="M8 8h5M8 12h8M8 16h6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function StationIcon({ color }: { color: string }) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20l1-4.5L15.5 5 19 8.5 8.5 19 4 20Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M13 7.5L16.5 11" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ArtifactIcon({ color }: { color: string }) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" stroke={color} strokeWidth="1.8" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" stroke={color} strokeWidth="1.8" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" stroke={color} strokeWidth="1.8" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" stroke={color} strokeWidth="1.8" />
    </svg>
  );
}

function WallIcon({ color }: { color: string }) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="4" width="17" height="4.5" rx="1" stroke={color} strokeWidth="1.8" />
      <rect x="3.5" y="10.5" width="17" height="4.5" rx="1" stroke={color} strokeWidth="1.8" />
      <rect x="3.5" y="17" width="17" height="3" rx="1" stroke={color} strokeWidth="1.8" />
    </svg>
  );
}

function SetupIcon({ color }: { color: string }) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3.2" stroke={color} strokeWidth="1.8" />
      <path
        d="M12 3.5v2.3M12 18.2v2.3M20.5 12h-2.3M5.8 12H3.5M18 6l-1.6 1.6M7.6 16.4L6 18M18 18l-1.6-1.6M7.6 7.6L6 6"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(() => window.innerWidth >= 700);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 700px)");
    const onChange = () => setDesktop(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return desktop;
}
