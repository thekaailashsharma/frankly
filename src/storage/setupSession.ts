/**
 * The PIN a browser TAB has unlocked Setup with, for a given event —
 * sessionStorage, not localStorage, on purpose. It survives switching
 * screens while actively setting up (so re-entering the PIN on every tap
 * isn't necessary), but is gone the moment the tab or window closes. On a
 * shared iPad, closing the browser before handing it over is a far lower
 * bar than "remember to manually clear something" — this makes that the
 * natural, already-happening reset point instead of an extra step.
 */

function key(eventId: string): string {
  return `frankly-setup-pin:${eventId}`;
}

export function getSessionPin(eventId: string): string | null {
  try {
    return sessionStorage.getItem(key(eventId));
  } catch {
    return null;
  }
}

export function setSessionPin(eventId: string, pin: string) {
  try {
    sessionStorage.setItem(key(eventId), pin);
  } catch {
    // Private browsing with storage disabled, or similar — Setup just
    // asks for the PIN again next screen, which is a worse experience,
    // not a broken one.
  }
}

export function clearSessionPin(eventId: string) {
  try {
    sessionStorage.removeItem(key(eventId));
  } catch {
    // Nothing to do — see above.
  }
}
