/**
 * A convenience list only — "events this browser has created or visited,"
 * with NO privilege attached. Deliberately holds no host_token: unlike the
 * old device-based host model, opening an event from this list only ever
 * gets you the same public view anyone with the link gets. Host access
 * now comes exclusively from a URL carrying `?key=...` (see db.ts /
 * EventStore) — the whole point of switching to that model was that a
 * shared device (an iPad passed hand to hand all night) must never grant
 * Setup access just because it happened to be the device sitting at Setup
 * once.
 */

const KEY = "frankly-recent-events";
const MAX = 20;

interface RecentEntry {
  id: string;
  name: string;
  createdAt: number;
}

function readAll(): RecentEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function rememberEvent(id: string, name: string, createdAt: number) {
  const all = readAll().filter((e) => e.id !== id);
  all.unshift({ id, name, createdAt });
  localStorage.setItem(KEY, JSON.stringify(all.slice(0, MAX)));
}

export function recentEventIds(): string[] {
  return readAll().map((e) => e.id);
}
