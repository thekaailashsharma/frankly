export type EventMode = "candid" | "memento";

interface EventModeConfig {
  title: string;
  displayLabel: string; // PosterView shows "KEEPSAKE" for memento, not "MEMENTO"
  blurb: string;
  privacyLine: string;
  suggestedPrompts: string[];
}

/** Ported 1:1 from EventStore.swift's EventMode. */
export const EVENT_MODES: Record<EventMode, EventModeConfig> = {
  candid: {
    title: "Candid",
    displayLabel: "CANDID",
    blurb: "Anonymous. For finding out what to fix.",
    privacyLine: "Anonymous. Your handwriting is kept, your name is not.",
    suggestedPrompts: [
      "What's the one thing we got wrong?",
      "What should we do differently?",
      "What didn't work for you?",
      "Frankly — how was it?",
    ],
  },
  memento: {
    title: "Keepsake",
    displayLabel: "KEEPSAKE",
    blurb: "Signed. For keeping.",
    privacyLine: "Your card becomes part of the event's guestbook.",
    suggestedPrompts: ["Leave a note", "What will you remember?", "Say something to the room", "Sign the wall"],
  },
};
