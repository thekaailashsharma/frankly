import { supabase } from "./supabase";

/**
 * Best-effort — a failed upload never blocks or breaks a submission. The
 * strokes/decorations JSON already saved to the `notes` row is the real
 * record; this PNG is a convenience export (an easy link to drop in
 * Slack, a quick look without opening the app).
 */
export async function uploadNoteSnapshot(eventId: string, noteId: string, dataUrl: string): Promise<string | null> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${eventId}/${noteId}.png`;
    const { error } = await supabase.storage
      .from("note-snapshots")
      .upload(path, blob, { contentType: "image/png", upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("note-snapshots").getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}
