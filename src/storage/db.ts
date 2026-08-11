import { nanoid } from "nanoid";
import { supabase } from "../lib/supabase";
import { rememberEvent, recentEventIds } from "./recentEvents";
import type { Note } from "../ink/types";
import type { EventMode } from "../store/EventMode";

export interface Event {
  id: string;
  name: string;
  prompt: string;
  mode: EventMode;
  themeId: string;
  /** Station's own look, independent of `themeId` (which drives Poster,
   * Wall, Artifact, Setup). Undefined means "match the main look" — most
   * hosts want one consistent theme, so this only exists to override it,
   * never to require a second choice up front. */
  stationThemeId?: string;
  hostNote: Note | null;
  isClosed: boolean;
  createdAt: number;
  closedAt?: number;
}

export interface SignatureRecord {
  deviceId: string;
  note: Note;
  createdAt: number;
}

/**
 * Everything here now lives in Supabase (Postgres + Storage), not
 * IndexedDB — this app used to be purely local-first, which meant an
 * attendee's feedback only ever existed on their own phone. A host on a
 * different device could never see it. Supabase is the actual shared
 * record now; IndexedDB is gone from this file entirely except for
 * device-local things (a signature, "have I been asked yet") that were
 * never meant to sync.
 *
 * `host_token` is the only access control this app has — no login, no
 * accounts. It's generated client-side at creation and handed back to
 * the caller EXACTLY ONCE, in `createEvent`'s return value — there is no
 * "remember this device" step, on purpose. An event created on a shared
 * iPad that then gets handed to fifty attendees must not leave Setup
 * open to whoever's holding it next; the only way in afterward is the
 * `?key=...` link the host was given at creation and is responsible for
 * saving somewhere that isn't the shared device. Every column list here
 * is explicit for exactly that reason: `select('*')` would hand
 * host_token to whoever loads the Poster page.
 */
const EVENT_COLUMNS = "id,name,prompt,mode,theme_id,station_theme_id,host_note,is_closed,created_at,closed_at";

interface EventRow {
  id: string;
  name: string;
  prompt: string;
  mode: EventMode;
  theme_id: string;
  station_theme_id: string | null;
  host_note: Note | null;
  is_closed: boolean;
  created_at: string;
  closed_at: string | null;
}

function rowToEvent(row: EventRow): Event {
  return {
    id: row.id,
    name: row.name,
    prompt: row.prompt,
    mode: row.mode,
    themeId: row.theme_id,
    stationThemeId: row.station_theme_id ?? undefined,
    hostNote: row.host_note,
    isClosed: row.is_closed,
    createdAt: Date.parse(row.created_at),
    closedAt: row.closed_at ? Date.parse(row.closed_at) : undefined,
  };
}

export type NewEvent = Omit<Event, "id" | "createdAt" | "closedAt">;

/** A 6-digit PIN, not a long random token — this is meant to be
 * remembered and typed at a plain, fixed `/setup` path, not copy-pasted
 * from a link. ~1 in a million per guess, no rate-limiting on top of it:
 * genuinely weaker than the old 24-char token, and a deliberate trade —
 * "simple enough to type on an iPad" was the explicit ask. */
function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** The only place a host_token is ever minted, and the only time it's
 * ever handed back to the caller — nothing here writes it to storage.
 * The caller (Setup.tsx) shows this PIN once, right after creation. */
export async function createEvent(input: NewEvent): Promise<{ event: Event; hostToken: string }> {
  const id = nanoid();
  const hostToken = generatePin();
  const { data, error } = await supabase
    .from("events")
    .insert({
      id,
      name: input.name,
      prompt: input.prompt,
      mode: input.mode,
      theme_id: input.themeId,
      station_theme_id: input.stationThemeId ?? null,
      host_note: input.hostNote,
      is_closed: input.isClosed,
      host_token: hostToken,
    })
    .select(EVENT_COLUMNS)
    .single();
  if (error) throw error;
  const event = rowToEvent(data as EventRow);
  rememberEvent(event.id, event.name, event.createdAt);
  return { event, hostToken };
}

export async function getEvent(id: string): Promise<Event | undefined> {
  const { data, error } = await supabase.from("events").select(EVENT_COLUMNS).eq("id", id).maybeSingle();
  if (error || !data) return undefined;
  return rowToEvent(data as EventRow);
}

/** True only if `key` actually matches this event's host_token — checked
 * via a scoped query rather than ever selecting host_token back, so a
 * wrong guess reveals nothing (an empty result either way). This is what
 * a page carrying `?key=...` calls once, live, to decide whether to grant
 * host access for that page view — never cached, never remembered. */
export async function verifyHostKey(id: string, key: string): Promise<boolean> {
  if (!key) return false;
  const { data } = await supabase.from("events").select("id").eq("id", id).eq("host_token", key).maybeSingle();
  return !!data;
}

/** `token` must be the real host_token, supplied by whoever is holding
 * the `?key=...` link — there's no other way to authorize a write. Wrong
 * or missing token matches zero rows and throws rather than no-op-ing
 * silently. */
export async function updateEvent(id: string, patch: Partial<Event>, token: string): Promise<Event> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.prompt !== undefined) update.prompt = patch.prompt;
  if (patch.mode !== undefined) update.mode = patch.mode;
  if (patch.themeId !== undefined) update.theme_id = patch.themeId;
  if ("stationThemeId" in patch) update.station_theme_id = patch.stationThemeId ?? null;
  if (patch.hostNote !== undefined) update.host_note = patch.hostNote;
  if (patch.isClosed !== undefined) update.is_closed = patch.isClosed;
  if ("closedAt" in patch) update.closed_at = patch.closedAt ? new Date(patch.closedAt).toISOString() : null;

  const { data, error } = await supabase
    .from("events")
    .update(update)
    .eq("id", id)
    .eq("host_token", token)
    .select(EVENT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Update rejected — host key missing or wrong.");
  return rowToEvent(data as EventRow);
}

/** Not a global directory — this only ever fetches events THIS browser
 * has created or opened before (see ../storage/recentEvents), which
 * carries no privilege at all, just a convenience shortcut back to the
 * public view of each one. */
export async function listEvents(): Promise<Event[]> {
  const ids = recentEventIds();
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("events").select(EVENT_COLUMNS).in("id", ids);
  if (error || !data) return [];
  const byId = new Map((data as EventRow[]).map((row) => [row.id, rowToEvent(row)]));
  return ids.map((id) => byId.get(id)).filter((e): e is Event => e != null);
}

interface NoteRow {
  id: string;
  event_id: string;
  strokes: Note["strokes"];
  decorations: Note["decorations"] | null;
  canvas_width: number;
  canvas_height: number;
  author_name: string | null;
  author_email: string | null;
  png_url: string | null;
  created_at: string;
}

function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    strokes: row.strokes,
    decorations: row.decorations ?? undefined,
    canvasWidth: row.canvas_width,
    canvasHeight: row.canvas_height,
    authorName: row.author_name ?? undefined,
    authorEmail: row.author_email ?? undefined,
    pngUrl: row.png_url ?? undefined,
    createdAt: Date.parse(row.created_at),
  };
}

export async function saveNote(eventId: string, note: Note) {
  const { error } = await supabase.from("notes").insert({
    id: note.id,
    event_id: eventId,
    strokes: note.strokes,
    decorations: note.decorations ?? null,
    canvas_width: note.canvasWidth,
    canvas_height: note.canvasHeight,
    author_name: note.authorName ?? null,
    author_email: note.authorEmail ?? null,
    png_url: note.pngUrl ?? null,
  });
  if (error) throw error;
}

export async function listNotes(eventId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("id,event_id,strokes,decorations,canvas_width,canvas_height,author_name,author_email,png_url,created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as NoteRow[]).map(rowToNote);
}

const DEVICE_ID_KEY = "frankly-device-id";

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// Signature stays device-local — it's a convenience for THIS device's
// pen, not event data, and there's nothing to gain by syncing it.
const SIGNATURE_KEY_PREFIX = "frankly-signature:";

export async function getSignature(): Promise<SignatureRecord | undefined> {
  const raw = localStorage.getItem(SIGNATURE_KEY_PREFIX + getDeviceId());
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export async function saveSignature(note: Note) {
  markSignatureAsked();
  const record: SignatureRecord = { deviceId: getDeviceId(), note, createdAt: Date.now() };
  localStorage.setItem(SIGNATURE_KEY_PREFIX + getDeviceId(), JSON.stringify(record));
}

const SIGNATURE_ASKED_KEY = "signature.asked";

/** Shown once per device, ever — skipping counts the same as answering. */
export function hasAskedSignature(): boolean {
  return localStorage.getItem(SIGNATURE_ASKED_KEY) === "1";
}

export function markSignatureAsked() {
  localStorage.setItem(SIGNATURE_ASKED_KEY, "1");
}
