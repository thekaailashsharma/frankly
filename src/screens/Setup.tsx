import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { nanoid } from "nanoid";
import { createEvent } from "../storage/db";
import { setSessionPin } from "../storage/setupSession";
import { useEventStore } from "../store/EventStore";
import { PinGate } from "../components/PinGate";
import { EVENT_MODES, type EventMode } from "../store/EventMode";
import { usePalettePrefs } from "../store/usePalettePrefs";
import { edgeAlignment, type PaletteEdge } from "../components/ToolPill";
import { THEMES, DEFAULT_THEME, type Theme } from "../theme/Theme";
import { themePreviewBackground } from "../theme/themePreview";
import { ThemeBackdrop } from "../theme/ThemeBackdrop";
import { GlassCard } from "../components/GlassCard";
import { primaryOn } from "../theme/surfaceColor";
import { editorial, label as labelFont, micro } from "../tokens/Typography";
import type { Note, Stroke, StrokePoint } from "../ink/types";
import "./Setup.css";

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(q.matches);
    q.addEventListener("change", onChange);
    return () => q.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** A short, deterministic-feeling wave stroke — enough to see a card render
 * with something on it, nothing more. This is a dev/testing convenience,
 * not a feature worth over-building. */
function makeSampleNote(): Note {
  const width = 260;
  const height = 76;
  const n = 22;
  const seed = Math.random() * Math.PI * 2;
  const points: StrokePoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    points.push({
      x: 18 + t * (width - 36),
      y: height / 2 + Math.sin(t * Math.PI * 2.4 + seed) * 20,
      t: i * 24,
      pressure: 0.5 + 0.35 * Math.abs(Math.sin(t * Math.PI * 3 + seed)),
    });
  }
  const stroke: Stroke = { id: nanoid(), points, inkIndex: Math.floor(Math.random() * 3), nib: "marker" };
  return { id: nanoid(), strokes: [stroke], canvasWidth: width, canvasHeight: height, createdAt: Date.now() };
}

/** Debounced text field: local state updates instantly, the persisting
 * commit fires ~500ms after the last keystroke, or immediately on blur —
 * this keeps IndexedDB writes off the hot path of every keystroke while
 * never leaving an edit unsaved if the host navigates away. */
function useDebouncedField(external: string, onCommit: (value: string) => void, delay = 500) {
  const [value, setValue] = useState(external);
  const touched = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!touched.current) setValue(external);
  }, [external]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function change(next: string) {
    touched.current = true;
    setValue(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onCommit(next), delay);
  }

  function flush() {
    window.clearTimeout(timer.current);
    onCommit(value);
  }

  return { value, change, flush };
}

/* ------------------------------------------------------------------ */
/* Entry point — dispatches to create vs. edit. Two separate function   */
/* components (rather than one branching on a hook) so useEventStore   */
/* is only ever called from a tree that actually has the provider.     */
/* ------------------------------------------------------------------ */

export function Setup() {
  const { eventId } = useParams();
  return eventId ? <EditSetup eventId={eventId} /> : <CreateSetup />;
}

/* ------------------------------------------------------------------ */
/* Create mode                                                         */
/* ------------------------------------------------------------------ */

function CreateSetup() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<EventMode>("candid");
  const [themeId, setThemeId] = useState(DEFAULT_THEME.id);
  const [creating, setCreating] = useState(false);

  const theme = useMemo(() => THEMES.find((t) => t.id === themeId) ?? DEFAULT_THEME, [themeId]);
  const canCreate = name.trim().length > 0 && !creating;

  async function handleCreate() {
    if (!canCreate) return;
    setCreating(true);
    try {
      const { event, hostToken } = await createEvent({
        name: name.trim(),
        prompt: prompt.trim() || EVENT_MODES[mode].suggestedPrompts[0],
        mode,
        themeId,
        hostNote: null,
        isClosed: false,
      });
      // Unlocks this tab's session immediately (no PIN prompt right after
      // creating it) and lands on the plain, fixed /setup path — the PIN
      // itself, shown once on the screen this navigates to, is the only
      // thing that ever grants this again.
      setSessionPin(event.id, hostToken);
      navigate(`/event/${event.id}/setup`);
    } catch {
      setCreating(false);
    }
  }

  return (
    <SetupShell theme={theme} calm={0.12} reducedMotion={reducedMotion} eyebrow="NEW EVENT" title={name || "Untitled event"}>
      <NameField value={name} onChange={setName} autoFocus />
      <PromptField
        value={prompt}
        onChange={setPrompt}
        mode={mode}
        onPickSuggestion={(p) => setPrompt(p)}
      />
      <ModePicker mode={mode} onChange={setMode} />
      <ThemePicker themeId={themeId} onChange={setThemeId} />
      <button className="setup__cta" disabled={!canCreate} onClick={handleCreate}>
        {creating ? "Creating…" : "Create event"}
      </button>
      <p className="setup__foot">No account, no login. Everything stays on this device until you choose to share it.</p>
    </SetupShell>
  );
}

/* ------------------------------------------------------------------ */
/* Edit mode                                                           */
/* ------------------------------------------------------------------ */

function EditSetup({ eventId }: { eventId: string }) {
  const store = useEventStore();
  const reducedMotion = useReducedMotion();
  const [seeding, setSeeding] = useState(false);

  const nameField = useDebouncedField(store.name, (v) => void store.setName(v.trim() || "Untitled event"));
  const promptField = useDebouncedField(store.prompt, (v) => void store.setPrompt(v));

  if (store.loading || store.checkingHost) return <div className="screen setup setup--loading" />;

  // The fixed /setup path is always reachable — what gates it is this PIN
  // gate, not the URL. Wrong or no PIN yet just means try again here.
  if (!store.isHost) return <div className="screen setup"><PinGate onUnlock={store.unlockHost} /></div>;

  async function seedSample() {
    setSeeding(true);
    try {
      for (let i = 0; i < 3; i++) {
        await store.submit(makeSampleNote());
      }
    } finally {
      setSeeding(false);
    }
  }

  return (
    <SetupShell
      theme={store.theme}
      calm={store.calm}
      reducedMotion={reducedMotion}
      eyebrow="EVENT SETUP"
      title={nameField.value || "Untitled event"}
      ghostNotes={store.notes}
    >
      <HostLinkBanner pin={store.hostPin} />
      <NameField value={nameField.value} onChange={nameField.change} onBlur={nameField.flush} />
      <PromptField
        value={promptField.value}
        onChange={promptField.change}
        onBlur={promptField.flush}
        mode={store.mode}
        onPickSuggestion={(p) => {
          promptField.change(p);
          void store.setPrompt(p);
        }}
      />
      <ModePicker mode={store.mode} onChange={(m) => void store.setMode(m)} />
      <ThemePicker themeId={store.theme.id} onChange={(id) => void store.setTheme(id)} />
      <StationThemePicker
        themeId={store.stationTheme.id}
        hasOverride={store.hasStationOverride}
        onChange={(id) => void store.setStationTheme(id)}
      />
      <DevicePrefs />

      <Section title="Sample content">
        <p className="setup__hint">Seed a few placeholder notes to test the wall and artifact views.</p>
        <button className="setup__secondary" onClick={seedSample} disabled={seeding}>
          {seeding ? "Adding…" : "Add sample notes"}
        </button>
      </Section>

      <p className="setup__foot">
        {store.count} {store.count === 1 ? "note" : "notes"} collected so far · event id {eventId.slice(0, 8)}
      </p>
    </SetupShell>
  );
}

/** The whole point of dropping device-based host access: the PIN IS the
 * credential, not anything about this device. Shown only inside Setup
 * (i.e. only once the PIN has already checked out), so surfacing it
 * again here isn't a new leak — but it IS the one moment to actually
 * write it down somewhere that isn't the device you're about to hand to
 * guests. Setup itself always lives at the same plain /setup path; only
 * the PIN changes per event. */
function HostLinkBanner({ pin }: { pin: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard permission denied or unavailable — the PIN is still
      // right there to read and remember, so nothing is actually lost.
    }
  }

  return (
    <Section title="Your setup PIN — save this">
      <p className="setup__hint">
        Setup always lives at the same /setup page for this event — this PIN is the only thing that unlocks it.
        Don't leave it typed into the device you're about to hand to guests.
      </p>
      <div className="setup__link-row">
        <input className="setup__input setup__link-input setup__pin-display" value={pin} readOnly onFocus={(e) => e.target.select()} />
        <button className="setup__link-copy" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Shell — the live theme backdrop + glass sheet every mode shares.    */
/* ------------------------------------------------------------------ */

function SetupShell({
  theme,
  calm,
  reducedMotion,
  eyebrow,
  title,
  ghostNotes = [],
  children,
}: {
  theme: Theme;
  calm: number;
  reducedMotion: boolean;
  eyebrow: string;
  title: string;
  ghostNotes?: Note[];
  children: ReactNode;
}) {
  return (
    <div className="screen setup">
      {/* usePhoto was here — a blurred, dark-scrimmed photo read as "just a
       * flat color" next to the vivid animated GeneratedSurface (the
       * marble/contour/bokeh swirl) Artifact already uses for the same
       * themes. Dropping back to the plain surface is what was actually
       * "the amazing moving background." */}
      <ThemeBackdrop
        theme={theme}
        calm={calm}
        reducedMotion={reducedMotion}
        ghostNotes={ghostNotes}
        className="setup__backdrop"
      />
      <div className={`setup__scrim ${theme.isDark ? "setup__scrim--dark" : "setup__scrim--light"}`} />

      <div className="setup__layout">
        <header className="setup__header">
          <p className="setup__eyebrow" style={{ ...micro(11), color: theme.isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)" }}>
            {eyebrow}
          </p>
          <h1
            className="setup__title"
            style={{ ...editorial(34), color: theme.isDark ? "#f5f3ee" : "#1a1a1a" }}
          >
            {title}
          </h1>
        </header>

        <GlassCard theme={theme} forceGlass className="setup__card">
          {(surface) => {
            const ink = primaryOn(surface);
            return (
              <div
                className="setup__card-inner"
                style={{ color: ink, "--setup-surface": surface, "--setup-ink": ink } as CSSProperties}
              >
                {children}
              </div>
            );
          }}
        </GlassCard>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="setup__section">
      <p className="setup__section-title" style={labelFont(13, true)}>
        {title}
      </p>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Fields                                                               */
/* ------------------------------------------------------------------ */

function NameField({
  value,
  onChange,
  onBlur,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  autoFocus?: boolean;
}) {
  return (
    <Section title="Event name">
      <input
        className="setup__input"
        style={labelFont(17)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder="Q3 all-hands"
        autoFocus={autoFocus}
      />
    </Section>
  );
}

function PromptField({
  value,
  onChange,
  onBlur,
  mode,
  onPickSuggestion,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  mode: EventMode;
  onPickSuggestion: (prompt: string) => void;
}) {
  const config = EVENT_MODES[mode];
  return (
    <Section title="Prompt guests will see">
      <input
        className="setup__input"
        style={labelFont(17)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={config.suggestedPrompts[0]}
      />
      <div className="setup__chips">
        {config.suggestedPrompts.map((p) => (
          <button key={p} className="setup__chip" onClick={() => onPickSuggestion(p)}>
            {p}
          </button>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Mode picker                                                         */
/* ------------------------------------------------------------------ */

function ModePicker({ mode, onChange }: { mode: EventMode; onChange: (m: EventMode) => void }) {
  const modes: EventMode[] = ["candid", "memento"];
  return (
    <Section title="Mode">
      <div className="setup__modes">
        {modes.map((m) => {
          const config = EVENT_MODES[m];
          const selected = m === mode;
          return (
            <button
              key={m}
              className={`setup__mode ${selected ? "setup__mode--selected" : ""}`}
              onClick={() => onChange(m)}
              aria-pressed={selected}
            >
              <span className="setup__mode-title" style={labelFont(15, true)}>
                {config.title}
              </span>
              <span className="setup__mode-blurb" style={labelFont(13)}>
                {config.blurb}
              </span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Theme picker — the whole screen's backdrop already IS the live       */
/* preview of whichever theme is selected, so the grid below only      */
/* needs static chips derived from each theme's poster colour.         */
/* ------------------------------------------------------------------ */

function ThemePicker({
  themeId,
  onChange,
  title = "Look",
}: {
  themeId: string;
  onChange: (id: string) => void;
  title?: string;
}) {
  return (
    <Section title={title}>
      <div className="setup__themes">
        {THEMES.map((t) => {
          const selected = t.id === themeId;
          const chipInk = primaryOn(t.poster);
          return (
            <button
              key={t.id}
              className={`setup__theme-chip ${selected ? "setup__theme-chip--selected" : ""}`}
              // A flat theme.poster swatch used to stand in for every
              // theme, including the ones whose real backdrop is a
              // generated gradient (Marble, Contour, Bokeh) — the chip for
              // "Marble" looked like a plain purple square, nothing like
              // what picking it actually produces. This is the same
              // colour parameters GeneratedSurface animates, just static.
              style={{ background: themePreviewBackground(t) }}
              onClick={() => onChange(t.id)}
              aria-pressed={selected}
              aria-label={t.name}
            >
              <span className="setup__theme-chip-label" style={{ ...micro(10), color: chipInk }}>
                {t.name}
              </span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

/** Station's background is independent of the event's main look — a host
 * who wants a calm, plain theme for Poster/Wall but something more alive
 * on the actual writing kiosk (or vice versa) can now say so. "Match main
 * look" clears the override rather than requiring a second, redundant
 * choice for hosts who just want one consistent theme everywhere. */
function StationThemePicker({
  themeId,
  hasOverride,
  onChange,
}: {
  themeId: string;
  hasOverride: boolean;
  onChange: (id: string | null) => void;
}) {
  return (
    <Section title="Station background">
      <div className="setup__themes">
        <button
          className={`setup__theme-chip setup__theme-chip--match ${!hasOverride ? "setup__theme-chip--selected" : ""}`}
          onClick={() => onChange(null)}
          aria-pressed={!hasOverride}
          aria-label="Match main look"
        >
          <span className="setup__theme-chip-label" style={micro(10)}>
            Match look
          </span>
        </button>
        {THEMES.map((t) => {
          const selected = hasOverride && t.id === themeId;
          const chipInk = primaryOn(t.poster);
          return (
            <button
              key={t.id}
              className={`setup__theme-chip ${selected ? "setup__theme-chip--selected" : ""}`}
              style={{ background: themePreviewBackground(t) }}
              onClick={() => onChange(t.id)}
              aria-pressed={selected}
              aria-label={t.name}
            >
              <span className="setup__theme-chip-label" style={{ ...micro(10), color: chipInk }}>
                {t.name}
              </span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Device preferences — palette edge + auto-minimize, device-level.    */
/* ------------------------------------------------------------------ */

const EDGES: PaletteEdge[] = ["top", "leading", "trailing", "bottom"];
const EDGE_LABEL: Record<PaletteEdge, string> = { top: "Top", leading: "Left", trailing: "Right", bottom: "Bottom" };

function DevicePrefs() {
  const { edge, setEdge, autoMinimize, setAutoMinimize } = usePalettePrefs();
  return (
    <Section title="Tool palette">
      <div className="setup__edges">
        {EDGES.map((e) => {
          const align = edgeAlignment(e);
          const frameStyle: CSSProperties = {
            display: "flex",
            justifyContent: align.justify as CSSProperties["justifyContent"],
            alignItems: align.align as CSSProperties["alignItems"],
          };
          const selected = e === edge;
          return (
            <button
              key={e}
              className={`setup__edge ${selected ? "setup__edge--selected" : ""}`}
              onClick={() => setEdge(e)}
              aria-pressed={selected}
              aria-label={EDGE_LABEL[e]}
            >
              <span className="setup__edge-frame" style={frameStyle}>
                <span className="setup__edge-pill" />
              </span>
              <span className="setup__edge-label" style={micro(9)}>
                {EDGE_LABEL[e]}
              </span>
            </button>
          );
        })}
      </div>

      <label className="setup__toggle">
        <span style={labelFont(14)}>Auto-minimize when idle</span>
        <span className={`setup__switch ${autoMinimize ? "setup__switch--on" : ""}`} onClick={() => setAutoMinimize(!autoMinimize)}>
          <span className="setup__switch-knob" />
        </span>
      </label>
    </Section>
  );
}
