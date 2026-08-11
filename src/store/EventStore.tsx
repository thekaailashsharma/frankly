import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import type { Note } from "../ink/types";
import type { Event } from "../storage/db";
import { getEvent, updateEvent, verifyHostKey, saveNote, listNotes } from "../storage/db";
import { getSessionPin, setSessionPin } from "../storage/setupSession";
import type { EventMode } from "./EventMode";
import { themeById, type Theme } from "../theme/Theme";

// Supabase Realtime needs its own publication wired up per-table on the
// project — not something this app can safely assume is on. Polling for
// new notes is the honest, zero-config middle ground: not instant, but
// the Wall genuinely fills in while people are writing, on every project
// without any dashboard step beyond the one schema.sql paste.
const NOTES_POLL_MS = 4000;

interface EventStoreValue {
  loading: boolean;
  event: Event | null;
  theme: Theme;
  /** Station's own look — falls back to `theme` when the host hasn't set
   * an override. Everywhere else (Poster, Wall, Artifact, Setup) reads
   * `theme` directly; only Station reads this one. */
  stationTheme: Theme;
  /** Whether `stationThemeId` is actually set — lets the picker show
   * "Match main look" as genuinely selected rather than just happening to
   * compute the same theme. */
  hasStationOverride: boolean;
  /** True once a valid PIN has been supplied for this event — either via
   * `?key=` (an old-style link) or by typing it into Setup's PinGate,
   * which then remembers it in sessionStorage for the rest of THIS TAB's
   * life only. Never localStorage: closing the tab (the natural thing to
   * do before handing a shared iPad to a guest) forgets it. */
  isHost: boolean;
  /** True only while a candidate PIN (from the URL or the session) is
   * being verified — lets Setup show a neutral loading state instead of
   * flashing "locked" for a real host before the check resolves. */
  checkingHost: boolean;
  /** Setup's PinGate calls this — verifies live, and on success remembers
   * the PIN in sessionStorage so the rest of this tab's visit doesn't ask
   * again. Returns whether it worked, so the gate can show "wrong PIN." */
  unlockHost: (pin: string) => Promise<boolean>;
  /** The PIN that unlocked this session — only meaningful once `isHost` is
   * true. Setup shows it back once so it can be written down; nothing
   * about exposing it here is a new leak since reaching it already
   * required knowing it. */
  hostPin: string;
  notes: Note[];
  hostNote: Note | null;
  isClosed: boolean;
  mode: EventMode;
  name: string;
  prompt: string;
  count: number;
  /** Ramps 0 -> 0.85 as notes go 0 -> 30, then flat — never fully calm by
   * design, so the backdrop never goes dead. Ported from EventStore.calm. */
  calm: number;
  submit: (note: Note) => Promise<void>;
  close: (hostNote: Note | null) => Promise<void>;
  reopen: () => Promise<void>;
  setName: (name: string) => Promise<void>;
  setPrompt: (prompt: string) => Promise<void>;
  setMode: (mode: EventMode) => Promise<void>;
  setTheme: (themeId: string) => Promise<void>;
  /** Pass null to clear the override and go back to matching the main look. */
  setStationTheme: (themeId: string | null) => Promise<void>;
}

const EventStoreContext = createContext<EventStoreValue | null>(null);

export function useEventStore(): EventStoreValue {
  const ctx = useContext(EventStoreContext);
  if (!ctx) throw new Error("useEventStore must be used within EventStoreProvider");
  return ctx;
}

export function EventStoreProvider({ eventId, children }: { eventId: string; children: ReactNode }) {
  const [event, setEvent] = useState<Event | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  // `?key=` still works (an old link, or one shared deliberately) — but
  // the everyday path is typing the fixed /setup URL and entering the PIN
  // there, which lands in sessionStorage instead of the address bar.
  const [pin, setPin] = useState(() => searchParams.get("key") || getSessionPin(eventId) || "");
  const [isHost, setIsHost] = useState(false);
  const [checkingHost, setCheckingHost] = useState(false);
  const eventRef = useRef<Event | null>(null);
  eventRef.current = event;
  const notesRef = useRef<Note[]>([]);
  notesRef.current = notes;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getEvent(eventId), listNotes(eventId)]).then(([e, n]) => {
      if (cancelled) return;
      setEvent(e ?? null);
      setNotes(n);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // Re-derive the candidate PIN whenever the event changes (a fresh
  // eventId might have its own session PIN, or none at all).
  useEffect(() => {
    setPin(searchParams.get("key") || getSessionPin(eventId) || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Verified fresh against Supabase every time the candidate PIN changes
  // — never cached as "true" beyond this, so a tab with no PIN (or a
  // wrong one) never silently inherits host access.
  useEffect(() => {
    if (!pin) {
      setIsHost(false);
      setCheckingHost(false);
      return;
    }
    let cancelled = false;
    setCheckingHost(true);
    verifyHostKey(eventId, pin).then((ok) => {
      if (cancelled) return;
      setIsHost(ok);
      setCheckingHost(false);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId, pin]);

  const unlockHost = useCallback(
    async (candidate: string) => {
      const ok = await verifyHostKey(eventId, candidate);
      if (ok) {
        setSessionPin(eventId, candidate);
        setPin(candidate);
        setIsHost(true);
      }
      return ok;
    },
    [eventId]
  );

  // Poll for new notes from other devices — see NOTES_POLL_MS above.
  useEffect(() => {
    const interval = setInterval(async () => {
      const fresh = await listNotes(eventId).catch(() => null);
      if (!fresh) return;
      const known = new Set(notesRef.current.map((n) => n.id));
      const unseen = fresh.filter((n) => !known.has(n.id));
      if (unseen.length > 0) setNotes((prev) => [...prev, ...unseen]);
    }, NOTES_POLL_MS);
    return () => clearInterval(interval);
  }, [eventId]);

  const persist = useCallback(
    async (patch: Partial<Event>) => {
      const current = eventRef.current;
      if (!current) return;
      const optimistic = { ...current, ...patch };
      setEvent(optimistic);
      try {
        const confirmed = await updateEvent(eventId, patch, pin);
        setEvent(confirmed);
      } catch {
        // Wrong/missing PIN, or the write failed — fall back to whatever
        // the server actually has rather than keeping a change that
        // never really landed.
        setEvent(current);
      }
    },
    [eventId, pin]
  );

  const submit = useCallback(
    async (note: Note) => {
      // `.every()` on an empty strokes array is vacuously true, which used
      // to reject a note that was, say, just a heart sticker and no ink —
      // a real thing now that decorations don't require any handwriting.
      const hasInk = note.strokes.some((s) => s.points.length >= 2);
      const hasDecoration = (note.decorations?.length ?? 0) > 0;
      if (!hasInk && !hasDecoration) return;
      setNotes((prev) => [...prev, note]);
      await saveNote(eventId, note);
    },
    [eventId]
  );

  const close = useCallback((hostNote: Note | null) => persist({ hostNote, isClosed: true }), [persist]);
  const reopen = useCallback(() => persist({ hostNote: null, isClosed: false }), [persist]);
  const setName = useCallback((name: string) => persist({ name }), [persist]);
  const setPrompt = useCallback((prompt: string) => persist({ prompt }), [persist]);
  const setMode = useCallback((mode: EventMode) => persist({ mode }), [persist]);
  const setTheme = useCallback((themeId: string) => persist({ themeId }), [persist]);
  const setStationTheme = useCallback(
    (themeId: string | null) => persist({ stationThemeId: themeId ?? undefined }),
    [persist]
  );

  const value = useMemo<EventStoreValue>(() => {
    const count = notes.length;
    const calm = Math.min(1, count / 30) * 0.85;
    return {
      loading,
      event,
      theme: event ? themeById(event.themeId) : themeById(""),
      stationTheme: event ? themeById(event.stationThemeId ?? event.themeId) : themeById(""),
      hasStationOverride: !!event?.stationThemeId,
      isHost,
      checkingHost,
      unlockHost,
      hostPin: pin,
      notes,
      hostNote: event?.hostNote ?? null,
      isClosed: event?.isClosed ?? false,
      mode: event?.mode ?? "candid",
      name: event?.name ?? "",
      prompt: event?.prompt ?? "",
      count,
      calm,
      submit,
      close,
      reopen,
      setName,
      setPrompt,
      setMode,
      setTheme,
      setStationTheme,
    };
  }, [
    loading,
    event,
    notes,
    isHost,
    checkingHost,
    unlockHost,
    pin,
    submit,
    close,
    reopen,
    setName,
    setPrompt,
    setMode,
    setTheme,
    setStationTheme,
  ]);

  return <EventStoreContext.Provider value={value}>{children}</EventStoreContext.Provider>;
}
